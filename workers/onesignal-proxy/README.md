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

1. Install Wrangler and create a worker

```bash
npm i -g wrangler
wrangler login
wrangler init tanklog-onesignal-proxy
```

2. Copy `src/index.ts` from this folder into your worker project.

3. Configure secrets / vars

```bash
wrangler secret put ONESIGNAL_APP_API_KEY
wrangler secret put ALLOWED_ORIGIN   # your TankLog origin, e.g. https://user.github.io
# optional:
wrangler secret put PROXY_KEY
```

4. Deploy

```bash
wrangler deploy
```

## Configure TankLog

Dashboard → Settings → Notifications (OneSignal):

- **App ID**: from OneSignal
- **Scheduling proxy URL**: your deployed worker URL
- **Proxy key**: only if you set `PROXY_KEY` in the worker

## Notes

- Optional: you can subscribe with the OneSignal Web SDK without the proxy.
- Scheduling reminders requires the proxy URL.
