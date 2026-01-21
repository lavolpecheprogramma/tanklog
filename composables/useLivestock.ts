import type { SheetsCellValue } from "@/composables/useGoogleSheets"

export type LivestockCategory = "fish" | "coral" | "invertebrate" | "plant"
export type LivestockStatus = "active" | "removed" | "dead"

export type LivestockTankZone = "top" | "mid" | "bottom" | "rock" | "sand"
export type LivestockOrigin = "wild" | "captive" | "frag"

export const LIVESTOCK_CATEGORIES: LivestockCategory[] = ["fish", "coral", "invertebrate", "plant"]
export const LIVESTOCK_STATUSES: LivestockStatus[] = ["active", "removed", "dead"]
export const LIVESTOCK_TANK_ZONES: LivestockTankZone[] = ["top", "mid", "bottom", "rock", "sand"]
export const LIVESTOCK_ORIGINS: LivestockOrigin[] = ["wild", "captive", "frag"]

/**
 * Canonical LIVESTOCK headers (exact column names).
 * Future optional columns (e.g. growth/light/flow requirements) can be appended after `notes`
 * without breaking the model.
 */
export const LIVESTOCK_HEADERS = [
  "livestock_id",
  "name_common",
  "name_scientific",
  "category",
  "sub_category",
  "tank_zone",
  "origin",
  "date_added",
  "date_removed",
  "status",
  "notes",
] as const

export type TankLivestock = {
  livestockId: string
  nameCommon: string
  nameScientific: string | null
  category: LivestockCategory
  subCategory: string | null
  tankZone: LivestockTankZone | null
  origin: LivestockOrigin | null
  dateAdded: string
  dateRemoved: string | null
  status: LivestockStatus
  notes: string | null

  // Future-proofing (optional, non-breaking)
  growthRate?: string | null
  lightRequirement?: string | null
  flowRequirement?: string | null
}

export type ListTankLivestockInput = {
  spreadsheetId: string
}

export type LivestockUpsertPayload = {
  nameCommon: string
  nameScientific?: string | null
  category: LivestockCategory
  subCategory?: string | null
  tankZone?: LivestockTankZone | null
  origin?: LivestockOrigin | null
  dateAdded: string
  dateRemoved?: string | null
  status: LivestockStatus
  notes?: string | null
}

export type CreateTankLivestockInput = {
  spreadsheetId: string
} & LivestockUpsertPayload

export type UpdateTankLivestockInput = {
  spreadsheetId: string
  livestockId: string
} & LivestockUpsertPayload

export type DeleteTankLivestockInput = {
  spreadsheetId: string
  livestockId: string
}

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

