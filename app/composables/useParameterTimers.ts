export type ParameterTimerState = {
  parameter: string
  endsAt: number
  durationMs: number
  oneSignalMessageId: string | null
}

const STORAGE_KEY = 'tanklog.parameterTimers.v1'

function loadPersisted(): Record<string, ParameterTimerState> {
  if (!import.meta.client) return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ParameterTimerState>
    const now = Date.now()
    const next: Record<string, ParameterTimerState> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value?.endsAt && value.endsAt > now) next[key] = value
    }
    return next
  } catch {
    return {}
  }
}

function persist(map: Record<string, ParameterTimerState>) {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function playBeep() {
  if (!import.meta.client) return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7)
    osc.stop(ctx.currentTime + 0.75)
    void ctx.resume()
    window.setTimeout(() => void ctx.close(), 1000)
  } catch {
    // ignore
  }
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useParameterTimers() {
  const timers = useState<Record<string, ParameterTimerState>>('tanklog.parameterTimers', () => ({}))
  const nowMs = useState<number>('tanklog.parameterTimers.now', () => Date.now())
  const hydrated = useState<boolean>('tanklog.parameterTimers.hydrated', () => false)
  const tickId = useState<number | null>('tanklog.parameterTimers.tickId', () => null)

  const { t } = useI18n()
  const toast = useToast()
  const notifications = useNotifications()
  const notifyPrefs = useNotificationPrefs()
  const oneSignalConfig = useOneSignalConfig()
  const oneSignalApi = useOneSignalApi()
  const oneSignal = useOneSignal()
  const auth = useAuth()

  function hydrate() {
    if (!import.meta.client || hydrated.value) return
    timers.value = loadPersisted()
    hydrated.value = true
    ensureTick()
  }

  function save() {
    persist(timers.value)
  }

  function ensureTick() {
    if (!import.meta.client) return
    if (tickId.value != null) return
    if (!Object.keys(timers.value).length) return
    tickId.value = window.setInterval(() => {
      nowMs.value = Date.now()
      const finished: ParameterTimerState[] = []
      const next: Record<string, ParameterTimerState> = {}
      for (const [key, timer] of Object.entries(timers.value)) {
        if (timer.endsAt <= nowMs.value) finished.push(timer)
        else next[key] = timer
      }
      if (finished.length) {
        timers.value = next
        save()
        for (const timer of finished) void onComplete(timer)
      }
      if (!Object.keys(timers.value).length && tickId.value != null) {
        clearInterval(tickId.value)
        tickId.value = null
      }
    }, 1000) as unknown as number
  }

  async function schedulePush(parameter: string, endsAt: number): Promise<string | null> {
    if (!oneSignalConfig.canSchedule.value) return null
    const externalId = auth.user.value?.id
    if (!externalId || !oneSignalConfig.appId.value || !oneSignalConfig.proxyUrl.value) return null
    try {
      if (oneSignal.isInitialized.value) {
        await oneSignal.login(externalId).catch(() => undefined)
      }
      const sendAfter = notifyPrefs.clampOutsideQuiet(new Date(endsAt))
      if (sendAfter.getTime() <= Date.now()) return null
      const result = await oneSignalApi.schedulePushMessage({
        appId: oneSignalConfig.appId.value,
        proxyUrl: oneSignalConfig.proxyUrl.value,
        proxyKey: oneSignalConfig.proxyKey.value,
        externalId,
        title: t('app.name'),
        body: t('waterTests.timer.readyBody', { parameter }),
        sendAfter: sendAfter.toISOString(),
        url: window.location.href,
        idempotencyKey: `param-timer:${parameter}:${endsAt}`
      })
      return result.messageId
    } catch {
      return null
    }
  }

  async function onComplete(timer: ParameterTimerState) {
    playBeep()
    toast.add({
      title: t('waterTests.timer.readyTitle', { parameter: timer.parameter }),
      description: t('waterTests.timer.readyBody', { parameter: timer.parameter }),
      color: 'success',
      icon: 'i-lucide-alarm-clock'
    })
    if (!notifyPrefs.isQuietNow()) {
      notifications.notify(
        t('waterTests.timer.readyTitle', { parameter: timer.parameter }),
        { body: t('waterTests.timer.readyBody', { parameter: timer.parameter }) }
      )
    }
  }

  async function start(parameter: string, durationMinutes: number) {
    hydrate()
    const durationMs = Math.round(durationMinutes * 60_000)
    if (!Number.isFinite(durationMs) || durationMs < 15_000) {
      throw new Error(t('waterTests.timer.invalidDuration'))
    }
    const existing = timers.value[parameter]
    if (existing?.oneSignalMessageId) {
      await cancelPush(existing.oneSignalMessageId)
    }
    const endsAt = Date.now() + durationMs
    const oneSignalMessageId = await schedulePush(parameter, endsAt)
    timers.value = {
      ...timers.value,
      [parameter]: { parameter, endsAt, durationMs, oneSignalMessageId }
    }
    save()
    ensureTick()
  }

  async function cancelPush(messageId: string | null) {
    if (!messageId || !oneSignalConfig.appId.value || !oneSignalConfig.proxyUrl.value) return
    try {
      await oneSignalApi.cancelPushMessage({
        appId: oneSignalConfig.appId.value,
        proxyUrl: oneSignalConfig.proxyUrl.value,
        proxyKey: oneSignalConfig.proxyKey.value,
        messageId
      })
    } catch {
      // best effort
    }
  }

  async function stop(parameter: string) {
    hydrate()
    const existing = timers.value[parameter]
    if (!existing) return
    await cancelPush(existing.oneSignalMessageId)
    const { [parameter]: _removed, ...next } = timers.value
    timers.value = next
    save()
  }

  function remainingLabel(parameter: string): string | null {
    hydrate()
    const timer = timers.value[parameter]
    if (!timer) return null
    return formatRemaining(timer.endsAt - nowMs.value)
  }

  function isRunning(parameter: string): boolean {
    hydrate()
    return Boolean(timers.value[parameter])
  }

  if (import.meta.client) hydrate()

  return {
    timers,
    start,
    stop,
    remainingLabel,
    isRunning,
    hydrate
  }
}
