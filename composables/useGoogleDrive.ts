export type GoogleDriveFile = {
  id: string
  name: string
  mimeType?: string
  parents?: string[]
}

const DRIVE_MIME_TYPES = {
  folder: "application/vnd.google-apps.folder",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
} as const

type DriveListResponse = {
  files?: GoogleDriveFile[]
  nextPageToken?: string
}

const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3"

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

export function useGoogleDrive() {
  const auth = useAuth()

  function getAccessTokenOrThrow(): string {
    const token = auth.accessToken.value
    if (!token) throw new Error("Missing Google access token.")
    return token
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = getAccessTokenOrThrow()
    const response = await fetch(`${DRIVE_API_BASE_URL}${path}`, {
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

  async function listFiles(options: {
    q: string
    pageSize?: number
    pageToken?: string
    spaces?: "drive"
    fields?: string
  }): Promise<DriveListResponse> {
    const query = toQueryString({
      q: options.q,
      pageSize: options.pageSize ?? 1000,
      pageToken: options.pageToken,
      spaces: options.spaces ?? "drive",
      fields: options.fields ?? "files(id,name,mimeType,parents),nextPageToken",
    })
    return await request<DriveListResponse>(`/files${query}`, { method: "GET" })
  }

  async function createFolder(options: { name: string; parentId?: string | null }): Promise<GoogleDriveFile> {
    const body: Record<string, unknown> = {
      name: options.name,
      mimeType: DRIVE_MIME_TYPES.folder,
    }

    if (options.parentId) {
      body.parents = [options.parentId]
    }

    return await request<GoogleDriveFile>(`/files?fields=id,name,mimeType,parents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  async function createSpreadsheetFile(options: { name: string; parentId: string }): Promise<GoogleDriveFile> {
    const body: Record<string, unknown> = {
      name: options.name,
      mimeType: DRIVE_MIME_TYPES.spreadsheet,
      parents: [options.parentId],
    }

    return await request<GoogleDriveFile>(`/files?fields=id,name,mimeType,parents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  return {
    listFiles,
    createFolder,
    createSpreadsheetFile,
  }
}

