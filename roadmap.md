## TankLog — Roadmap (small sprints)

### How we work
- **Sprint size**: 3–5 days (small, focused)
- **Rule**: ship something visible every sprint (even if simple)
- **Definition of Done (for every sprint)**:
  - Static build works (SSG)
  - Mobile layout works
  - Basic loading + empty + error states exist

### MVP target (what “done” looks like)
- Google login
- Use the user’s **Google Sheet** as the database (tanks, tests, events, ranges)
- Water tests: input, history, charts, out-of-range highlights
- Photos: upload to **Google Drive** + timeline gallery
- UI in **Italian + English** (dynamic language switch)
- Installable **PWA** (offline-first baseline)
- Custom **reminders + notifications** (best effort, device/browser dependent)

### Sprint list (at a glance)
- **Current sprint**: Sprint 15 — Settings + onboarding polish + MVP release (started 2026-01-20)
- Sprint 0: Repo scaffold + first deploy (PWA foundation)
- Sprint 1: Page skeletons + app navigation
- Sprint 2: i18n foundation (it/en)
- Sprint 3: Google setup + Auth (client-side)
- Sprint 4: Google Drive: connect + discover tanks (per-tank sheets)
- Sprint 5: Water tests: create (write to Sheets)
- Sprint 6: Water tests: list + detail
- Sprint 7: Parameter ranges + out-of-range highlighting
- Sprint 8: Charts (trends over time)
- Sprint 9: Tank detail page (bring it together)
- Sprint 10: Events: CRUD (Sheets)
- Sprint 11: Reminders: CRUD + upcoming/overdue
- Sprint 12: Notifications: permission + reminder delivery
- Sprint 13: Photos: upload to Drive + save metadata
- Sprint 14: Photo timeline + comparison
- Sprint 15: Settings + onboarding polish + MVP release

---

## Sprint 0 — Repo scaffold + first deploy
**Goal**: a running Nuxt 3 static app with a clean UI baseline.

- [x] Scaffold Nuxt 3 (TypeScript) configured for **SSG**
- [x] Install + configure Tailwind + `shadcn-vue`
- [x] Enable PWA (`@vite-pwa/nuxt`): manifest + icons + service worker
- [x] Offline cache baseline (app shell + static assets)
- [x] App shell: header + simple navigation + responsive container
- [x] Add GitHub Pages deploy workflow (`.github/workflows/deploy.yml`)
- [ ] Deploy to a free host (GitHub Pages / Netlify / Cloudflare Pages)

**Done when**
- [x] `npm run generate` produces a static output
- [ ] Deploy is live
- [x] Home page loads and navigation works
- [x] App is installable as a PWA (manifest detected)
- [x] Home loads offline after a first successful visit

## Sprint 1 — Page skeletons + app navigation
**Goal**: all main pages exist and feel coherent.

- [x] Create pages: `/`, `/tank/[id]`, `/tank/[id]/tests`, `/tank/[id]/photos`, `/tank/[id]/events`, `/tank/[id]/reminders`, `/settings`
- [x] Tank navigation: dashboard tank list + per-tank sidebar
- [x] Add simple UI primitives (Card, Button, Dialog) and consistent spacing

**Done when**
- [x] You can click through all pages without broken routes
- [x] “Active tank” is visible in the UI (even if mocked)

## Sprint 2 — i18n foundation (it/en)
**Goal**: the whole UI can switch language.

- [x] Configure Nuxt i18n (Italian + English)
- [x] Add `LanguageSwitcher` component
- [x] Localize navigation, page titles, buttons, empty states

**Done when**
- [x] Language switch updates UI immediately and persists (local storage)

## Sprint 3 — Google setup + Auth (client-side)
**Goal**: login/logout works and we can call Google APIs.

- [x] Create/Document Google Cloud project setup (OAuth consent + credentials)
- [x] Enable Google Sheets API + Google Drive API
- [x] Implement Google Identity Services login (client-side OAuth)
- [x] Protect all dashboard routes behind login (Nuxt middleware + `/login`)
- [x] Store session/token safely for the session (and rehydrate on refresh)

**Done when**
- [x] Login + logout work
- [x] We can obtain an access token with the right scopes

## Sprint 4 — Google Drive: connect + discover tanks (per-tank sheets)
**Goal**: connect the user’s TankLog folder and discover tanks from Drive.

- [x] `useGoogleDrive()` composable: auth header + list helpers (folders/files)
- [x] `useGoogleSheets()` composable: basic read helpers (values/batch updates)
- [x] “Connect TankLog folder” step (Drive folder ID stored locally)
- [x] Discover tanks from Drive:
  - list `TankLog/` subfolders (one folder per tank)
  - find `tank_data.xlsx` in each tank folder
  - read `TANK_INFO` and show real tank list + active tank selection
- [x] Gate the app: until the TankLog folder is connected, only Settings is accessible
- [x] Create tank: create the tank folder structure + initialize `tank_data.xlsx` with required sheets/headers

**Done when**
- [x] App requires the TankLog Drive folder, remembers it locally, loads tanks from per‑tank sheets, and can create a new tank end‑to‑end

## Sprint 5 — Water tests: create (write to Sheets)
**Goal**: users can add a water test record.

