import { computed, readonly, watch, watchEffect } from "vue"
import { useLocalStorage } from "@vueuse/core"

import type { GoogleDriveFile } from "@/composables/useGoogleDrive"
import type { SheetsCellValue } from "@/composables/useGoogleSheets"
import { getDefaultParameterRangesForTankType } from "@/lib/parameterRangeDefaults"

export type TankType = "freshwater" | "planted" | "marine" | "reef"

export type Tank = {
  id: string
  name: string
  type: TankType
  volumeLiters: number | null
  folderId: string
  spreadsheetId: string
}

export type CreateTankInput = {
  name: string
  type: TankType
  volumeLiters?: number | null
  startDate?: string | null
  notes?: string | null
}

type TanksStatus = "idle" | "loading" | "ready" | "error"

const ACTIVE_TANK_STORAGE_KEY = "tanklog.activeTankId.v1"

function sanitizeTankNameFromFolderSegment(value: string): string {
  return value.replaceAll("_", " ").trim()
}

function parseTankFolderName(folderName: string): { tankId?: string; tankName?: string } {
  if (!folderName.startsWith("Tank_")) return {}
  const parts = folderName.split("_")
  const tankId = parts[1]?.trim()
  const namePart = parts.slice(2).join("_")
  const tankName = namePart ? sanitizeTankNameFromFolderSegment(namePart) : undefined
  return { tankId, tankName }
}

function normalizeTankType(value: string | undefined | null): TankType | null {
  const trimmed = value?.trim()
  if (trimmed === "freshwater" || trimmed === "planted" || trimmed === "marine" || trimmed === "reef") return trimmed
  return null
}

function parseTankInfo(
  values: SheetsCellValue[][] | undefined
): { tankId: string | null; tankName: string | null; tankType: TankType | null; volumeLiters: number | null } {
  if (!values?.length) return { tankId: null, tankName: null, tankType: null, volumeLiters: null }
  if (values.length < 2) return { tankId: null, tankName: null, tankType: null, volumeLiters: null }

  const header = values[0] ?? []
  const row = values[1] ?? []
  const index = new Map<string, number>()

  for (let i = 0; i < header.length; i += 1) {
    const cell = header[i]
    const key = typeof cell === "string" ? cell.trim() : String(cell ?? "").trim()
    if (!key) continue
    index.set(key, i)
  }

  const tankIdCell = index.has("id") ? row[index.get("id")!] : null
  const tankNameCell = index.has("name") ? row[index.get("name")!] : null
  const tankTypeCell = index.has("type") ? row[index.get("type")!] : null
  const volumeCell = index.has("volume_liters") ? row[index.get("volume_liters")!] : null

  const tankId = tankIdCell === null || tankIdCell === undefined ? null : String(tankIdCell)
  const tankName = tankNameCell === null || tankNameCell === undefined ? null : String(tankNameCell)
  const tankTypeRaw = tankTypeCell === null || tankTypeCell === undefined ? null : String(tankTypeCell)

  const volumeLiters = (() => {
    if (volumeCell === null || volumeCell === undefined) return null
    if (typeof volumeCell === "number") return Number.isFinite(volumeCell) ? volumeCell : null
    if (typeof volumeCell === "string") {
      const trimmed = volumeCell.trim()
      if (!trimmed) return null
      const normalized = trimmed.replace(",", ".")
      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  })()

  return {
    tankId: tankId ? tankId.trim() : null,
    tankName: tankName ? tankName.trim() : null,
    tankType: normalizeTankType(tankTypeRaw),
    volumeLiters,
  }
}

function slugifyTankId(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return base
}

function sanitizeTankNameForFolderSegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 50)
}

function makeUniqueTankId(baseId: string, existingIds: Set<string>): string {
  const fallback = `tank-${Date.now().toString(36)}`
  const initial = baseId || fallback
  if (!existingIds.has(initial)) return initial

  let i = 2
  while (existingIds.has(`${initial}-${i}`)) i += 1
  return `${initial}-${i}`
}

