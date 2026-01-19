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
  parameter: WaterTestParameter
  value: number
  unit: string
  method: string | null
  note: string | null
}

export type CreateWaterTestSessionInput = {
  spreadsheetId: string
  date: Date
  measurements: Array<{ parameter: WaterTestParameter; value: number; unit: string }>
  method?: string | null
  note?: string | null
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

  return {
    createWaterTestSession,
  }
}

