# TankLog

## Vision
Create a **dashboard for freshwater and marine aquariums** that allows users to record data, visualize trends over time, and monitor the growth and health of tanks, fish, and corals.

The project is designed as:
- **Aquarium technical logbook**
- **Preventive analysis tool** (for detecting negative trends)
- **Visual historical archive**

---

## Main Objectives

- Enter and view **water test results**
- Display **time-series charts** of parameters
- Upload and compare **tank and animal photos**
- Record **events and interventions** (water changes, dosing, maintenance)
- Create **custom reminders** (e.g. water change, dosing, replace batteries) with notifications
- Fully **frontend-based static app**
- Be an **installable PWA** (offline-first baseline)
- Support **multilingual** interface (Italian and English) with dynamic language selection

---

## Key Constraints

- ✅ **Frontend-only** (no custom backend)
- ✅ **Static site generation (SSG)**
- ✅ **PWA** (installable + offline caching)
- ✅ **Free stack only**
- ✅ **User-controlled data storage**
- ❌ No proprietary databases
- ❌ No dedicated servers

---

## Technology Stack

### Frontend
- **Nuxt 3**
- Mode: **Static Site Generation (SSG)**
- Language: TypeScript
- Styling / UI: **shadcn-vue** (headless, accessible, minimal components)
- CSS utility: Tailwind (required by shadcn-vue)
- Charting: Chart.js or ECharts
- Multilingual: Nuxt i18n (Italian and English)
- PWA: `@vite-pwa/nuxt` (manifest + service worker + offline cache)

### Reminders & Notifications
- Reminders: stored in Sheets, evaluated client-side
- Notifications (baseline): Web Notifications API (when app is open)
- Notifications (PWA): Service Worker notifications (best effort; device/browser dependent)
- Optional (future): Web Push via a free provider (e.g. Firebase Cloud Messaging) for background delivery

### Authentication
- **Google OAuth (client-side)**
- Login via Google Identity Services

### Data Storage

#### Google Sheets
Used as a database for:
- Water tests
- Events
- Reminders
- Animals
- Equipment

Accessed via **Google Sheets API** (client-side, OAuth)

#### Google Drive
Used for:
- Tank photos
- Fish and coral photos

Accessed via **Google Drive API**

---

## Architecture Overview

```
[ Nuxt Static PWA ]
        |
        | Service Worker (offline cache + notifications)
        v
[ Browser / OS ]
        |
        | OAuth
        v
[ Google APIs ]
   |         |
Sheets     Drive
```

All application logic runs in the frontend.
Reminder notifications are **best-effort** without a backend: reliable background delivery typically requires an external push provider (optional).

---

## Data Model (Source of Truth)

TankLog stores data **per tank** (no shared database across tanks).

- Each tank has a dedicated Google Drive folder: `Tank_<tank_id>_<tank_name>`
- Inside that folder there is one Google Spreadsheet: `tank_data.xlsx`
- The full storage architecture is defined in `docs/schema_sheets.md` (Drive + Sheets)

### WATER_TESTS (measurement-based)

TankLog stores water tests as an **event/measurement log**:

- **One row in `WATER_TESTS` represents ONE measurement of ONE parameter.**
- A “test session” is represented by **multiple rows**, all sharing the same:
  - `test_group_id`
  - `date`

#### Required sheet structure

- **Sheet name**: `WATER_TESTS`

**Columns:**

- `id` (unique measurement id, generated client-side)
- `test_group_id` (same value for measurements taken in the same session)
- `date` (ISO string)
- `parameter` (string, e.g. `pH`, `KH`, `NO3`)
- `value` (number)
- `unit` (string)
- `method` (optional, e.g. test kit)
- `note` (optional)

#### Behavior

- If a user submits a form with multiple parameters, the app must create **multiple rows** (one per parameter), all sharing the same `test_group_id` and `date`.
- The UI may look like a “single test”, but storage is always **atomic** per measurement.

#### Do NOT

- Do NOT store multiple parameters in the same row.
- Do NOT create one sheet per parameter.
- Do NOT rely on empty cells for missing parameters (missing measurements are represented by **missing rows**, not blanks).

#### Rationale

- Tests may be partial (e.g. only `pH` today, `KH` another day).
- This model simplifies charts, trends, filtering, and future analysis.
- This is the standard approach for time-series and logging systems.

(see `docs/schema_sheets.md`)

---

## MVP Features

### Tank Management
- Create tanks
- Select active tank

### Water Tests
- Manual parameter input
- Test history
- Parameter charts
- Highlight out-of-range values

### Photos
- Upload to Drive
- Save link in Sheet
- Photo timeline

### Reminders & Notifications
- Create custom reminders (one-time or recurring)
- Reminder list (upcoming / overdue)
- Send notifications for due reminders (best effort, device/browser dependent)

### Multilingual
- Italian and English
- Dynamic language switching
- All UI text and charts localized

---

## Advanced Features (post-MVP)

- Event and intervention tracking
- Stability KPIs
- Alerts for dangerous trends
- Background push notifications (via a push provider)
- Photo comparison over time
- Read-only sharing

---

## UX / UI Guidelines

- Mobile-first
- Simple language (for aquarium hobbyists, not technical)
- Focus on:
  - stability
  - trends
  - historical data
- Avoid over-engineering
- Clean UI using **shadcn-vue**, accessible and minimal

---

## Development Philosophy (VIBE)

- Keep it simple
- Prefer clarity over abstraction
- Hobbyist-first, not enterprise
- Modular but readable
- Every function should be understandable months later

---

## Development Phases

### Phase 1 – Setup
- Scaffold Nuxt 3 static + shadcn-vue + Tailwind
- Enable PWA (manifest + service worker + offline cache baseline)
- Google OAuth
- Access Sheets API
- Nuxt i18n configuration

### Phase 2 – Core Data
- CRUD for WATER_TESTS
- CRUD for REMINDERS
- Discover tanks from Drive (per-tank sheets via `TANK_INFO`)

### Phase 3 – Visualization
- Charts
- Dashboard
- Multilingual support

### Phase 4 – Media
- Upload photos
- Photo timeline

---

## Nuxt Pages & Component Structure

### Pages
```
/                   -> Home / Dashboard overview
/tanks              -> Tank list (create + select)
/tanks/[id]         -> Tank detail page (tests, events, photos)
/tests              -> Add/view water tests
/photos             -> Photo timeline gallery
/events             -> Event list and management
/reminders          -> Custom reminders (create / upcoming / overdue)
/settings           -> Account, language, preferences
```

### Components (shadcn-vue)
- Card, Table, Dialog, Button, FormInput, FormSelect, Tabs
- ChartComponent (wrapper for Chart.js / ECharts)
- PhotoGallery, PhotoUploader
- LanguageSwitcher (i18n)
- AlertBanner (for out-of-range values)
- ReminderList, ReminderForm
- InstallPrompt (PWA)
- NotificationPermissionBanner

### Composables / Utilities
- useGoogleSheets() -> CRUD for Sheets
- useGoogleDrive() -> Upload / fetch photos
- useAuth() -> Google OAuth + session management
- useCharts() -> Chart data preparation
- useI18n() -> Language switching helper
- useReminders() -> Reminder CRUD + due calculations
- useNotifications() -> Permission + notify helper
- usePwa() -> install prompt + service worker update handling

---

## Final Goal

An app that:
- Helps users **understand what is happening in the tank**
- Reduces repeated mistakes
- Creates a real historical log of the aquarium
- Supports **Italian and English**

Not a management software.

An **intelligent reef log** 🐠🌊

