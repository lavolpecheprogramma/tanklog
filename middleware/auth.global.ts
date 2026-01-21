function normalizeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/dashboard"
  if (!value.startsWith("/")) return "/dashboard"
  if (value.startsWith("//")) return "/dashboard"
  if (value.startsWith("/dashboard/login")) return "/dashboard"
  return value
}

export default defineNuxtRouteMiddleware((to) => {
  // IMPORTANT for SSG: don't redirect during prerender / server render.
  if (!process.client) return

  const auth = useAuth()
  auth.hydrateFromStorage()

  const publicRoutes = new Set(["/", "/dashboard/login", "/privacy"])
  const isPublicRoute = publicRoutes.has(to.path)
  const isLoginRoute = to.path === "/dashboard/login"
  const isAuthed = auth.isAuthenticated.value

  if (!isAuthed && !isPublicRoute) {
    return navigateTo({
      path: "/dashboard/login",
      query: { redirect: to.fullPath },
    })
  }

  if (isAuthed && isLoginRoute) {
    return navigateTo(normalizeRedirect(to.query.redirect))
  }

  // Sprint 4+ storage gate: until the TankLog Drive folder is connected, lock the app.
  if (!isAuthed) return
  const isSettingsRoute = to.path === "/dashboard" || to.path === "/dashboard/settings"
  const isPrivacyRoute = to.path === "/privacy"

  const storage = useTankLogRootFolderId()
  storage.hydrateFromStorage()
  const hasStorage = storage.hasRootFolderId.value

  if (!hasStorage && !isSettingsRoute && !isPrivacyRoute) {
    return navigateTo("/dashboard")
  }
})

