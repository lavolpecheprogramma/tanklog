import { watch } from "vue"

export default defineNuxtPlugin(() => {
  const auth = useAuth()
  auth.hydrateFromStorage()

  const route = useRoute()

  watch(
    () => auth.isAuthenticated.value,
    (isAuthed, wasAuthed) => {
      if (!wasAuthed || isAuthed) return
      if (route.path === "/dashboard/login") return

      navigateTo({
        path: "/dashboard/login",
        query: { redirect: route.fullPath },
      })
    }
  )
})

