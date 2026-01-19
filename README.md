# TankLog

Frontend-only aquarium logbook + trends dashboard.

**Constraints** (source of truth: `project.md` / `roadmap.md`):
- Frontend-only, **SSG**, **PWA**
- Free stack only
- **User-controlled storage** (Google Sheets + Google Drive)

## Local dev

```bash
npm install
npm run dev
```

## Static build (SSG)

```bash
npm run generate
```

Static output is generated in `./.output/public` and can be deployed to any static host.

## PWA

TankLog uses `@vite-pwa/nuxt` to generate:
- `manifest.webmanifest`
- `sw.js` (Workbox-based service worker)

After a successful first visit, the app shell can load offline (best-effort, browser-dependent).

## Deploy

### GitHub Pages
- A workflow is included at `.github/workflows/deploy.yml`.
- Pushing to `main` builds and deploys `./.output/public`.
- The workflow sets `NUXT_APP_BASE_URL` automatically for project pages (`/<repo>/`).

### Netlify / Cloudflare Pages
- **Build command**: `npm run generate`
- **Publish directory**: `.output/public`
