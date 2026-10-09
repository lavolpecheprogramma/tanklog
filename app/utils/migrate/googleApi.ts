export type DriveFile = {
  id: string
  name: string
  mimeType?: string
}

const DRIVE = 'https://www.googleapis.com/drive/v3'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } }
    return data.error?.message || response.statusText
  } catch {
    return response.statusText
  }
}

async function googleFetch<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {})
    }
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return (await response.json()) as T
}

export async function listDriveFiles(
  accessToken: string,
  q: string,
  pageSize = 100
): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q,
      pageSize: String(pageSize),
      fields: 'nextPageToken,files(id,name,mimeType)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      spaces: 'drive'
    })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await googleFetch<{ files?: DriveFile[], nextPageToken?: string }>(
      accessToken,
      `${DRIVE}/files?${params}`
    )
    files.push(...(data.files ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return files
}

export async function downloadDriveFile(accessToken: string, fileId: string): Promise<Blob> {
  const response = await fetch(
    `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) throw new Error(await readError(response))
  return await response.blob()
}

export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<(string | number | boolean | null)[][]> {
  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  })
  try {
    const data = await googleFetch<{ values?: (string | number | boolean | null)[][] }>(
      accessToken,
      `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params}`
    )
    return data.values ?? []
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.toLowerCase().includes('unable to parse range')) return []
    throw e
  }
}
