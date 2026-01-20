import type { SheetsCellValue } from "@/composables/useGoogleSheets"
import type { TankType } from "@/composables/useTanks"

export type ParameterRangeStatus = "optimal" | "acceptable" | "critical"

export type ParameterRange = {
  parameter: string
  minValue: number | null
  maxValue: number | null
  unit: string
  status: ParameterRangeStatus
}

export type ListParameterRangesInput = {
  spreadsheetId: string
  /**
   * Kept for compatibility with older callers: ranges are stored per tank
   * (one spreadsheet per tank), so the tank type is implicit.
   */
  tankType?: TankType | null
}

export type SaveParameterRangesInput = {
  spreadsheetId: string
  /**
   * Kept for compatibility with older callers: ranges are stored per tank
   * (one spreadsheet per tank), so the tank type is implicit.
   */
  tankType: TankType
  ranges: Array<{
    parameter: string
    minValue: number | null
    maxValue: number | null
    unit: string
    status?: ParameterRangeStatus | null
  }>
  existingRowCount?: number | null
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

function normalizeStatus(value: string | null): ParameterRangeStatus | null {
  const trimmed = value?.trim()
  if (trimmed === "optimal" || trimmed === "acceptable" || trimmed === "critical") return trimmed
  return null
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function looksLikeHeaderRow(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return false
  const normalizeHeaderCell = (value: SheetsCellValue | undefined) => (typeof value === "string" ? value.trim().toLowerCase() : "")
  return (
    normalizeHeaderCell(row[0]) === "parameter"
    && normalizeHeaderCell(row[1]) === "min_value"
    && normalizeHeaderCell(row[2]) === "max_value"
    && (normalizeHeaderCell(row[4]) === "status" || normalizeHeaderCell(row[4]) === "tank_type")
  )
}

function parseParameterRangeRow(row: SheetsCellValue[]): ParameterRange | null {
  const parameter = cellToString(row[0])
  const minValue = cellToNumber(row[1])
  const maxValue = cellToNumber(row[2])
  const unit = cellToString(row[3])
  const statusCell = cellToString(row[4])
  const status = normalizeStatus(statusCell) ?? "acceptable"

  if (!parameter || !unit) return null
  if (minValue === null && maxValue === null) return null

  return {
    parameter,
    minValue,
    maxValue,
    unit,
    status,
  }
}

export function useParameterRanges() {
  const sheets = useGoogleSheets()

  function normalizeParameterKey(value: string): string {
    return value.trim().toLowerCase()
  }

  function pickEffectiveRange(ranges: ParameterRange[]): ParameterRange | null {
    // Prefer "acceptable" as the single representative range for legacy callers (highlighting, simple hints).
    const byStatus = new Map<ParameterRangeStatus, ParameterRange[]>()
    for (const range of ranges) {
      const list = byStatus.get(range.status) ?? []
      list.push(range)
      byStatus.set(range.status, list)
    }

    if (byStatus.get("acceptable")?.length) return byStatus.get("acceptable")![0]!
    if (byStatus.get("optimal")?.length) return byStatus.get("optimal")![0]!
    if (byStatus.get("critical")?.length) return byStatus.get("critical")![0]!
    return null
  }

  async function listParameterRanges(input: ListParameterRangesInput): Promise<ParameterRange[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "PARAMETER_RANGES!A:E",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows
    const allByParam = new Map<string, ParameterRange[]>()

    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const parsed = parseParameterRangeRow(row)
      if (!parsed) continue
      const key = normalizeParameterKey(parsed.parameter)
      const list = allByParam.get(key) ?? []
      list.push(parsed)
      allByParam.set(key, list)
    }

    const effective: ParameterRange[] = []
    for (const list of allByParam.values()) {
      const selected = pickEffectiveRange(list)
      if (selected) effective.push(selected)
    }

    effective.sort((a, b) => a.parameter.localeCompare(b.parameter))
    return effective
  }

  async function readParameterRangesSheet(input: ListParameterRangesInput): Promise<{
    ranges: ParameterRange[]
    existingRowCount: number
  }> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "PARAMETER_RANGES!A:E",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return { ranges: [], existingRowCount: 0 }

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows
    const existingRowCount = dataRows.length

    const all: ParameterRange[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const parsed = parseParameterRangeRow(row)
      if (!parsed) continue
      all.push(parsed)
    }

    const statusOrder: Record<ParameterRangeStatus, number> = { optimal: 0, acceptable: 1, critical: 2 }
    all.sort((a, b) => {
      const byParam = a.parameter.localeCompare(b.parameter)
      if (byParam !== 0) return byParam
      return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    })

    return { ranges: all, existingRowCount }
  }

  async function saveParameterRanges(input: SaveParameterRangesInput): Promise<{ savedCount: number }> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.tankType) throw new Error("Missing tank type.")

    const existingSheet = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "PARAMETER_RANGES!A:E",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const existingRows = existingSheet.values ?? []
    const existingDataRows = looksLikeHeaderRow(existingRows[0]) ? existingRows.slice(1) : existingRows
    const existingRowCount = existingDataRows.length

    const deduped: Array<{
      parameter: string
      minValue: number | null
      maxValue: number | null
      unit: string
      status: ParameterRangeStatus
    }> = []
    const seen = new Set<string>()
    for (const range of input.ranges) {
      const parameter = range.parameter.trim()
      const unit = range.unit.trim()
      const status = range.status ?? "acceptable"
      if (!parameter || !unit) continue
      if (range.minValue === null && range.maxValue === null) continue

      const key = `${normalizeParameterKey(parameter)}:${status}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push({ parameter, minValue: range.minValue, maxValue: range.maxValue, unit, status })
    }

    const statusOrder: Record<ParameterRangeStatus, number> = { optimal: 0, acceptable: 1, critical: 2 }
    deduped.sort((a, b) => {
      const byParam = a.parameter.localeCompare(b.parameter)
      if (byParam !== 0) return byParam
      return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    })

    const finalDataRows: SheetsCellValue[][] = deduped.map((range) => [
      range.parameter,
      range.minValue,
      range.maxValue,
      range.unit,
      range.status,
    ])

    const extraBlankRows = Math.max(0, existingRowCount - finalDataRows.length)
    const blanks: SheetsCellValue[][] = Array.from({ length: extraBlankRows }, () => [null, null, null, null, null])

    const values: SheetsCellValue[][] = [
      ["parameter", "min_value", "max_value", "unit", "status"],
      ...finalDataRows,
      ...blanks,
    ]

    const range = `PARAMETER_RANGES!A1:E${values.length}`
    await sheets.updateValues({
      spreadsheetId: input.spreadsheetId,
      range,
      values,
      valueInputOption: "RAW",
    })

    return { savedCount: deduped.length }
  }

  return {
    listParameterRanges,
    readParameterRangesSheet,
    saveParameterRanges,
  }
}

