# Environment variables

TankLog is a static (SSG) Nuxt app. Some values are injected at build time.

## `NUXT_PUBLIC_GOOGLE_CLIENT_ID`

**Required** to enable Google login.

- Used by Google Identity Services in the browser
- Safe to expose in the client bundle (it is a public identifier, not a secret)
- Setup guide: `docs/google-setup.md`

## `NUXT_APP_BASE_URL`

**Optional**. Used for correct asset paths when deploying under a sub-path (for example GitHub project pages).

The GitHub Pages workflow sets this automatically.
