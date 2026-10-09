import type { TankEventType } from '~/types/event'
import type {
  CreateReminderInput,
  MarkReminderDoneOptions,
  Reminder,
  UpdateReminderInput
} from '~/types/reminder'
import { advanceNextDue, getReminderDueStatus, isPastEndDue } from '~/utils/reminderDue'

type ReminderRow = {
  id: string
  tank_id: string
  title: string
  next_due: string
  start_due: string | null
  end_due: string | null
  repeat_every_days: number | null
  last_done: string | null
  notes: string | null
  event_type: TankEventType
  quantity: number | string | null
  unit: string | null
  product: string | null
  onesignal_message_id: string | null
  created_at: string
  updated_at: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function mapRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    tankId: row.tank_id,
    title: row.title,
    nextDue: row.next_due,
    startDue: row.start_due,
    endDue: row.end_due,
    repeatEveryDays: row.repeat_every_days,
    lastDone: row.last_done,
    notes: row.notes,
    eventType: row.event_type,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.unit,
    product: row.product,
    oneSignalMessageId: row.onesignal_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const SELECT = 'id, tank_id, title, next_due, start_due, end_due, repeat_every_days, last_done, notes, event_type, quantity, unit, product, onesignal_message_id, created_at, updated_at'

export function useReminders() {
  const reminders = useState<Reminder[]>('tanklog.reminders', () => [])
  const loading = useState<boolean>('tanklog.reminders.loading', () => false)
  const error = useState<string | null>('tanklog.reminders.error', () => null)
  const push = useReminderPush()
  const notifications = useNotifications()
  const eventsApi = useEvents()

  const dueBuckets = computed(() => {
    const overdue: Reminder[] = []
    const today: Reminder[] = []
    const upcoming: Reminder[] = []

    for (const reminder of reminders.value) {
      const status = getReminderDueStatus(reminder.nextDue)
      if (status === 'overdue') overdue.push(reminder)
      else if (status === 'today') today.push(reminder)
      else upcoming.push(reminder)
    }

    const byDue = (a: Reminder, b: Reminder) => Date.parse(a.nextDue) - Date.parse(b.nextDue)
    overdue.sort(byDue)
    today.sort(byDue)
    upcoming.sort(byDue)
    return { overdue, today, upcoming }
  })

  function replaceLocal(mapped: Reminder) {
    reminders.value = reminders.value
      .map(r => (r.id === mapped.id ? mapped : r))
      .sort((a, b) => Date.parse(a.nextDue) - Date.parse(b.nextDue))
  }

  async function persistMessageId(id: string, messageId: string | null): Promise<Reminder | null> {
    const client = useSupabaseClient()
    if (!client) return null
    const { data, error: updateError } = await client
      .from('reminders')
      .update({ onesignal_message_id: messageId })
      .eq('id', id)
      .select(SELECT)
      .single()
    if (updateError || !data) return null
    const mapped = mapRow(data as ReminderRow)
    replaceLocal(mapped)
    return mapped
  }

  async function syncPushAfterSave(reminder: Reminder, previousMessageId?: string | null): Promise<Reminder> {
    if (previousMessageId) {
      await push.cancelMessage(previousMessageId)
    }

    const messageId = await push.scheduleReminder(reminder)
    if (messageId === reminder.oneSignalMessageId) return reminder

    const updated = await persistMessageId(reminder.id, messageId)
    return updated ?? { ...reminder, oneSignalMessageId: messageId }
  }

  async function listByTank(tankId: string): Promise<Reminder[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('reminders')
        .select(SELECT)
        .eq('tank_id', tankId)
        .order('next_due', { ascending: true })

      if (queryError) throw queryError

      reminders.value = (data as ReminderRow[] | null)?.map(mapRow) ?? []
      return reminders.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateReminderInput): Promise<Reminder> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    if (!input.title.trim()) throw new Error('Title is required')
    if (!input.nextDue || Number.isNaN(input.nextDue.getTime())) {
      throw new Error('Invalid due date')
    }
    if (input.repeatEveryDays != null && input.repeatEveryDays <= 0) {
      throw new Error('Repeat interval must be greater than 0')
    }

    const nextDueIso = input.nextDue.toISOString()
    const payload = {
      tank_id: input.tankId,
      title: input.title.trim(),
      next_due: nextDueIso,
      start_due: nextDueIso,
      end_due: normalizeOptionalText(input.endDue),
      repeat_every_days: input.repeatEveryDays ?? null,
      notes: normalizeOptionalText(input.notes),
      event_type: input.eventType,
      quantity: input.quantity ?? null,
      unit: normalizeOptionalText(input.unit),
      product: normalizeOptionalText(input.product)
    }

    const { data, error: insertError } = await client
      .from('reminders')
      .insert(payload)
      .select(SELECT)
      .single()

    if (insertError) throw insertError

    let mapped = mapRow(data as ReminderRow)
    reminders.value = [...reminders.value, mapped].sort(
      (a, b) => Date.parse(a.nextDue) - Date.parse(b.nextDue)
    )

    mapped = await syncPushAfterSave(mapped)
    return mapped
  }

  async function update(id: string, input: UpdateReminderInput): Promise<Reminder> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const previous = reminders.value.find(r => r.id === id)
    const patch: Record<string, unknown> = {}

    if (input.title !== undefined) {
      const title = input.title.trim()
      if (!title) throw new Error('Title is required')
      patch.title = title
    }
    if (input.nextDue !== undefined) {
      if (Number.isNaN(input.nextDue.getTime())) throw new Error('Invalid due date')
      patch.next_due = input.nextDue.toISOString()
    }
    if (input.eventType !== undefined) patch.event_type = input.eventType
    if (input.repeatEveryDays !== undefined) {
      if (input.repeatEveryDays != null && input.repeatEveryDays <= 0) {
        throw new Error('Repeat interval must be greater than 0')
      }
      patch.repeat_every_days = input.repeatEveryDays
    }
    if (input.endDue !== undefined) patch.end_due = normalizeOptionalText(input.endDue)
    if (input.notes !== undefined) patch.notes = normalizeOptionalText(input.notes)
    if (input.quantity !== undefined) patch.quantity = input.quantity
    if (input.unit !== undefined) patch.unit = normalizeOptionalText(input.unit)
    if (input.product !== undefined) patch.product = normalizeOptionalText(input.product)

    const { data, error: updateError } = await client
      .from('reminders')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw updateError

    let mapped = mapRow(data as ReminderRow)
    replaceLocal(mapped)

    const dueChanged = input.nextDue !== undefined || input.title !== undefined
    if (dueChanged) {
      mapped = await syncPushAfterSave(mapped, previous?.oneSignalMessageId)
    }
    return mapped
  }

  async function remove(id: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const previous = reminders.value.find(r => r.id === id)
    if (previous?.oneSignalMessageId) {
      await push.cancelMessage(previous.oneSignalMessageId)
    }

    const { error: deleteError } = await client.from('reminders').delete().eq('id', id)
    if (deleteError) throw deleteError

    reminders.value = reminders.value.filter(r => r.id !== id)
  }

  /**
   * Mark done: optionally insert a tank event, then advance or delete the reminder.
   */
  async function markDone(id: string, options: MarkReminderDoneOptions = {}): Promise<Reminder | null> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const reminder = reminders.value.find(r => r.id === id)
    if (!reminder) throw new Error('Reminder not found')

    const doneAt = options.doneAt ?? new Date()
    const createEvent = options.createEvent !== false

    if (createEvent) {
      await eventsApi.create({
        tankId: reminder.tankId,
        occurredAt: doneAt,
        type: reminder.eventType,
        description: reminder.title,
        quantity: reminder.quantity,
        unit: reminder.unit,
        product: reminder.product,
        note: reminder.notes,
        targetType: 'tank'
      })
    }

    const days = reminder.repeatEveryDays
    if (days == null) {
      await remove(id)
      return null
    }

    const nextDue = advanceNextDue(reminder.nextDue, days, doneAt)
    if (isPastEndDue(reminder.endDue, nextDue)) {
      await remove(id)
      return null
    }

    if (reminder.oneSignalMessageId) {
      await push.cancelMessage(reminder.oneSignalMessageId)
    }

    const { data, error: updateError } = await client
      .from('reminders')
      .update({
        last_done: doneAt.toISOString(),
        next_due: nextDue.toISOString(),
        onesignal_message_id: null
      })
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw updateError

    let mapped = mapRow(data as ReminderRow)
    replaceLocal(mapped)

    mapped = await syncPushAfterSave(mapped)

    notifications.clearNotified(id)

    return mapped
  }

  return {
    reminders,
    loading,
    error,
    dueBuckets,
    listByTank,
    create,
    update,
    remove,
    markDone
  }
}
