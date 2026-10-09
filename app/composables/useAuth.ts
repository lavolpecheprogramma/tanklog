import type { Session, User } from '@supabase/supabase-js'

let authListenerKey: string | null = null

export function useAuth() {
  const user = useState<User | null>('tanklog.auth.user', () => null)
  const session = useState<Session | null>('tanklog.auth.session', () => null)
  const ready = useState<boolean>('tanklog.auth.ready', () => false)
  const busy = useState<boolean>('tanklog.auth.busy', () => false)
  const error = useState<string | null>('tanklog.auth.error', () => null)
  const { url, anonKey } = useSupabaseConfig()

  const isAuthenticated = computed(() => Boolean(session.value && user.value))

  function applySession(next: Session | null) {
    session.value = next
    user.value = next?.user ?? null
  }

  function clientKey() {
    if (!url.value || !anonKey.value) return null
    return `${url.value}::${anonKey.value}`
  }

  async function bootstrap() {
    error.value = null
    const client = useSupabaseClient()
    const key = clientKey()

    if (!client || !key) {
      applySession(null)
      authListenerKey = null
      ready.value = true
      return
    }

    const { data, error: sessionError } = await client.auth.getSession()
    if (sessionError) {
      error.value = sessionError.message
      applySession(null)
    } else {
      applySession(data.session)
    }

    if (authListenerKey !== key) {
      client.auth.onAuthStateChange((_event, nextSession) => {
        applySession(nextSession)
      })
      authListenerKey = key
    }

    ready.value = true
  }

  async function signInWithPassword(email: string, password: string) {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) {
        throw new Error('Supabase is not configured')
      }
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      if (authError) throw authError
      applySession(data.session)
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      busy.value = false
    }
  }

  async function signUpWithPassword(email: string, password: string) {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) {
        throw new Error('Supabase is not configured')
      }
      const { data, error: authError } = await client.auth.signUp({
        email: email.trim(),
        password
      })
      if (authError) throw authError
      applySession(data.session)
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      busy.value = false
    }
  }

  async function signOut() {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (client) {
        const { error: authError } = await client.auth.signOut()
        if (authError) throw authError
      }
      applySession(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      busy.value = false
    }
  }

  return {
    user,
    session,
    ready,
    busy,
    error,
    isAuthenticated,
    bootstrap,
    signInWithPassword,
    signUpWithPassword,
    signOut
  }
}
