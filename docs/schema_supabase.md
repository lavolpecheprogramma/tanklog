# TankLog v2 — Supabase schema companion

Canonical storage rules: [`docs/v2-data-model.md`](v2-data-model.md).  
Runnable SQL: [`supabase/schema.sql`](../supabase/schema.sql).  
BYO setup: [`docs/supabase-setup.md`](supabase-setup.md).

This file is a short companion for humans reviewing the schema without opening the full data-model doc.

---

## Ownership model

- Each end user creates their **own** free Supabase project (BYO).
- TankLog (static Nuxt app) stores `supabaseUrl` + `anonKey` in localStorage.
- Auth is Supabase Auth (email/password or magic link) on **that** project.
- All tables include `user_id`; RLS enforces `user_id = auth.uid()`.
- Triggers force `user_id` from the JWT and reject writes to tanks the user does not own.

---

## Tables (summary)

| Table | Role |
| --- | --- |
| `tanks` | Tank identity + metadata |
| `water_tests` | One row = one parameter measurement; sessions via `test_group_id` |
| `events` | Interventions (tank or livestock target) |
| `reminders` | One-time / recurring tasks |
| `livestock` | Unified biological inventory |
| `photos` | Photo metadata (+ optional `tags text[]`); files in Storage |
| `parameter_ranges` | Allowed params + alert bands per tank |
| `equipment` | Equipment inventory (UI shipped) |

---

## Storage

- Bucket: `photos` (private, ~10 MiB, image MIME types)
- Path: `{user_id}/{tank_id}/{tank|livestock}/{photo_id}.ext`
- Display with signed URLs; do not treat permanent public URLs as source of truth

---

## Health check (app)

After connect + login, the app should verify:

1. Session present (`auth.getUser()`)
2. `select id from tanks limit 1` succeeds (RLS + schema applied)
3. Storage bucket `photos` reachable for authenticated upload/list (best-effort)

If (2) fails with relation/permission errors, show “run schema.sql” guidance.

---

## Migration from Google Sheets

See section 9 in [`v2-data-model.md`](v2-data-model.md).  
Legacy string IDs are stored in `legacy_id` columns; new primary keys are UUIDs.
