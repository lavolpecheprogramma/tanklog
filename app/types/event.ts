export type EventTargetType = 'tank' | 'livestock'

export type TankEventType
  = | 'water_change'
    | 'dosing'
    | 'maintenance'
    | 'livestock_addition'
    | 'livestock_removal'

export type LivestockEventType
  = | 'feeding'
    | 'health'
    | 'treatment'
    | 'observation'
    | 'molt'
    | 'spawn'
    | 'fragging'
    | 'other'

export type TankLogEventType = TankEventType | LivestockEventType

export const TANK_EVENT_TYPES: TankEventType[] = [
  'water_change',
  'dosing',
  'maintenance',
  'livestock_addition',
  'livestock_removal'
]

export const LIVESTOCK_EVENT_TYPES: LivestockEventType[] = [
  'feeding',
  'health',
  'treatment',
  'observation',
  'molt',
  'spawn',
  'fragging',
  'other'
]

export type TankLogEvent = {
  id: string
  tankId: string
  occurredAt: string
  type: TankLogEventType
  description: string
  quantity: number | null
  unit: string | null
  product: string | null
  note: string | null
  targetType: EventTargetType
  livestockId: string | null
  createdAt: string
}

export type CreateEventInput = {
  tankId: string
  occurredAt: Date
  type: TankLogEventType
  description: string
  quantity?: number | null
  unit?: string | null
  product?: string | null
  note?: string | null
  targetType: EventTargetType
  livestockId?: string | null
}

export type UpdateEventInput = {
  occurredAt?: Date
  type?: TankLogEventType
  description?: string
  quantity?: number | null
  unit?: string | null
  product?: string | null
  note?: string | null
  targetType?: EventTargetType
  livestockId?: string | null
}
