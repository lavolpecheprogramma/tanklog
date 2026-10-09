/** Normalize unknown thrown values (incl. Supabase PostgrestError) to a readable string. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown
      details?: unknown
      error_description?: unknown
      hint?: unknown
    }
    if (typeof record.message === 'string' && record.message.trim()) return record.message
    if (typeof record.error_description === 'string' && record.error_description.trim()) {
      return record.error_description
    }
    if (typeof record.details === 'string' && record.details.trim()) return record.details
    if (typeof record.hint === 'string' && record.hint.trim()) return record.hint
  }
  if (typeof error === 'string' && error.trim()) return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
