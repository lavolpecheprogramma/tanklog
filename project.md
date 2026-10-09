# TankLog

## Vision
Create a **dashboard for freshwater and marine aquariums** that allows users to record data, visualize trends over time, and monitor the growth and health of tanks, fish, and corals.

The project is designed as:
- **Aquarium technical logbook**
- **Preventive analysis tool** (for detecting negative trends)
- **Visual historical archive**

---

## Canonical docs (v2)

| Doc | Role |
| --- | --- |
| [`docs/v2-specs.md`](docs/v2-specs.md) | Product + engineering specifications |
| [`docs/v2-data-model.md`](docs/v2-data-model.md) | Storage source of truth (Postgres / Storage) |
| [`supabase/schema.sql`](supabase/schema.sql) | Runnable BYO schema (RLS + bucket) |
| [`docs/supabase-setup.md`](docs/supabase-setup.md) | End-user setup guide |
| [`roadmap.md`](roadmap.md) | Sprint board |

Legacy Google Sheets architecture: [`docs/schema_sheets.md`](docs/schema_sheets.md) (migration reference only).

---

## Main Objectives

- Enter and view **water test results**
- Display **time-series charts** of parameters
- Upload and compare **tank and livestock photos**
- Record **events and interventions** (water changes, dosing, maintenance)
- Create **custom reminders** with notifications (best-effort)
- Fully **frontend-based static app** (public-friendly)
- Be an **installable PWA** (offline-first baseline = app shell)
- Support **multilingual** UI (Italian and English)

---

## Key Constraints

- ✅ **Frontend-only** (no custom TankLog backend)
- ✅ **Static site generation / static SPA**
- ✅ **PWA** (installable + offline caching of app shell)
- ✅ **Free stack only**
- ✅ **User-controlled data storage** via **BYO Supabase** (user’s own project URL + anon key)
- ❌ No Google Sheets/Drive as primary storage
- ❌ No `service_role` key in the client
- ❌ No dedicated TankLog servers

---

## Technology Stack

### Frontend
- **Nuxt 4** (TypeScript), static / `ssr: false`
- **Nuxt UI** (`@nuxt/ui`)
- Charting: Chart.js or ECharts
- Multilingual: Nuxt i18n (Italian and English)
- PWA: `@vite-pwa/nuxt`

### Backend services (user-owned)
- **Supabase Auth** — email sign-up / sign-in
- **Supabase Postgres** — structured data + RLS
- **Supabase Storage** — photo files (private bucket `photos`)
- Client: **`@supabase/supabase-js`** directly (not `@nuxtjs/supabase`), because credentials are BYO at runtime

### Reminders & Notifications
- Reminders stored in Postgres, evaluated client-side
- Notifications (baseline): Web Notifications API (when app is open)
- Optional (future): Web Push provider for background delivery

---

## Architecture Overview

```
[ Nuxt Static PWA + Nuxt UI ]
        |
        | supabase-js (BYO URL + anon key)
        v
[ User Supabase project ]
   Auth | Postgres+RLS | Storage
```

Optional one-shot migration wizard may use temporary Google OAuth to import v1 Sheets/Drive data.

---

## Data Model

See [`docs/v2-data-model.md`](docs/v2-data-model.md).

Summary:
- Multi-tank rows in one database (`tanks` + FK `tank_id`)
- `water_tests`: **one row = one measurement**; sessions share `test_group_id`
- Photos: metadata in `photos`, binaries in Storage
- Isolation: `user_id` + Row Level Security

---

## MVP Features

- Tank management (create / select / configure)
- Water tests: input, history, charts, out-of-range highlights, editable ranges
- Events + reminders (+ best-effort notifications)
- Livestock inventory
- Photos: upload + timeline + compare
- i18n it/en
- Installable PWA
- BYO Supabase onboarding + optional Google → Supabase migration
- Export JSON (portable backup)

---

## Advanced Features (post-MVP)

Shipped (static / BYO):

- Equipment UI
- Stability KPIs / dangerous-trend alerts (client-side)
- Background Web Push (BYO OneSignal + optional proxy)
- Photo tagging + livestock growth compare
- Offline last-known data cache (IndexedDB read fallback)
- Share snapshot (JSON + HTML download; no public viewer)
- Quiet hours + reminder snooze
- Water-test parameter wait countdown (sound + Notification / OneSignal)

---

## UX / UI Guidelines

- Mobile-first
- Modern / futuristic monitoring aesthetic (cyan–teal HUD, dark default)
- Nuxt UI primitives; custom TankLog composition (not generic admin chrome)
- Simple language for hobbyists
- Focus on stability, trends, history
- Accessibility: WCAG AA

---

## Development Philosophy (VIBE)

- Keep it simple
- Prefer clarity over abstraction
- Hobbyist-first, not enterprise
- Modular but readable

---

## Final Goal

An app that:
- Helps users **understand what is happening in the tank**
- Reduces repeated mistakes
- Creates a real historical log of the aquarium
- Supports **Italian and English**
- Can be published publicly without Google verification blockers

Not a management suite — an **intelligent reef log**.
