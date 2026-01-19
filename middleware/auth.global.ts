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
})

