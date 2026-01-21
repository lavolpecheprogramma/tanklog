import type { SheetsCellValue } from "@/composables/useGoogleSheets"

export type EventType = "water_change" | "dosing" | "maintenance" | "livestock_addition" | "livestock_removal"

export const EVENT_TYPES: EventType[] = [
  "water_change",
  "dosing",
  "maintenance",
  "livestock_addition",
  "livestock_removal",
]

export type TankEvent = {
  eventId: string
  date: string
  eventType: string
  description: string
  quantity: number | null
  unit: string | null
  product: string | null
  note: string | null
}

export type CreateTankEventInput = {
  spreadsheetId: string
  date: Date
  eventType: EventType
  description: string
  quantity?: number | null
  unit?: string | null
  product?: string | null
  note?: string | null
}

export type UpdateTankEventInput = {
  spreadsheetId: string
  eventId: string
  date: Date
  eventType: EventType
  description: string
  quantity?: number | null
  unit?: string | null
  product?: string | null
  note?: string | null
}

export type ListTankEventsInput = {
  spreadsheetId: string
}

export type DeleteTankEventInput = {
  spreadsheetId: string
  eventId: string
}

const EVENTS_HEADERS = ["id", "date", "type", "description", "quantity", "unit", "product", "note"] as const
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
    && normalizeHeaderCell(row[1]) === "date"
    && normalizeHeaderCell(row[2]) === "type"
    && normalizeHeaderCell(row[3]) === "description"
  )
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function parseEventRow(row: SheetsCellValue[]): TankEvent | null {
  const eventId = cellToString(row[0])
  const date = cellToString(row[1])
  const eventType = cellToString(row[2])
  const description = cellToString(row[3])
  const quantity = cellToNumber(row[4])
  const unit = cellToOptionalText(row[5])
  const product = cellToOptionalText(row[6])
  const note = cellToOptionalText(row[7])

  if (!eventId || !date || !eventType || !description) return null

  return {
    eventId,
    date,
    eventType,
    description,
    quantity,
    unit,
    product,
    note,
  }
}

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function useEvents() {
  const sheets = useGoogleSheets()

  async function ensureEventsSheet(spreadsheetId: string) {
    if (!spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (ensuredSpreadsheets.has(spreadsheetId)) return
    ensuredSpreadsheets.add(spreadsheetId)

    try {
      const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
      const hasEventsSheet = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === "EVENTS") ?? false

      if (!hasEventsSheet) {
        await sheets.batchUpdate({
          spreadsheetId,
          requests: [{ addSheet: { properties: { title: "EVENTS" } } }],
        })
      }

      await sheets.updateValues({
        spreadsheetId,
        range: "EVENTS!A1:H1",
        values: [[...EVENTS_HEADERS]],
      })
    } catch (error) {
      ensuredSpreadsheets.delete(spreadsheetId)
      throw error
    }
  }

  async function findEventRowNumber(spreadsheetId: string, eventId: string): Promise<number> {
    await ensureEventsSheet(spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId,
      range: "EVENTS!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) throw new Error("Event not found.")

    const startIndex = looksLikeHeaderRow(rows[0]) ? 1 : 0
    for (let index = startIndex; index < rows.length; index += 1) {
      const row = rows[index] ?? []
      if (isRowEmpty(row)) continue
      const id = cellToString(row[0])
      if (id === eventId) return index + 1
    }

    throw new Error("Event not found.")
  }

  async function getEventsSheetId(spreadsheetId: string): Promise<number> {
    const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
    const sheet = spreadsheet.sheets?.find((item) => item.properties?.title === "EVENTS")
    const sheetId = sheet?.properties?.sheetId
    if (typeof sheetId !== "number") throw new Error("Missing EVENTS sheet id.")
    return sheetId
  }

  async function createEvent(input: CreateTankEventInput): Promise<TankEvent> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    if (!input.date || Number.isNaN(input.date.getTime())) {
      throw new Error("Invalid event date.")
    }

    const eventType = input.eventType
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error("Invalid event type.")
    }

    const description = input.description.trim()
    if (!description) throw new Error("Description is required.")

    const quantity = input.quantity ?? null
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      throw new Error("Invalid quantity.")
    }

    const unit = normalizeOptionalText(input.unit)
    const product = normalizeOptionalText(input.product)
    const note = normalizeOptionalText(input.note)

    const event: TankEvent = {
      eventId: generateId("ev"),
      date: input.date.toISOString(),
      eventType,
      description,
      quantity,
      unit,
      product,
      note,
    }

    await ensureEventsSheet(input.spreadsheetId)

    await sheets.appendValues({
      spreadsheetId: input.spreadsheetId,
      range: "EVENTS!A:H",
      values: [[event.eventId, event.date, event.eventType, event.description, event.quantity, event.unit, event.product, event.note]],
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    })

    return event
  }

  async function updateEvent(input: UpdateTankEventInput): Promise<TankEvent> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.eventId) throw new Error("Missing event id.")

    if (!input.date || Number.isNaN(input.date.getTime())) {
      throw new Error("Invalid event date.")
    }

    const eventType = input.eventType
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error("Invalid event type.")
    }

    const description = input.description.trim()
    if (!description) throw new Error("Description is required.")

    const quantity = input.quantity ?? null
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      throw new Error("Invalid quantity.")
    }

    const unit = normalizeOptionalText(input.unit)
    const product = normalizeOptionalText(input.product)
    const note = normalizeOptionalText(input.note)

    const rowNumber = await findEventRowNumber(input.spreadsheetId, input.eventId)

    const event: TankEvent = {
      eventId: input.eventId,
      date: input.date.toISOString(),
      eventType,
      description,
      quantity,
      unit,
      product,
      note,
    }

    await sheets.updateValues({
      spreadsheetId: input.spreadsheetId,
      range: `EVENTS!A${rowNumber}:H${rowNumber}`,
      values: [[event.eventId, event.date, event.eventType, event.description, event.quantity, event.unit, event.product, event.note]],
      valueInputOption: "RAW",
    })

    return event
  }

  async function deleteEvent(input: DeleteTankEventInput): Promise<void> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.eventId) throw new Error("Missing event id.")

    const rowNumber = await findEventRowNumber(input.spreadsheetId, input.eventId)
    const sheetId = await getEventsSheetId(input.spreadsheetId)

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

  async function listEvents(input: ListTankEventsInput): Promise<TankEvent[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    await ensureEventsSheet(input.spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "EVENTS!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows

    const events: TankEvent[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const event = parseEventRow(row)
      if (!event) continue
      events.push(event)
    }

    events.sort((a, b) => (toEpochMs(b.date) ?? -Infinity) - (toEpochMs(a.date) ?? -Infinity))
    return events
  }

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    listEvents,
  }
}

