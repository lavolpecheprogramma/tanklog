import type { ParameterRange, ParameterRangeStatus } from '~/composables/useParameterRanges'

export type RangeVerdict = 'ok' | 'warning' | 'critical' | 'unknown'

function isOutside(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return true
  if (max !== null && value > max) return true
  return false
}

function bandFor(
  rows: ParameterRange[],
  parameter: string,
  status: ParameterRangeStatus
): ParameterRange | undefined {
  return rows.find(row => row.parameter === parameter && row.status === status)
}

/**
 * Evaluate a measurement against per-tank bands.
 * critical is widest; acceptable is the main alert band; optimal is informational only.
 */
export function evaluateMeasurement(
  parameter: string,
  value: number,
  rows: ParameterRange[]
): RangeVerdict {
  const forParam = rows.filter(row => row.parameter === parameter)
  if (!forParam.length || !Number.isFinite(value)) return 'unknown'

  const critical = bandFor(forParam, parameter, 'critical')
  if (critical && isOutside(value, critical.minValue, critical.maxValue)) {
    return 'critical'
  }

  const acceptable = bandFor(forParam, parameter, 'acceptable')
  if (acceptable && isOutside(value, acceptable.minValue, acceptable.maxValue)) {
    return 'warning'
  }

  // Outside optimal but inside acceptable → still ok for MVP highlighting
  return 'ok'
}

export function verdictTone(verdict: RangeVerdict): 'success' | 'warning' | 'error' | 'neutral' {
  if (verdict === 'ok') return 'success'
  if (verdict === 'warning') return 'warning'
  if (verdict === 'critical') return 'error'
  return 'neutral'
}
