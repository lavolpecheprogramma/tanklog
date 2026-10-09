const UUID_RE
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * OneSignal requires `idempotency_key` to be an RFC 9562 UUID.
 * Accept an already-valid UUID, or derive a stable UUIDv4-shaped value from a seed
 * so retries of the same logical send still dedupe.
 */
export async function toIdempotencyUuid(seed: string): Promise<string> {
  const trimmed = seed.trim()
  if (!trimmed) throw new Error('Missing idempotency seed.')
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase()

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed))
  const bytes = new Uint8Array(digest).slice(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