function cellToOptionalText(value: SheetsCellValue | undefined): string | null {
  return normalizeOptionalText(cellToString(value))
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function looksLikeHeaderRow(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return false
  const normalizeHeaderCell = (value: SheetsCellValue | undefined) => (typeof value === "string" ? value.trim().toLowerCase() : "")
  return (
    normalizeHeaderCell(row[0]) === "livestock_id"
    && normalizeHeaderCell(row[1]) === "name_common"
    && normalizeHeaderCell(row[3]) === "category"
    && normalizeHeaderCell(row[7]) === "date_added"
    && normalizeHeaderCell(row[9]) === "status"
  )
}

function normalizeCategory(value: string): LivestockCategory | null {
  const trimmed = value.trim()
  if (trimmed === "fish" || trimmed === "coral" || trimmed === "invertebrate" || trimmed === "plant") return trimmed
  return null
}

function normalizeStatus(value: string): LivestockStatus | null {
  const trimmed = value.trim()
  if (trimmed === "active" || trimmed === "removed" || trimmed === "dead") return trimmed
  return null
}

function normalizeTankZone(value: string): LivestockTankZone | null {
  const trimmed = value.trim()
  if (trimmed === "top" || trimmed === "mid" || trimmed === "bottom" || trimmed === "rock" || trimmed === "sand") return trimmed
  return null
}

function normalizeOrigin(value: string): LivestockOrigin | null {
  const trimmed = value.trim()
  if (trimmed === "wild" || trimmed === "captive" || trimmed === "frag") return trimmed
  return null
}

function parseLivestockRow(row: SheetsCellValue[]): TankLivestock | null {
  const livestockId = cellToString(row[0])
  const nameCommon = cellToString(row[1])
  const nameScientific = cellToOptionalText(row[2])
  const categoryRaw = cellToString(row[3])
  const subCategory = cellToOptionalText(row[4])
  const tankZoneRaw = cellToOptionalText(row[5])
  const originRaw = cellToOptionalText(row[6])
  const dateAdded = cellToString(row[7])
  const dateRemoved = cellToOptionalText(row[8])
  const statusRaw = cellToString(row[9])
  const notes = cellToOptionalText(row[10])

  if (!livestockId || !nameCommon || !categoryRaw || !dateAdded || !statusRaw) return null

  const category = normalizeCategory(categoryRaw)
  const status = normalizeStatus(statusRaw)
  if (!category || !status) return null

  const tankZone = tankZoneRaw ? normalizeTankZone(tankZoneRaw) : null
  const origin = originRaw ? normalizeOrigin(originRaw) : null

  return {
    livestockId,
    nameCommon,
    nameScientific,
    category,
    subCategory,
    tankZone,
    origin,
    dateAdded,
    dateRemoved,
    status,
    notes,
  }
}

function toLivestockRowValues(livestock: TankLivestock): SheetsCellValue[] {
  return [
    livestock.livestockId,
    livestock.nameCommon,
    livestock.nameScientific,
    livestock.category,
    livestock.subCategory,
    livestock.tankZone,
    livestock.origin,
    livestock.dateAdded,
    livestock.dateRemoved,
    livestock.status,
    livestock.notes,
  ]
}

export function useLivestock() {
  const sheets = useGoogleSheets()

  async function ensureLivestockSheet(spreadsheetId: string) {
    if (!spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (ensuredSpreadsheets.has(spreadsheetId)) return
    ensuredSpreadsheets.add(spreadsheetId)

    try {
      const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
      const hasLivestockSheet = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === "LIVESTOCK") ?? false
      if (!hasLivestockSheet) {
        throw new Error("Your tank spreadsheet is missing the “LIVESTOCK” tab.")
      }

      await sheets.updateValues({
        spreadsheetId,
        range: "LIVESTOCK!A1:K1",
        values: [[...LIVESTOCK_HEADERS]],
      })
    } catch (error) {
      ensuredSpreadsheets.delete(spreadsheetId)
      throw error
    }
  }

  async function findLivestockRowNumber(spreadsheetId: string, livestockId: string): Promise<number> {
    await ensureLivestockSheet(spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId,
      range: "LIVESTOCK!A:K",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) throw new Error("Livestock not found.")

    const startIndex = looksLikeHeaderRow(rows[0]) ? 1 : 0
    for (let index = startIndex; index < rows.length; index += 1) {
      const row = rows[index] ?? []
      if (isRowEmpty(row)) continue
      const id = cellToString(row[0])
      if (id === livestockId) return index + 1
    }

    throw new Error("Livestock not found.")
  }

  async function getLivestockSheetId(spreadsheetId: string): Promise<number> {
    const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
    const sheet = spreadsheet.sheets?.find((item) => item.properties?.title === "LIVESTOCK")
    const sheetId = sheet?.properties?.sheetId
    if (typeof sheetId !== "number") throw new Error("Missing LIVESTOCK sheet id.")
    return sheetId
  }

  async function listLivestock(input: ListTankLivestockInput): Promise<TankLivestock[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    await ensureLivestockSheet(input.spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "LIVESTOCK!A:K",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows

    const livestock: TankLivestock[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const item = parseLivestockRow(row)
      if (!item) continue
      livestock.push(item)
    }

    return livestock
  }

  async function createLivestock(input: CreateTankLivestockInput): Promise<TankLivestock> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    const nameCommon = input.nameCommon.trim()
    if (!nameCommon) throw new Error("Common name is required.")

    const category = input.category
    if (!LIVESTOCK_CATEGORIES.includes(category)) throw new Error("Invalid livestock category.")

    const status = input.status
    if (!LIVESTOCK_STATUSES.includes(status)) throw new Error("Invalid livestock status.")

    const dateAdded = input.dateAdded.trim()
    if (!dateAdded || !isDateOnly(dateAdded)) throw new Error("Invalid date added (YYYY-MM-DD).")

    const dateRemoved = normalizeOptionalText(input.dateRemoved ?? null)
    if (dateRemoved && !isDateOnly(dateRemoved)) throw new Error("Invalid date removed (YYYY-MM-DD).")

    const tankZone = input.tankZone ?? null
    if (tankZone !== null && !LIVESTOCK_TANK_ZONES.includes(tankZone)) throw new Error("Invalid tank zone.")

    const origin = input.origin ?? null
    if (origin !== null && !LIVESTOCK_ORIGINS.includes(origin)) throw new Error("Invalid origin.")

    const livestock: TankLivestock = {
      livestockId: generateId("ls"),
      nameCommon,
      nameScientific: normalizeOptionalText(input.nameScientific ?? null),
      category,
      subCategory: normalizeOptionalText(input.subCategory ?? null),
      tankZone,
      origin,
      dateAdded,
      dateRemoved: dateRemoved ?? null,
      status,
      notes: normalizeOptionalText(input.notes ?? null),
    }

    await ensureLivestockSheet(input.spreadsheetId)

    await sheets.appendValues({
      spreadsheetId: input.spreadsheetId,
      range: "LIVESTOCK!A:K",
      values: [toLivestockRowValues(livestock)],
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    })

    return livestock
  }

  async function updateLivestock(input: UpdateTankLivestockInput): Promise<TankLivestock> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    const livestockId = input.livestockId?.trim()
    if (!livestockId) throw new Error("Missing livestock id.")

    const nameCommon = input.nameCommon.trim()
    if (!nameCommon) throw new Error("Common name is required.")

    const category = input.category
    if (!LIVESTOCK_CATEGORIES.includes(category)) throw new Error("Invalid livestock category.")

    const status = input.status
    if (!LIVESTOCK_STATUSES.includes(status)) throw new Error("Invalid livestock status.")

    const dateAdded = input.dateAdded.trim()
    if (!dateAdded || !isDateOnly(dateAdded)) throw new Error("Invalid date added (YYYY-MM-DD).")

    const dateRemoved = normalizeOptionalText(input.dateRemoved ?? null)
    if (dateRemoved && !isDateOnly(dateRemoved)) throw new Error("Invalid date removed (YYYY-MM-DD).")

    const tankZone = input.tankZone ?? null
    if (tankZone !== null && !LIVESTOCK_TANK_ZONES.includes(tankZone)) throw new Error("Invalid tank zone.")

    const origin = input.origin ?? null
    if (origin !== null && !LIVESTOCK_ORIGINS.includes(origin)) throw new Error("Invalid origin.")

    const rowNumber = await findLivestockRowNumber(input.spreadsheetId, livestockId)

    const livestock: TankLivestock = {
      livestockId,
      nameCommon,
      nameScientific: normalizeOptionalText(input.nameScientific ?? null),
      category,
      subCategory: normalizeOptionalText(input.subCategory ?? null),
      tankZone,
      origin,
      dateAdded,
      dateRemoved: dateRemoved ?? null,
      status,
      notes: normalizeOptionalText(input.notes ?? null),
    }

    await sheets.updateValues({
      spreadsheetId: input.spreadsheetId,
      range: `LIVESTOCK!A${rowNumber}:K${rowNumber}`,
      values: [toLivestockRowValues(livestock)],
      valueInputOption: "RAW",
    })

    return livestock
  }

  async function deleteLivestock(input: DeleteTankLivestockInput): Promise<void> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    const livestockId = input.livestockId?.trim()
    if (!livestockId) throw new Error("Missing livestock id.")

    const rowNumber = await findLivestockRowNumber(input.spreadsheetId, livestockId)
    const sheetId = await getLivestockSheetId(input.spreadsheetId)

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

  return {
    ensureLivestockSheet,
    listLivestock,
    createLivestock,
    updateLivestock,
    deleteLivestock,
  }
}

