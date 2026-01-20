import type { SheetsCellValue } from "@/composables/useGoogleSheets"

export type WaterTestParameter = "pH" | "KH" | "GH" | "NO2" | "NO3" | "PO4"

export type WaterTestParameterConfig = {
  parameter: WaterTestParameter
  label: string
  unit: string
  step?: number
  min?: number
}

export const WATER_TEST_PARAMETERS: WaterTestParameterConfig[] = [
  { parameter: "pH", label: "pH", unit: "pH", step: 0.01, min: 0 },
  { parameter: "KH", label: "KH", unit: "dKH", step: 0.1, min: 0 },
  { parameter: "GH", label: "GH", unit: "dGH", step: 0.1, min: 0 },
  { parameter: "NO2", label: "NO2", unit: "ppm", step: 0.01, min: 0 },
  { parameter: "NO3", label: "NO3", unit: "ppm", step: 0.1, min: 0 },
  { parameter: "PO4", label: "PO4", unit: "ppm", step: 0.01, min: 0 },
]

export type WaterTestMeasurement = {
  id: string
  testGroupId: string
  date: string
  parameter: string
  value: number
  unit: string
  method: string | null
  note: string | null
}

export type WaterTestSession = {
  testGroupId: string
  date: string
  method: string | null
  note: string | null
  measurements: WaterTestMeasurement[]
}

export type CreateWaterTestSessionInput = {
  spreadsheetId: string
  date: Date
  measurements: Array<{ parameter: WaterTestParameter; value: number; unit: string }>
  method?: string | null
  note?: string | null
}

export type ListWaterTestSessionsInput = {
  spreadsheetId: string
}

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
    && normalizeHeaderCell(row[1]) === "test_group_id"
    && normalizeHeaderCell(row[2]) === "date"
    && normalizeHeaderCell(row[3]) === "parameter"
  )
}

function getDefaultUnitForParameter(parameter: string): string | null {
  const known = WATER_TEST_PARAMETERS.find((item) => item.parameter === parameter)
  return known?.unit ?? null
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function parseMeasurementRow(row: SheetsCellValue[]): WaterTestMeasurement | null {
  const id = cellToString(row[0])
  const testGroupId = cellToString(row[1])
  const date = cellToString(row[2])
  const parameter = cellToString(row[3])
  const value = cellToNumber(row[4])
  const unit = cellToString(row[5]) ?? (parameter ? getDefaultUnitForParameter(parameter) : null)
  const method = cellToOptionalText(row[6])
  const note = cellToOptionalText(row[7])

  if (!id || !testGroupId || !date || !parameter || value === null || !unit) return null

  return {
    id,
    testGroupId,
    date,
    parameter,
    value,
    unit,
    method,
    note,
  }
}

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function groupMeasurementsIntoSessions(measurements: WaterTestMeasurement[]): WaterTestSession[] {
  const parameterOrder: Record<string, number> = Object.fromEntries(
    WATER_TEST_PARAMETERS.map((item, index) => [item.parameter, index])
  )

  const sessionsByGroupId = new Map<string, WaterTestSession>()

  for (const measurement of measurements) {
    let session = sessionsByGroupId.get(measurement.testGroupId)
    if (!session) {
      session = {
        testGroupId: measurement.testGroupId,
        date: measurement.date,
        method: measurement.method,
        note: measurement.note,
        measurements: [],
      }
      sessionsByGroupId.set(measurement.testGroupId, session)
    }

    session.measurements.push(measurement)

    if (!session.method && measurement.method) session.method = measurement.method
    if (!session.note && measurement.note) session.note = measurement.note

    const currentMs = toEpochMs(session.date)
    const candidateMs = toEpochMs(measurement.date)
    if (candidateMs !== null && (currentMs === null || candidateMs > currentMs)) {
      session.date = measurement.date
    }
  }

  for (const session of sessionsByGroupId.values()) {
    session.measurements.sort((a, b) => {
      const orderA = parameterOrder[a.parameter] ?? Number.MAX_SAFE_INTEGER
      const orderB = parameterOrder[b.parameter] ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return a.parameter.localeCompare(b.parameter)
    })
  }

  const sessions = Array.from(sessionsByGroupId.values())
  sessions.sort((a, b) => (toEpochMs(b.date) ?? -Infinity) - (toEpochMs(a.date) ?? -Infinity))

  return sessions
}

export function useWaterTests() {
  const sheets = useGoogleSheets()

  async function createWaterTestSession(input: CreateWaterTestSessionInput): Promise<{
    testGroupId: string
    measurements: WaterTestMeasurement[]
  }> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    if (!input.date || Number.isNaN(input.date.getTime())) {
      throw new Error("Invalid test date.")
    }

    const validMeasurements = input.measurements.filter(
      (measurement) => Number.isFinite(measurement.value) && measurement.value >= 0
    )

    if (!validMeasurements.length) {
      throw new Error("At least one measurement is required.")
    }

    const testGroupId = generateId("tg")
    const dateIso = input.date.toISOString()
    const method = normalizeOptionalText(input.method)
    const note = normalizeOptionalText(input.note)

    const measurements: WaterTestMeasurement[] = validMeasurements.map((measurement) => ({
      id: generateId("m"),
      testGroupId,
      date: dateIso,
      parameter: measurement.parameter,
      value: measurement.value,
      unit: measurement.unit,
      method,
      note,
    }))

    const rows: SheetsCellValue[][] = measurements.map((measurement) => [
      measurement.id,
      measurement.testGroupId,
      measurement.date,
      measurement.parameter,
      measurement.value,
      measurement.unit,
      measurement.method,
      measurement.note,
    ])

    await sheets.appendValues({
      spreadsheetId: input.spreadsheetId,
      range: "WATER_TESTS!A:H",
      values: rows,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    })

    return { testGroupId, measurements }
  }

  async function listWaterTestSessions(input: ListWaterTestSessionsInput): Promise<WaterTestSession[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "WATER_TESTS!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows

    const measurements: WaterTestMeasurement[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const measurement = parseMeasurementRow(row)
      if (!measurement) continue
      measurements.push(measurement)
    }

    return groupMeasurementsIntoSessions(measurements)
  }

  return {
    createWaterTestSession,
    listWaterTestSessions,
  }
}

