export type ParameterRangeStatus = 'optimal' | 'acceptable' | 'critical'

export type ParameterRange = {
  id: string
  tankId: string
  parameter: string
  minValue: number | null
  maxValue: number | null
  unit: string
  status: ParameterRangeStatus
  color: string | null
}

export type ParameterOption = {
  parameter: string
  unit: string
  color: string | null
}

type ParameterRangeRow = {
  id: string
  tank_id: string
  parameter: string
  min_value: number | string | null
  max_value: number | string | null
  unit: string
  status: ParameterRangeStatus
  color: string | null
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapRow(row: ParameterRangeRow): ParameterRange {
  return {
    id: row.id,
    tankId: row.tank_id,
    parameter: row.parameter,
    minValue: toNumber(row.min_value),
    maxValue: toNumber(row.max_value),
    unit: row.unit,
    status: row.status,
    color: row.color
  }
}

/**
 * Collapse multi-band rows to one option per parameter (prefer acceptable, then optimal).
 */
export function toParameterOptions(rows: ParameterRange[]): ParameterOption[] {
  const rank: Record<ParameterRangeStatus, number> = {
    acceptable: 0,
    optimal: 1,
    critical: 2
  }

  const best = new Map<string, ParameterRange>()
  for (const row of rows) {
    const current = best.get(row.parameter)
    if (!current || rank[row.status] < rank[current.status]) {
      best.set(row.parameter, row)
    }
  }

  return Array.from(best.values())
    .sort((a, b) => a.parameter.localeCompare(b.parameter))
    .map(row => ({
      parameter: row.parameter,
      unit: row.unit,
      color: row.color
    }))
}

export type ParameterRangeInput = {
  parameter: string
  minValue: number | null
  maxValue: number | null
  unit: string
  status: ParameterRangeStatus
  color: string | null
}

export function useParameterRanges() {
  const rows = useState<ParameterRange[]>('tanklog.parameterRanges', () => [])
  const loading = useState<boolean>('tanklog.parameterRanges.loading', () => false)
  const error = useState<string | null>('tanklog.parameterRanges.error', () => null)

  async function listForTank(tankId: string): Promise<ParameterRange[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('parameter_ranges')
        .select('id, tank_id, parameter, min_value, max_value, unit, status, color')
        .eq('tank_id', tankId)
        .order('parameter', { ascending: true })

      if (queryError) throw queryError

      const mapped = (data as ParameterRangeRow[] | null)?.map(mapRow) ?? []
      rows.value = mapped
      return mapped
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Replace all ranges for a tank (delete + insert). */
  async function saveForTank(tankId: string, next: ParameterRangeInput[]): Promise<ParameterRange[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      for (const row of next) {
        if (!row.parameter.trim() || !row.unit.trim()) {
          throw new Error('Parameter and unit are required')
        }
        if (row.minValue === null && row.maxValue === null) {
          throw new Error(`Range for ${row.parameter} needs min or max`)
        }
      }

      const { error: deleteError } = await client
        .from('parameter_ranges')
        .delete()
        .eq('tank_id', tankId)
      if (deleteError) throw deleteError

      if (next.length) {
        const { error: insertError } = await client.from('parameter_ranges').insert(
          next.map(row => ({
            tank_id: tankId,
            parameter: row.parameter.trim(),
            min_value: row.minValue,
            max_value: row.maxValue,
            unit: row.unit.trim(),
            status: row.status,
            color: row.color
          }))
        )
        if (insertError) throw insertError
      }

      return await listForTank(tankId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    rows,
    loading,
    error,
    listForTank,
    saveForTank,
    toParameterOptions
  }
}
