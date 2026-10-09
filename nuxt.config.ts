// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

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

  app: {
    baseURL,
    head: {
      titleTemplate: '%s · TankLog',
      meta: [
        {
          name: 'description',
          content: 'TankLog — aquarium logbook and trends dashboard (BYO Supabase).'
        },
        { name: 'theme-color', content: '#020617' }
      ],
      link: [
        { rel: 'icon', href: `${baseURL}favicon.ico`, sizes: 'any' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap'
        }
      ]
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
      description: 'Aquarium logbook and trends dashboard (BYO Supabase).',
      theme_color: '#020617',
      background_color: '#020617',
      display: 'standalone',
      start_url: baseURL,
      scope: baseURL
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
