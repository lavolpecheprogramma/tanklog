const STORAGE_KEY = 'tanklog.supabase.config.v1'

export type SupabaseConfig = {
  url: string
  anonKey: string
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function readStored(): SupabaseConfig | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>
    if (!parsed.url || !parsed.anonKey) return null
    return { url: normalizeUrl(parsed.url), anonKey: parsed.anonKey.trim() }
  } catch {
    return null
  }
}

export function useSupabaseConfig() {
  const url = useState<string | null>('tanklog.supabase.url', () => null)
  const anonKey = useState<string | null>('tanklog.supabase.anonKey', () => null)

  if (import.meta.client && url.value === null && anonKey.value === null) {
    const stored = readStored()
    if (stored) {
      url.value = stored.url
      anonKey.value = stored.anonKey
    }
  }

  const isConfigured = computed(() => Boolean(url.value && anonKey.value))

  function setConfig(next: SupabaseConfig) {
    const normalized = {
      url: normalizeUrl(next.url),
      anonKey: next.anonKey.trim()
    }
    url.value = normalized.url
    anonKey.value = normalized.anonKey
    resetSupabaseClient()
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  }

  function clearConfig() {
    url.value = null
    anonKey.value = null
    resetSupabaseClient()
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    url,
    anonKey,
    isConfigured,
    setConfig,
    clearConfig
  }
}
