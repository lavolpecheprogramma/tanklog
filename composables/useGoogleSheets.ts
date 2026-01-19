export type SheetsCellValue = string | number | boolean | null

type SheetsValuesResponse = {
  range?: string
  majorDimension?: "ROWS" | "COLUMNS"
  values?: SheetsCellValue[][]
}

const SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets"

type SheetsSpreadsheetResponse = {
  sheets?: Array<{
    properties?: {
      sheetId?: number
      title?: string
    }
  }>
}

type SheetsBatchUpdateRequest = {
  requests: unknown[]
}

type SheetsBatchUpdateResponse = {
  spreadsheetId?: string
}

type SheetsUpdateValuesResponse = {
  updatedRange?: string
  updatedRows?: number
  updatedColumns?: number
  updatedCells?: number
}

type SheetsAppendValuesResponse = {
  spreadsheetId?: string
  tableRange?: string
  updates?: SheetsUpdateValuesResponse
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } }
    return data.error?.message || response.statusText
  } catch {
    return response.statusText
  }
}

function toQueryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== null && value !== undefined)
  if (!entries.length) return ""
  const search = new URLSearchParams()
  for (const [key, value] of entries) search.set(key, String(value))
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export function useGoogleSheets() {
  const auth = useAuth()

  function getAccessTokenOrThrow(): string {
    const token = auth.accessToken.value
    if (!token) throw new Error("Missing Google access token.")
    return token
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = getAccessTokenOrThrow()
    const response = await fetch(`${SHEETS_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    })

    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    return (await response.json()) as T
  }

  async function getValues(options: {
    spreadsheetId: string
    range: string
    valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA"
    dateTimeRenderOption?: "SERIAL_NUMBER" | "FORMATTED_STRING"
    majorDimension?: "ROWS" | "COLUMNS"
  }): Promise<SheetsValuesResponse> {
    const query = toQueryString({
      valueRenderOption: options.valueRenderOption ?? "FORMATTED_VALUE",
      dateTimeRenderOption: options.dateTimeRenderOption ?? "FORMATTED_STRING",
      majorDimension: options.majorDimension ?? "ROWS",
    })

    const encodedRange = encodeURIComponent(options.range)
    return await request<SheetsValuesResponse>(`/${options.spreadsheetId}/values/${encodedRange}${query}`, { method: "GET" })
  }

  async function getSpreadsheet(options: { spreadsheetId: string; fields?: string }): Promise<SheetsSpreadsheetResponse> {
    const query = toQueryString({
      fields: options.fields ?? "sheets.properties(sheetId,title)",
    })

    return await request<SheetsSpreadsheetResponse>(`/${options.spreadsheetId}${query}`, { method: "GET" })
  }

  async function batchUpdate(options: { spreadsheetId: string; requests: unknown[] }): Promise<SheetsBatchUpdateResponse> {
    const body: SheetsBatchUpdateRequest = {
      requests: options.requests,
    }

    return await request<SheetsBatchUpdateResponse>(`/${options.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  async function updateValues(options: {
    spreadsheetId: string
    range: string
    values: SheetsCellValue[][]
    valueInputOption?: "RAW" | "USER_ENTERED"
  }): Promise<SheetsUpdateValuesResponse> {
    const query = toQueryString({
      valueInputOption: options.valueInputOption ?? "RAW",
    })

    const normalizedValues = options.values.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : cell))
    )

    const body = {
      range: options.range,
      majorDimension: "ROWS",
      values: normalizedValues,
    }

    const encodedRange = encodeURIComponent(options.range)
    return await request<SheetsUpdateValuesResponse>(`/${options.spreadsheetId}/values/${encodedRange}${query}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  async function appendValues(options: {
    spreadsheetId: string
    range: string
    values: SheetsCellValue[][]
    valueInputOption?: "RAW" | "USER_ENTERED"
    insertDataOption?: "INSERT_ROWS" | "OVERWRITE"
  }): Promise<SheetsAppendValuesResponse> {
    const query = toQueryString({
      valueInputOption: options.valueInputOption ?? "RAW",
      insertDataOption: options.insertDataOption ?? "INSERT_ROWS",
    })

    const normalizedValues = options.values.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : cell))
    )

    const body = {
      range: options.range,
      majorDimension: "ROWS",
      values: normalizedValues,
    }

    const encodedRange = encodeURIComponent(options.range)
    return await request<SheetsAppendValuesResponse>(`/${options.spreadsheetId}/values/${encodedRange}:append${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  return {
    getValues,
    getSpreadsheet,
    batchUpdate,
    updateValues,
    appendValues,
  }
}

