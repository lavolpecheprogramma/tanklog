# OneSignal (Web Push) — Setup for TankLog v2

TankLog is **frontend-only** and runs as a **static PWA**. This integration supports **optional background web push** via OneSignal (BYO App ID).

For **scheduled reminders** (OneSignal REST API `send_after`), TankLog needs a small **server-side proxy** because OneSignal’s REST API does **not** allow browser CORS requests. The REST **App API key must never** live in the browser.

MVP baseline remains the in-app browser `Notification` API when OneSignal is off or unavailable.

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

TankLog ships the OneSignal service worker at:

- `public/push/onesignal/OneSignalSDKWorker.js`

Once deployed it must be reachable at:

- `https://<your-site><baseURL>/push/onesignal/OneSignalSDKWorker.js`

The file contains:

- `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");`

Notes:

- This path is intentionally **not root-scoped** to avoid conflicts with TankLog’s PWA service worker.
- OneSignal service worker docs: [OneSignal Service Worker](https://documentation.onesignal.com/docs/en/onesignal-service-worker.md)

## 3) Keys and optional scheduling proxy

OneSignal dashboard → **Settings → Keys & IDs**:

- **App ID** (public — paste in TankLog Settings)
- **App API key** (secret — only in the proxy Worker secrets)

### Scheduling proxy (Cloudflare Worker)

This repo includes a ready-to-deploy Worker:

- `workers/onesignal-proxy/`

See `workers/onesignal-proxy/README.md` for deployment steps.

## 4) Configure TankLog

In TankLog → **Dashboard → Settings → Notifications (OneSignal)**:

1. Paste your **App ID**
2. (Optional) Paste your **Scheduling proxy URL** (required for scheduled reminders)
3. (Optional) Paste your **Proxy key** (only if your proxy requires it)
4. Click **Save OneSignal config**
5. Click **Subscribe this browser** and accept the **browser/OS permission** prompt

Config is stored in **localStorage** on this device (`useOneSignalConfig`). Identity uses the Supabase Auth `user.id` as OneSignal `external_id` (`app/plugins/onesignal.client.ts`).

### Permissions checklist (push not showing)

Scheduled reminders use **OneSignal web push**, not the in-app toast. You need:

1. TankLog **Subscribe this browser** succeeded (Settings shows Subscribed)
2. Browser site notifications **Allowed** for your TankLog origin
3. OS notifications enabled for the browser / PWA (macOS Focus off while testing; on iPhone the site must be **Add to Home Screen**)
4. Proxy URL configured (otherwise TankLog cannot call `send_after`)
5. After saving a future reminder, the toast **Push scheduled** with the due time — if you see **Push not scheduled**, fix the error text first

When the scheduling proxy is configured, TankLog does **not** fire local `Notification` alerts for reminders (to avoid an instant fake “push” on save). Delivery is only via OneSignal at `send_after`.

Related code:

- `app/composables/useOneSignalConfig.ts`
- `app/composables/useOneSignal.ts`
- `app/composables/useOneSignalApi.ts`
- `app/composables/useReminderPush.ts`
- `app/plugins/onesignal.client.ts`

## 5) How scheduled reminders work

When you create or update a reminder with a future `next_due`, and OneSignal is enabled + opted in + proxy configured, TankLog schedules a push via the proxy using `send_after`. If **quiet hours** are enabled in Settings, `send_after` is clamped outside that local window.

On delete / mark-done / snooze it cancels or reschedules the previous message (best-effort) and updates the stored id.

Water-test **parameter wait timers** can also schedule a one-shot push at timer end (same proxy rules); cancel stops the local countdown and cancels that message id when present.

TankLog stores the scheduled message id on the Supabase `reminders` row:

- column: `onesignal_message_id`
- app type field: `oneSignalMessageId` (`app/types/reminder.ts`)

Schema: `supabase/schema.sql` / `docs/v2-data-model.md`.

## Security note (important)

Do **not** store the OneSignal App API key in the browser. Use the proxy and keep the API key as a Worker secret.

Out of scope for TankLog-hosted shared apps: no shared OneSignal app or shared proxy; each user BYO.
