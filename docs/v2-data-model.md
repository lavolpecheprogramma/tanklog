# TankLog v2 — Data model (Supabase / Postgres)

This document is the **source of truth for storage in TankLog v2**.

If `docs/schema_sheets.md` (v1 Google) disagrees with this document, **this document wins for v2**.
SQL in `supabase/schema.sql` must match this document.

Related docs:

- `docs/schema_supabase.md` — human-readable schema companion
- `supabase/schema.sql` — runnable SQL (tables, RLS, storage)
- `docs/v2-specs.md` — product/stack/UI specs (references this file)
- `docs/supabase-setup.md` — BYO Supabase setup for end users

---

## 1. Goals

TankLog stores per-user aquarium data so the app can:

- Log water measurements and chart trends
- Track events, reminders, livestock, photos
- Highlight out-of-range values using per-tank parameter bands
- Keep data **owned by the user** via their own Supabase project (BYO)

---

## 2. What changes from v1 (Sheets + Drive)

| v1 (Google) | v2 (Supabase) |
| --- | --- |
| One Drive folder + spreadsheet per tank | Rows in shared tables, keyed by `tank_id` |
| Isolation by file | Isolation by `user_id` + Row Level Security |
| Photo binaries in Drive | Photo binaries in Supabase Storage |
| `drive_file_id` / `drive_url` | `storage_path` (+ signed URL at read time) |
| String IDs unique within a sheet | UUID primary keys; optional `legacy_id` for migration |
| Discover tanks by listing Drive folders | `select` from `tanks` |

**Domain rules that stay the same:**

- Water tests are **measurement-based**: one row = one parameter measurement
- A “test session” is multiple rows sharing the same `test_group_id` (+ same timestamp)
- Livestock is a **single** inventory (category is a filter, not a separate table)
- Parameter ranges are **per tank**, with multiple status bands per parameter

---

## 3. Closed design decisions

1. **BYO Supabase**: one user-owned project; app stores project URL + anon key locally.
2. **Multi-tank in one database**: every entity has `tank_id` → `tanks.id`.
3. **Every row has `user_id`** → `auth.users.id`; RLS: `user_id = auth.uid()`.
4. **Water tests stay flat** (`water_tests` + `test_group_id`). No separate sessions table in MVP.
5. **Primary keys are `uuid`**. Migrated rows may set `legacy_id` (old Sheets string id).
6. **Timestamps are `timestamptz`**. Date-only fields use `date`.
7. **Enums as `text` + `CHECK`** (same literals as v1).
8. **Events / photos**: `target_type` / `related_type` + nullable `livestock_id` FK + CHECK invariants.
9. **Storage bucket** `photos` (private). Path: `{user_id}/{tank_id}/{tank|livestock}/{photo_id}.ext`.
10. **No wide parameter columns**. No JSONB as primary measurement storage.
11. **`equipment` table** + tank Equipment UI (CRUD) are shipped post-MVP.
12. **`onesignal_message_id`** on reminders is optional/nullable (compat; not required for MVP notify).

---

## 4. Entity-relationship overview

```text
auth.users
    └── tanks
            ├── water_tests
            ├── events ──────────► livestock (optional)
            ├── reminders
            ├── livestock
            ├── photos ──────────► livestock (optional)
            ├── parameter_ranges
            └── equipment
```

Files for photos live in Storage; `photos.storage_path` points at the object.

---

## 5. Tables

Conventions for all tables unless noted:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users (id) on delete cascade`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` (where useful)
- RLS enabled; policies for `select/insert/update/delete` require `user_id = auth.uid()`
- On insert, client (or trigger) must set `user_id = auth.uid()`

### 5.1 `tanks`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | Owner |
| `name` | text | yes | Display name |
| `type` | text | yes | `freshwater` \| `planted` \| `marine` \| `reef` |
| `volume_liters` | numeric | no | |
| `start_date` | date | no | |
| `notes` | text | no | |
| `legacy_id` | text | no | v1 tank id for migration |
| `created_at` | timestamptz | yes | |
| `updated_at` | timestamptz | yes | |

**Invariants**

