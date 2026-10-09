import type { TankEventType } from '~/types/event'

export type ReminderDueStatus = 'overdue' | 'today' | 'upcoming'

export type Reminder = {
  id: string
  tankId: string
  title: string
  nextDue: string
  startDue: string | null
  endDue: string | null
  repeatEveryDays: number | null
  lastDone: string | null
  notes: string | null
  eventType: TankEventType
  quantity: number | null
  unit: string | null
  product: string | null
  oneSignalMessageId: string | null
  createdAt: string
  updatedAt: string
}

export type CreateReminderInput = {
  tankId: string
  title: string
  nextDue: Date
  eventType: TankEventType
  repeatEveryDays?: number | null
  endDue?: string | null
  notes?: string | null
  quantity?: number | null
  unit?: string | null
  product?: string | null
}

export type UpdateReminderInput = {
  title?: string
  nextDue?: Date
  eventType?: TankEventType
  repeatEveryDays?: number | null
  endDue?: string | null
  notes?: string | null
  quantity?: number | null
  unit?: string | null
  product?: string | null
}

export type MarkReminderDoneOptions = {
  createEvent?: boolean
  doneAt?: Date
}
