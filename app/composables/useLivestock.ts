import type {
  CreateLivestockInput,
  Livestock,
  LivestockCategory,
  LivestockOrigin,
  LivestockStatus,
  LivestockTankZone,
  UpdateLivestockInput
} from '~/types/livestock'
import { toErrorMessage } from '~/utils/errorMessage'

type LivestockRow = {
  id: string
  tank_id: string
  name_common: string
  name_scientific: string | null
  category: LivestockCategory
  sub_category: string | null
  tank_zone: LivestockTankZone | null
  origin: LivestockOrigin | null
  date_added: string
  date_removed: string | null
  status: LivestockStatus
  cost: number | string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeCost(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid cost')
  return value
}

function mapCost(value: number | string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapRow(row: LivestockRow): Livestock {
  return {
    id: row.id,
    tankId: row.tank_id,
    nameCommon: row.name_common,
    nameScientific: row.name_scientific,
    category: row.category,
    subCategory: row.sub_category,
    tankZone: row.tank_zone,
    origin: row.origin,
    dateAdded: row.date_added,
    dateRemoved: row.date_removed,
    status: row.status,
    cost: mapCost(row.cost),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const SELECT = 'id, tank_id, name_common, name_scientific, category, sub_category, tank_zone, origin, date_added, date_removed, status, cost, notes, created_at, updated_at'

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

export function useLivestock() {
  const items = useState<Livestock[]>('tanklog.livestock', () => [])
  const loading = useState<boolean>('tanklog.livestock.loading', () => false)
  const error = useState<string | null>('tanklog.livestock.error', () => null)

  async function listByTank(tankId: string, status: LivestockStatus | 'all' = 'all'): Promise<Livestock[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      let query = client
        .from('livestock')
        .select(SELECT)
        .eq('tank_id', tankId)
        .order('name_common', { ascending: true })

      if (status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error: queryError } = await query
      if (queryError) throw new Error(toErrorMessage(queryError))

      items.value = (data as LivestockRow[] | null)?.map(mapRow) ?? []
      return items.value
    } catch (e) {
      error.value = toErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getById(id: string): Promise<Livestock | null> {
    const cached = items.value.find(item => item.id === id)
    if (cached) return cached

    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { data, error: queryError } = await client
      .from('livestock')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()

    if (queryError) throw queryError
    if (!data) return null

    const mapped = mapRow(data as LivestockRow)
    items.value = [...items.value.filter(item => item.id !== mapped.id), mapped]
      .sort((a, b) => a.nameCommon.localeCompare(b.nameCommon))
    return mapped
  }

  async function create(input: CreateLivestockInput): Promise<Livestock> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const nameCommon = input.nameCommon.trim()
    if (!nameCommon) throw new Error('Name is required')
    assertDate(input.dateAdded, 'date added')

    const status = input.status ?? 'active'
    const dateRemoved = normalizeOptionalText(input.dateRemoved)
    if (dateRemoved) assertDate(dateRemoved, 'date removed')
    if (status !== 'active' && !dateRemoved) {
      // soft default: today when marking removed/dead without a date
    }

    const payload = {
      tank_id: input.tankId,
      name_common: nameCommon,
      name_scientific: normalizeOptionalText(input.nameScientific),
      category: input.category,
      sub_category: normalizeOptionalText(input.subCategory),
      tank_zone: input.tankZone ?? null,
      origin: input.origin ?? null,
      date_added: input.dateAdded,
      date_removed: dateRemoved,
      status,
      cost: normalizeCost(input.cost),
      notes: normalizeOptionalText(input.notes)
    }

    const { data, error: insertError } = await client
      .from('livestock')
      .insert(payload)
      .select(SELECT)
      .single()

    if (insertError) throw insertError

    const mapped = mapRow(data as LivestockRow)
    items.value = [...items.value, mapped].sort((a, b) => a.nameCommon.localeCompare(b.nameCommon))
    return mapped
  }

  async function update(id: string, input: UpdateLivestockInput): Promise<Livestock> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const patch: Record<string, unknown> = {}

    if (input.nameCommon !== undefined) {
      const nameCommon = input.nameCommon.trim()
      if (!nameCommon) throw new Error('Name is required')
      patch.name_common = nameCommon
    }
    if (input.nameScientific !== undefined) patch.name_scientific = normalizeOptionalText(input.nameScientific)
    if (input.category !== undefined) patch.category = input.category
    if (input.subCategory !== undefined) patch.sub_category = normalizeOptionalText(input.subCategory)
    if (input.tankZone !== undefined) patch.tank_zone = input.tankZone
    if (input.origin !== undefined) patch.origin = input.origin
    if (input.dateAdded !== undefined) {
      assertDate(input.dateAdded, 'date added')
      patch.date_added = input.dateAdded
    }
    if (input.dateRemoved !== undefined) {
      const dateRemoved = normalizeOptionalText(input.dateRemoved)
      if (dateRemoved) assertDate(dateRemoved, 'date removed')
      patch.date_removed = dateRemoved
    }
    if (input.status !== undefined) patch.status = input.status
    if (input.cost !== undefined) patch.cost = normalizeCost(input.cost)
    if (input.notes !== undefined) patch.notes = normalizeOptionalText(input.notes)

    const { data, error: updateError } = await client
      .from('livestock')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw updateError

    const mapped = mapRow(data as LivestockRow)
    items.value = items.value
      .map(item => (item.id === id ? mapped : item))
      .sort((a, b) => a.nameCommon.localeCompare(b.nameCommon))
    return mapped
  }

  async function remove(id: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { error: deleteError } = await client.from('livestock').delete().eq('id', id)
    if (deleteError) throw deleteError

    items.value = items.value.filter(item => item.id !== id)
  }

  return {
    items,
    loading,
    error,
    listByTank,
    getById,
    create,
    update,
    remove
  }
}
