import { computed, readonly, watchEffect } from "vue"
import { useLocalStorage } from "@vueuse/core"

const STORAGE_KEY = "tanklog.drive.rootFolderId.v1"
const GOOGLE_CLIENT_ID_STORAGE_KEY = "tanklog.google.clientId.v1"
const ONESIGNAL_APP_ID_STORAGE_KEY = "tanklog.onesignal.appId.v1"
const ONESIGNAL_API_KEY_STORAGE_KEY = "tanklog.onesignal.apiKey.v1"
const ONESIGNAL_PROXY_URL_STORAGE_KEY = "tanklog.onesignal.proxyUrl.v1"
const ONESIGNAL_PROXY_KEY_STORAGE_KEY = "tanklog.onesignal.proxyKey.v1"
const ONESIGNAL_ENABLED_STORAGE_KEY = "tanklog.onesignal.enabled.v1"

export function normalizeDriveFolderId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/)
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/)
  const candidate = foldersMatch?.[1] ?? queryMatch?.[1] ?? trimmed

  if (!/^[a-zA-Z0-9-_]+$/.test(candidate)) return null
  return candidate
}

export function normalizeGoogleClientId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed
}

export function normalizeOneSignalAppId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  // UUID v4-ish validation (OneSignal App IDs are UUID v4 format).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) return null
  return normalized
}

export function normalizeOneSignalApiKey(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Users might paste the full header value like "Key xxxxx". Store just the token.
  return trimmed.replace(/^key\s+/i, "").trim() || null
}

export function normalizeOneSignalProxyUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    // Store without trailing slashes for stable comparisons / joining.
    return url.toString().replace(/\/+$/, "")
  } catch {
    return null
  }
}

export function normalizeOneSignalProxyKey(input: string): string | null {
  const trimmed = input.trim()
  return trimmed ? trimmed : null
}

export function useTankLogRootFolderId() {
  const stored = useLocalStorage<string | null>(STORAGE_KEY, null, { writeDefaults: false })

  watchEffect(() => {
    const raw = stored.value
    if (!raw) return

    const normalized = normalizeDriveFolderId(raw)
    if (!normalized) {
      stored.value = null
      return
    }

    if (normalized !== raw) stored.value = normalized
  })

  const rootFolderId = computed<string | null>(() => stored.value || null)
  const hasRootFolderId = computed(() => Boolean(rootFolderId.value))

  function hydrateFromStorage() {
    // Backward-compatible no-op: VueUse already hydrates from localStorage.
  }

  function setRootFolderId(next: string | null) {
    const normalized = next ? normalizeDriveFolderId(next) : null
    stored.value = normalized
  }

  function setRootFolderIdFromInput(input: string) {
    setRootFolderId(input)
    return rootFolderId.value
  }

  function clearRootFolderId() {
    setRootFolderId(null)
  }

  return {
    rootFolderId: readonly(rootFolderId),
    hasRootFolderId,
    hydrateFromStorage,
    setRootFolderId,
    setRootFolderIdFromInput,
    clearRootFolderId,
  }
}

export function useTankLogGoogleClientId() {
  const stored = useLocalStorage<string | null>(GOOGLE_CLIENT_ID_STORAGE_KEY, null, { writeDefaults: false })

  watchEffect(() => {
    const raw = stored.value
    if (!raw) return

    const normalized = normalizeGoogleClientId(raw)
    if (!normalized) {
      stored.value = null
      return
    }

    if (normalized !== raw) stored.value = normalized
  })

  const googleClientId = computed<string | null>(() => stored.value || null)
  const hasGoogleClientId = computed(() => Boolean(googleClientId.value))

  function hydrateFromStorage() {
    // Backward-compatible no-op: VueUse already hydrates from localStorage.
  }

  function setGoogleClientId(next: string | null) {
    const normalized = next ? normalizeGoogleClientId(next) : null
    stored.value = normalized
  }

  function setGoogleClientIdFromInput(input: string) {
    setGoogleClientId(input)
    return googleClientId.value
  }

  function clearGoogleClientId() {
    setGoogleClientId(null)
  }

  return {
    googleClientId: readonly(googleClientId),
    hasGoogleClientId,
    hydrateFromStorage,
    setGoogleClientId,
    setGoogleClientIdFromInput,
    clearGoogleClientId,
  }
}

