# Contributing

Thanks for taking the time to contribute to TankLog!

This project is intentionally **frontend-only** (Nuxt SSG + PWA) and uses **user-controlled storage** (Google Sheets + Google Drive). Please keep changes aligned with the constraints and roadmap described in `project.md` and `roadmap.md`.

## Development setup

- Install Node.js (the deploy workflow uses Node 20).
- Install dependencies:

```bash
npm ci
```

- Start dev server:

```bash
npm run dev
```

## Build / deploy sanity check

Before opening a PR, please ensure the static build still works:

```bash
npm run generate
```

## Google setup (for features that need it)

Some features require a Google OAuth client ID:

- Follow `docs/google-setup.md`
- Set `NUXT_PUBLIC_GOOGLE_CLIENT_ID` in your environment (do **not** commit secrets)

## i18n (English + Italian)

TankLog is bilingual. If you add or change user-facing text, please update both locale files:

- `i18n/locales/en.json`
- `i18n/locales/it.json`

Prefer reusing existing translation keys and keep messages concise and consistent.

## What to work on

- Check `roadmap.md` for the current sprint and backlog.
- If you plan something bigger than a small fix, open an issue first to discuss scope.

## Pull request guidelines

- Keep PRs small and focused (one feature/fix per PR).
- Add or update docs when behavior changes.
- Avoid introducing backend/server dependencies (this is a static app by design).
- Aim for accessible UI (keyboard navigation, focus states, proper labels, readable contrast).

## License

By contributing, you agree that your contributions will be licensed under the project license (see `LICENSE`).
