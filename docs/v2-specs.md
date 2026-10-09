# TankLog v2 — Project specifications

This document is the **product + engineering brief** for TankLog v2 (greenfield).

| Concern | Canonical doc |
| --- | --- |
| Storage / Postgres / RLS | [`docs/v2-data-model.md`](v2-data-model.md) |
| SQL to run | [`supabase/schema.sql`](../supabase/schema.sql) |
| Schema companion | [`docs/schema_supabase.md`](schema_supabase.md) |
| End-user BYO setup | [`docs/supabase-setup.md`](supabase-setup.md) |
| Short product summary | [`project.md`](../project.md) |
| Sprint board | [`roadmap.md`](../roadmap.md) |

v1 Google Sheets docs (`docs/schema_sheets.md`, `docs/google-setup.md`) remain as **legacy / migration reference only**.

---

## 1. Vision

TankLog is a **dashboard for freshwater and marine aquariums**:

- Technical logbook
- Preventive analysis (spot negative trends)
- Visual historical archive

Not enterprise tank-management software. Hobbyist-first.

---

## 2. Non-negotiable constraints

- **Frontend-only** — no custom TankLog backend
- **Static site** — Nuxt SSG / SPA static (`ssr: false` acceptable)
- **PWA** — installable + offline app-shell baseline
- **Free stack only**
- **User-controlled storage** — each user brings their **own Supabase project** (URL + anon key)
- **Public-friendly app** — no Google Drive/Sheets scopes required for normal use
- **i18n** — Italian + English
- **No `service_role` in the client**

---

## 3. Stack

| Area | Choice |
| --- | --- |
| Framework | Nuxt 4 + TypeScript (static / `ssr: false`) |
| UI kit | **Nuxt UI** (`@nuxt/ui`) |
| Styling | Tailwind (via Nuxt UI) |
| Charts | Chart.js or ECharts (thin wrapper) |
| i18n | `@nuxtjs/i18n` (`it`, `en`, `no_prefix`) |
| PWA | `@vite-pwa/nuxt` |
| Backend services | User’s Supabase: Auth + Postgres + Storage via **`@supabase/supabase-js`** (thin TankLog composables) |
| Hosting | Static (GitHub Pages / Cloudflare Pages / Netlify) |

