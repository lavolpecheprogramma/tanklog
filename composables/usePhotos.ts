import type { GoogleDriveUploadedFile } from "@/composables/useGoogleDrive"
import type { SheetsCellValue } from "@/composables/useGoogleSheets"
import { normalizeImageBlobForBrowser } from "@/lib/images"

export type PhotoRelatedType = "tank" | "animal"

export type TankPhoto = {
  photoId: string
  date: string
  relatedType: PhotoRelatedType
  relatedId: string | null
  driveFileId: string
  driveUrl: string
  note: string | null
}

export type UploadTankPhotoInput = {
  spreadsheetId: string
  tankFolderId: string
  file: File
  date: Date
  note?: string | null
}

export type ListTankPhotosInput = {
  spreadsheetId: string
}

const PHOTOS_HEADERS = ["id", "date", "related_type", "related_id", "drive_file_id", "drive_url", "note"] as const
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

function looksLikeHeaderRow(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return false
  const normalizeHeaderCell = (value: SheetsCellValue | undefined) => (typeof value === "string" ? value.trim().toLowerCase() : "")
  return (
    normalizeHeaderCell(row[0]) === "id"
    && normalizeHeaderCell(row[1]) === "date"
    && normalizeHeaderCell(row[2]) === "related_type"
    && normalizeHeaderCell(row[4]) === "drive_file_id"
  )
}

function isRowEmpty(row: SheetsCellValue[] | undefined): boolean {
  if (!row?.length) return true
  return row.every((cell) => cell === null || cell === undefined || (typeof cell === "string" && !cell.trim()))
}

function normalizeRelatedType(value: string): PhotoRelatedType | null {
  const trimmed = value.trim()
  if (trimmed === "tank" || trimmed === "animal") return trimmed
  return null
}

function parsePhotoRow(row: SheetsCellValue[]): TankPhoto | null {
  const photoId = cellToString(row[0])
  const date = cellToString(row[1])
  const relatedTypeRaw = cellToString(row[2])
  const relatedId = cellToOptionalText(row[3])
  const driveFileId = cellToString(row[4])
  const driveUrl = cellToString(row[5])
  const note = cellToOptionalText(row[6])

  if (!photoId || !date || !relatedTypeRaw || !driveFileId || !driveUrl) return null
  const relatedType = normalizeRelatedType(relatedTypeRaw)
  if (!relatedType) return null

  if (relatedType === "tank" && relatedId) return null
  if (relatedType === "animal" && !relatedId) return null

  return {
    photoId,
    date,
    relatedType,
    relatedId: relatedId ?? null,
    driveFileId,
    driveUrl,
    note,
  }
}

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fileExtensionFromName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const dot = trimmed.lastIndexOf(".")
  if (dot < 0) return null
  const ext = trimmed.slice(dot + 1).trim().toLowerCase()
  if (!ext || ext.length > 10) return null
  if (!/^[a-z0-9]+$/.test(ext)) return null
  return ext
}

function extensionFromMimeType(mimeType: string): string | null {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/gif") return "gif"
  return null
}

function toUtcFileStamp(date: Date): string {
  // 2026-01-19T10:00:00.000Z -> 2026-01-19_10-00-00-000Z
  return date.toISOString().replace("T", "_").replaceAll(":", "-").replaceAll(".", "-")
}

function toDriveViewUrl(fileId: string): string {
  const safeId = encodeURIComponent(fileId)
  return `https://drive.google.com/file/d/${safeId}/view`
}

