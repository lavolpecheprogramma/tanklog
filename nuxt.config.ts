// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  css: ['~/assets/css/tailwind.css'],

  components: [
    {
      path: '~/components',
      extensions: ['vue']
    }
  ],

  // TankLog constraint: Static Site Generation (SSG), frontend-only
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/vasques/reef-300l', '/vasques/nano-40l', '/vasques/fresh-120l']
    }
  },

  app: {
    baseURL,
    head: {
      titleTemplate: '%s · TankLog',
      meta: [
        { name: 'description', content: 'TankLog — frontend-only aquarium logbook and trends dashboard.' },
        { name: 'theme-color', content: '#09090b' }
      ],
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