- [x] Define WATER_TESTS model (measurement-based: one row per parameter measurement) + client-side ID generation
- [x] Water test form (minimal: date, tank, key params)
- [x] Write to `WATER_TESTS` tab via Sheets API

**Done when**
- [x] Submitting the form creates a new row in Google Sheets
- [x] Basic validation prevents obvious bad inputs

## Sprint 6 — Water tests: list + detail
**Goal**: history is usable.

- [x] List water tests for active tank (sorted by date)
- [x] Simple filters (date range / parameter presence)
- [x] Row detail view (dialog or page section)

**Done when**
- [x] Users can find and open past tests quickly

## Sprint 7 — Parameter ranges + out-of-range highlighting
**Goal**: detect “bad values” immediately.

- [x] Read `PARAMETER_RANGES` tab
- [x] Compute out-of-range per test + per parameter
- [x] Add `AlertBanner` + per-value highlighting in tables
- [x] Add a ranges editor page (frontend) with presets (freshwater/marine/reef)

**Done when**
- [x] Any out-of-range value is clearly highlighted and explained
- [x] Users can edit parameter ranges from the UI and save them to Sheets

## Sprint 8 — Charts (trends over time)
**Goal**: visualize stability and trends.

**Status**: Completed (started 2026-01-20)

- [x] Add `ChartComponent` wrapper (Chart.js or ECharts)
- [x] Parameter time-series chart for active tank
- [x] Localize chart labels + tooltips (it/en)

**Done when**
- [x] Users can select a parameter and see an accurate trend chart

## Sprint 9 — Tank detail page (bring it together)
**Goal**: one place to understand the tank status.

**Status**: Completed (started 2026-01-20)

- [x] `/tank/[id]` shows: latest values, alerts, charts, recent events and photos preview
- [x] “Last 7/30/90 days” quick ranges for charts

**Done when**
- [x] Tank detail feels like the main dashboard for that tank

## Sprint 10 — Events: CRUD (Sheets)
**Goal**: track interventions (water changes, dosing, maintenance).

**Status**: Completed (started 2026-01-20)

- [x] Events model + form (type, date, notes, tank)
- [x] Write to `EVENTS` tab
- [x] List events on tank detail + `/tank/[id]/events` page
- [x] Edit and delete events (update/delete rows in `EVENTS`)

**Done when**
- [x] Events can be added and viewed per tank
- [x] Events can be edited and deleted per tank

## Sprint 11 — Reminders: CRUD + upcoming/overdue (Sheets)
**Goal**: track recurring tasks (water changes, dosing, batteries, etc).

**Status**: Completed (started 2026-01-20)

- [x] Define REMINDERS model + client-side ID generation
- [x] Reminder form (title, schedule, next due, notes)
- [x] Write to / read from `REMINDERS` tab via Sheets API (CRUD)
- [x] Upcoming + overdue views (global + per tank)
- [x] Marking a reminder as done can log a matching event in `EVENTS`

**Done when**
- [x] A reminder can be created and appears in the upcoming list
- [x] Overdue reminders are clearly highlighted

## Sprint 12 — Notifications: permission + reminder delivery
**Goal**: notify the user when reminders are due (best effort without backend).

- [ ] Notification permission UX (banner + Settings toggle)
- [ ] Trigger notifications for due reminders while the app is open
- [ ] Add snooze / mark done (updates next due date and/or status in Sheets)
- [ ] Add settings: quiet hours + default snooze
- [ ] Document limitations + optional path to background Web Push (post‑MVP)

**Done when**
- [ ] Creating a reminder “due soon” results in a real notification
- [ ] Snooze / done updates the reminder and removes it from “due now”

## Sprint 13 — Photos: upload to Drive + save metadata
**Goal**: store photos in user-controlled storage.

**Status**: In progress (started 2026-01-20)

- [x] `useGoogleDrive()` composable: upload helper
- [x] Photo uploader UI (tank + date + optional notes)
- [x] Save photo metadata/link in `PHOTOS` tab

**Done when**
- [x] Upload creates a file in Drive and a row in the sheet

## Sprint 14 — Photo timeline + comparison
**Goal**: browse progress over time.

- [x] Photo timeline/gallery for a tank (ordered by date)
- [x] Fullscreen viewer
- [x] Basic compare mode (pick two photos and toggle/side-by-side)

**Done when**
- [x] Users can browse and compare tank photos over time

## Sprint 15 — Settings + onboarding polish + MVP release
**Goal**: make it easy to start and safe to use.

- [ ] Settings: language, disconnect account, change spreadsheet ID
- [ ] Onboarding: “create/copy the template sheet” instructions (simple step-by-step)
- [ ] Robust error handling (expired token, missing tabs, bad sheet ID)
- [ ] Final UI pass (copy, spacing, empty states)

**Done when**
- [ ] A new user can set up TankLog in < 10 minutes
- [ ] MVP checklist (above) is complete

---

### Post‑MVP backlog (pick later)
- Alerts for dangerous trends (simple heuristics)
- KPI stability score per parameter
- Background Web Push notifications (FCM/OneSignal/etc)
- Read-only sharing mode (no-write scopes)
- Offline-friendly cache (last known data)
- Photo tagging (fish/coral) + growth tracking
