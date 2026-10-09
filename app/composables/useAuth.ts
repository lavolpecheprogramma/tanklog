import type { Session, User } from '@supabase/supabase-js'

let authListenerKey: string | null = null

function passwordResetRedirectTo(): string {
  if (!import.meta.client) throw new Error('Password reset is only available in the browser.')
  const base = useRuntimeConfig().app.baseURL || '/'
  const path = `${base}dashboard/reset-password`.replace(/\/{2,}/g, '/')
  return new URL(path, window.location.origin).toString()
}

function urlLooksLikePasswordRecovery(): boolean {
  if (!import.meta.client) return false
  const hash = window.location.hash.toLowerCase()
  const search = window.location.search.toLowerCase()
  return hash.includes('type=recovery') || search.includes('type=recovery')
}

export function useAuth() {
  const user = useState<User | null>('tanklog.auth.user', () => null)
  const session = useState<Session | null>('tanklog.auth.session', () => null)
  const ready = useState<boolean>('tanklog.auth.ready', () => false)
  const busy = useState<boolean>('tanklog.auth.busy', () => false)
  const error = useState<string | null>('tanklog.auth.error', () => null)
  const passwordRecoveryPending = useState<boolean>('tanklog.auth.passwordRecovery', () => false)
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

    if (urlLooksLikePasswordRecovery()) {
      passwordRecoveryPending.value = true
    }

    const { data, error: sessionError } = await client.auth.getSession()
    if (sessionError) {
      error.value = sessionError.message
      applySession(null)
    } else {
      applySession(data.session)
    }

    if (authListenerKey !== key) {
      client.auth.onAuthStateChange((event, nextSession) => {
        applySession(nextSession)
        if (event === 'PASSWORD_RECOVERY') {
          passwordRecoveryPending.value = true
        }
        if (event === 'SIGNED_OUT') {
          passwordRecoveryPending.value = false
        }
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

  /**
   * Change password for the signed-in email/password user.
   * Verifies the current password first so it works even when the Supabase
   * project does not enable “Secure password change → require current password”.
   */
  async function updatePassword(currentPassword: string, newPassword: string) {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const email = user.value?.email?.trim()
      if (!email) throw new Error('Not signed in')

      const current = currentPassword
      const next = newPassword
      if (!current) throw new Error('Current password is required')
      if (next.length < 6) throw new Error('Password must be at least 6 characters')
      if (next === current) throw new Error('New password must be different')

      const { error: verifyError } = await client.auth.signInWithPassword({
        email,
        password: current
      })
      if (verifyError) throw new Error('Current password is incorrect')

      const { data, error: authError } = await client.auth.updateUser({
        password: next
      })
      if (authError) throw authError
      if (data.user) user.value = data.user
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      busy.value = false
    }
  }

  /** Send a password-recovery email (always returns success-shaped UX; Supabase avoids enumeration). */
  async function requestPasswordReset(email: string) {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')
      const trimmed = email.trim()
      if (!trimmed) throw new Error('Email is required')

      const { error: authError } = await client.auth.resetPasswordForEmail(trimmed, {
        redirectTo: passwordResetRedirectTo()
      })
      if (authError) throw authError
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      busy.value = false
    }
  }

  /** Set a new password after the user opened the recovery link from email. */
  async function completePasswordRecovery(newPassword: string) {
    busy.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')
      if (!session.value || !user.value) throw new Error('Recovery session missing')
      if (!passwordRecoveryPending.value && !urlLooksLikePasswordRecovery()) {
        throw new Error('Recovery session missing')
      }

      const next = newPassword
      if (next.length < 6) throw new Error('Password must be at least 6 characters')

      const { data, error: authError } = await client.auth.updateUser({
        password: next
      })
      if (authError) throw authError
      if (data.user) user.value = data.user
      passwordRecoveryPending.value = false
      return data
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
    passwordRecoveryPending,
    isAuthenticated,
    bootstrap,
    signInWithPassword,
    signUpWithPassword,
    updatePassword,
    requestPasswordReset,
    completePasswordRecovery,
    signOut
  }
}
