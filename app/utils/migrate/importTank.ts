import type { SupabaseClient } from '@supabase/supabase-js'
import type { TankType } from '~/types/tank'
import {
  downloadDriveFile,
  getSheetValues,
  type DriveFile
} from '~/utils/migrate/googleApi'
import {
  guessExtFromMime,
  parseNumber,
  sheetToRecords,
  toDateOnly,
  toTimestamptz
} from '~/utils/migrate/parseSheet'

export type MigrateTankCandidate = {
  folderId: string
  folderName: string
  legacyTankId: string
  displayName: string
  spreadsheetId: string
}

export type MigrateEntityCounts = {
  livestock: number
  ranges: number
  waterTests: number
  events: number
  reminders: number
  equipment: number
  photos: number
}

export type MigrateTankReport = {
  legacyTankId: string
  displayName: string
  status: 'ok' | 'skipped' | 'error'
  message?: string
  tankId?: string
  counts?: MigrateEntityCounts
  errors: string[]
}

const TANK_TYPES = new Set(['freshwater', 'planted', 'marine', 'reef'])
const PHOTO_BUCKET = 'photos'

function emptyCounts(): MigrateEntityCounts {
  return {
    livestock: 0,
    ranges: 0,
    waterTests: 0,
    events: 0,
    reminders: 0,
    equipment: 0,
    photos: 0
  }
}

function parseTankFolder(folderName: string): { legacyTankId: string, displayName: string } | null {
  // Tank_<id>_<name...>
  const match = /^Tank_([^_]+)_(.+)$/.exec(folderName)
  if (!match) return null
  return {
    legacyTankId: match[1]!,
    displayName: match[2]!.replace(/_/g, ' ')
  }
}

