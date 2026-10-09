/** Parse optional cost from form text (accepts comma decimals). Empty → null. */
export function parseCostInput(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return null
  const value = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid cost')
  }
  return value
}

export function formatMoney(
  value: number | null | undefined,
  locale: string,
  currency = 'EUR'
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value)
}

export function sumCosts(values: Array<number | null | undefined>): number {
  let total = 0
  for (const value of values) {
    if (value != null && Number.isFinite(value)) total += value
  }
  return total
}
