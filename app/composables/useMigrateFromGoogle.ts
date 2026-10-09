import {
  FOLDER_MIME,
  SPREADSHEET_MIME,
  listDriveFiles
} from '~/utils/migrate/googleApi'
import {
  requestMigrateAccessToken,
  revokeMigrateAccessToken
} from '~/utils/migrate/googleAuth'
import {
  clearMigrateGoogleClientId,
  getMigrateGoogleClientId,
  setMigrateGoogleClientId
} from '~/utils/migrate/googleConfig'
import {
  importTankFromGoogle,
  parseTankCandidates,
  type MigrateTankCandidate,
  type MigrateTankReport
} from '~/utils/migrate/importTank'

export type MigrateStep =
  | 'clientId'
  | 'connect'
  | 'pickRoot'
  | 'pickTanks'
  | 'running'
  | 'done'

export type MigrateRootFolder = {
  id: string
  name: string
}

export function useMigrateFromGoogle() {
  const step = useState<MigrateStep>('tanklog.migrate.step', () => 'clientId')
  const clientId = useState<string>('tanklog.migrate.clientId', () => getMigrateGoogleClientId() ?? '')
  const accessToken = useState<string | null>('tanklog.migrate.token', () => null)
  const roots = useState<MigrateRootFolder[]>('tanklog.migrate.roots', () => [])
  const selectedRootId = useState<string | null>('tanklog.migrate.rootId', () => null)
  const candidates = useState<MigrateTankCandidate[]>('tanklog.migrate.candidates', () => [])
  const selectedLegacyIds = useState<string[]>('tanklog.migrate.selected', () => [])
  const reports = useState<MigrateTankReport[]>('tanklog.migrate.reports', () => [])
  const progressMessage = useState<string | null>('tanklog.migrate.progress', () => null)
  const busy = useState<boolean>('tanklog.migrate.busy', () => false)
  const error = useState<string | null>('tanklog.migrate.error', () => null)

  function hydrateClientId() {
    clientId.value = getMigrateGoogleClientId() ?? clientId.value
    if (clientId.value.trim() && step.value === 'clientId') {
      step.value = 'connect'
    }
  }

  function saveClientId(value: string) {
    const trimmed = value.trim()
    if (!trimmed) throw new Error('Google Client ID is required')
    setMigrateGoogleClientId(trimmed)
    clientId.value = trimmed
    step.value = 'connect'
    error.value = null
  }

  async function connectGoogle() {
    busy.value = true
    error.value = null
    try {
      const id = clientId.value.trim() || getMigrateGoogleClientId()
      if (!id) throw new Error('Save a Google Client ID first')
      accessToken.value = await requestMigrateAccessToken(id)
      step.value = 'pickRoot'
      await discoverRoots()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      busy.value = false
    }
  }

  async function discoverRoots() {
    if (!accessToken.value) throw new Error('Not connected to Google')
    busy.value = true
    error.value = null
    try {
      const folders = await listDriveFiles(
        accessToken.value,
        `mimeType='${FOLDER_MIME}' and name='TankLog' and trashed=false`
      )
      roots.value = folders.map(f => ({ id: f.id, name: f.name }))
      if (roots.value.length === 1) {
        selectedRootId.value = roots.value[0]!.id
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      busy.value = false
    }
  }

  async function discoverTanks(rootId: string) {
    if (!accessToken.value) throw new Error('Not connected to Google')
    busy.value = true
    error.value = null
    selectedRootId.value = rootId
    try {
      const tankFolders = await listDriveFiles(
        accessToken.value,
        `'${rootId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false and name contains 'Tank_'`
      )

      const spreadsheetPairs = await Promise.all(
        tankFolders.map(async (folder) => {
          const sheets = await listDriveFiles(
            accessToken.value!,
            `'${folder.id}' in parents and mimeType='${SPREADSHEET_MIME}' and trashed=false`
          )
          const preferred = sheets.find(s => /tank_data/i.test(s.name)) ?? sheets[0]
          return [folder.id, preferred] as const
        })
      )

      const byParent = new Map<string, NonNullable<(typeof spreadsheetPairs)[number][1]>>()
      for (const [folderId, sheet] of spreadsheetPairs) {
        if (sheet) byParent.set(folderId, sheet)
      }

      candidates.value = parseTankCandidates(tankFolders, byParent)
      selectedLegacyIds.value = candidates.value.map(c => c.legacyTankId)
      step.value = 'pickTanks'
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      busy.value = false
    }
  }

  function toggleTank(legacyId: string, selected: boolean) {
    if (selected) {
      if (!selectedLegacyIds.value.includes(legacyId)) {
        selectedLegacyIds.value = [...selectedLegacyIds.value, legacyId]
      }
      return
    }
    selectedLegacyIds.value = selectedLegacyIds.value.filter(id => id !== legacyId)
  }

  async function runImport() {
    if (!accessToken.value) throw new Error('Not connected to Google')
    const supabase = useSupabaseClient()
    if (!supabase) throw new Error('Supabase is not configured')
    const { user } = useAuth()
    const userId = user.value?.id
    if (!userId) throw new Error('Not signed in')

    const selected = candidates.value.filter(c => selectedLegacyIds.value.includes(c.legacyTankId))
    if (!selected.length) throw new Error('Select at least one tank')

    busy.value = true
    error.value = null
    reports.value = []
    step.value = 'running'

    try {
      for (const candidate of selected) {
        progressMessage.value = `Importing ${candidate.displayName}…`
        const report = await importTankFromGoogle({
          client: supabase,
          accessToken: accessToken.value,
          userId,
          candidate,
          onProgress: (message) => {
            progressMessage.value = `${candidate.displayName}: ${message}`
          }
        })
        reports.value = [...reports.value, report]
      }
      step.value = 'done'
      progressMessage.value = null
      await useTanks().refresh().catch(() => undefined)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      step.value = 'pickTanks'
      throw e
    } finally {
      busy.value = false
    }
  }

  async function disconnectGoogle() {
    if (accessToken.value) {
      await revokeMigrateAccessToken(accessToken.value)
    }
    accessToken.value = null
    roots.value = []
    candidates.value = []
    selectedLegacyIds.value = []
    selectedRootId.value = null
    clearMigrateGoogleClientId()
    clientId.value = ''
    step.value = 'clientId'
    progressMessage.value = null
  }

  return {
    step,
    clientId,
    accessToken,
    roots,
    selectedRootId,
    candidates,
    selectedLegacyIds,
    reports,
    progressMessage,
    busy,
    error,
    hydrateClientId,
    saveClientId,
    connectGoogle,
    discoverRoots,
    discoverTanks,
    toggleTank,
    runImport,
    disconnectGoogle
  }
}
