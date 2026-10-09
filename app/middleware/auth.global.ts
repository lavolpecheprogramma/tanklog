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
  const isSetup = path === '/dashboard/setup'
  const isSettings = path === '/dashboard/settings'

  if (isDashboard && !isLogin && !auth.isAuthenticated.value) {
    return navigateTo({
      path: '/dashboard/login',
      query: { redirect: path }
    })
  }

  if (isLogin && auth.isAuthenticated.value) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
    return navigateTo(redirect)
  }

  if (!auth.isAuthenticated.value) return

  // Schema health gate (settings + setup always allowed)
  if (isDashboard && !isLogin && !isSetup && !isSettings) {
    const health = useSchemaHealth()
    if (health.status.value === 'unknown' || health.status.value === 'checking') {
      await health.check()
    }
    if (health.needsSetup.value) {
      return navigateTo('/dashboard/setup')
    }
  }
})
