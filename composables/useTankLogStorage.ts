import { computed, readonly, watchEffect } from "vue"
import { useLocalStorage } from "@vueuse/core"

const STORAGE_KEY = "tanklog.drive.rootFolderId.v1"
const GOOGLE_CLIENT_ID_STORAGE_KEY = "tanklog.google.clientId.v1"

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

