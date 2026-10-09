/**
 * Absolute public asset / page URLs for SEO (og:image, canonical).
 * Set NUXT_PUBLIC_SITE_URL at build time for correct social previews.
 */
export function useSiteMeta() {
  const config = useRuntimeConfig()
  const baseURL = config.app.baseURL || '/'

  function withBase(path: string) {
    const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
    return `${normalizedBase}${path.replace(/^\//, '')}`
  }

  function absoluteUrl(path = '') {
    const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')
    const relative = withBase(path)
    return siteUrl ? `${siteUrl}${relative}` : relative
  }

  const ogImage = computed(() => absoluteUrl('og.jpg'))

  return {
    withBase,
    absoluteUrl,
    ogImage,
    siteUrl: computed(() => String(config.public.siteUrl || '').replace(/\/$/, ''))
  }
}