export function useTankLogOneSignalConfig() {
  const storedAppId = useLocalStorage<string | null>(ONESIGNAL_APP_ID_STORAGE_KEY, null, { writeDefaults: false })
  const storedApiKey = useLocalStorage<string | null>(ONESIGNAL_API_KEY_STORAGE_KEY, null, { writeDefaults: false })
  const storedProxyUrl = useLocalStorage<string | null>(ONESIGNAL_PROXY_URL_STORAGE_KEY, null, { writeDefaults: false })
  const storedProxyKey = useLocalStorage<string | null>(ONESIGNAL_PROXY_KEY_STORAGE_KEY, null, { writeDefaults: false })
  const storedEnabled = useLocalStorage<boolean>(ONESIGNAL_ENABLED_STORAGE_KEY, false, { writeDefaults: false })

  watchEffect(() => {
    const raw = storedAppId.value
    if (!raw) return

    const normalized = normalizeOneSignalAppId(raw)
    if (!normalized) {
      storedAppId.value = null
      return
    }

    if (normalized !== raw) storedAppId.value = normalized
  })

  watchEffect(() => {
    const raw = storedApiKey.value
    if (!raw) return

    const normalized = normalizeOneSignalApiKey(raw)
    if (!normalized) {
      storedApiKey.value = null
      return
    }

    if (normalized !== raw) storedApiKey.value = normalized
  })

  watchEffect(() => {
    const raw = storedProxyUrl.value
    if (!raw) return

    const normalized = normalizeOneSignalProxyUrl(raw)
    if (!normalized) {
      storedProxyUrl.value = null
      return
    }

    if (normalized !== raw) storedProxyUrl.value = normalized
  })

  watchEffect(() => {
    const raw = storedProxyKey.value
    if (!raw) return

    const normalized = normalizeOneSignalProxyKey(raw)
    if (!normalized) {
      storedProxyKey.value = null
      return
    }

    if (normalized !== raw) storedProxyKey.value = normalized
  })

  const oneSignalAppId = computed<string | null>(() => storedAppId.value || null)
  const oneSignalApiKey = computed<string | null>(() => storedApiKey.value || null)
  const oneSignalProxyUrl = computed<string | null>(() => storedProxyUrl.value || null)
  const oneSignalProxyKey = computed<string | null>(() => storedProxyKey.value || null)
  const isOneSignalEnabled = computed(() => Boolean(storedEnabled.value))

  const hasOneSignalAppId = computed(() => Boolean(oneSignalAppId.value))
  const hasOneSignalApiKey = computed(() => Boolean(oneSignalApiKey.value))
  const hasOneSignalProxyUrl = computed(() => Boolean(oneSignalProxyUrl.value))
  const hasOneSignalConfig = computed(() => hasOneSignalAppId.value)
  const hasOneSignalSchedulingProxy = computed(() => hasOneSignalAppId.value && hasOneSignalProxyUrl.value)

  function hydrateFromStorage() {
    // Backward-compatible no-op: VueUse already hydrates from localStorage.
  }

  function setOneSignalAppId(next: string | null) {
    const normalized = next ? normalizeOneSignalAppId(next) : null
    storedAppId.value = normalized
  }

  function setOneSignalAppIdFromInput(input: string) {
    setOneSignalAppId(input)
    return oneSignalAppId.value
  }

  function clearOneSignalAppId() {
    setOneSignalAppId(null)
  }

  function setOneSignalApiKey(next: string | null) {
    const normalized = next ? normalizeOneSignalApiKey(next) : null
    storedApiKey.value = normalized
  }

  function setOneSignalApiKeyFromInput(input: string) {
    setOneSignalApiKey(input)
    return oneSignalApiKey.value
  }

  function clearOneSignalApiKey() {
    setOneSignalApiKey(null)
  }

  function setOneSignalProxyUrl(next: string | null) {
    const normalized = next ? normalizeOneSignalProxyUrl(next) : null
    storedProxyUrl.value = normalized
  }

  function setOneSignalProxyUrlFromInput(input: string) {
    setOneSignalProxyUrl(input)
    return oneSignalProxyUrl.value
  }

  function clearOneSignalProxyUrl() {
    setOneSignalProxyUrl(null)
  }

  function setOneSignalProxyKey(next: string | null) {
    const normalized = next ? normalizeOneSignalProxyKey(next) : null
    storedProxyKey.value = normalized
  }

  function setOneSignalProxyKeyFromInput(input: string) {
    setOneSignalProxyKey(input)
    return oneSignalProxyKey.value
  }

  function clearOneSignalProxyKey() {
    setOneSignalProxyKey(null)
  }

  function setOneSignalEnabled(next: boolean) {
    storedEnabled.value = Boolean(next)
  }

  function clearOneSignalConfig() {
    clearOneSignalAppId()
    clearOneSignalApiKey()
    clearOneSignalProxyUrl()
    clearOneSignalProxyKey()
    setOneSignalEnabled(false)
  }

  return {
    oneSignalAppId: readonly(oneSignalAppId),
    oneSignalApiKey: readonly(oneSignalApiKey),
    oneSignalProxyUrl: readonly(oneSignalProxyUrl),
    oneSignalProxyKey: readonly(oneSignalProxyKey),
    isOneSignalEnabled: readonly(isOneSignalEnabled),
    hasOneSignalAppId,
    hasOneSignalApiKey,
    hasOneSignalProxyUrl,
    hasOneSignalConfig,
    hasOneSignalSchedulingProxy,
    hydrateFromStorage,
    setOneSignalAppId,
    setOneSignalAppIdFromInput,
    clearOneSignalAppId,
    setOneSignalApiKey,
    setOneSignalApiKeyFromInput,
    clearOneSignalApiKey,
    setOneSignalProxyUrl,
    setOneSignalProxyUrlFromInput,
    clearOneSignalProxyUrl,
    setOneSignalProxyKey,
    setOneSignalProxyKeyFromInput,
    clearOneSignalProxyKey,
    setOneSignalEnabled,
    clearOneSignalConfig,
  }
}

