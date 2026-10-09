export type SheetCell = string | number | boolean | null
export type SheetRecord = Record<string, string>

export function sheetToRecords(values: SheetCell[][]): SheetRecord[] {
  if (!values.length) return []
  const headers = (values[0] ?? []).map(cell => String(cell ?? '').trim())
  if (!headers.length) return []

  const rows: SheetRecord[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? []
    const record: SheetRecord = {}
    let any = false
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (!key) continue
      const raw = row[c]
      const value = raw == null ? '' : String(raw).trim()
      record[key] = value
      if (value) any = true
    }
    if (any) rows.push(record)
  }
  return rows
}

export function parseNumber(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Accept ISO timestamps or date-only → ISO timestamptz string. */
export function toTimestamptz(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`
  }
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function toDateOnly(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function guessExtFromMime(mime: string, name: string): string {
  const fromName = name.split('.').pop()?.toLowerCase()
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('heif')) return 'heif'
  return 'jpg'
}
