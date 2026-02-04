type OneSignalCreateMessageResponse =
  | {
      id?: string
      external_id?: string
      errors?: unknown
    }
  | {
      id?: ""
      errors?: unknown
    }

type OneSignalCancelMessageResponse =
  | {
      success?: boolean
    }
  | {
      errors?: unknown
    }

function buildAuthorizationHeaderValue(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (!trimmed) return "Key "
  return /^key\s+/i.test(trimmed) ? trimmed : `Key ${trimmed}`
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error) return value.message
  if (typeof value === "string" && value.trim()) return value
  return fallback
}

function extractOneSignalErrors(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const candidate = payload as Record<string, unknown>
  const raw = candidate.errors
  if (!raw) return null
  if (typeof raw === "string") return raw
  if (Array.isArray(raw)) {
    const first = raw.find((item) => typeof item === "string" && item.trim())
    return typeof first === "string" ? first : null
  }
  // Sometimes errors are objects keyed by reason.
  if (raw && typeof raw === "object") {
    const values = Object.values(raw as Record<string, unknown>)
    const firstString = values.find((item) => typeof item === "string" && item.trim())
    if (typeof firstString === "string") return firstString
  }
  return null
}

export type SchedulePushMessageInput = {
  appId: string
  apiKey: string
  externalId: string
  title: string
  body: string
  sendAfter: string
  url?: string
  idempotencyKey?: string
}

export type SchedulePushMessageResult = {
  messageId: string | null
}

export type CancelPushMessageInput = {
  appId: string
  apiKey: string
  messageId: string
}

export function useOneSignalApi() {
  async function schedulePushMessage(input: SchedulePushMessageInput): Promise<SchedulePushMessageResult> {
    if (!import.meta.client) throw new Error("OneSignal API can only be called in the browser.")
    if (!input.appId?.trim()) throw new Error("Missing OneSignal App ID.")
    if (!input.apiKey?.trim()) throw new Error("Missing OneSignal API key.")
    if (!input.externalId?.trim()) throw new Error("Missing OneSignal external id.")
    if (!input.body?.trim()) throw new Error("Missing notification body.")
    if (!input.sendAfter?.trim()) throw new Error("Missing send_after value.")

    const response = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: buildAuthorizationHeaderValue(input.apiKey),
      },
      body: JSON.stringify({
        app_id: input.appId.trim(),
        target_channel: "push",
        include_aliases: {
          external_id: [input.externalId.trim()],
        },
        headings: {
          en: input.title?.trim() || "TankLog",
        },
        contents: {
          en: input.body.trim(),
        },
        url: input.url?.trim() || undefined,
        send_after: input.sendAfter.trim(),
        idempotency_key: input.idempotencyKey?.trim() || undefined,
      }),
    })

    const payload = (await response.json().catch(() => null)) as OneSignalCreateMessageResponse | null
    if (!response.ok) {
      const message = extractOneSignalErrors(payload) ?? `OneSignal request failed (${response.status}).`
      throw new Error(message)
    }

    const messageId = payload?.id?.trim() || ""
    if (!messageId) {
      const message = extractOneSignalErrors(payload) ?? "OneSignal did not schedule the push notification."
      throw new Error(message)
    }

    return { messageId }
  }

  async function cancelPushMessage(input: CancelPushMessageInput): Promise<boolean> {
    if (!import.meta.client) throw new Error("OneSignal API can only be called in the browser.")
    if (!input.appId?.trim()) throw new Error("Missing OneSignal App ID.")
    if (!input.apiKey?.trim()) throw new Error("Missing OneSignal API key.")
    if (!input.messageId?.trim()) return false

    const url = new URL(`https://api.onesignal.com/notifications/${encodeURIComponent(input.messageId.trim())}`)
    url.searchParams.set("app_id", input.appId.trim())

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: buildAuthorizationHeaderValue(input.apiKey),
      },
    })

    const payload = (await response.json().catch(() => null)) as OneSignalCancelMessageResponse | null
    if (!response.ok) {
      const message = extractOneSignalErrors(payload) ?? `OneSignal cancel request failed (${response.status}).`
      throw new Error(message)
    }

    return Boolean(payload && typeof payload === "object" && (payload as any).success)
  }

  return {
    schedulePushMessage,
    cancelPushMessage,
  }
}

