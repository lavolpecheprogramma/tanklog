import { toOffsetIsoString } from '~/utils/datetime'

export type ParameterTimerState = {
  parameter: string
  endsAt: number
  durationMs: number
  oneSignalMessageId: string | null
}

const STORAGE_KEY = 'tanklog.parameterTimers.v1'
/** Keep ringing until stop or this cap (toast stays for the same window). */
const ALARM_MAX_MS = 45_000

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

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (!import.meta.client) return null
  return window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    || null
}

let sharedAudioCtx: AudioContext | null = null

async function ensureAudioContext(): Promise<AudioContext | null> {
  const Ctx = getAudioContextCtor()
  if (!Ctx) return null
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctx()
    }
    if (sharedAudioCtx.state === 'suspended') {
      await sharedAudioCtx.resume()
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

function playTone(ctx: AudioContext, frequency: number, durationSec: number, when = 0) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  gain.gain.value = 0.0001
  osc.connect(gain)
  gain.connect(ctx.destination)
  const startAt = ctx.currentTime + when
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.07, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)
  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.02)
}

type AlarmController = {
  stop: () => void
}

let activeAlarm: AlarmController | null = null

function stopAlarmAudio() {
  const current = activeAlarm
  activeAlarm = null
  current?.stop()
}

async function startAlarmLoop(onAutoStop?: () => void): Promise<boolean> {
  if (!import.meta.client) return false
  stopAlarmAudio()

  const maybeCtx = await ensureAudioContext()
  if (!maybeCtx) return false
  const ctx: AudioContext = maybeCtx

  let stopped = false
  let pulseTimer: number | null = null
  let maxTimer: number | null = null

  function stop() {
    if (stopped) return
    stopped = true
    if (pulseTimer != null) window.clearTimeout(pulseTimer)
    if (maxTimer != null) window.clearTimeout(maxTimer)
    pulseTimer = null
    maxTimer = null
  }

  function pulse() {
    if (stopped) return
    try {
      if (ctx.state === 'suspended') void ctx.resume()
      playTone(ctx, 880, 0.16, 0)
      playTone(ctx, 660, 0.16, 0.2)
    } catch {
      // ignore
    }
    pulseTimer = window.setTimeout(pulse, 850) as unknown as number
  }

  activeAlarm = { stop }
  maxTimer = window.setTimeout(() => {
    stopAlarmAudio()
    onAutoStop?.()
  }, ALARM_MAX_MS) as unknown as number

  try {
    await ctx.resume()
  } catch {
    // ignore
  }
  pulse()
  return true
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
  const alarming = useState<boolean>('tanklog.parameterTimers.alarming', () => false)
  const alarmToastId = useState<string | number | null>('tanklog.parameterTimers.alarmToastId', () => null)

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

  function stopAlarm(options: { removeToast?: boolean } = {}) {
    const { removeToast = true } = options
    stopAlarmAudio()
    alarming.value = false
    if (removeToast && alarmToastId.value != null) {
      const id = alarmToastId.value
      alarmToastId.value = null
      toast.remove(id)
    } else if (!removeToast) {
      alarmToastId.value = null
    }
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
        sendAfter: toOffsetIsoString(sendAfter),
        url: window.location.href,
        idempotencyKey: `param-timer:${parameter}:${endsAt}`
      })
      return result.messageId
    } catch {
      return null
    }
  }

  async function onComplete(timer: ParameterTimerState) {
    const quiet = notifyPrefs.isQuietNow()
    const ring = !quiet && await startAlarmLoop(() => {
      stopAlarm()
    })
    alarming.value = ring

    if (ring) {
      // Replace previous alarm toast if another timer finished while ringing.
      if (alarmToastId.value != null) toast.remove(alarmToastId.value)
      const added = toast.add({
        title: t('waterTests.timer.readyTitle', { parameter: timer.parameter }),
        description: t('waterTests.timer.readyBody', { parameter: timer.parameter }),
        color: 'warning',
        icon: 'i-lucide-alarm-clock',
        duration: ALARM_MAX_MS,
        actions: [{
          label: t('waterTests.timer.stopAlarm'),
          color: 'neutral',
          variant: 'solid',
          icon: 'i-lucide-volume-x',
          onClick: () => {
            stopAlarm()
          }
        }],
        'onUpdate:open': (open: boolean) => {
          if (!open) stopAlarm({ removeToast: false })
        }
      })
      alarmToastId.value = added.id
    } else {
      toast.add({
        title: t('waterTests.timer.readyTitle', { parameter: timer.parameter }),
        description: t('waterTests.timer.readyBody', { parameter: timer.parameter }),
        color: 'success',
        icon: 'i-lucide-alarm-clock'
      })
    }

    if (!quiet) {
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
    // Unlock audio during the user gesture so the later alarm can play.
    await ensureAudioContext()
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
    stopAlarm,
    remainingLabel,
    isRunning,
    alarming,
    hydrate
  }
}
