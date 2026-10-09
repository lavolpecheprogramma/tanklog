# TankLog v2 — BYO Supabase setup

TankLog does **not** host your database. You create a free Supabase project and paste its keys into the app.

Canonical schema: [`supabase/schema.sql`](../supabase/schema.sql)  
Data model: [`docs/v2-data-model.md`](v2-data-model.md)

---

## Checklist (≈10 minutes)

### 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. **New project** → pick org, name, password, region
3. Security toggles (recommended for TankLog):
   - **Enable Data API**: ON
   - **Automatically expose new tables**: OFF
   - **Enable automatic RLS**: ON
4. Wait until the project is ready

> If “Automatically expose new tables” is OFF, TankLog’s `schema.sql` includes explicit `GRANT`s for the `authenticated` role so the Data API can reach the tables (RLS still applies).

### 2. Enable Email Auth

1. Project → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. For local/hobby use you may disable “Confirm email” temporarily (optional); production should keep confirmation on

### 2b. Redirect URLs (password reset)

TankLog can send a **forgot password** email and finish recovery on `/dashboard/reset-password`.

1. Project → **Authentication** → **URL Configuration**
2. Set **Site URL** to your TankLog origin (include the repo subpath if you use GitHub project pages), e.g. `https://you.github.io/tanklog/`
3. Add to **Redirect URLs**:
   - `http://localhost:3000/dashboard/reset-password` (local)
   - `https://<your-tanklog-host><baseURL>/dashboard/reset-password` (production)

Without these entries, the reset link from email will fail or land on the wrong page.

### 3. Apply TankLog schema

1. Project → **SQL** → **New query**
2. Paste the full contents of `supabase/schema.sql` from this repo
3. Run the script
4. Confirm no errors (re-running is mostly idempotent: policies/triggers are dropped/recreated)

This creates tables, RLS, triggers, and the private `photos` storage bucket.

### 4. Copy API keys

1. Project → **Project Settings** → **API**
2. Copy:
   - **Project URL**
   - **anon public** key

Never paste the **service_role** key into TankLog.

### 5. Connect TankLog

1. Open TankLog → Settings / onboarding
2. Paste Project URL + anon key
3. Create an account (sign up) or sign in on **your** project
4. Create a tank (or run the Google migration wizard if you have v1 data)

### 6. Health check

The app should be able to list tanks (even if empty). If you see schema/permission errors, re-run `schema.sql` and confirm you are signed in.

### 7. Photos (Storage)

`schema.sql` creates a private bucket `photos` with RLS on `storage.objects`. Paths are `{user_id}/{tank_id}/{tank|livestock}/{photo_id}.ext`.

If uploads fail with bucket/policy errors, re-run the Storage section of `schema.sql` (or the full script) and confirm you are signed in as the same user that owns the path prefix.

---

## Optional: migrate from Google Sheets / Drive

Only if you used TankLog v1:

1. Finish steps 1–6 above
2. Settings → **Open migration wizard** (`/dashboard/migrate`)
3. Provide a Google OAuth Client ID **temporarily** (import only) — see [`docs/google-setup.md`](google-setup.md)
4. Select your TankLog Drive folder and tanks
5. Review the import report
6. Disconnect Google / clear the Client ID from the device

Details: [`docs/v2-data-model.md`](v2-data-model.md) §9.

---

## Schema upgrades (existing projects)

If you applied an earlier `schema.sql` without photo tags, run in the SQL Editor:

```sql
alter table public.photos add column if not exists tags text[] not null default '{}';
```

Re-download / re-apply the full [`public/tanklog-schema.sql`](../public/tanklog-schema.sql) is also fine (`IF NOT EXISTS` / additive alters).

---

## Privacy notes

- Your aquarium data lives in **your** Supabase project
- TankLog (the static site) only talks to the URL you configured
- You can wipe local TankLog settings without deleting the Supabase project
- Export JSON / HTML snapshot (Settings) is the portable backup / offline share format — not a public link
