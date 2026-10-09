export type WaterTestMeasurement = {
  id: string
  tankId: string
  testGroupId: string
  measuredAt: string
  parameter: string
  value: number
  unit: string
  method: string | null
  note: string | null
}

export type WaterTestSession = {
  testGroupId: string
  measuredAt: string
  method: string | null
  note: string | null
  measurements: WaterTestMeasurement[]
}

export type CreateWaterTestSessionInput = {
  tankId: string
  measuredAt: Date
  measurements: Array<{ parameter: string, value: number, unit: string }>
  method?: string | null
  note?: string | null
}

export type UpdateWaterTestSessionInput = CreateWaterTestSessionInput & {
  testGroupId: string
}

type WaterTestRow = {
  id: string
  tank_id: string
  test_group_id: string
  measured_at: string
  parameter: string
  value: number | string
  unit: string
  method: string | null
  note: string | null
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function generateTestGroupId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return `tg_${uuid}`
  } catch {
    // ignore
  }
  return `tg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function mapRow(row: WaterTestRow): WaterTestMeasurement {
  return {
    id: row.id,
    tankId: row.tank_id,
    testGroupId: row.test_group_id,
    measuredAt: row.measured_at,
    parameter: row.parameter,
    value: Number(row.value),
    unit: row.unit,
    method: row.method,
    note: row.note
  }
}

function toEpochMs(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : -Infinity
}

function groupIntoSessions(measurements: WaterTestMeasurement[]): WaterTestSession[] {
  const byGroup = new Map<string, WaterTestSession>()

  for (const measurement of measurements) {
    let session = byGroup.get(measurement.testGroupId)
    if (!session) {
      session = {
        testGroupId: measurement.testGroupId,
        measuredAt: measurement.measuredAt,
        method: measurement.method,
        note: measurement.note,
        measurements: []
      }
      byGroup.set(measurement.testGroupId, session)
    }

    session.measurements.push(measurement)
    if (!session.method && measurement.method) session.method = measurement.method
    if (!session.note && measurement.note) session.note = measurement.note
    if (toEpochMs(measurement.measuredAt) > toEpochMs(session.measuredAt)) {
      session.measuredAt = measurement.measuredAt
    }
  }

  for (const session of byGroup.values()) {
    session.measurements.sort((a, b) => a.parameter.localeCompare(b.parameter))
  }

  return Array.from(byGroup.values()).sort(
    (a, b) => toEpochMs(b.measuredAt) - toEpochMs(a.measuredAt)
  )
}

export function useWaterTests() {
  const sessions = useState<WaterTestSession[]>('tanklog.waterTestSessions', () => [])
  const loading = useState<boolean>('tanklog.waterTests.loading', () => false)
  const error = useState<string | null>('tanklog.waterTests.error', () => null)

  async function listSessions(tankId: string): Promise<WaterTestSession[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('water_tests')
        .select('id, tank_id, test_group_id, measured_at, parameter, value, unit, method, note')
        .eq('tank_id', tankId)
        .order('measured_at', { ascending: false })

      if (queryError) throw queryError

      const mapped = (data as WaterTestRow[] | null)?.map(mapRow) ?? []
      const grouped = groupIntoSessions(mapped)
      sessions.value = grouped
      return grouped
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createSession(input: CreateWaterTestSessionInput): Promise<WaterTestSession> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    if (!input.measuredAt || Number.isNaN(input.measuredAt.getTime())) {
      throw new Error('Invalid test date')
    }

    const valid = input.measurements.filter(
      m => m.parameter && m.unit && Number.isFinite(m.value)
    )
    if (!valid.length) {
      throw new Error('At least one measurement is required')
    }

    const testGroupId = generateTestGroupId()
    const measuredAt = input.measuredAt.toISOString()
    const method = normalizeOptionalText(input.method)
    const note = normalizeOptionalText(input.note)

    const payload = valid.map(m => ({
      tank_id: input.tankId,
      test_group_id: testGroupId,
      measured_at: measuredAt,
      parameter: m.parameter,
      value: m.value,
      unit: m.unit,
      method,
      note
    }))

    const { data, error: insertError } = await client
      .from('water_tests')
      .insert(payload)
      .select('id, tank_id, test_group_id, measured_at, parameter, value, unit, method, note')

    if (insertError) throw insertError

    const mapped = (data as WaterTestRow[] | null)?.map(mapRow) ?? []
    const [session] = groupIntoSessions(mapped)
    if (!session) throw new Error('Failed to create session')

    sessions.value = [session, ...sessions.value.filter(s => s.testGroupId !== session.testGroupId)]
    return session
  }

  async function updateSession(input: UpdateWaterTestSessionInput): Promise<WaterTestSession> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    if (!input.testGroupId) throw new Error('Test group is required')
    if (!input.measuredAt || Number.isNaN(input.measuredAt.getTime())) {
      throw new Error('Invalid test date')
    }

    const valid = input.measurements.filter(
      m => m.parameter && m.unit && Number.isFinite(m.value)
    )
    if (!valid.length) {
      throw new Error('At least one measurement is required')
    }

    const measuredAt = input.measuredAt.toISOString()
    const method = normalizeOptionalText(input.method)
    const note = normalizeOptionalText(input.note)

    const { error: deleteError } = await client
      .from('water_tests')
      .delete()
      .eq('tank_id', input.tankId)
      .eq('test_group_id', input.testGroupId)

    if (deleteError) throw deleteError

    const payload = valid.map(m => ({
      tank_id: input.tankId,
      test_group_id: input.testGroupId,
      measured_at: measuredAt,
      parameter: m.parameter,
      value: m.value,
      unit: m.unit,
      method,
      note
    }))

    const { data, error: insertError } = await client
      .from('water_tests')
      .insert(payload)
      .select('id, tank_id, test_group_id, measured_at, parameter, value, unit, method, note')

    if (insertError) throw insertError

    const mapped = (data as WaterTestRow[] | null)?.map(mapRow) ?? []
    const [session] = groupIntoSessions(mapped)
    if (!session) throw new Error('Failed to update session')

    sessions.value = [session, ...sessions.value.filter(s => s.testGroupId !== session.testGroupId)]
      .sort((a, b) => toEpochMs(b.measuredAt) - toEpochMs(a.measuredAt))
    return session
  }

  async function removeSession(tankId: string, testGroupId: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')
    if (!testGroupId) throw new Error('Test group is required')

    const { error: deleteError } = await client
      .from('water_tests')
      .delete()
      .eq('tank_id', tankId)
      .eq('test_group_id', testGroupId)

    if (deleteError) throw deleteError

    sessions.value = sessions.value.filter(s => s.testGroupId !== testGroupId)
  }

  return {
    sessions,
    loading,
    error,
    listSessions,
    createSession,
    updateSession,
    removeSession
  }
}
