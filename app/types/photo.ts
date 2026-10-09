export type PhotoRelatedType = 'tank' | 'livestock'

export type Photo = {
  id: string
  tankId: string
  takenAt: string
  relatedType: PhotoRelatedType
  livestockId: string | null
  storagePath: string
  note: string | null
  tags: string[]
  createdAt: string
}

export type UploadPhotoInput = {
  tankId: string
  file: File
  takenAt: Date
  relatedType: PhotoRelatedType
  livestockId?: string | null
  note?: string | null
  tags?: string[] | null
}

export type UpdatePhotoInput = {
  takenAt?: Date
  note?: string | null
  relatedType?: PhotoRelatedType
  livestockId?: string | null
  tags?: string[] | null
}
