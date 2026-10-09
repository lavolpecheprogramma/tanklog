// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

function withBase(path: string) {
  const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
  const normalizedPath = path.replace(/^\//, '')
  return `${normalizedBase}${normalizedPath}`
}

function absoluteUrl(path: string) {
  const relative = withBase(path)
  return siteUrl ? `${siteUrl}${relative}` : relative
}

const seoDescription
  = 'TankLog — aquarium technical logbook: water tests, trends, events, reminders, and photos. Data stays in your Supabase project.'
const ogImage = absoluteUrl('og.jpg')
const siteName = 'TankLog'

const headMeta = [
  { charset: 'utf-8' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  { name: 'description', content: seoDescription },
  { name: 'application-name', content: siteName },
  { name: 'theme-color', content: '#020617' },
  { name: 'color-scheme', content: 'dark' },
  { name: 'mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
  { name: 'apple-mobile-web-app-title', content: siteName },
  { name: 'format-detection', content: 'telephone=no' },
  { name: 'author', content: siteName },
  {
    name: 'keywords',
    content: 'aquarium, reef tank, water parameters, aquarium log, freshwater, marine, Supabase, TankLog'
  },
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: siteName },
  { property: 'og:title', content: siteName },
  { property: 'og:description', content: seoDescription },
  { property: 'og:image', content: ogImage },
  { property: 'og:image:type', content: 'image/jpeg' },
  { property: 'og:image:width', content: '1280' },
  { property: 'og:image:height', content: '720' },
  { property: 'og:image:alt', content: 'TankLog — aquarium technical log' },
  { property: 'og:locale', content: 'it_IT' },
  { property: 'og:locale:alternate', content: 'en_US' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: siteName },
  { name: 'twitter:description', content: seoDescription },
  { name: 'twitter:image', content: ogImage },
  { name: 'twitter:image:alt', content: 'TankLog — aquarium technical log' }
]

if (siteUrl) {
  headMeta.push({ property: 'og:url', content: absoluteUrl('') })
}

const headLink: Array<Record<string, string>> = [
  { rel: 'icon', href: withBase('favicon.ico'), sizes: 'any' },
  { rel: 'icon', type: 'image/svg+xml', href: withBase('favicon.svg') },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: withBase('favicon-32x32.png') },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: withBase('favicon-16x16.png') },
  { rel: 'apple-touch-icon', sizes: '180x180', href: withBase('apple-touch-icon.png') },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap'
  }
]

if (siteUrl) {
  headLink.splice(5, 0, { rel: 'canonical', href: absoluteUrl('') })
}

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt'
  ],

  // TankLog: static / client-only SPA (SSG-friendly)
  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  runtimeConfig: {
    public: {
      siteUrl
    }
  },

  app: {
    baseURL,
    head: {
      title: siteName,
      titleTemplate: `%s`,
      htmlAttrs: {
        lang: 'it'
      },
      meta: headMeta,
      link: headLink,
      // Typed loosely: Unhead script unions omit innerHTML in some versions
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: siteName,
            description: seoDescription,
            ...(siteUrl ? { url: absoluteUrl('') } : {}),
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD'
            },
            image: ogImage
          })
        }
      ] as Array<Record<string, string>>
    }
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'it',
    langDir: 'locales',
    locales: [
      { code: 'it', language: 'it-IT', name: 'Italiano', file: 'it.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
    ],
    detectBrowserLanguage: false,
    vueI18n: 'i18n.config.ts'
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'TankLog',
      short_name: 'TankLog',
      description: 'Aquarium technical logbook and trends dashboard (BYO Supabase).',
      theme_color: '#020617',
      background_color: '#020617',
      display: 'standalone',
      start_url: baseURL,
      scope: baseURL,
      lang: 'it',
      icons: [
        {
          src: withBase('icon-192.png'),
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: withBase('icon-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: withBase('icon-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/'
    },
    client: {
      installPrompt: true
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
