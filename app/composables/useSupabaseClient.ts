import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: { key: string, client: SupabaseClient } | null = null

export function resetSupabaseClient() {
  cached = null
}

/**
 * BYO Supabase client from local config (not @nuxtjs/supabase).
 * Returns null when URL/anon key are missing.
 */
export function useSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = useSupabaseConfig()

  if (!url.value || !anonKey.value) {
    cached = null
    return null
  }

  const cacheKey = `${url.value}::${anonKey.value}`
  if (cached?.key === cacheKey) {
    return cached.client
  }

  let host: string
  try {
    host = new URL(url.value).hostname
  } catch {
    host = 'invalid'
  }

  const client = createClient(url.value, anonKey.value, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `tanklog.supabase.auth.${host}`
    }
  })

  cached = { key: cacheKey, client }
  return client
}
