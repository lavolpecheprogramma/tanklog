type Env = {
  /**
   * OneSignal App API key (secret).
   * OneSignal dashboard → Settings → Keys & IDs → App API key
   */
  ONESIGNAL_APP_API_KEY: string

  /**
   * Allowed origin for browser calls, e.g. "https://tanklog.example.com".
   * If empty, the worker will respond with "*" (not recommended).
   */
  ALLOWED_ORIGIN?: string

  /**
   * Optional shared secret checked against the request header `X-Tanklog-Proxy-Key`.
   * If set, TankLog must be configured with the same value.
   */
  PROXY_KEY?: string
}

const ALLOWED_METHODS = "POST, DELETE, OPTIONS"
const ALLOWED_HEADERS = "Content-Type, X-Tanklog-Proxy-Key"

function corsHeaders(origin: string | null, env: Env): Headers {
  const allowedOrigin = env.ALLOWED_ORIGIN?.trim()
  const value = allowedOrigin ? allowedOrigin : (origin ?? "*")
  const headers = new Headers()
  headers.set("Access-Control-Allow-Origin", value)
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS)
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS)
  headers.set("Access-Control-Max-Age", "86400")
  headers.set("Vary", "Origin")
  return headers
}

function withCors(response: Response, origin: string | null, env: Env): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(origin, env)
  cors.forEach((value, key) => headers.set(key, value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function isAllowedOrigin(origin: string | null, env: Env): boolean {
  const allowedOrigin = env.ALLOWED_ORIGIN?.trim()
  if (!allowedOrigin) return true
  if (!origin) return false
  return origin === allowedOrigin
}

function isAuthorized(request: Request, env: Env): boolean {
  const required = env.PROXY_KEY?.trim()
  if (!required) return true
  const provided = request.headers.get("X-Tanklog-Proxy-Key")?.trim()
  return Boolean(provided && provided === required)
}

function isAllowedPath(url: URL): boolean {
  // Allow only:
  // - POST   /notifications?c=push
  // - DELETE /notifications/<message_id>?app_id=<app_id>
  if (url.pathname === "/notifications" && url.searchParams.get("c") === "push") return true
  if (url.pathname.startsWith("/notifications/")) return true
  return false
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin")

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
    }

    if (!isAllowedOrigin(origin, env)) {
      return withCors(new Response("Forbidden origin.", { status: 403 }), origin, env)
    }

    if (!isAuthorized(request, env)) {
      return withCors(new Response("Unauthorized.", { status: 401 }), origin, env)
    }

    const url = new URL(request.url)
    if (!isAllowedPath(url)) {
      return withCors(new Response("Not found.", { status: 404 }), origin, env)
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      return withCors(new Response("Method not allowed.", { status: 405 }), origin, env)
    }

    const apiKey = env.ONESIGNAL_APP_API_KEY?.trim()
    if (!apiKey) {
      return withCors(new Response("Missing OneSignal API key (worker env).", { status: 500 }), origin, env)
    }

    const upstreamUrl = new URL(url.pathname + url.search, "https://api.onesignal.com")

    const headers = new Headers(request.headers)
    headers.set("Authorization", apiKey.toLowerCase().startsWith("key ") ? apiKey : `Key ${apiKey}`)
    headers.delete("X-Tanklog-Proxy-Key")
    headers.delete("Origin")

    const body = request.method === "POST" ? await request.arrayBuffer() : undefined

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body,
    })

    // Always return a readable body to the browser (no streaming needed here).
    const buffer = await upstreamResponse.arrayBuffer()
    const response = new Response(buffer, { status: upstreamResponse.status, headers: upstreamResponse.headers })
    return withCors(response, origin, env)
  },
}

