import type {
  Photo,
  PhotoRelatedType,
  UpdatePhotoInput,
  UploadPhotoInput
} from '~/types/photo'
import { toErrorMessage } from '~/utils/errorMessage'

const BUCKET = 'photos'
const MAX_BYTES = 10 * 1024 * 1024
const SIGNED_TTL_SEC = 3600
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
])

type PhotoRow = {
  id: string
  tank_id: string
  taken_at: string
  related_type: PhotoRelatedType
  livestock_id: string | null
  storage_path: string
  note: string | null
  tags?: string[] | null
  created_at: string
}

function normalizeTags(value: string[] | null | undefined): string[] {
  if (!value?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    const tag = raw.trim().toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

type SignedCacheEntry = {
  url: string
  expiresAt: number
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function mapRow(row: PhotoRow): Photo {
  return {
    id: row.id,
    tankId: row.tank_id,
    takenAt: row.taken_at,
    relatedType: row.related_type,
    livestockId: row.livestock_id,
    storagePath: row.storage_path,
    note: row.note,
    tags: normalizeTags(row.tags),
    createdAt: row.created_at
  }
}

function extensionForMime(mime: string, fileName: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  switch (mime) {
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/heic': return 'heic'
    case 'image/heif': return 'heif'
    default: return 'jpg'
  }
}

function newPhotoId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return uuid
  } catch {
    // ignore
  }
  // UUID-shaped fallback (Postgres `uuid` PK)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const SELECT = 'id, tank_id, taken_at, related_type, livestock_id, storage_path, note, tags, created_at'

export function usePhotos() {
  const photos = useState<Photo[]>('tanklog.photos', () => [])
  const loading = useState<boolean>('tanklog.photos.loading', () => false)
  const error = useState<string | null>('tanklog.photos.error', () => null)
  const signedCache = useState<Record<string, SignedCacheEntry>>('tanklog.photos.signedCache', () => ({}))

  async function listByTank(tankId: string): Promise<Photo[]> {
    loading.value = true
    error.value = null
    try {
      const client = useSupabaseClient()
      if (!client) throw new Error('Supabase is not configured')

      const { data, error: queryError } = await client
        .from('photos')
        .select(SELECT)
        .eq('tank_id', tankId)
        .order('taken_at', { ascending: false })

      if (queryError) throw new Error(toErrorMessage(queryError))

      photos.value = (data as PhotoRow[] | null)?.map(mapRow) ?? []
      return photos.value
    } catch (e) {
      error.value = toErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getSignedUrl(storagePath: string): Promise<string> {
    const cached = signedCache.value[storagePath]
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.url
    }

    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { data, error: signError } = await client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_TTL_SEC)

    if (signError) throw signError
    if (!data?.signedUrl) throw new Error('Failed to create signed URL')

    signedCache.value = {
      ...signedCache.value,
      [storagePath]: {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_TTL_SEC * 1000
      }
    }
    return data.signedUrl
  }

  async function upload(input: UploadPhotoInput): Promise<Photo> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const { user } = useAuth()
    const userId = user.value?.id
    if (!userId) throw new Error('Not signed in')

    if (!input.file) throw new Error('File is required')
    if (!ALLOWED_MIME.has(input.file.type)) {
      throw new Error('Unsupported image type')
    }
    if (input.file.size > MAX_BYTES) {
      throw new Error('Image must be 10 MiB or smaller')
    }
    if (!input.takenAt || Number.isNaN(input.takenAt.getTime())) {
      throw new Error('Invalid photo date')
    }

    const relatedType = input.relatedType
    const livestockId = relatedType === 'livestock'
      ? (input.livestockId ?? null)
      : null
    if (relatedType === 'livestock' && !livestockId) {
      throw new Error('Livestock is required for livestock photos')
    }

    const photoId = newPhotoId()
    const ext = extensionForMime(input.file.type, input.file.name)
    const folder = relatedType === 'livestock' ? 'livestock' : 'tank'
    const storagePath = `${userId}/${input.tankId}/${folder}/${photoId}.${ext}`

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(storagePath, input.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: input.file.type
      })

    if (uploadError) throw uploadError

    const payload = {
      id: photoId,
      tank_id: input.tankId,
      taken_at: input.takenAt.toISOString(),
      related_type: relatedType,
      livestock_id: livestockId,
      storage_path: storagePath,
      note: normalizeOptionalText(input.note),
      tags: normalizeTags(input.tags)
    }

    const { data, error: insertError } = await client
      .from('photos')
      .insert(payload)
      .select(SELECT)
      .single()

    if (insertError) {
      await client.storage.from(BUCKET).remove([storagePath]).catch(() => undefined)
      throw new Error(toErrorMessage(insertError))
    }

    const mapped = mapRow(data as PhotoRow)
    photos.value = [mapped, ...photos.value.filter(p => p.id !== mapped.id)]
    return mapped
  }

  async function update(id: string, input: UpdatePhotoInput): Promise<Photo> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const existing = photos.value.find(p => p.id === id)
    const relatedType = input.relatedType ?? existing?.relatedType ?? 'tank'
    const livestockId = relatedType === 'livestock'
      ? (input.livestockId !== undefined ? input.livestockId : existing?.livestockId ?? null)
      : null

    if (relatedType === 'livestock' && !livestockId) {
      throw new Error('Livestock is required for livestock photos')
    }

    const patch: Record<string, unknown> = {
      related_type: relatedType,
      livestock_id: livestockId
    }
    if (input.takenAt !== undefined) {
      if (Number.isNaN(input.takenAt.getTime())) throw new Error('Invalid photo date')
      patch.taken_at = input.takenAt.toISOString()
    }
    if (input.note !== undefined) patch.note = normalizeOptionalText(input.note)
    if (input.tags !== undefined) patch.tags = normalizeTags(input.tags)

    const { data, error: updateError } = await client
      .from('photos')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()

    if (updateError) throw new Error(toErrorMessage(updateError))

    const mapped = mapRow(data as PhotoRow)
    photos.value = photos.value.map(p => (p.id === id ? mapped : p))
    return mapped
  }

  async function remove(id: string): Promise<void> {
    const client = useSupabaseClient()
    if (!client) throw new Error('Supabase is not configured')

    const existing = photos.value.find(p => p.id === id)
    let storagePath = existing?.storagePath

    if (!storagePath) {
      const { data } = await client.from('photos').select('storage_path').eq('id', id).maybeSingle()
      storagePath = (data as { storage_path?: string } | null)?.storage_path
    }

    const { error: deleteError } = await client.from('photos').delete().eq('id', id)
    if (deleteError) throw deleteError

    if (storagePath) {
      await client.storage.from(BUCKET).remove([storagePath]).catch(() => undefined)
      const { [storagePath]: _removed, ...next } = signedCache.value
      signedCache.value = next
    }

    photos.value = photos.value.filter(p => p.id !== id)
  }

  return {
    photos,
    loading,
    error,
    listByTank,
    getSignedUrl,
    upload,
    update,
    remove
  }
}
