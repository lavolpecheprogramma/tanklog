import { watch } from "vue"

export default defineNuxtPlugin(() => {
  const auth = useAuth()
  auth.hydrateFromStorage()

  const route = useRoute()

  watch(
    () => auth.isAuthenticated.value,
    (isAuthed, wasAuthed) => {
      if (!wasAuthed || isAuthed) return
      if (route.path === "/login") return

      navigateTo({
        path: "/login",
        query: { redirect: route.fullPath },
      })
    }
  )
})

