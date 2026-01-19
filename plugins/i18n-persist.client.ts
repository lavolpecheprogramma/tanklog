const STORAGE_KEY = "tanklog.locale"

export default defineNuxtPlugin(async () => {
  const { $i18n } = useNuxtApp();
  const { locale, localeCodes, setLocale, getBrowserLocale } = $i18n
  const supported = localeCodes.value
  const stored = localStorage.getItem(STORAGE_KEY)
  const browser = getBrowserLocale()

  type AppLocale = typeof locale.value

  function isSupportedLocale(value: string | null | undefined): value is AppLocale {
    if (!value) return false
    return supported.includes(value as AppLocale)
  }

  const storedLocale = isSupportedLocale(stored) ? stored : null
  const browserLocale = isSupportedLocale(browser) ? browser : null
  const initial = storedLocale || browserLocale || locale.value

  if (initial && initial !== locale.value) {
    await setLocale(initial)
  }

  watch(
    locale,
    (value) => {
      if (!value) return
      localStorage.setItem(STORAGE_KEY, value)
    },
    { immediate: true }
  )
})

