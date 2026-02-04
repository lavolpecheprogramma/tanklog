# OneSignal (Web Push) — Setup for TankLog

TankLog is **frontend-only** and runs as a **static PWA**. This integration supports **web push notifications** via OneSignal.

For **scheduled reminders** (using the OneSignal REST API `send_after`), TankLog needs a small **server-side proxy** because OneSignal’s REST API does **not** allow browser CORS requests.

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

## 3) Get your keys (and optionally set up a proxy for scheduling)

OneSignal dashboard → **Settings → Keys & IDs**:

- **App ID** (public)
- **App API key** (secret; used by the proxy for REST API scheduling)

Docs:
- [Keys & IDs](https://documentation.onesignal.com/docs/en/keys-and-ids.md)

### Scheduling proxy (Cloudflare Worker, free)

This repo includes a ready-to-deploy Worker:

- `workers/onesignal-proxy/`

See `workers/onesignal-proxy/README.md` for deployment steps.

## 4) Configure TankLog

In TankLog → **Dashboard → Settings → Notifications (OneSignal)**:

1. Paste your **App ID**
2. (Optional) Paste your **Scheduling proxy URL** (required for scheduled reminders)
3. (Optional) Paste your **Proxy key** (only if your proxy requires it)
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

Do **not** store the OneSignal App API key in the browser. Use the proxy and keep the API key as a Worker secret.

