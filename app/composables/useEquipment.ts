import type {
  CreateEquipmentInput,
  Equipment,
  UpdateEquipmentInput
} from '~/types/equipment'
import { toErrorMessage } from '~/utils/errorMessage'

type EquipmentRow = {
  id: string
  tank_id: string
  type: string
  brand_model: string
  installation_date: string | null
  maintenance_interval: string | null
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

function mapRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    tankId: row.tank_id,
    type: row.type,
    brandModel: row.brand_model,
    installationDate: row.installation_date,
    maintenanceInterval: row.maintenance_interval,
    cost: mapCost(row.cost),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const SELECT = 'id, tank_id, type, brand_model, installation_date, maintenance_interval, cost, notes, created_at, updated_at'

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

export function useEquipment() {
  const items = useState<Equipment[]>('tanklog.equipment', () => [])
  const loading = useState<boolean>('tanklog.equipment.loading', () => false)
  const error = useState<string | null>('tanklog.equipment.error', () => null)

  async function listByTank(tankId: string): Promise<Equipment[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('equipment')
        .select(SELECT)
        .eq('tank_id', tankId)
        .order('type', { ascending: true })
        .order('brand_model', { ascending: true })

      if (queryError) throw new Error(toErrorMessage(queryError))

      items.value = (data as EquipmentRow[] | null)?.map(mapRow) ?? []
      return items.value
    } catch (e) {
      error.value = toErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateEquipmentInput): Promise<Equipment> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const type = input.type.trim()
    const brandModel = input.brandModel.trim()
    if (!type) throw new Error('Type is required')
    if (!brandModel) throw new Error('Brand / model is required')

    const installationDate = normalizeOptionalText(input.installationDate)
    if (installationDate) assertDate(installationDate, 'installation date')

    const payload = {
      tank_id: input.tankId,
      type,
      brand_model: brandModel,
      installation_date: installationDate,
      maintenance_interval: normalizeOptionalText(input.maintenanceInterval),
      cost: normalizeCost(input.cost),
      notes: normalizeOptionalText(input.notes)
    }

    const { data, error: insertError } = await client
      .from('equipment')
      .insert(payload)
      .select(SELECT)
      .single()

    if (insertError) throw insertError

    const mapped = mapRow(data as EquipmentRow)
    items.value = [...items.value, mapped].sort((a, b) => {
      const byType = a.type.localeCompare(b.type)
      return byType !== 0 ? byType : a.brandModel.localeCompare(b.brandModel)
    })
    return mapped
  }

  async function update(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const patch: Record<string, unknown> = {}

    if (input.type !== undefined) {
      const type = input.type.trim()
      if (!type) throw new Error('Type is required')
      patch.type = type
    }
    if (input.brandModel !== undefined) {
      const brandModel = input.brandModel.trim()
      if (!brandModel) throw new Error('Brand / model is required')
      patch.brand_model = brandModel
    }
    if (input.installationDate !== undefined) {
      const installationDate = normalizeOptionalText(input.installationDate)
      if (installationDate) assertDate(installationDate, 'installation date')
      patch.installation_date = installationDate
    }
    if (input.maintenanceInterval !== undefined) {
      patch.maintenance_interval = normalizeOptionalText(input.maintenanceInterval)
    }
    if (input.cost !== undefined) {
      patch.cost = normalizeCost(input.cost)
    }
    if (input.notes !== undefined) {
      patch.notes = normalizeOptionalText(input.notes)
    }

    const { data, error: updateError } = await client
      .from('equipment')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw updateError

    const mapped = mapRow(data as EquipmentRow)
    items.value = items.value
      .map(item => (item.id === id ? mapped : item))
      .sort((a, b) => {
        const byType = a.type.localeCompare(b.type)
        return byType !== 0 ? byType : a.brandModel.localeCompare(b.brandModel)
      })
    return mapped
  }

  async function remove(id: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { error: deleteError } = await client.from('equipment').delete().eq('id', id)
    if (deleteError) throw deleteError

    items.value = items.value.filter(item => item.id !== id)
  }

  return {
    items,
    loading,
    error,
    listByTank,
    create,
    update,
    remove
  }
}
