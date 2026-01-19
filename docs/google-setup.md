# Google setup (Sprint 3)

TankLog is **frontend-only** and uses **Google Identity Services (GIS)** to get an OAuth access token in the browser.

## 1) Create a Google Cloud project

- Go to Google Cloud Console
- Create a new project (or pick an existing one)

## 2) Configure OAuth consent screen

- APIs & Services → OAuth consent screen
- User type: **External** (for personal use you can keep the app in *Testing*)
- Add yourself as a **Test user**
- Add these scopes (you can add more later):
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.file`

## 3) Enable Google APIs

- APIs & Services → Library
- Enable:
  - **Google Sheets API**
  - **Google Drive API**

## 4) Create OAuth Client ID (Web)

- APIs & Services → Credentials → Create Credentials → **OAuth client ID**
- Application type: **Web application**
- Authorized JavaScript origins:
  - Local dev: `http://localhost:3000`
  - Production: your site origin (example GitHub Pages: `https://<user>.github.io`)

Copy the **Client ID**.

## 5) Configure TankLog

TankLog reads the client id from an env var:

- `NUXT_PUBLIC_GOOGLE_CLIENT_ID="<your-client-id>"`

For local dev, create a `.env` file (do not commit it):

```bash
NUXT_PUBLIC_GOOGLE_CLIENT_ID="1234-abc.apps.googleusercontent.com"
```

Then run:

```bash
npm run dev
```

## Notes

- TankLog stores the session token in **session storage** (cleared when the tab is closed).
- Requested scopes:
  - Sheets: full spreadsheet access (needed to read/write your TankLog sheet)
  - Drive: `drive.file` (only files created/opened by TankLog)

