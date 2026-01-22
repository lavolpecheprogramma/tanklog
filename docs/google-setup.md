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
  - `https://www.googleapis.com/auth/drive.metadata.readonly`
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

TankLog does **not** ship with a default Google OAuth Client ID.
Each user must provide their own Client ID (“Bring Your Own Client ID”).

- Open TankLog
- Go to **Login**
- Paste your **Client ID** when prompted and save it
- Then click **Sign in with Google**

The Client ID is stored **locally on your device** (localStorage) and can be edited or removed from the app settings.

## Notes

- TankLog stores the session token in **session storage** (cleared when the tab is closed).
- Requested scopes:
  - Sheets: full spreadsheet access (needed to read/write your TankLog sheet)
  - Drive: `drive.metadata.readonly` (to discover folders/files) + `drive.file` (to create/upload TankLog files)

