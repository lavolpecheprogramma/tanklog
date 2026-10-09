const APP_ID_KEY = 'tanklog.onesignal.appId.v1'
const PROXY_URL_KEY = 'tanklog.onesignal.proxyUrl.v1'
const PROXY_KEY_KEY = 'tanklog.onesignal.proxyKey.v1'
const ENABLED_KEY = 'tanklog.onesignal.enabled.v1'

export function normalizeOneSignalAppId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    return null
  }
  return normalized
}

export function normalizeOneSignalProxyUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function normalizeOneSignalProxyKey(input: string): string | null {
  const trimmed = input.trim()
  return trimmed || null
}

function readString(key: string): string | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(key)
    return raw?.trim() ? raw : null
  } catch {
    return null
  }
}

function writeString(key: string, value: string | null) {
  if (!import.meta.client) return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

function readEnabled(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeEnabled(value: boolean) {
  if (!import.meta.client) return
  if (value) localStorage.setItem(ENABLED_KEY, '1')
  else localStorage.removeItem(ENABLED_KEY)
}

export function useOneSignalConfig() {
  const appId = useState<string | null>('tanklog.onesignal.appId', () => null)
  const proxyUrl = useState<string | null>('tanklog.onesignal.proxyUrl', () => null)
  const proxyKey = useState<string | null>('tanklog.onesignal.proxyKey', () => null)
  const enabled = useState<boolean>('tanklog.onesignal.enabled', () => false)
  const hydrated = useState<boolean>('tanklog.onesignal.hydrated', () => false)

  function hydrateFromStorage() {
    if (!import.meta.client || hydrated.value) return
    const storedAppId = readString(APP_ID_KEY)
    appId.value = storedAppId ? normalizeOneSignalAppId(storedAppId) : null
    const storedProxyUrl = readString(PROXY_URL_KEY)
    proxyUrl.value = storedProxyUrl ? normalizeOneSignalProxyUrl(storedProxyUrl) : null
    const storedProxyKey = readString(PROXY_KEY_KEY)
    proxyKey.value = storedProxyKey ? normalizeOneSignalProxyKey(storedProxyKey) : null
    enabled.value = readEnabled()
    hydrated.value = true
  }

  if (import.meta.client && !hydrated.value) {
    hydrateFromStorage()
  }

  const isEnabled = computed(() => Boolean(enabled.value && appId.value))
  const hasSchedulingProxy = computed(() => Boolean(appId.value && proxyUrl.value))
  const canSchedule = computed(() => Boolean(isEnabled.value && proxyUrl.value))

  function setAppIdFromInput(input: string): string | null {
    const normalized = normalizeOneSignalAppId(input)
    appId.value = normalized
    writeString(APP_ID_KEY, normalized)
    return normalized
  }

  function setProxyUrlFromInput(input: string): string | null {
    const normalized = normalizeOneSignalProxyUrl(input)
    proxyUrl.value = normalized
    writeString(PROXY_URL_KEY, normalized)
    return normalized
  }

  function setProxyKeyFromInput(input: string): string | null {
    const normalized = normalizeOneSignalProxyKey(input)
    proxyKey.value = normalized
    writeString(PROXY_KEY_KEY, normalized)
    return normalized
  }

  function clearProxyUrl() {
    proxyUrl.value = null
    writeString(PROXY_URL_KEY, null)
  }

  function clearProxyKey() {
    proxyKey.value = null
    writeString(PROXY_KEY_KEY, null)
  }

  function setEnabled(next: boolean) {
    enabled.value = Boolean(next)
    writeEnabled(enabled.value)
  }

  function clearConfig() {
    appId.value = null
    proxyUrl.value = null
    proxyKey.value = null
    enabled.value = false
    writeString(APP_ID_KEY, null)
    writeString(PROXY_URL_KEY, null)
    writeString(PROXY_KEY_KEY, null)
    writeEnabled(false)
  }

  return {
    appId,
    proxyUrl,
    proxyKey,
    enabled,
    isEnabled,
    hasSchedulingProxy,
    canSchedule,
    hydrateFromStorage,
    setAppIdFromInput,
    setProxyUrlFromInput,
    setProxyKeyFromInput,
    clearProxyUrl,
    clearProxyKey,
    setEnabled,
    clearConfig
  }
}
