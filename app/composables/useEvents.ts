import type {
  CreateEventInput,
  EventTargetType,
  TankLogEvent,
  TankLogEventType,
  UpdateEventInput
} from '~/types/event'

type EventRow = {
  id: string
  tank_id: string
  occurred_at: string
  type: TankLogEventType
  description: string
  quantity: number | string | null
  unit: string | null
  product: string | null
  note: string | null
  target_type: EventTargetType
  livestock_id: string | null
  created_at: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function mapRow(row: EventRow): TankLogEvent {
  return {
    id: row.id,
    tankId: row.tank_id,
    occurredAt: row.occurred_at,
    type: row.type,
    description: row.description,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.unit,
    product: row.product,
    note: row.note,
    targetType: row.target_type,
    livestockId: row.livestock_id,
    createdAt: row.created_at
  }
}

function toInsertPayload(input: CreateEventInput) {
  const targetType = input.targetType
  const livestockId = targetType === 'livestock'
    ? (input.livestockId ?? null)
    : null

  if (targetType === 'livestock' && !livestockId) {
    throw new Error('Livestock is required for livestock-targeted events')
  }

  if (!input.description.trim()) {
    throw new Error('Description is required')
  }

  if (!input.occurredAt || Number.isNaN(input.occurredAt.getTime())) {
    throw new Error('Invalid event date')
  }

  return {
    tank_id: input.tankId,
    occurred_at: input.occurredAt.toISOString(),
    type: input.type,
    description: input.description.trim(),
    quantity: input.quantity ?? null,
    unit: normalizeOptionalText(input.unit),
    product: normalizeOptionalText(input.product),
    note: normalizeOptionalText(input.note),
    target_type: targetType,
    livestock_id: livestockId
  }
}

const SELECT = 'id, tank_id, occurred_at, type, description, quantity, unit, product, note, target_type, livestock_id, created_at'

export function useEvents() {
  const events = useState<TankLogEvent[]>('tanklog.events', () => [])
  const loading = useState<boolean>('tanklog.events.loading', () => false)
  const error = useState<string | null>('tanklog.events.error', () => null)

  async function listByTank(tankId: string): Promise<TankLogEvent[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('events')
        .select(SELECT)
        .eq('tank_id', tankId)
        .order('occurred_at', { ascending: false })

      if (queryError) throw queryError

      events.value = (data as EventRow[] | null)?.map(mapRow) ?? []
      return events.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateEventInput): Promise<TankLogEvent> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { data, error: insertError } = await client
      .from('events')
      .insert(toInsertPayload(input))
      .select(SELECT)
      .single()

    if (insertError) throw insertError

    const mapped = mapRow(data as EventRow)
    events.value = [mapped, ...events.value.filter(e => e.id !== mapped.id)]
    return mapped
  }

  async function update(id: string, input: UpdateEventInput): Promise<TankLogEvent> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const existing = events.value.find(e => e.id === id)
    const targetType = input.targetType ?? existing?.targetType ?? 'tank'
    const livestockId = targetType === 'livestock'
      ? (input.livestockId !== undefined ? input.livestockId : existing?.livestockId ?? null)
      : null

    if (targetType === 'livestock' && !livestockId) {
      throw new Error('Livestock is required for livestock-targeted events')
    }

    const patch: Record<string, unknown> = {
      target_type: targetType,
      livestock_id: livestockId
    }

    if (input.occurredAt !== undefined) {
      if (Number.isNaN(input.occurredAt.getTime())) throw new Error('Invalid event date')
      patch.occurred_at = input.occurredAt.toISOString()
    }
    if (input.type !== undefined) patch.type = input.type
    if (input.description !== undefined) {
      const description = input.description.trim()
      if (!description) throw new Error('Description is required')
      patch.description = description
    }
    if (input.quantity !== undefined) patch.quantity = input.quantity
    if (input.unit !== undefined) patch.unit = normalizeOptionalText(input.unit)
    if (input.product !== undefined) patch.product = normalizeOptionalText(input.product)
    if (input.note !== undefined) patch.note = normalizeOptionalText(input.note)

    const { data, error: updateError } = await client
      .from('events')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw updateError

    const mapped = mapRow(data as EventRow)
    events.value = events.value.map(e => (e.id === id ? mapped : e))
    return mapped
  }

  async function remove(id: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { error: deleteError } = await client.from('events').delete().eq('id', id)
    if (deleteError) throw deleteError

    events.value = events.value.filter(e => e.id !== id)
  }

  return {
    events,
    loading,
    error,
    listByTank,
    create,
    update,
    remove
  }
}