- `type` in allowed set
- Unique optional: `(user_id, legacy_id)` where `legacy_id is not null`

### 5.2 `water_tests`

One row = one measurement of one parameter.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `test_group_id` | text | yes | Shared by measurements in the same session |
| `measured_at` | timestamptz | yes | Session timestamp (same for group) |
| `parameter` | text | yes | Must exist in that tank’s `parameter_ranges` |
| `value` | numeric | yes | |
| `unit` | text | yes | From parameter ranges for that parameter |
| `method` | text | no | Test kit / method |
| `note` | text | no | |
| `legacy_id` | text | no | Old measurement id |

**Invariants**

- Missing parameters = missing rows (never null “placeholder” values)
- App should keep `method` / `note` consistent within a `test_group_id` (same as v1)

**Indexes**

- `(tank_id, parameter, measured_at desc)`
- `(tank_id, test_group_id)`

### 5.3 `events`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `occurred_at` | timestamptz | yes | |
| `type` | text | yes | Depends on `target_type` (see below) |
| `description` | text | yes | |
| `quantity` | numeric | no | Tank-centric |
| `unit` | text | no | |
| `product` | text | no | |
| `note` | text | no | |
| `target_type` | text | yes | `tank` \| `livestock` (default `tank`) |
| `livestock_id` | uuid | no | FK → `livestock`; required if livestock target |
| `legacy_id` | text | no | |

**Tank event types:** `water_change`, `dosing`, `maintenance`, `livestock_addition`, `livestock_removal`

**Livestock event types:** `feeding`, `health`, `treatment`, `observation`, `molt`, `spawn`, `fragging`, `other`

**CHECK**

- `target_type = 'tank'` ⇒ `livestock_id is null`
- `target_type = 'livestock'` ⇒ `livestock_id is not null`

**Index:** `(tank_id, occurred_at desc)`

### 5.4 `reminders`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `title` | text | yes | Used as event description when marking done |
| `next_due` | timestamptz | yes | |
| `start_due` | timestamptz | no | Set once at creation |
| `end_due` | date | no | Stop scheduling after this date |
| `repeat_every_days` | integer | no | null = one-time; if set must be > 0 |
| `last_done` | timestamptz | no | |
| `notes` | text | no | |
| `event_type` | text | yes | Tank event types only |
| `quantity` | numeric | no | |
| `unit` | text | no | |
| `product` | text | no | |
| `onesignal_message_id` | text | no | Optional push scheduling |
| `legacy_id` | text | no | |

**Behavior (app-level, same as v1)**

- Overdue / due today / upcoming derived from `next_due`
- Mark done may insert an `events` row and advance `next_due` when repeating

**Index:** `(tank_id, next_due)`

### 5.5 `livestock`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `name_common` | text | yes | |
| `name_scientific` | text | no | |
| `category` | text | yes | `fish` \| `coral` \| `invertebrate` \| `plant` |
| `sub_category` | text | no | |
| `tank_zone` | text | no | `top` \| `mid` \| `bottom` \| `rock` \| `sand` |
| `origin` | text | no | `wild` \| `captive` \| `frag` |
| `date_added` | date | yes | |
| `date_removed` | date | no | |
| `status` | text | yes | `active` \| `removed` \| `dead` |
| `cost` | numeric | no | Purchase cost (same currency across the tank; UI formats as EUR) |
| `notes` | text | no | |
| `legacy_id` | text | no | Old `livestock_id` |

**Index:** `(tank_id, status)`

### 5.6 `photos`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `taken_at` | timestamptz | yes | |
| `related_type` | text | yes | `tank` \| `livestock` |
| `livestock_id` | uuid | no | FK → `livestock` when livestock-related |
| `storage_path` | text | yes | Object path in bucket `photos` |
| `note` | text | no | |
| `tags` | text[] | yes | Lowercased tags; default `{}` |
| `legacy_id` | text | no | |

**CHECK**

- `related_type = 'tank'` ⇒ `livestock_id is null`
- `related_type = 'livestock'` ⇒ `livestock_id is not null`

**Do not store** long-lived public URLs as source of truth. Generate signed URLs when displaying.

