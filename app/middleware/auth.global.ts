export default defineNuxtRouteMiddleware(async (to) => {
  // SSG / server: skip (client-only auth gate)
  if (import.meta.server) return

  const auth = useAuth()
  if (!auth.ready.value) {
    await auth.bootstrap()
  }

  const path = to.path
  const isDashboard = path === '/dashboard' || path.startsWith('/dashboard/')
  const isLogin = path === '/dashboard/login'
  const isResetPassword = path === '/dashboard/reset-password'
  const isSetup = path === '/dashboard/setup'
  const isSettings = path === '/dashboard/settings'

  if (isDashboard && !isLogin && !isResetPassword && !auth.isAuthenticated.value) {
    return navigateTo({
      path: '/dashboard/login',
      query: { redirect: path }
    })
  }

  if (isLogin && auth.isAuthenticated.value) {
    if (auth.passwordRecoveryPending.value) {
      return navigateTo('/dashboard/reset-password')
    }
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
    return navigateTo(redirect)
  }

  if (!auth.isAuthenticated.value) return

  // Schema health gate (settings + setup + recovery always allowed)
  if (isDashboard && !isLogin && !isSetup && !isSettings && !isResetPassword) {
    const health = useSchemaHealth()
    if (health.status.value === 'unknown' || health.status.value === 'checking') {
      await health.check()
    }
    if (health.needsSetup.value) {
      return navigateTo('/dashboard/setup')
    }
  }
})
