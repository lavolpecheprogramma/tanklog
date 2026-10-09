# TankLog v2

Frontend-only aquarium logbook (Nuxt + Nuxt UI + BYO Supabase).

## Specs

- [`docs/v2-specs.md`](docs/v2-specs.md) — product / engineering brief
- [`docs/v2-data-model.md`](docs/v2-data-model.md) — Postgres + Storage model
- [`supabase/schema.sql`](supabase/schema.sql) — SQL to run in your Supabase project
- [`docs/supabase-setup.md`](docs/supabase-setup.md) — BYO setup guide
- [`docs/google-setup.md`](docs/google-setup.md) — optional v1 migration OAuth
- [`docs/onesignal.md`](docs/onesignal.md) — optional BYO web push + scheduling proxy
- [`project.md`](project.md) · [`roadmap.md`](roadmap.md) (MVP + post-MVP shipped)

## Stack

- Nuxt 4 (static / `ssr: false`) + **Nuxt UI**
- `@supabase/supabase-js` (BYO URL + anon key — not `@nuxtjs/supabase`)
- `@nuxtjs/i18n` (it/en)
- `@vite-pwa/nuxt`

## Develop

```bash
npm install
npm run dev
```

```bash
npm run generate   # static output → .output/public
```

## First-time setup (in the app)

1. Open `/onboarding`
2. Create a Supabase project → apply `schema.sql` → paste URL + anon key → sign up
3. Create a tank (or import from Google v1 via Settings → migrate)

## Deploy

Static hosting (GitHub Pages, Cloudflare Pages, Netlify, …) of `.output/public`.

- GitHub Pages workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (runs on `main` + `workflow_dispatch`)
- Enable **Settings → Pages → GitHub Actions**
- If the site is under a repo subpath, set Actions variable `NUXT_APP_BASE_URL` to `/<repo>/`

## Branch

Active greenfield work: `feature/v2`.
