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
- Sprint 0: Repo scaffold + first deploy (PWA foundation)
- Sprint 1: Page skeletons + app navigation
- Sprint 2: i18n foundation (it/en)
- Sprint 3: Google setup + Auth (client-side)
- Sprint 4: Google Sheets: connect + read basics
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

- [ ] Scaffold Nuxt 3 (TypeScript) configured for **SSG**
- [ ] Install + configure Tailwind + `shadcn-vue`
- [ ] Enable PWA (`@vite-pwa/nuxt`): manifest + icons + service worker
- [ ] Offline cache baseline (app shell + static assets)
- [ ] App shell: header + simple navigation + responsive container
- [ ] Deploy to a free host (GitHub Pages / Netlify / Cloudflare Pages)

**Done when**
- [ ] `npm run build` produces a static output and deploy is live
- [ ] Home page loads and navigation works
- [ ] App is installable as a PWA (manifest detected)
- [ ] Home loads offline after a first successful visit

## Sprint 1 — Page skeletons + app navigation
**Goal**: all main pages exist and feel coherent.

- [ ] Create pages: `/`, `/vasques/[id]`, `/tests`, `/photos`, `/events`, `/reminders`, `/settings`
- [ ] Add active tank selector (temporary “mock” list)
- [ ] Add simple UI primitives (Card, Button, Dialog) and consistent spacing

**Done when**
- [ ] You can click through all pages without broken routes
- [ ] “Active tank” is visible in the UI (even if mocked)

## Sprint 2 — i18n foundation (it/en)
**Goal**: the whole UI can switch language.

- [ ] Configure Nuxt i18n (Italian + English)
- [ ] Add `LanguageSwitcher` component
- [ ] Localize navigation, page titles, buttons, empty states

**Done when**
- [ ] Language switch updates UI immediately and persists (local storage)

## Sprint 3 — Google setup + Auth (client-side)
**Goal**: login/logout works and we can call Google APIs.

- [ ] Create/Document Google Cloud project setup (OAuth consent + credentials)
- [ ] Enable Google Sheets API + Google Drive API
- [ ] Implement Google Identity Services login (client-side OAuth)
- [ ] Store session/token safely for the session (and rehydrate on refresh)

**Done when**
- [ ] Login + logout work
- [ ] We can obtain an access token with the right scopes

## Sprint 4 — Google Sheets: connect + read basics
**Goal**: read user data from a spreadsheet.

- [ ] `useGoogleSheets()` composable: auth header + basic read helpers
- [ ] “Connect spreadsheet” step (spreadsheet ID stored locally)
- [ ] Read `TANKS` and show real tank list + active tank selection

**Done when**
- [ ] App loads tanks from the user’s sheet and remembers the chosen sheet

## Sprint 5 — Water tests: create (write to Sheets)
**Goal**: users can add a water test record.

- [ ] Define WATER_TESTS model + client-side ID generation
- [ ] Water test form (minimal: date, tank, key params)
- [ ] Write to `WATER_TESTS` tab via Sheets API

**Done when**
- [ ] Submitting the form creates a new row in Google Sheets
- [ ] Basic validation prevents obvious bad inputs

## Sprint 6 — Water tests: list + detail
**Goal**: history is usable.

- [ ] List water tests for active tank (sorted by date)
- [ ] Simple filters (date range / parameter presence)
- [ ] Row detail view (dialog or page section)

**Done when**
- [ ] Users can find and open past tests quickly

## Sprint 7 — Parameter ranges + out-of-range highlighting
**Goal**: detect “bad values” immediately.

- [ ] Read `PARAMETER_RANGES` tab
- [ ] Compute out-of-range per test + per parameter
- [ ] Add `AlertBanner` + per-value highlighting in tables

**Done when**
- [ ] Any out-of-range value is clearly highlighted and explained

## Sprint 8 — Charts (trends over time)
**Goal**: visualize stability and trends.

- [ ] Add `ChartComponent` wrapper (Chart.js or ECharts)
- [ ] Parameter time-series chart for active tank
- [ ] Localize chart labels + tooltips (it/en)

**Done when**
- [ ] Users can select a parameter and see an accurate trend chart

## Sprint 9 — Tank detail page (bring it together)
**Goal**: one place to understand the tank status.

- [ ] `/vasques/[id]` shows: latest values, alerts, charts, recent events/photos placeholders
- [ ] “Last 7/30/90 days” quick ranges for charts

**Done when**
- [ ] Tank detail feels like the main dashboard for that tank

## Sprint 10 — Events: CRUD (Sheets)
**Goal**: track interventions (water changes, dosing, maintenance).

- [ ] Events model + form (type, date, notes, tank)
- [ ] Write to `EVENTS` tab
- [ ] List events on tank detail + `/events` page

**Done when**
- [ ] Events can be added and viewed per tank

## Sprint 11 — Reminders: CRUD + upcoming/overdue (Sheets)
**Goal**: track recurring tasks (water changes, dosing, batteries, etc).

- [ ] Define REMINDERS model + client-side ID generation
- [ ] Reminder form (title, tank optional, schedule, next due, notes)
- [ ] Write to / read from `REMINDERS` tab via Sheets API (CRUD)
- [ ] Upcoming + overdue views (global + per tank)

**Done when**
- [ ] A reminder can be created and appears in the upcoming list
- [ ] Overdue reminders are clearly highlighted

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

- [ ] `useGoogleDrive()` composable: upload helper
- [ ] Photo uploader UI (tank + date + optional notes)
- [ ] Save photo metadata/link in `PHOTOS` tab

**Done when**
- [ ] Upload creates a file in Drive and a row in the sheet

## Sprint 14 — Photo timeline + comparison
**Goal**: browse progress over time.

- [ ] Photo timeline/gallery for a tank (ordered by date)
- [ ] Fullscreen viewer
- [ ] Basic compare mode (pick two photos and toggle/side-by-side)

**Done when**
- [ ] Users can browse and compare tank photos over time

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
