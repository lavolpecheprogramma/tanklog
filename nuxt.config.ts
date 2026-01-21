// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = (globalThis as any).process?.env?.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt', '@nuxtjs/i18n'],
  css: ['~/assets/css/tailwind.css'],
  ssr: false,
  runtimeConfig: {
    public: {
      // Google Identity Services OAuth client id (Web application)
      // Required for Sprint 3 (Auth) and all Google API calls.
      googleClientId: (globalThis as any).process?.env?.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    },
  },

  components: [
    {
      path: '~/components',
      extensions: ['vue']
    }
  ],

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'it',
    // Locale files live in /i18n/locales (Nuxt i18n resolves langDir relative to /i18n).
    langDir: 'locales',
    locales: [
      { code: 'it', iso: 'it-IT', name: 'Italiano', file: 'it.json' },
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: false,
    vueI18n: './i18n.config.ts',
  },

  // TankLog constraint: Static Site Generation (SSG), frontend-only
  nitro: {
    // GitHub Pages serves static output and needs `.nojekyll` for `_nuxt/` assets.
    // We also support setting a base URL (NUXT_APP_BASE_URL) for project pages (/<repo>/).
    preset: 'github_pages',
    prerender: {
      routes: [ '/login' ]
    }
  },

  app: {
    baseURL,
    head: {
      titleTemplate: '%s · TankLog',
      meta: [
        { name: 'description', content: 'TankLog — frontend-only aquarium logbook and trends dashboard.' },
        { name: 'theme-color', content: '#09090b' },
      ],
      script: [{ src: 'https://accounts.google.com/gsi/client', async: true, defer: true }],
      link: [
        { rel: 'icon', href: `${baseURL}favicon.ico`, sizes: 'any' },
        { rel: 'icon', href: `${baseURL}pwa-icon.svg`, type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: `${baseURL}apple-touch-icon-180x180.png` }
      ]
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'TankLog',
      short_name: 'TankLog',
      description: 'Frontend-only aquarium logbook and trends dashboard.',
      theme_color: '#09090b',
      background_color: '#09090b',
      display: 'standalone',
      start_url: baseURL,
      scope: baseURL,
      icons: [
        { src: `${baseURL}pwa-64x64.png`, sizes: '64x64', type: 'image/png' },
        { src: `${baseURL}pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${baseURL}pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
        {
          src: `${baseURL}maskable-icon-512x512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      // NOTE: Workbox minification can fail with "Unexpected early exit (terser) renderChunk"
      // in some build environments. Development mode disables SW minification while keeping
      // the same caching behavior.
      mode: 'development',
      // On static hosts, Nuxt generates 200.html as the SPA fallback.
      // Caching it enables basic offline navigation after a first visit.
      navigateFallback: `${baseURL}200.html`,
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json,txt,woff2}']
    },
    devOptions: {
      enabled: false
    }
  }
})
