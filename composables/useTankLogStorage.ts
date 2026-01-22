import { computed, readonly } from "vue"

const STORAGE_KEY = "tanklog.drive.rootFolderId.v1"
const GOOGLE_CLIENT_ID_STORAGE_KEY = "tanklog.google.clientId.v1"

function getLocalStorage(): Storage | null {
  if (!process.client) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

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
  const rootFolderId = useState<string | null>("drive.tanklog.rootFolderId", () => null)
  const hydrated = useState<boolean>("drive.tanklog.rootFolderId.hydrated", () => false)

  const hasRootFolderId = computed(() => Boolean(rootFolderId.value))

  function hydrateFromStorage() {
    if (!process.client) return
    if (hydrated.value) return

    const storage = getLocalStorage()
    hydrated.value = true
    if (!storage) return

    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return

    const normalized = normalizeDriveFolderId(raw)
    if (!normalized) {
      storage.removeItem(STORAGE_KEY)
      rootFolderId.value = null
      return
    }

    rootFolderId.value = normalized
  }

  function setRootFolderId(next: string | null) {
    const normalized = next ? normalizeDriveFolderId(next) : null
    rootFolderId.value = normalized

    const storage = getLocalStorage()
    if (!storage) return

    if (!normalized) {
      storage.removeItem(STORAGE_KEY)
      return
    }

    storage.setItem(STORAGE_KEY, normalized)
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
    hydrated: readonly(hydrated),
    hasRootFolderId,
    hydrateFromStorage,
    setRootFolderId,
    setRootFolderIdFromInput,
    clearRootFolderId,
  }
}

export function useTankLogGoogleClientId() {
  const googleClientId = useState<string | null>("google.tanklog.clientId", () => null)
  const hydrated = useState<boolean>("google.tanklog.clientId.hydrated", () => false)

  const hasGoogleClientId = computed(() => Boolean(googleClientId.value))

  function hydrateFromStorage() {
    if (!process.client) return
    if (hydrated.value) return

    const storage = getLocalStorage()
    hydrated.value = true
    if (!storage) return

    const raw = storage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)
    if (!raw) return

    const normalized = normalizeGoogleClientId(raw)
    if (!normalized) {
      storage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY)
      googleClientId.value = null
      return
    }

    googleClientId.value = normalized
  }

  function setGoogleClientId(next: string | null) {
    const normalized = next ? normalizeGoogleClientId(next) : null
    googleClientId.value = normalized

    const storage = getLocalStorage()
    if (!storage) return

    if (!normalized) {
      storage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY)
      return
    }

    storage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, normalized)
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
    hydrated: readonly(hydrated),
    hasGoogleClientId,
    hydrateFromStorage,
    setGoogleClientId,
    setGoogleClientIdFromInput,
    clearGoogleClientId,
  }
}

