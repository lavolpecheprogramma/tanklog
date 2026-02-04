# OneSignal REST proxy (Cloudflare Worker)

TankLog is a static frontend app. **OneSignal’s REST API does not allow browser CORS**, so scheduling notifications (`send_after`) needs a small server-side proxy.

This Cloudflare Worker:
- Adds the OneSignal **App API key** server-side (kept secret in worker env)
- Adds proper **CORS** headers for your TankLog origin
- Optionally enforces a shared **proxy key**
- Only allows the endpoints TankLog needs:
  - `POST /notifications?c=push`
  - `DELETE /notifications/<message_id>?app_id=<app_id>`

## Setup

1) Install Wrangler and create a worker

```bash
npm i -g wrangler
wrangler login
wrangler init tanklog-onesignal-proxy
```

2) Copy `src/index.ts` from this repo into your worker project.

3) Configure secrets / vars

Set the OneSignal App API key (secret):

```bash
wrangler secret put ONESIGNAL_APP_API_KEY
```

Set allowed origin (your TankLog origin):

```bash
wrangler secret put ALLOWED_ORIGIN
```

Optional: set a proxy key (shared secret required by the worker):

```bash
wrangler secret put PROXY_KEY
```

4) Deploy

```bash
wrangler deploy
```

## Configure TankLog

TankLog → **Dashboard → Settings → Notifications (OneSignal)**:
- **App ID**: from OneSignal
- **Scheduling proxy URL**: your deployed worker URL (e.g. `https://tanklog-onesignal-proxy.<account>.workers.dev`)
- **Proxy key**: only if you set `PROXY_KEY` in the worker

## Notes

- This is optional. You can still use OneSignal Web Push subscriptions without scheduling.
- If you change the worker URL, update the proxy URL in TankLog settings.

