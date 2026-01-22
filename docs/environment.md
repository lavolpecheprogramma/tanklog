# Environment variables

TankLog is a static (SSG) Nuxt app. Some values are injected at build time.

## Google OAuth Client ID

TankLog uses Google Identity Services (OAuth) in the browser.
The OAuth **Client ID is user-provided at runtime** (stored locally on the device) and is **not** configured via environment variables.

See: `docs/google-setup.md`

## `NUXT_APP_BASE_URL`

**Optional**. Used for correct asset paths when deploying under a sub-path (for example GitHub project pages).

The GitHub Pages workflow sets this automatically.
