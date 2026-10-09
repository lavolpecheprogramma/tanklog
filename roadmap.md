## TankLog — Roadmap v2 (BYO Supabase)

### How we work
- **Sprint size**: 3–5 days (small, focused)
- **Rule**: ship something visible every sprint (even if simple)
- **Definition of Done (for every sprint)**:
  - Static build works
  - Mobile layout works
  - Basic loading + empty + error states exist

### Canonical specs
- [`docs/v2-specs.md`](docs/v2-specs.md)
- [`docs/v2-data-model.md`](docs/v2-data-model.md)

### MVP target (v2 “done”)
- BYO Supabase connect + email auth
- Postgres CRUD for tanks, tests, events, reminders, livestock, ranges
- Photos on Supabase Storage + timeline/compare
- Charts + out-of-range highlights
- Optional Google → Supabase migration wizard
- UI in Italian + English
- Installable PWA (offline app shell)
- Modern / futuristic Nuxt UI

### Sprint list (at a glance)
- **Current sprint**: S10 Polish + MVP — complete 2026-10-09
- S0: Scaffold Nuxt 4 + Nuxt UI + supabase-js + theme/i18n/PWA
- S1: BYO connect + Auth
- S2: Schema apply UX + health check
- S3: Tanks CRUD
- S4: Water tests create/list/detail
- S5: Ranges + out-of-range + charts
- S6: Events + Reminders (+ Web Notifications)
- S7: Livestock
- S8: Photos Storage + timeline/compare
- S9: Migration wizard (Google → Supabase)
- S10: Onboarding polish + privacy + export JSON + MVP release

---

## Docs foundation — data model + specs
**Goal**: lock storage and product brief before coding the greenfield app.

- [x] Write [`docs/v2-data-model.md`](docs/v2-data-model.md)
- [x] Write [`supabase/schema.sql`](supabase/schema.sql) + [`docs/schema_supabase.md`](docs/schema_supabase.md)
- [x] Write [`docs/supabase-setup.md`](docs/supabase-setup.md)
- [x] Write [`docs/v2-specs.md`](docs/v2-specs.md)
- [x] Update [`project.md`](project.md) for v2 constraints
- [x] Align Cursor rules to Nuxt UI + Supabase
- [x] Archive note: v1 Google docs are migration reference only

**Done when**
- [x] An agent can implement v2 from specs + data model without guessing the schema

---

## Sprint 0 — Scaffold
**Goal**: empty Nuxt app with Nuxt UI, supabase client stub, i18n, PWA, futuristic base theme.

- [x] Branch `feature/v2` (greenfield wipe + `nuxi init --template ui`)
- [x] Nuxt 4 + TypeScript + `@nuxt/ui`
- [x] `@supabase/supabase-js` wired for client-only BYO use (`useSupabaseConfig` / `useSupabaseClient`)
- [x] i18n it/en + PWA baseline
- [x] Remove Google GIS / shadcn dependency from the v2 tree
- [x] Landing + shell with modern/futuristic tokens (cyan HUD)

**Done when**
- [x] `npm run generate` works
- [x] Language switch works (PWA manifest present; install prompt via module)
- [x] No Google scripts required to load the shell

---

## Sprint 1 — BYO connect + Auth
**Goal**: users can paste Supabase keys and sign up / sign in.

- [x] Settings: Supabase URL + anon key (localStorage)
- [x] `useAuth`: signUp / signIn / signOut / session restore
- [x] Middleware: protect dashboard routes
- [x] Login UI (Nuxt UI)

**Done when**
- [x] Login + logout work against a BYO project
- [x] Unauthenticated users cannot open tank pages

---

## Sprint 2 — Schema health
**Goal**: clear path if SQL was not applied.

- [x] Copy/link to `schema.sql` + setup doc in UI (`/dashboard/setup`, `/tanklog-schema.sql`)
- [x] Health check: `tanks` selectable under RLS (`useSchemaHealth`)
- [x] Gate dashboard until healthy (except settings + setup)
- [x] Explicit `GRANT`s in `schema.sql` for Data API when auto-expose is OFF

