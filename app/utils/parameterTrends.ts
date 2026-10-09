import type { ParameterRange } from '~/composables/useParameterRanges'
import type { WaterTestSession } from '~/composables/useWaterTests'
import { evaluateMeasurement, type RangeVerdict } from '~/utils/parameterRangeEval'

export type TrendSignal = 'improving' | 'worsening' | 'stable' | 'unknown'

export type ParameterTrend = {
  parameter: string
  unit: string
  latestValue: number
  previousValue: number | null
  delta: number | null
  sampleCount: number
  latestVerdict: RangeVerdict
  previousVerdict: RangeVerdict | null
  /** Moving away from ideal / toward worse bands (includes mild in-range drift) */
  worsening: boolean
  /** Moving closer to ideal / toward better bands */
  improving: boolean
  /** Strong alert: verdict degraded or out-of-range and drifting further out */
  alert: boolean
  signal: TrendSignal
  direction: 'up' | 'down' | 'flat' | 'unknown'
}

const DEFAULT_WINDOW = 6

function verdictRank(verdict: RangeVerdict): number {
  if (verdict === 'critical') return 3
  if (verdict === 'warning') return 2
  if (verdict === 'ok') return 1
  return 0
}

function bandFor(
  ranges: ParameterRange[],
  parameter: string,
  status: ParameterRange['status']
): ParameterRange | undefined {
  return ranges.find(r => r.parameter === parameter && r.status === status)
}

/** Ideal target = midpoint of optimal band, else acceptable. */
function idealTarget(
  ranges: ParameterRange[],
  parameter: string
): { mid: number, width: number } | null {
  const optimal = bandFor(ranges, parameter, 'optimal')
  const acceptable = bandFor(ranges, parameter, 'acceptable')
  const band = optimal ?? acceptable
  if (!band) return null

  const min = band.minValue
  const max = band.maxValue
  if (min === null && max === null) return null

  const lo = min ?? max!
  const hi = max ?? min!
  const mid = (lo + hi) / 2
  const width = Math.max(Math.abs(hi - lo), Math.abs(mid) * 0.1, 1e-6)
  return { mid, width }
}

function distanceToIdeal(value: number, mid: number): number {
  return Math.abs(value - mid)
}

/**
 * Build per-parameter trends from newest sessions first.
 * Signals mild drift toward/away from the optimal (or acceptable) midpoint,
 * plus stronger alerts when the range verdict worsens.
 */
export function computeParameterTrends(
  sessions: WaterTestSession[],
  ranges: ParameterRange[],
  windowSize = DEFAULT_WINDOW
): ParameterTrend[] {
  const window = sessions.slice(0, Math.max(2, windowSize))
  const byParam = new Map<string, Array<{ value: number, unit: string, measuredAt: string }>>()

  for (const session of window) {
    for (const m of session.measurements) {
      if (!Number.isFinite(m.value)) continue
      const list = byParam.get(m.parameter) ?? []
      list.push({ value: m.value, unit: m.unit, measuredAt: m.measuredAt })
      byParam.set(m.parameter, list)
    }
  }

  const trends: ParameterTrend[] = []

  for (const [parameter, points] of byParam) {
    if (!points.length) continue
    const latest = points[0]!
    const previous = points[1] ?? null
    const latestVerdict = evaluateMeasurement(parameter, latest.value, ranges)
    const previousVerdict = previous
      ? evaluateMeasurement(parameter, previous.value, ranges)
      : null

    const delta = previous ? latest.value - previous.value : null
    let direction: ParameterTrend['direction']
    if (delta === null) direction = 'unknown'
    else if (Math.abs(delta) < 1e-9) direction = 'flat'
    else direction = delta > 0 ? 'up' : 'down'

    let verdictWorse = false
    let verdictBetter = false
    if (previousVerdict && previousVerdict !== 'unknown' && latestVerdict !== 'unknown') {
      verdictWorse = verdictRank(latestVerdict) > verdictRank(previousVerdict)
      verdictBetter = verdictRank(latestVerdict) < verdictRank(previousVerdict)
    }

    let driftingWorse = false
    let driftingBetter = false
    const ideal = idealTarget(ranges, parameter)
    if (previous && ideal && direction !== 'flat' && direction !== 'unknown') {
      const prevDist = distanceToIdeal(previous.value, ideal.mid)
      const nextDist = distanceToIdeal(latest.value, ideal.mid)
      // Ignore noise: require ~5% of band width (or absolute tiny epsilon)
      const threshold = Math.max(ideal.width * 0.05, 1e-9)
      if (nextDist > prevDist + threshold) driftingWorse = true
      else if (prevDist > nextDist + threshold) driftingBetter = true
    }

    const alert = Boolean(
      verdictWorse
      || (
        latestVerdict !== 'ok'
        && latestVerdict !== 'unknown'
        && driftingWorse
      )
    )

    const worsening = alert || driftingWorse
    const improving = !worsening && (verdictBetter || driftingBetter)

    let signal: TrendSignal
    if (!previous) signal = 'unknown'
    else if (worsening) signal = 'worsening'
    else if (improving) signal = 'improving'
    else signal = 'stable'

    trends.push({
      parameter,
      unit: latest.unit,
      latestValue: latest.value,
      previousValue: previous?.value ?? null,
      delta,
      sampleCount: points.length,
      latestVerdict,
      previousVerdict,
      worsening,
      improving,
      alert,
      signal,
      direction
    })
  }

  return trends.sort((a, b) => {
    if (a.alert !== b.alert) return a.alert ? -1 : 1
    if (a.worsening !== b.worsening) return a.worsening ? -1 : 1
    if (a.improving !== b.improving) return a.improving ? -1 : 1
    return verdictRank(b.latestVerdict) - verdictRank(a.latestVerdict)
      || a.parameter.localeCompare(b.parameter)
  })
}

export function summarizeTrends(trends: ParameterTrend[]) {
  const withVerdict = trends.filter(t => t.latestVerdict !== 'unknown')
  const inRange = withVerdict.filter(t => t.latestVerdict === 'ok').length
  const worsening = trends.filter(t => t.worsening)
  const improving = trends.filter(t => t.improving)
  const alerts = trends.filter(
    t => t.worsening || t.improving || t.latestVerdict === 'warning' || t.latestVerdict === 'critical'
  )
  return {
    total: withVerdict.length,
    inRange,
    worseningCount: worsening.length,
    improvingCount: improving.length,
    worsening,
    improving,
    alerts
  }
}
