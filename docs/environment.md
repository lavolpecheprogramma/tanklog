# Environment variables

TankLog is a static (SSG) Nuxt app. Some values are injected at build time.

## Google OAuth Client ID

TankLog uses Google Identity Services (OAuth) in the browser.
The OAuth **Client ID is user-provided at runtime** (stored locally on the device) and is **not** configured via environment variables.

See: `docs/google-setup.md`

## `NUXT_APP_BASE_URL`

**Optional**. Used for correct asset paths when deploying under a sub-path (for example GitHub project pages).

The GitHub Pages workflow sets this automatically.

## `NUXT_PUBLIC_SITE_URL`

**Optional but recommended for SEO / social previews.** Public **origin only** (scheme + host, no path, no trailing slash).

Examples:
- `https://example.com`
- `https://username.github.io`

Do **not** include the repo subpath here — that belongs in `NUXT_APP_BASE_URL` (e.g. `/tanklog/`). Absolute SEO URLs are built as `SITE_URL + BASE_URL + asset`.

Used at build time for `og:url`, `canonical`, JSON-LD, and absolute `og:image` / Twitter image URLs.

Set as a GitHub Actions **variable** (`vars.NUXT_PUBLIC_SITE_URL`) for the deploy workflow.
