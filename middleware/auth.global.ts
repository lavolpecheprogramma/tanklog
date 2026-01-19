function normalizeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  if (value.startsWith("/login")) return "/"
  return value
}

export default defineNuxtRouteMiddleware((to) => {
  // IMPORTANT for SSG: don't redirect during prerender / server render.
  if (!process.client) return

  const auth = useAuth()
  auth.hydrateFromStorage()

  const isLoginRoute = to.path === "/login"
  const isAuthed = auth.isAuthenticated.value

  if (!isAuthed && !isLoginRoute) {
    return navigateTo({
      path: "/login",
      query: { redirect: to.fullPath },
    })
  }

  if (isAuthed && isLoginRoute) {
    return navigateTo(normalizeRedirect(to.query.redirect))
  }

  // Sprint 4+ storage gate: until the TankLog Drive folder is connected, lock the app.
  if (!isAuthed) return
  const isSettingsRoute = to.path === "/settings"

  const storage = useTankLogRootFolderId()
  storage.hydrateFromStorage()
  const hasStorage = storage.hasRootFolderId.value

  if (!hasStorage && !isSettingsRoute) {
    return navigateTo("/settings")
  }
})