**Done when**
- [x] Missing schema shows actionable error, not a blank crash

---

## Sprint 3 — Tanks CRUD
**Goal**: create and select tanks in Postgres.

- [x] Create tank (seed default `parameter_ranges` by type)
- [x] List + active tank selection
- [x] Edit / delete tank

**Done when**
- [x] End-to-end tank create → appear in dashboard

---

## Sprint 4 — Water tests
**Goal**: measurement-based logging.

- [x] Create session → many `water_tests` rows / shared `test_group_id`
- [x] List + detail
- [x] Basic validation
- [x] Parameters sourced from tank `parameter_ranges`

**Done when**
- [x] Submitting a multi-param form persists correct rows

---

## Sprint 5 — Ranges + charts
**Goal**: trends and alerts.

- [x] Read/edit `parameter_ranges`
- [x] Out-of-range highlighting
- [x] Parameter time-series charts (7/30/90)

**Done when**
- [x] Bad values are obvious; charts match stored measurements

---

## Sprint 6 — Events + Reminders
**Goal**: interventions and due tasks.

- [x] Events CRUD (tank + livestock targets)
- [x] Reminders CRUD + upcoming/overdue
- [x] Mark done → event + next_due advance
- [x] Notification permission UX + in-app due list

**Done when**
- [x] A due reminder can notify while the app is open

---

## Sprint 7 — Livestock
**Goal**: unified inventory.

- [x] CRUD + filters by category
- [x] Detail page with related activity

**Done when**
- [x] Livestock can be added and opened per tank

---

## Sprint 8 — Photos
**Goal**: Storage-backed media.

- [x] Upload to bucket `photos` + `photos` row
- [x] Timeline + fullscreen + compare
- [x] Signed URL display helper

**Done when**
- [x] Upload appears in timeline for that tank

---

## Sprint 9 — Migration wizard
**Goal**: import v1 Google data once.

- [x] Temporary Google OAuth (import only)
- [x] Discover TankLog folder / per-tank sheets
- [x] Map rows + upload Drive files → Storage
- [x] Report ok/skip/error; disconnect Google

**Done when**
- [x] Wizard can import a sample v1 tank into Supabase (incl. photos when Drive files exist)

---

## Sprint 10 — Polish + MVP release
**Goal**: onboarding under 10 minutes.

- [x] Onboarding wizard (create project → SQL → keys → account)
- [x] Privacy page (BYO Supabase)
- [x] Export JSON
- [x] Final UI pass (copy, empty states, spacing)
- [x] Deploy static site (GitHub Pages workflow + `npm run generate`)

**Done when**
- [x] New user can set up TankLog without Google
- [x] MVP checklist above is complete

---

### Post‑MVP shipped
- [x] Background Web Push (BYO OneSignal App ID + optional Cloudflare scheduling proxy; see `docs/onesignal.md`). In-app browser `Notification` remains the MVP baseline when OneSignal is off.
- [x] Equipment UI (`equipment` table + tank subnav)
- [x] Stability KPIs / dangerous-trend alerts (client-side on tank overview)
- [x] Quiet hours (Settings) + reminder snooze (+1h / +1d); OneSignal schedule clamped outside quiet window
- [x] Offline last-known cache (IndexedDB) for tank overview bundle
- [x] Photo tags (`photos.tags`) + livestock growth oldest/newest compare
- [x] Share snapshot: JSON + HTML download from Settings (no public link)
- [x] Water-test parameter wait countdown (modal presets, sound, Notification / optional OneSignal)

### Post‑MVP backlog
- True public read-only sharing (anonymous RLS / signed share links) — deferred; conflicts with simple BYO RLS
- Offline mutation queue / full offline sync

### Legacy note
v1 Google sprints (Sheets/Drive) are superseded by this board. Keep `docs/schema_sheets.md` only for migration mapping.
