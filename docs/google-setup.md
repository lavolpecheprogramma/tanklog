# Google setup (migration only — v2)

TankLog v2 does **not** use Google for daily CRUD. Google OAuth is only for the optional **migration wizard** (`/dashboard/migrate`) that imports v1 Sheets/Drive data into your BYO Supabase project.

Canonical storage: [`docs/v2-data-model.md`](v2-data-model.md) §9.

## 1) Create a Google Cloud project

- Google Cloud Console → create or pick a project

## 2) OAuth consent screen

- APIs & Services → OAuth consent screen
- User type: **External** (Testing is fine for personal use; add yourself as test user)
- Scopes for migration (read-only):
  - `https://www.googleapis.com/auth/spreadsheets.readonly`
  - `https://www.googleapis.com/auth/drive.readonly`

## 3) Enable APIs

- Google Sheets API
- Google Drive API

## 4) OAuth Client ID (Web)

- Credentials → Create → **OAuth client ID** → Web application
- Authorized JavaScript origins:
  - Local: `http://localhost:3000`
  - Production: your static site origin

Copy the **Client ID**.

## 5) Use in TankLog

1. Sign in to TankLog with your Supabase account (schema applied)
2. Settings → **Open migration wizard**
3. Paste the Client ID (stored only on this device under a migrate-specific key)
4. Connect Google → pick `TankLog` folder → select tanks → import
5. Review the report, then **Disconnect Google & clear Client ID**

Do not leave a Google Client ID configured after import.

## Legacy note

v1 used GIS + Drive/Sheets for all persistence. That path is removed from the app tree; this doc remains for migration setup only.