export function parseTankCandidates(
  folders: DriveFile[],
  spreadsheetsByParent: Map<string, DriveFile>
): MigrateTankCandidate[] {
  const out: MigrateTankCandidate[] = []
  for (const folder of folders) {
    const parsed = parseTankFolder(folder.name)
    if (!parsed) continue
    const sheet = spreadsheetsByParent.get(folder.id)
    if (!sheet) continue
    out.push({
      folderId: folder.id,
      folderName: folder.name,
      legacyTankId: parsed.legacyTankId,
      displayName: parsed.displayName,
      spreadsheetId: sheet.id
    })
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

async function readTab(accessToken: string, spreadsheetId: string, tab: string) {
  const values = await getSheetValues(accessToken, spreadsheetId, `${tab}!A1:Z`)
  return sheetToRecords(values)
}

export async function importTankFromGoogle(options: {
  client: SupabaseClient
  accessToken: string
  userId: string
  candidate: MigrateTankCandidate
  onProgress?: (message: string) => void
}): Promise<MigrateTankReport> {
  const { client, accessToken, userId, candidate } = options
  const errors: string[] = []
  const counts = emptyCounts()
  const progress = (message: string) => options.onProgress?.(message)

  try {
    const { data: existing } = await client
      .from('tanks')
      .select('id')
      .eq('legacy_id', candidate.legacyTankId)
      .maybeSingle()

    if (existing?.id) {
      return {
        legacyTankId: candidate.legacyTankId,
        displayName: candidate.displayName,
        status: 'skipped',
        message: 'Tank already imported (same legacy_id)',
        tankId: existing.id,
        errors: []
      }
    }

    progress('Reading TANK_INFO…')
    const tankRows = await readTab(accessToken, candidate.spreadsheetId, 'TANK_INFO')
    const tankInfo = tankRows[0]
    if (!tankInfo?.name && !tankInfo?.id) {
      throw new Error('TANK_INFO is empty')
    }

    const typeRaw = (tankInfo.type || 'freshwater').toLowerCase()
    const type = (TANK_TYPES.has(typeRaw) ? typeRaw : 'freshwater') as TankType
    const name = tankInfo.name || candidate.displayName

    progress('Creating tank…')
    const { data: tankRow, error: tankError } = await client
      .from('tanks')
      .insert({
        name,
        type,
        volume_liters: parseNumber(tankInfo.volume_liters),
        start_date: toDateOnly(tankInfo.start_date),
        notes: tankInfo.notes || null,
        legacy_id: tankInfo.id || candidate.legacyTankId
      })
      .select('id')
      .single()

    if (tankError) throw tankError
    const tankId = tankRow.id as string

    // Drop auto-seeded ranges if any were created by other paths (createTank seeds; we insert raw)
    // Direct insert does not seed — safe.

    progress('Importing livestock…')
    const livestockRows = await readTab(accessToken, candidate.spreadsheetId, 'LIVESTOCK')
    const livestockMap = new Map<string, string>()
    for (const row of livestockRows) {
      const legacy = row.livestock_id
      if (!legacy || !row.name_common || !row.category || !row.date_added || !row.status) {
        errors.push(`Livestock skipped: incomplete row`)
        continue
      }
      const { data, error } = await client
        .from('livestock')
        .insert({
          tank_id: tankId,
          name_common: row.name_common,
          name_scientific: row.name_scientific || null,
          category: row.category,
          sub_category: row.sub_category || null,
          tank_zone: row.tank_zone || null,
          origin: row.origin || null,
          date_added: toDateOnly(row.date_added),
          date_removed: toDateOnly(row.date_removed),
          status: row.status,
          notes: row.notes || null,
          legacy_id: legacy
        })
        .select('id')
        .single()
      if (error) {
        errors.push(`Livestock ${legacy}: ${error.message}`)
        continue
      }
      livestockMap.set(legacy, data.id as string)
      counts.livestock += 1
    }

    progress('Importing parameter ranges…')
    const rangeRows = await readTab(accessToken, candidate.spreadsheetId, 'PARAMETER_RANGES')
    for (const row of rangeRows) {
      if (!row.parameter || !row.unit || !row.status) {
        errors.push('Range skipped: incomplete row')
        continue
      }
      const minValue = parseNumber(row.min_value)
      const maxValue = parseNumber(row.max_value)
      if (minValue == null && maxValue == null) {
        errors.push(`Range ${row.parameter}/${row.status}: missing min/max`)
        continue
      }
      const { error } = await client.from('parameter_ranges').upsert({
        tank_id: tankId,
        parameter: row.parameter,
        min_value: minValue,
        max_value: maxValue,
        unit: row.unit,
        status: row.status,
        color: row.color || null
      }, { onConflict: 'tank_id,parameter,status' })
      if (error) {
        errors.push(`Range ${row.parameter}: ${error.message}`)
        continue
      }
      counts.ranges += 1
    }

    progress('Importing water tests…')
    const testRows = await readTab(accessToken, candidate.spreadsheetId, 'WATER_TESTS')
    const testPayload = []
    for (const row of testRows) {
      const measuredAt = toTimestamptz(row.date)
      const value = parseNumber(row.value)
      if (!row.test_group_id || !measuredAt || !row.parameter || value == null || !row.unit) {
        errors.push(`Water test skipped: incomplete row (${row.id || '?'})`)
        continue
      }
      testPayload.push({
        tank_id: tankId,
        test_group_id: row.test_group_id,
        measured_at: measuredAt,
        parameter: row.parameter,
        value,
        unit: row.unit,
        method: row.method || null,
        note: row.note || null,
        legacy_id: row.id || null
      })
    }
    if (testPayload.length) {
      const { error } = await client.from('water_tests').insert(testPayload)
      if (error) errors.push(`Water tests: ${error.message}`)
      else counts.waterTests = testPayload.length
    }

    progress('Importing events…')
    const eventRows = await readTab(accessToken, candidate.spreadsheetId, 'EVENTS')
    for (const row of eventRows) {
      const occurredAt = toTimestamptz(row.date)
      const targetType = (row.target_type || 'tank').toLowerCase() === 'livestock' ? 'livestock' : 'tank'
      if (!occurredAt || !row.type || !row.description) {
        errors.push(`Event skipped: incomplete (${row.id || '?'})`)
        continue
      }
      let livestockId: string | null = null
      if (targetType === 'livestock') {
        const legacyLivestockId = row.target_id?.trim()
        if (!legacyLivestockId) {
          errors.push(`Event ${row.id}: missing livestock target_id`)
          continue
        }
        livestockId = livestockMap.get(legacyLivestockId) ?? null
        if (!livestockId) {
          errors.push(`Event ${row.id}: livestock ${legacyLivestockId} not found`)
          continue
        }
      }
      const { error } = await client.from('events').insert({
        tank_id: tankId,
        occurred_at: occurredAt,
        type: row.type,
        description: row.description,
        quantity: parseNumber(row.quantity),
        unit: row.unit || null,
        product: row.product || null,
        note: row.note || null,
        target_type: targetType,
        livestock_id: livestockId,
        legacy_id: row.id || null
      })
      if (error) errors.push(`Event ${row.id}: ${error.message}`)
      else counts.events += 1
    }

    progress('Importing reminders…')
    const reminderRows = await readTab(accessToken, candidate.spreadsheetId, 'REMINDERS')
    for (const row of reminderRows) {
      const nextDue = toTimestamptz(row.next_due)
      if (!row.title || !nextDue || !row.event_type) {
        errors.push(`Reminder skipped: incomplete (${row.id || '?'})`)
        continue
      }
      const { error } = await client.from('reminders').insert({
        tank_id: tankId,
        title: row.title,
        next_due: nextDue,
        start_due: toTimestamptz(row.start_due),
        end_due: toDateOnly(row.end_due),
        repeat_every_days: parseNumber(row.repeat_every_days),
        last_done: toTimestamptz(row.last_done),
        notes: row.notes || null,
        event_type: row.event_type,
        quantity: parseNumber(row.quantity),
        unit: row.unit || null,
        product: row.product || null,
        onesignal_message_id: row.onesignal_message_id || null,
        legacy_id: row.id || null
      })
      if (error) errors.push(`Reminder ${row.id}: ${error.message}`)
      else counts.reminders += 1
    }

    progress('Importing equipment…')
    const equipmentRows = await readTab(accessToken, candidate.spreadsheetId, 'EQUIPMENT')
    for (const row of equipmentRows) {
      if (!row.type || !row.brand_model) {
        errors.push(`Equipment skipped: incomplete (${row.id || '?'})`)
        continue
      }
      const { error } = await client.from('equipment').insert({
        tank_id: tankId,
        type: row.type,
        brand_model: row.brand_model,
        installation_date: toDateOnly(row.installation_date),
        maintenance_interval: row.maintenance_interval || null,
        notes: row.notes || null,
        legacy_id: row.id || null
      })
      if (error) errors.push(`Equipment ${row.id}: ${error.message}`)
      else counts.equipment += 1
    }

    progress('Importing photos…')
    const photoRows = await readTab(accessToken, candidate.spreadsheetId, 'PHOTOS')
    for (const row of photoRows) {
      const takenAt = toTimestamptz(row.date)
      const relatedType = (row.related_type || 'tank').toLowerCase() === 'livestock' ? 'livestock' : 'tank'
      if (!takenAt || !row.drive_file_id) {
        errors.push(`Photo skipped: incomplete (${row.id || '?'})`)
        continue
      }
      let livestockId: string | null = null
      if (relatedType === 'livestock') {
        const legacyLivestockId = row.related_id?.trim()
        if (!legacyLivestockId) {
          errors.push(`Photo ${row.id}: missing livestock related_id`)
          continue
        }
        livestockId = livestockMap.get(legacyLivestockId) ?? null
        if (!livestockId) {
          errors.push(`Photo ${row.id}: livestock ${legacyLivestockId} not found`)
          continue
        }
      }

      try {
        const blob = await downloadDriveFile(accessToken, row.drive_file_id)
        const mime = blob.type || 'image/jpeg'
        const ext = guessExtFromMime(mime, row.drive_file_id)
        const photoId = globalThis.crypto?.randomUUID?.()
          ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
        // Ensure uuid-ish id for PK
        const id = photoId.includes('-')
          ? photoId
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.floor(Math.random() * 16)
              const v = c === 'x' ? r : (r & 0x3) | 0x8
              return v.toString(16)
            })
        const folder = relatedType === 'livestock' ? 'livestock' : 'tank'
        const storagePath = `${userId}/${tankId}/${folder}/${id}.${ext}`

        const { error: uploadError } = await client.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, blob, {
            contentType: mime,
            upsert: false,
            cacheControl: '3600'
          })
        if (uploadError) throw uploadError

        const { error: insertError } = await client.from('photos').insert({
          id,
          tank_id: tankId,
          taken_at: takenAt,
          related_type: relatedType,
          livestock_id: livestockId,
          storage_path: storagePath,
          note: row.note || null,
          legacy_id: row.id || null
        })
        if (insertError) {
          await client.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => undefined)
          throw insertError
        }
        counts.photos += 1
      } catch (e) {
        errors.push(`Photo ${row.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return {
      legacyTankId: candidate.legacyTankId,
      displayName: name,
      status: errors.length ? 'ok' : 'ok',
      message: errors.length ? `Imported with ${errors.length} warnings` : 'Imported',
      tankId,
      counts,
      errors
    }
  } catch (e) {
    return {
      legacyTankId: candidate.legacyTankId,
      displayName: candidate.displayName,
      status: 'error',
      message: e instanceof Error ? e.message : String(e),
      counts,
      errors
    }
  }
}