**Index:** `(tank_id, taken_at desc)`

### 5.7 `parameter_ranges`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `parameter` | text | yes | Allowed `water_tests.parameter` values |
| `min_value` | numeric | no | |
| `max_value` | numeric | no | |
| `unit` | text | yes | Source of truth for units |
| `status` | text | yes | `optimal` \| `acceptable` \| `critical` |
| `color` | text | no | Hex e.g. `#3b82f6` |

**Invariants**

- At least one of `min_value` / `max_value` set
- Unique `(tank_id, parameter, status)`
- Seeded at tank creation from defaults for `tanks.type`; never auto-overwritten later

**Index:** `(tank_id, parameter)`

### 5.8 `equipment`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | PK |
| `user_id` | uuid | yes | |
| `tank_id` | uuid | yes | FK → `tanks` |
| `type` | text | yes | e.g. `light`, `pump`, `filter` |
| `brand_model` | text | yes | |
| `installation_date` | date | no | |
| `maintenance_interval` | text | no | Human-readable e.g. `30d` |
| `cost` | numeric | no | Purchase cost (same currency across the tank; UI formats as EUR) |
| `notes` | text | no | |
| `legacy_id` | text | no | |

**Tank value (client):** sum of `cost` on active livestock + all equipment for the tank.

---

## 6. Storage (files)

- **Bucket:** `photos` (private)
- **Path:** `{user_id}/{tank_id}/{tank|livestock}/{photo_id}.{ext}`
- **Policies:** authenticated user may read/write/delete only objects under `{auth.uid()}/...`
- **Upload flow:** create `photos` row (or generate id) → upload object → persist `storage_path`
- **Display flow:** `createSignedUrl(storage_path)` (or download blob) in the client

---

## 7. Security (RLS)

On every table in `public`:

- `ENABLE ROW LEVEL SECURITY`
- Policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`: `user_id = auth.uid()`
- Prefer also verifying tank ownership on write (either by trigger or by ensuring `tank_id` belongs to same `user_id` via FK + consistent inserts)

**Never** ship the Supabase `service_role` key in the Nuxt client. Only the **anon** (publishable) key + user JWT.

Optional hardening (recommended in SQL):

- Trigger `set_user_id` before insert: `new.user_id := auth.uid()`
- Trigger to reject `tank_id` that does not belong to `auth.uid()`

---

## 8. Queries the UI must support

These are acceptance criteria for the schema:

1. List tanks for the current user
2. Time series for one parameter on one tank (7 / 30 / 90 days)
3. Group measurements into sessions by `test_group_id`
4. Detect out-of-range values using `parameter_ranges` bands for the same tank + parameter
5. List events / reminders (upcoming & overdue) per tank and globally
6. List active livestock; attach related events/photos
7. Photo timeline ordered by `taken_at`, filter by tank vs livestock

---

## 9. Migration mapping (v1 → v2)

Import **per tank**, in this order:

1. `TANK_INFO` (+ folder context) → `tanks` (`legacy_id` = old tank id)
2. `LIVESTOCK` → `livestock` (`legacy_id` = old `livestock_id`); build map `old → new uuid`
3. `PARAMETER_RANGES` → `parameter_ranges`
4. `WATER_TESTS` → `water_tests` (`date` → `measured_at`; keep `test_group_id`)
5. `EVENTS` → `events` (resolve `target_id` via livestock map)
6. `REMINDERS` → `reminders` (normalize date-only → timestamptz where needed)
7. `EQUIPMENT` → `equipment` (if present)
8. `PHOTOS` + Drive download → Storage upload + `photos` row (`storage_path`; drop `drive_*`)

Report per tank: ok / skipped / errors. Google credentials are temporary and removed after import.

---

## 10. Explicit non-goals (data)

- One Postgres schema / database per tank
- Wide tables with one column per parameter
- Storing photo blobs in Postgres
- Dual-write to Google Sheets after migration
- Shared multi-tenant SaaS database operated by TankLog (v2 is BYO)

---

## 11. Changelog

| Date | Change |
| --- | --- |
| 2026-10-09 | Initial v2 data model (BYO Supabase) |
