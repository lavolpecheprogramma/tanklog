import { watch } from "vue"

export default defineNuxtPlugin(() => {
  const { $i18n } = useNuxtApp()
  const { locale } = $i18n

  const oneSignalConfig = useTankLogOneSignalConfig()
  oneSignalConfig.hydrateFromStorage()

  const auth = useAuth()
  auth.hydrateFromStorage()

  const oneSignal = useOneSignal()

  async function ensureInitialized() {
    if (!import.meta.client) return
    if (!oneSignalConfig.isOneSignalEnabled.value) return

    const appId = oneSignalConfig.oneSignalAppId.value
    if (!appId) return
    if (oneSignal.isInitialized.value) return

    try {
      await oneSignal.init({ appId })
    } catch {
      // Keep app functional even if OneSignal fails to load.
    }
  }

  async function ensureIdentityLinked() {
    if (!import.meta.client) return
    if (!oneSignal.isInitialized.value) return

    const email = auth.user.value?.email
    if (email) {
      try {
        await oneSignal.login(email)
      } catch {
        // best effort
      }
    } else {
      try {
        await oneSignal.logout()
      } catch {
        // best effort
      }
    }
  }

  watch(
    () => [oneSignalConfig.isOneSignalEnabled.value, oneSignalConfig.oneSignalAppId.value],
    () => {
      void ensureInitialized()
    },
    { immediate: true }
  )

  watch(
    () => oneSignal.isInitialized.value,
    () => {
      void ensureIdentityLinked()
      void oneSignal.setLanguage(locale.value)
    },
    { immediate: true }
  )

  watch(
    () => auth.user.value?.email ?? null,
    () => {
      void ensureIdentityLinked()
    }
  )

  watch(
    () => locale.value,
    (value) => {
      void oneSignal.setLanguage(value)
    }
  )
})

