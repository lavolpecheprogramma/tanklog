const QUIET_ENABLED_KEY = 'tanklog.notify.quietEnabled.v1'
const QUIET_START_KEY = 'tanklog.notify.quietStart.v1'
const QUIET_END_KEY = 'tanklog.notify.quietEnd.v1'

const DEFAULT_START = '22:00'
const DEFAULT_END = '08:00'

function readString(key: string, fallback: string | null = null): string | null {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw?.trim() ? raw.trim() : fallback
  } catch {
    return fallback
  }
}

function writeString(key: string, value: string | null) {
  if (!import.meta.client) return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

function readBool(key: string): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeBool(key: string, value: boolean) {
  if (!import.meta.client) return
  if (value) localStorage.setItem(key, '1')
  else localStorage.removeItem(key)
}

/** Parse HH:mm to minutes from midnight. */
export function parseHm(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Quiet window may wrap midnight (e.g. 22:00–08:00).
 */
export function isInQuietWindow(now: Date, startHm: string, endHm: string): boolean {
  const start = parseHm(startHm)
  const end = parseHm(endHm)
  if (start === null || end === null) return false
  const mins = now.getHours() * 60 + now.getMinutes()
  if (start === end) return false
  if (start < end) return mins >= start && mins < end
  return mins >= start || mins < end
}

/** Next Date when quiet hours end, at or after `from`. */
export function nextQuietEnd(from: Date, startHm: string, endHm: string): Date {
  const endMins = parseHm(endHm)
  if (endMins === null) return from
  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0)
  if (candidate.getTime() <= from.getTime()) {
    candidate.setDate(candidate.getDate() + 1)
  }
  // If still inside quiet (wrap case), advance until outside
  let guard = 0
  while (isInQuietWindow(candidate, startHm, endHm) && guard < 3) {
    candidate.setDate(candidate.getDate() + 1)
    guard += 1
  }
  return candidate
}

export function useNotificationPrefs() {
  const quietEnabled = useState<boolean>('tanklog.notify.quietEnabled', () => false)
  const quietStart = useState<string>('tanklog.notify.quietStart', () => DEFAULT_START)
  const quietEnd = useState<string>('tanklog.notify.quietEnd', () => DEFAULT_END)
  const hydrated = useState<boolean>('tanklog.notify.hydrated', () => false)

  function hydrateFromStorage() {
    if (!import.meta.client || hydrated.value) return
    quietEnabled.value = readBool(QUIET_ENABLED_KEY)
    quietStart.value = readString(QUIET_START_KEY, DEFAULT_START) ?? DEFAULT_START
    quietEnd.value = readString(QUIET_END_KEY, DEFAULT_END) ?? DEFAULT_END
    hydrated.value = true
  }

  function setQuietEnabled(value: boolean) {
    hydrateFromStorage()
    quietEnabled.value = value
    writeBool(QUIET_ENABLED_KEY, value)
  }

  function setQuietWindow(start: string, end: string) {
    hydrateFromStorage()
    if (parseHm(start) === null || parseHm(end) === null) {
      throw new Error('Invalid quiet hours')
    }
    quietStart.value = start
    quietEnd.value = end
    writeString(QUIET_START_KEY, start)
    writeString(QUIET_END_KEY, end)
  }

  function isQuietNow(at: Date = new Date()): boolean {
    hydrateFromStorage()
    if (!quietEnabled.value) return false
    return isInQuietWindow(at, quietStart.value, quietEnd.value)
  }

  /** If `when` falls in quiet hours, return quiet-end; else return `when`. */
  function clampOutsideQuiet(when: Date): Date {
    hydrateFromStorage()
    if (!quietEnabled.value) return when
    if (!isInQuietWindow(when, quietStart.value, quietEnd.value)) return when
    return nextQuietEnd(when, quietStart.value, quietEnd.value)
  }

  if (import.meta.client) hydrateFromStorage()

  return {
    quietEnabled,
    quietStart,
    quietEnd,
    hydrateFromStorage,
    setQuietEnabled,
    setQuietWindow,
    isQuietNow,
    clampOutsideQuiet
  }
}
