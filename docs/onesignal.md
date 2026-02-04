# OneSignal (Web Push) — Setup for TankLog

TankLog is **frontend-only** and runs as a **static PWA**. This integration supports **web push notifications** via OneSignal, including **scheduled delivery** using the OneSignal REST API `send_after`.

## 1) Create a OneSignal app (Web → Custom Code)

In the OneSignal dashboard:

1. Create a **New App/Website**
2. Platform: **Web**
3. Integration: **Custom Code**
4. Set the **Site URL** to your TankLog deployment origin (must match exactly).

Docs:
- [Web SDK setup](https://documentation.onesignal.com/docs/en/web-sdk-setup.md)
- [Custom Code Setup](https://documentation.onesignal.com/docs/en/web-push-custom-code-setup.md)

## 2) Host the OneSignal service worker file

TankLog already ships the OneSignal service worker file at:

- `public/push/onesignal/OneSignalSDKWorker.js`

So, once deployed, it must be reachable at:

- `https://<your-site><baseURL>/push/onesignal/OneSignalSDKWorker.js`

The file contains:

- `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");`

Notes:
- This path is intentionally **not root-scoped** to avoid conflicts with TankLog’s PWA service worker.
- OneSignal service worker docs: [OneSignal Service Worker](https://documentation.onesignal.com/docs/en/onesignal-service-worker.md)

## 3) Get your keys

OneSignal dashboard → **Settings → Keys & IDs**:

- **App ID** (public)
- **App API key** (secret; used for REST API scheduling)

Docs:
- [Keys & IDs](https://documentation.onesignal.com/docs/en/keys-and-ids.md)

## 4) Configure TankLog

In TankLog → **Dashboard → Settings → Notifications (OneSignal)**:

1. Paste your **App ID**
2. Paste your **App API key** (optional for subscribing, required for scheduling)
3. Click **Enable**
4. Click **Subscribe this browser**

## 5) How scheduled reminders work

When you create a reminder with a future `next_due`, TankLog schedules a OneSignal push using:

- `send_after` (delivery time)

Docs:
- [Push notification API](https://documentation.onesignal.com/reference/push-notification.md)

TankLog stores the scheduled message id in the REMINDERS sheet:

- `onesignal_message_id`

This is used to cancel/reschedule notifications when reminders are deleted or marked as done.

## Security note (important)

TankLog is frontend-only, so the **OneSignal App API key is stored locally in your browser** when you configure it.

- Use this only on **trusted devices**
- Do not use this approach for a shared/public deployment where you don’t control the browser environment

