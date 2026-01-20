import type { SheetsCellValue } from "@/composables/useGoogleSheets"

export type TankReminder = {
  reminderId: string
  title: string
  nextDue: string
  repeatEveryDays: number | null
  lastDone: string | null
  notes: string | null
}

export type CreateTankReminderInput = {
  spreadsheetId: string
  title: string
  nextDue: string
  repeatEveryDays?: number | null
  notes?: string | null
}

export type ListTankRemindersInput = {
  spreadsheetId: string
}

export type DeleteTankReminderInput = {
  spreadsheetId: string
  reminderId: string
}

export type MarkTankReminderDoneInput = {
  spreadsheetId: string
  reminderId: string
  doneAt?: Date
}

export type SetTankReminderDoneInput = {
  spreadsheetId: string
  reminderId: string
  done: boolean
}

const REMINDERS_HEADERS = ["id", "title", "next_due", "repeat_every_days", "last_done", "notes"] as const
const ensuredSpreadsheets = new Set<string>()

function generateId(prefix: string): string {
  const safePrefix = prefix.trim().replace(/[^a-z0-9_-]/gi, "") || "id"
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)

  try {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return `${safePrefix}_${uuid}`
  } catch {
    // ignore
  }

  return `${safePrefix}_${time}_${random}`
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function cellToString(value: SheetsCellValue | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return normalizeOptionalText(value)
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null
  if (typeof value === "boolean") return String(value)
  return null
}