export function useTanks() {
  const tanks = useState<Tank[]>("tanks.items", () => [])
  const status = useState<TanksStatus>("tanks.status", () => "idle")
  const error = useState<string | null>("tanks.error", () => null)
  const initialized = useState<boolean>("tanks.initialized", () => false)

  const auth = useAuth()
  const storage = useTankLogRootFolderId()
  storage.hydrateFromStorage()
  const drive = useGoogleDrive()
  const sheets = useGoogleSheets()

  async function listAllFiles(query: string): Promise<GoogleDriveFile[]> {
    const all: GoogleDriveFile[] = []
    let pageToken: string | undefined

    do {
      const response = await drive.listFiles({ q: query, pageSize: 1000, pageToken })
      const batch = response.files ?? []
      all.push(...batch)
      pageToken = response.nextPageToken
    } while (pageToken)

    return all
  }

  function clearState() {
    tanks.value = []
    status.value = "idle"
    error.value = null
  }

  async function refresh() {
    const rootFolderId = storage.rootFolderId.value
    if (!rootFolderId) {
      clearState()
      return
    }

    if (!auth.isAuthenticated.value) {
      clearState()
      return
    }

    status.value = "loading"
    error.value = null

    try {
      const folders = await listAllFiles(
        `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )

      const tankFolders = folders.filter((folder) => folder.name?.startsWith("Tank_"))

      const results = await Promise.all(
        tankFolders.map(async (folder) => {
          try {
            const sheetFiles = await listAllFiles(
              `'${folder.id}' in parents and name='tank_data.xlsx' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
            )

            const sheet = sheetFiles[0]
            if (!sheet?.id) return null

            const tankInfo = await sheets.getValues({
              spreadsheetId: sheet.id,
              range: "TANK_INFO!A1:Z2",
            })

            const parsed = parseTankInfo(tankInfo.values)
            const fallback = parseTankFolderName(folder.name)

            const id = parsed.tankId ?? fallback.tankId ?? null
            const name = parsed.tankName ?? fallback.tankName ?? folder.name
            const type = parsed.tankType ?? "freshwater"
            const volumeLiters = parsed.volumeLiters ?? null

            if (!id) return null

            return {
              id,
              name,
              type,
              volumeLiters,
              folderId: folder.id,
              spreadsheetId: sheet.id,
            } satisfies Tank
          } catch {
            return null
          }
        })
      )

      const next = results.filter((item): item is Tank => Boolean(item))
      next.sort((a, b) => a.name.localeCompare(b.name))

      tanks.value = next
      status.value = "ready"
    } catch (e) {
      status.value = "error"
      error.value = e instanceof Error ? e.message : "Failed to load tanks."
      tanks.value = []
    }
  }

  async function createTank(input: CreateTankInput): Promise<Tank> {
    const rootFolderId = storage.rootFolderId.value
    if (!rootFolderId) throw new Error("TankLog folder is not connected.")
    if (!auth.isAuthenticated.value) throw new Error("Not authenticated.")

    const name = input.name.trim()
    if (!name) throw new Error("Tank name is required.")

    const type = normalizeTankType(input.type) ?? null
    if (!type) throw new Error("Invalid tank type.")

    const existingIds = new Set(tanks.value.map((tank) => tank.id))
    const tankId = makeUniqueTankId(slugifyTankId(name), existingIds)

    const folderNameSegment = sanitizeTankNameForFolderSegment(name) || tankId
    const tankFolderName = `Tank_${tankId}_${folderNameSegment}`

    const tankFolder = await drive.createFolder({ name: tankFolderName, parentId: rootFolderId })

    const photosFolder = await drive.createFolder({ name: "photos", parentId: tankFolder.id })
    await Promise.all(
      ["tank", "livestock"].map((folderName) => drive.createFolder({ name: folderName, parentId: photosFolder.id }))
    )

    const spreadsheetFile = await drive.createSpreadsheetFile({ name: "tank_data.xlsx", parentId: tankFolder.id })
    const spreadsheetId = spreadsheetFile.id

    const spreadsheetMeta = await sheets.getSpreadsheet({ spreadsheetId })
    const defaultSheetId = spreadsheetMeta.sheets?.[0]?.properties?.sheetId
    if (typeof defaultSheetId !== "number") {
      throw new Error("Failed to initialize the tank spreadsheet.")
    }

    const sheetTitles = ["WATER_TESTS", "EVENTS", "REMINDERS", "LIVESTOCK", "PHOTOS", "EQUIPMENT", "PARAMETER_RANGES"] as const

    await sheets.batchUpdate({
      spreadsheetId,
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: defaultSheetId, title: "TANK_INFO" },
            fields: "title",
          },
        },
        ...sheetTitles.map((title) => ({ addSheet: { properties: { title } } })),
      ],
    })

    const tankInfoRow: SheetsCellValue[] = [
      tankId,
      name,
      type,
      input.volumeLiters ?? null,
      input.startDate ?? null,
      input.notes ?? null,
    ]

    await sheets.updateValues({
      spreadsheetId,
      range: "TANK_INFO!A1:F2",
      values: [
        ["id", "name", "type", "volume_liters", "start_date", "notes"],
        tankInfoRow,
      ],
    })

    const defaultParameterRanges = getDefaultParameterRangesForTankType(type)

    await Promise.all([
      sheets.updateValues({
        spreadsheetId,
        range: "WATER_TESTS!A1:H1",
        values: [["id", "test_group_id", "date", "parameter", "value", "unit", "method", "note"]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: "EVENTS!A1:H1",
        values: [["id", "date", "type", "description", "quantity", "unit", "product", "note"]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: "REMINDERS!A1:J1",
        values: [["id", "title", "next_due", "repeat_every_days", "last_done", "notes", "event_type", "quantity", "unit", "product"]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: "LIVESTOCK!A1:K1",
        values: [[
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
        ]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: "PHOTOS!A1:G1",
        values: [["id", "date", "related_type", "related_id", "drive_file_id", "drive_url", "note"]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: "EQUIPMENT!A1:F1",
        values: [["id", "type", "brand_model", "installation_date", "maintenance_interval", "notes"]],
      }),
      sheets.updateValues({
        spreadsheetId,
        range: `PARAMETER_RANGES!A1:F${1 + defaultParameterRanges.length}`,
        values: [
          ["parameter", "min_value", "max_value", "unit", "status", "color"],
          ...defaultParameterRanges.map((row) => [
            row.parameter,
            row.minValue,
            row.maxValue,
            row.unit,
            row.status,
            row.color,
          ]),
        ],
      }),
    ])

    await refresh()

    return {
      id: tankId,
      name,
      type,
      volumeLiters: input.volumeLiters ?? null,
      folderId: tankFolder.id,
      spreadsheetId,
    }
  }

  async function deleteTank(options: { tankId: string }): Promise<void> {
    if (!auth.isAuthenticated.value) throw new Error("Not authenticated.")
    const rootFolderId = storage.rootFolderId.value
    if (!rootFolderId) throw new Error("TankLog folder is not connected.")

    const tankId = options.tankId?.trim()
    if (!tankId) throw new Error("Missing tank id.")

    const tank = tanks.value.find((item) => item.id === tankId) ?? null
    if (!tank) throw new Error("Tank not found.")

    await drive.trashFile({ fileId: tank.folderId })
    await refresh()
  }

  if (import.meta.client && !initialized.value) {
    initialized.value = true

    watch(
      [() => auth.isAuthenticated.value, () => storage.rootFolderId.value],
      ([isAuthed, rootFolderId]) => {
        if (!isAuthed || !rootFolderId) {
          clearState()
          return
        }
        refresh()
      },
      { immediate: true }
    )
  }

  return {
    tanks: readonly(tanks),
    status: readonly(status),
    error: readonly(error),
    refresh,
    createTank,
    deleteTank,
  }
}

export function useActiveTankId() {
  return useLocalStorage<string>(ACTIVE_TANK_STORAGE_KEY, "", { writeDefaults: false })
}

export function useActiveTank() {
  const { tanks } = useTanks()
  const activeTankId = useActiveTankId()

  const activeTank = computed(() => {
    if (!tanks.value.length) return null
    const selected = tanks.value.find((tank) => tank.id === activeTankId.value)
    return selected ?? tanks.value[0]
  })

  watchEffect(() => {
    if (!tanks.value.length) return

    if (!activeTankId.value || !tanks.value.some((tank) => tank.id === activeTankId.value)) {
      activeTankId.value = tanks.value[0]!.id
    }
  })

  function setActiveTankId(id: string) {
    activeTankId.value = id
  }

  return {
    tanks,
    activeTankId,
    activeTank,
    setActiveTankId,
  }
}