**Do not use `@nuxtjs/supabase`** ([supabase.nuxtjs.org](https://supabase.nuxtjs.org/)) for v2. That module wires a **single** project from `NUXT_PUBLIC_SUPABASE_URL` / key at app init. TankLog is **BYO**: each user pastes their own URL + anon key into localStorage and the client must be (re)created at runtime. Prefer custom `useSupabaseConfig` + `useSupabaseClient` over fighting the module.

**Abandoned vs v1:** shadcn-vue, Google Identity Services, Drive/Sheets composables, BYO Google Client ID for daily use.

---

## 4. Architecture

```text
[ Nuxt static PWA + Nuxt UI ]
        |
        | supabase-js (URL + anon key from localStorage)
        v
[ User Supabase project ]
   | Auth | Postgres+RLS | Storage(photos)

Optional one-shot:
[ Migration wizard ] --temp Google OAuth--> Sheets/Drive --> Supabase
```

Local config (device):

- `supabaseUrl`
- `supabaseAnonKey`
- Active tank id (UX preference)
- Locale / theme prefs

Session: managed by supabase-js (persist per Supabase client defaults).

---

## 5. Data model

**Do not redefine tables here.** Follow [`docs/v2-data-model.md`](v2-data-model.md).

Highlights:

- Multi-tank rows in one DB; RLS by `user_id`
- Measurement-based `water_tests` + `test_group_id`
- Photos: DB metadata + Storage path
- Migration uses `legacy_id` columns

---

## 6. Auth & onboarding

### Daily path (no Google)

1. Paste Supabase URL + anon key
2. Sign up / sign in (email)
3. App verifies schema health (`tanks` selectable)
4. If schema missing → show “run `schema.sql`” instructions (link to setup doc)
5. Create tank or open migration wizard

### Gate

- Unauthenticated → login / connect settings only
- Authenticated but unhealthy schema → settings + setup guidance
- Healthy → full dashboard

### Migration path (optional)

See data-model §9 and `docs/supabase-setup.md`. Google is temporary and removed after import.

---

## 7. MVP features (acceptance)

### Tanks

- [ ] Create / list / select active tank
- [ ] Edit tank metadata (name, type, volume, dates, notes)
- [ ] Delete tank (cascade data)

### Water tests

- [ ] Create session (multi-parameter → many `water_tests` rows, shared `test_group_id`)
- [ ] History list + session detail
- [ ] Parameter charts (7/30/90 days)
- [ ] Out-of-range highlighting via `parameter_ranges`
- [ ] Edit ranges (+ seed defaults by tank type on create)

### Events & reminders

- [x] Events CRUD (tank + livestock targets)
- [x] Reminders CRUD; upcoming / overdue
- [x] Mark done → optional event + advance `next_due`
- [x] Web Notifications best-effort while app is open

### Livestock

- [x] CRUD unified inventory
- [x] Detail page with related events/photos

### Photos

- [x] Upload to Storage + `photos` row
- [x] Timeline + fullscreen + basic compare

### Settings / polish

- [x] Language switch it/en
- [x] Disconnect Supabase config / logout
- [x] Privacy page updated for BYO Supabase
- [x] Export JSON (portable backup)
- [x] Migration wizard from Google (if user has v1 data)
- [x] Onboarding wizard (BYO path, no Google)

---

## 8. Routes (target)

```text
/                              marketing landing
/privacy                       privacy
/dashboard                     tank grid (auth)
/dashboard/login               connect keys + auth
/dashboard/settings            keys, language, disconnect, migrate entry
/dashboard/migrate             Google → Supabase wizard
/dashboard/tank/[id]           tank overview
/dashboard/tank/[id]/water-test
/dashboard/tank/[id]/water-test/ranges
/dashboard/tank/[id]/events
/dashboard/tank/[id]/reminders
/dashboard/tank/[id]/livestock
/dashboard/tank/[id]/livestock/[livestockId]
/dashboard/tank/[id]/photos
/dashboard/tank/[id]/configuration
```

---

## 9. Composables (contracts)

Replace Google modules with Supabase-backed equivalents. Suggested surface:

| Composable | Responsibility |
| --- | --- |
| `useSupabaseConfig` | Read/write URL + anon key (localStorage) |
| `useSupabaseClient` | Create/cached client from config |
| `useAuth` | signUp, signIn, signOut, session, user |
| `useSchemaHealth` | Probe `tanks` (+ optional storage) |
| `useTanks` | list/create/update/delete; active tank |
| `useWaterTests` | create session, list/group sessions |
| `useParameterRanges` | list/save; seed defaults |
| `useEvents` | CRUD |
| `useReminders` | CRUD + mark done |
| `useLivestock` | CRUD |
| `usePhotos` | upload/list; signed URL helper |
| `useMigrateFromGoogle` | one-shot import (isolated module) |
| `useNotifications` | permission + notify (best-effort) |
| `usePwa` | install / SW update |

No `useGoogleSheets` / `useGoogleDrive` outside `useMigrateFromGoogle`.

---

## 10. UI / visual system

**Kit:** Nuxt UI primitives; TankLog-specific layouts on top (not stock template look).

**Direction: modern / futuristic monitoring console**

- Dark default; accent **cyan / electric teal** (water + HUD)
- Layered surfaces, geometric expressive sans for display (not Inter/Roboto/Arial/system as hero type)
- Motion: 2–3 intentional micro-interactions (enter, value update, chart draw) — no particle soup
- Landing first viewport: brand + one headline + one CTA
- Tank dashboard: one composition (status + trend), not an admin widget dump
- Mobile-first; WCAG AA; visible focus on dark UI

**Anti-patterns**

- Purple neon / glow stacks
- Cream + terracotta “AI default”
- Broadsheet dense newspaper layout
- Pill-stat strip clutter in the hero

---

## 11. Accessibility

- Semantic landmarks; buttons for actions; links for navigation
- Forms: labels, `aria-describedby` for errors
- Charts: text summary and/or table alternative
- Dialogs: focus trap / restore (prefer Nuxt UI patterns)
- Notification permission only after user action

---

## 12. Roadmap sprints (v2)

See also [`roadmap.md`](../roadmap.md).

| Sprint | Goal |
| --- | --- |
| **S0** | Specs + scaffold Nuxt 3 + Nuxt UI + supabase-js + i18n/PWA + base theme |
| **S1** | BYO connect + Auth |
| **S2** | Schema apply UX + health check |
| **S3** | Tanks CRUD |
| **S4** | Water tests create/list/detail |
| **S5** | Ranges + out-of-range + charts |
| **S6** | Events + Reminders (+ Web Notifications) |
| **S7** | Livestock |
| **S8** | Photos Storage + timeline/compare |
| **S9** | Migration wizard |
| **S10** | Onboarding, privacy, export JSON, MVP release |

**Definition of Done (every sprint):** static build works; mobile layout works; loading / empty / error states exist.

---

## 13. Non-goals

- Custom TankLog server / Edge Functions required for MVP
- Single shared multi-tenant Supabase operated by TankLog as SaaS
- Google Sheets/Drive as primary storage
- Background Web Push as MVP requirement (available post-MVP as BYO OneSignal)
- Public multi-tenant read-only sharing (HTML/JSON snapshot download is the BYO substitute)
- Offline full data sync / write queue (shell + last-known IndexedDB read cache only)

---

## 14. Development philosophy (VIBE)

- Keep it simple; clarity over abstraction
- Hobbyist-first
- Modular but readable
- Prefer small sprints that ship visible UI

---

## 15. Agent / contributor instructions

When implementing v2:

1. Treat **this file + `v2-data-model.md`** as requirements
2. Do not reintroduce Google for normal CRUD paths
3. Prefer Nuxt UI components; keep a11y rules in `.cursor/rules`
4. Update `roadmap.md` checkboxes when a sprint item ships
5. If a request conflicts with BYO / frontend-only / SSG, call it out and propose a compliant alternative

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-10-09 | Initial v2 specifications |
