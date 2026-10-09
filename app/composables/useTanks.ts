import type { CreateTankInput, Tank, TankType, UpdateTankInput } from '~/types/tank'
import { getDefaultParameterRangesForTankType } from '~/utils/parameterRangeDefaults'

type TankRow = {
  id: string
  name: string
  type: TankType
  volume_liters: number | string | null
  start_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const ACTIVE_TANK_KEY = 'tanklog.activeTankId.v1'

function mapRow(row: TankRow): Tank {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    volumeLiters: row.volume_liters === null || row.volume_liters === undefined
      ? null
      : Number(row.volume_liters),
    startDate: row.start_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function useActiveTankId() {
  const activeTankId = useState<string | null>('tanklog.activeTankId', () => null)

  if (import.meta.client && activeTankId.value === null) {
    activeTankId.value = localStorage.getItem(ACTIVE_TANK_KEY)
  }

  function setActiveTankId(id: string | null) {
    activeTankId.value = id
    if (import.meta.client) {
      if (id) localStorage.setItem(ACTIVE_TANK_KEY, id)
      else localStorage.removeItem(ACTIVE_TANK_KEY)
    }
  }

  return { activeTankId, setActiveTankId }
}

export function useTanks() {
  const tanks = useState<Tank[]>('tanklog.tanks', () => [])
  const loading = useState<boolean>('tanklog.tanks.loading', () => false)
  const error = useState<string | null>('tanklog.tanks.error', () => null)
  const { activeTankId, setActiveTankId } = useActiveTankId()

  const activeTank = computed(() => tanks.value.find(t => t.id === activeTankId.value) ?? null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('tanks')
        .select('id, name, type, volume_liters, start_date, notes, created_at, updated_at')
        .order('created_at', { ascending: true })

      if (queryError) throw queryError

      tanks.value = (data as TankRow[] | null)?.map(mapRow) ?? []

      if (activeTankId.value && !tanks.value.some(t => t.id === activeTankId.value)) {
        setActiveTankId(tanks.value[0]?.id ?? null)
      } else if (!activeTankId.value && tanks.value[0]) {
        setActiveTankId(tanks.value[0].id)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createTank(input: CreateTankInput): Promise<Tank> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const name = input.name.trim()
    if (!name) throw new Error('Tank name is required')

    const { data, error: insertError } = await client
      .from('tanks')
      .insert({
        name,
        type: input.type,
        volume_liters: input.volumeLiters ?? null,
        start_date: input.startDate || null,
        notes: input.notes?.trim() || null
      })
      .select('id, name, type, volume_liters, start_date, notes, created_at, updated_at')
      .single()

    if (insertError) throw insertError

    const tank = mapRow(data as TankRow)

    const defaults = getDefaultParameterRangesForTankType(tank.type)
    if (defaults.length) {
      const { error: rangesError } = await client.from('parameter_ranges').insert(
        defaults.map(row => ({
          tank_id: tank.id,
          parameter: row.parameter,
          min_value: row.minValue,
          max_value: row.maxValue,
          unit: row.unit,
          status: row.status,
          color: row.color
        }))
      )
      if (rangesError) {
        await client.from('tanks').delete().eq('id', tank.id)
        throw rangesError
      }
    }

    tanks.value = [...tanks.value, tank]
    setActiveTankId(tank.id)
    return tank
  }

  async function updateTank(id: string, input: UpdateTankInput): Promise<Tank> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.type !== undefined) patch.type = input.type
    if (input.volumeLiters !== undefined) patch.volume_liters = input.volumeLiters
    if (input.startDate !== undefined) patch.start_date = input.startDate || null
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

    const { data, error: updateError } = await client
      .from('tanks')
      .update(patch)
      .eq('id', id)
      .select('id, name, type, volume_liters, start_date, notes, created_at, updated_at')
      .single()

    if (updateError) throw updateError

    const tank = mapRow(data as TankRow)
    tanks.value = tanks.value.map(t => (t.id === id ? tank : t))
    return tank
  }

  async function deleteTank(id: string) {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { error: deleteError } = await client.from('tanks').delete().eq('id', id)
    if (deleteError) throw deleteError

    tanks.value = tanks.value.filter(t => t.id !== id)
    if (activeTankId.value === id) {
      setActiveTankId(tanks.value[0]?.id ?? null)
    }
  }

  return {
    tanks,
    loading,
    error,
    activeTankId,
    activeTank,
    setActiveTankId,
    refresh,
    createTank,
    updateTank,
    deleteTank
  }
}

export type { Tank, TankType, CreateTankInput, UpdateTankInput }
