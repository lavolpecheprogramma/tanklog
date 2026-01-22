export type GoogleDriveFile = {
  id: string
  name: string
  mimeType?: string
  parents?: string[]
}

export type GoogleDriveUploadedFile = GoogleDriveFile & {
  webViewLink?: string
  webContentLink?: string
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
const DRIVE_UPLOAD_API_BASE_URL = "https://www.googleapis.com/upload/drive/v3"

const cache = new Map<string, Blob>()
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
  const { t } = useI18n()

  function getAccessTokenOrThrow(): string {
    if (!auth.isAuthenticated.value) {
      throw new Error(t("errors.auth.sessionExpired"))
    }
    const token = auth.accessToken.value
    if (!token) throw new Error(t("errors.auth.sessionExpired"))
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

    if (response.status === 401) {
      await auth.logout()
      throw new Error(t("errors.auth.sessionExpired"))
    }

    if (!response.ok) {
      const message = await readErrorMessage(response)
      if (response.status === 404) {
        throw new Error(t("errors.drive.notFound"))
      }
      throw new Error(message)
    }

    return (await response.json()) as T
  }

  async function uploadRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = getAccessTokenOrThrow()
    const response = await fetch(`${DRIVE_UPLOAD_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    })

    if (response.status === 401) {
      await auth.logout()
      throw new Error(t("errors.auth.sessionExpired"))
    }

    if (!response.ok) {
      const message = await readErrorMessage(response)
      if (response.status === 404) {
        throw new Error(t("errors.drive.notFound"))
      }
      throw new Error(message)
    }

    return (await response.json()) as T
  }

  async function downloadFile(options: { fileId: string; supportsAllDrives?: boolean; acknowledgeAbuse?: boolean }): Promise<Blob> {
    const fileId = options.fileId?.trim()
    if (!fileId) throw new Error("Missing file id.")
    if(cache.has(fileId)) {
      return cache.get(fileId)!
    }
    const accessToken = getAccessTokenOrThrow()
    const query = toQueryString({
      alt: "media",
      supportsAllDrives: options.supportsAllDrives ?? true,
      acknowledgeAbuse: options.acknowledgeAbuse,
    })
    const response = await fetch(`${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.status === 401) {
      await auth.logout()
      throw new Error(t("errors.auth.sessionExpired"))
    }

    if (!response.ok) {
      const message = await readErrorMessage(response)
      if (response.status === 404) {
        throw new Error(t("errors.drive.notFound"))
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    cache.set(fileId, blob)
    return blob
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

  function makeMultipartRelatedBody(options: {
    boundary: string
    metadata: Record<string, unknown>
    file: Blob
    mimeType: string
  }): Blob {
    return new Blob([
      `--${options.boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(options.metadata),
      "\r\n",
      `--${options.boundary}\r\n`,
      `Content-Type: ${options.mimeType}\r\n\r\n`,
      options.file,
      "\r\n",
      `--${options.boundary}--`,
    ])
  }

  async function uploadFile(options: {
    parentId: string
    name: string
    file: Blob
    mimeType?: string
    fields?: string
  }): Promise<GoogleDriveUploadedFile> {
    const parentId = options.parentId?.trim()
    if (!parentId) throw new Error("Missing parent folder id.")

    const name = options.name?.trim()
    if (!name) throw new Error("Missing file name.")

    const inferredType = (options.file as { type?: string } | null)?.type
    const mimeType = options.mimeType?.trim() || inferredType || "application/octet-stream"

    const boundary = `tanklog_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
    const metadata: Record<string, unknown> = {
      name,
      parents: [parentId],
    }

    const body = makeMultipartRelatedBody({
      boundary,
      metadata,
      file: options.file,
      mimeType,
    })

    const query = toQueryString({
      uploadType: "multipart",
      fields: options.fields ?? "id,name,mimeType,parents,webViewLink,webContentLink",
    })

    return await uploadRequest<GoogleDriveUploadedFile>(`/files${query}`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    })
  }

  async function trashFile(options: { fileId: string }): Promise<GoogleDriveFile> {
    const fileId = options.fileId?.trim()
    if (!fileId) throw new Error("Missing file id.")

    return await request<GoogleDriveFile>(`/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    })
  }

  async function deleteFile(options: { fileId: string; supportsAllDrives?: boolean }): Promise<void> {
    const fileId = options.fileId?.trim()
    if (!fileId) throw new Error("Missing file id.")

    const accessToken = getAccessTokenOrThrow()
    const query = toQueryString({
      supportsAllDrives: options.supportsAllDrives ?? true,
    })

    const response = await fetch(`${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}${query}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.status === 401) {
      await auth.logout()
      throw new Error(t("errors.auth.sessionExpired"))
    }

    if (!response.ok) {
      const message = await readErrorMessage(response)
      if (response.status === 404) {
        throw new Error(t("errors.drive.notFound"))
      }
      throw new Error(message)
    }
  }

  return {
    listFiles,
    createFolder,
    createSpreadsheetFile,
    downloadFile,
    uploadFile,
    trashFile,
    deleteFile,
  }
}