export function usePhotos() {
  const sheets = useGoogleSheets()
  const drive = useGoogleDrive()

  async function ensurePhotosSheet(spreadsheetId: string) {
    if (!spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (ensuredSpreadsheets.has(spreadsheetId)) return
    ensuredSpreadsheets.add(spreadsheetId)

    try {
      const spreadsheet = await sheets.getSpreadsheet({ spreadsheetId })
      const hasPhotosSheet = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === "PHOTOS") ?? false

      if (!hasPhotosSheet) {
        await sheets.batchUpdate({
          spreadsheetId,
          requests: [{ addSheet: { properties: { title: "PHOTOS" } } }],
        })
      }

      await sheets.updateValues({
        spreadsheetId,
        range: "PHOTOS!A1:G1",
        values: [[...PHOTOS_HEADERS]],
      })
    } catch (error) {
      ensuredSpreadsheets.delete(spreadsheetId)
      throw error
    }
  }

  async function findChildFolderIdByName(parentId: string, name: string): Promise<string | null> {
    const response = await drive.listFiles({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
      pageSize: 10,
      fields: "files(id,name),nextPageToken",
    })

    const match = response.files?.[0]
    return match?.id ?? null
  }

  async function ensureTankPhotosFolder(tankFolderId: string): Promise<string> {
    if (!tankFolderId) throw new Error("Missing tank folder id.")

    const photosFolderId = (await findChildFolderIdByName(tankFolderId, "photos")) ?? (await drive.createFolder({ name: "photos", parentId: tankFolderId })).id

    const tankPhotosFolderId
      = (await findChildFolderIdByName(photosFolderId, "tank")) ?? (await drive.createFolder({ name: "tank", parentId: photosFolderId })).id

    return tankPhotosFolderId
  }

  async function uploadTankPhoto(input: UploadTankPhotoInput): Promise<TankPhoto> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    if (!input.tankFolderId) throw new Error("Missing tank folder id.")

    const file = input.file
    if (!file) throw new Error("Missing photo file.")
    if (!file.size) throw new Error("Photo file is empty.")
    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error("Please select an image file.")
    }

    const date = input.date
    if (!date || Number.isNaN(date.getTime())) {
      throw new Error("Invalid photo date.")
    }

    const note = normalizeOptionalText(input.note)

    await ensurePhotosSheet(input.spreadsheetId)
    const tankPhotosFolderId = await ensureTankPhotosFolder(input.tankFolderId)

    let uploadBlob: Blob = file
    try {
      const normalized = await normalizeImageBlobForBrowser(file)
      uploadBlob = normalized.blob
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to process the image file.")
    }

    const uploadMimeType = uploadBlob.type || file.type
    const photoId = generateId("p")
    const ext = extensionFromMimeType(uploadMimeType) ?? fileExtensionFromName(file.name) ?? extensionFromMimeType(file.type) ?? "jpg"
    const name = `tank_${toUtcFileStamp(date)}_${photoId.slice(0, 8)}.${ext}`

    const uploaded: GoogleDriveUploadedFile = await drive.uploadFile({
      parentId: tankPhotosFolderId,
      name,
      file: uploadBlob,
      mimeType: uploadMimeType,
    })

    if (!uploaded.id) throw new Error("Google Drive did not return a file id.")

    const driveUrl = uploaded.webViewLink || toDriveViewUrl(uploaded.id)

    const photo: TankPhoto = {
      photoId,
      date: date.toISOString(),
      relatedType: "tank",
      relatedId: null,
      driveFileId: uploaded.id,
      driveUrl,
      note,
    }

    await sheets.appendValues({
      spreadsheetId: input.spreadsheetId,
      range: "PHOTOS!A:G",
      values: [[photo.photoId, photo.date, photo.relatedType, photo.relatedId, photo.driveFileId, photo.driveUrl, photo.note]],
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    })

    return photo
  }

  async function listTankPhotos(input: ListTankPhotosInput): Promise<TankPhoto[]> {
    if (!input.spreadsheetId) throw new Error("Missing spreadsheet id.")
    await ensurePhotosSheet(input.spreadsheetId)

    const response = await sheets.getValues({
      spreadsheetId: input.spreadsheetId,
      range: "PHOTOS!A:G",
      valueRenderOption: "UNFORMATTED_VALUE",
    })

    const rows = response.values ?? []
    if (!rows.length) return []

    const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows

    const photos: TankPhoto[] = []
    for (const row of dataRows) {
      if (isRowEmpty(row)) continue
      const photo = parsePhotoRow(row)
      if (!photo) continue
      if (photo.relatedType !== "tank") continue
      photos.push(photo)
    }

    photos.sort((a, b) => (toEpochMs(b.date) ?? -Infinity) - (toEpochMs(a.date) ?? -Infinity))
    return photos
  }

  return {
    uploadTankPhoto,
    listTankPhotos,
  }
}