function cellToNumber(value: SheetsCellValue | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null

  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function cellToOptionalText(value: SheetsCellValue | undefined): string | null {
  return normalizeOptionalText(cellToString(value))
}

function looksLikeHeaderRow(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return false
  const normalizeHeaderCell = (value: SheetsCellValue | undefined) => (typeof value === "string" ? value.trim().toLowerCase() : "")
  return (
    normalizeHeaderCell(row[0]) === "id"
    && normalizeHeaderCell(row[1]) === "title"
    && normalizeHeaderCell(row[2]) === "next_due"
  )
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

function toDateOnlyValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

function toDueEpochMs(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (isDateOnly(trimmed)) {
    const parsed = parseDateOnly(trimmed)
    if (!parsed) return null
    const localEndOfDay = new Date(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999)
    if (Number.isNaN(localEndOfDay.getTime())) return null
    return localEndOfDay.getTime()
  }

  const epochMs = Date.parse(trimmed)
  return Number.isFinite(epochMs) ? epochMs : null
}

function normalizeDateOrTimestamp(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (isDateOnly(trimmed)) return trimmed

  const epochMs = Date.parse(trimmed)
  if (!Number.isFinite(epochMs)) return null
  return new Date(epochMs).toISOString()
}

function addDaysLocal(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

function parseReminderRow(row: SheetsCellValue[]): TankReminder | null {
  const reminderId = cellToString(row[0])
  const title = cellToString(row[1])
  const rawNextDue = cellToString(row[2])
  const repeatEveryDays = cellToNumber(row[3])
  const rawLastDone = cellToOptionalText(row[4])
  const notes = cellToOptionalText(row[5])

  if (!reminderId || !title || !rawNextDue) return null

  const nextDue = normalizeDateOrTimestamp(rawNextDue)
  if (!nextDue) return null

  const lastDone = rawLastDone ? normalizeDateOrTimestamp(rawLastDone) : null
  if (rawLastDone && !lastDone) return null

  const normalizedRepeat = repeatEveryDays !== null && repeatEveryDays > 0 ? repeatEveryDays : null

  return {
    reminderId,
    title,
    nextDue,
    repeatEveryDays: normalizedRepeat,
    lastDone,
    notes,
  }
}

export function useReminders() {
  const sheets = useGoogleSheets()

  async function ensureRemindersSheet(spreadsheetId: string) {
    if (!spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (ensuredSpreadsheets.has(spreadsheetId)) return
    ensuredSpreadsheets.add(spreadsheetId)

    try {
      const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
      const hasRemindersSheet = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === "REMINDERS") ?? false

      if (!hasRemindersSheet) {
        await sheets.batchUpdate({
          spreadsheetId,
          requests: [{ addSheet: { properties: { title: "REMINDERS" } } }],
        })
      }

      await sheets.updateValues({
        spreadsheetId,
        range: "REMINDERS!A1:F1",
        values: [[...REMINDERS_HEADERS]],
      })
    } catch (error) {
      ensuredSpreadsheets.delete(spreadsheetId)
      throw error
    }
  }

  async function createReminder(input: CreateTankReminderInput): Promise<TankReminder> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    const title = input.title.trim()
    if (!title) throw new Error("Title is required.")

    const rawNextDue = input.nextDue.trim()
    if (!rawNextDue) throw new Error("Next due date is required.")

    const nextDue = normalizeDateOrTimestamp(rawNextDue)
    if (!nextDue) throw new Error("Invalid next due date.")

    const repeatEveryDays = input.repeatEveryDays ?? null
    if (repeatEveryDays !== null && (!Number.isFinite(repeatEveryDays) || repeatEveryDays <= 0 || !Number.isInteger(repeatEveryDays))) {
      throw new Error("Invalid repeat interval.")
    }

    const reminder: TankReminder = {
      reminderId: generateId("r"),
      title,
      nextDue,
      repeatEveryDays,
      lastDone: null,
      notes: normalizeOptionalText(input.notes),
    }

    await ensureRemindersSheet(input.spreadsheetId)

    await sheets.appendValues({
      spreadsheetId: input.spreadsheetId,
      range: "REMINDERS!A:F",
      values: [[reminder.reminderId, reminder.title, reminder.nextDue, reminder.repeatEveryDays, reminder.lastDone, reminder.notes]],
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    })

    return reminder
  }

  async function listReminders(input: ListTankRemindersInput): Promise<TankReminder[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    await ensureRemindersSheet(input.spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "REMINDERS!A:F",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows

    const reminders: TankReminder[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const reminder = parseReminderRow(row)
      if (!reminder) continue
      reminders.push(reminder)
    }

    reminders.sort((a, b) => (toDueEpochMs(a.nextDue) ?? Infinity) - (toDueEpochMs(b.nextDue) ?? Infinity))
    return reminders
  }

  async function findReminderRowNumber(spreadsheetId: string, reminderId: string): Promise<number> {
    await ensureRemindersSheet(spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId,
      range: "REMINDERS!A:F",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) throw new Error("Reminder not found.")

    const startIndex = looksLikeHeaderRow(rows[0]) ? 1 : 0
    for (let index = startIndex; index < rows.length; index += 1) {
      const row = rows[index] ?? []
      if (isRowEmpty(row)) continue
      const id = cellToString(row[0])
      if (id === reminderId) {
        return index + 1
      }
    }

    throw new Error("Reminder not found.")
  }

  async function getRemindersSheetId(spreadsheetId: string): Promise<number> {
    const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
    const sheet = spreadsheet.sheets?.find((item) => item.properties?.title === "REMINDERS")
    const sheetId = sheet?.properties?.sheetId
    if (typeof sheetId !== "number") throw new Error("Missing REMINDERS sheet id.")
    return sheetId
  }

  async function deleteReminder(input: DeleteTankReminderInput): Promise<void> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.reminderId) throw new Error("Missing reminder id.")

    const rowNumber = await findReminderRowNumber(input.spreadsheetId, input.reminderId)
    const sheetId = await getRemindersSheetId(input.spreadsheetId)

    await sheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    })
  }

  async function setReminderDone(input: SetTankReminderDoneInput): Promise<TankReminder> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.reminderId) throw new Error("Missing reminder id.")

    const rowNumber = await findReminderRowNumber(input.spreadsheetId, input.reminderId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: `REMINDERS!A${rowNumber}:F${rowNumber}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const row = response.values?.[0]
    if (!row) throw new Error("Reminder not found.")

    const reminder = parseReminderRow(row)
    if (!reminder) throw new Error("Reminder is invalid.")

    const doneAt = input.done ? new Date() : null
    reminder.lastDone = doneAt ? doneAt.toISOString() : null

    await sheets.updateValues({
      spreadsheetId: input.spreadsheetId,
      range: `REMINDERS!A${rowNumber}:F${rowNumber}`,
      values: [[reminder.reminderId, reminder.title, reminder.nextDue, reminder.repeatEveryDays, reminder.lastDone, reminder.notes]],
      valueInputOption: "RAW",
    })

    return reminder
  }

  async function markReminderDone(input: MarkTankReminderDoneInput): Promise<TankReminder> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.reminderId) throw new Error("Missing reminder id.")

    const rowNumber = await findReminderRowNumber(input.spreadsheetId, input.reminderId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: `REMINDERS!A${rowNumber}:F${rowNumber}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const row = response.values?.[0]
    if (!row) throw new Error("Reminder not found.")

    const reminder = parseReminderRow(row)
    if (!reminder) throw new Error("Reminder is invalid.")

    const doneAt = input.doneAt ?? new Date()
    if (Number.isNaN(doneAt.getTime())) throw new Error("Invalid done date.")

    reminder.lastDone = doneAt.toISOString()

    if (reminder.repeatEveryDays !== null) {
      const baseDueEpochMs = toDueEpochMs(reminder.nextDue)
      const baseDue = baseDueEpochMs !== null ? new Date(baseDueEpochMs) : doneAt

      let nextDue = addDaysLocal(baseDue, reminder.repeatEveryDays)
      while (nextDue.getTime() <= doneAt.getTime()) {
        nextDue = addDaysLocal(nextDue, reminder.repeatEveryDays)
      }

      reminder.nextDue = isDateOnly(reminder.nextDue) ? toDateOnlyValue(nextDue) : nextDue.toISOString()
    }

    await sheets.updateValues({
      spreadsheetId: input.spreadsheetId,
      range: `REMINDERS!A${rowNumber}:F${rowNumber}`,
      values: [[reminder.reminderId, reminder.title, reminder.nextDue, reminder.repeatEveryDays, reminder.lastDone, reminder.notes]],
      valueInputOption: "RAW",
    })

    return reminder
  }

  return {
    createReminder,
    listReminders,
    deleteReminder,
    markReminderDone,
    setReminderDone,
  }
}

