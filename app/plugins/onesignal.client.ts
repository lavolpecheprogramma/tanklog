export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n
  const config = useOneSignalConfig()
  const auth = useAuth()
  const oneSignal = useOneSignal()

  config.hydrateFromStorage()

  function currentLocale(): string {
    return String(i18n.locale.value || 'en')
  }

  async function ensureInitialized() {
    if (!import.meta.client) return
    if (!config.isEnabled.value) return
    const appId = config.appId.value
    if (!appId || oneSignal.isInitialized.value) return

    try {
      await oneSignal.init({ appId })
    } catch {
      // Keep app functional even if OneSignal fails to load.
    }
  }

  async function ensureIdentityLinked() {
    if (!import.meta.client || !oneSignal.isInitialized.value) return

    const userId = auth.user.value?.id
    if (userId) {
      try {
        await oneSignal.login(userId)
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
    () => [config.isEnabled.value, config.appId.value] as const,
    () => {
      void ensureInitialized()
    },
    { immediate: true }
  )

  watch(
    () => oneSignal.isInitialized.value,
    () => {
      void ensureIdentityLinked()
      void oneSignal.setLanguage(currentLocale())
    },
    { immediate: true }
  )

  watch(
    () => auth.user.value?.id ?? null,
    () => {
      void ensureIdentityLinked()
    }
  )

  watch(
    () => i18n.locale.value,
    (value) => {
      void oneSignal.setLanguage(String(value || 'en'))
    }
  )
})
