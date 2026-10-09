export type LivestockCategory = 'fish' | 'coral' | 'invertebrate' | 'plant'
export type LivestockStatus = 'active' | 'removed' | 'dead'
export type LivestockTankZone = 'top' | 'mid' | 'bottom' | 'rock' | 'sand'
export type LivestockOrigin = 'wild' | 'captive' | 'frag'

export const LIVESTOCK_CATEGORIES: LivestockCategory[] = [
  'fish',
  'coral',
  'invertebrate',
  'plant'
]

export const LIVESTOCK_STATUSES: LivestockStatus[] = [
  'active',
  'removed',
  'dead'
]

export const LIVESTOCK_TANK_ZONES: LivestockTankZone[] = [
  'top',
  'mid',
  'bottom',
  'rock',
  'sand'
]

export const LIVESTOCK_ORIGINS: LivestockOrigin[] = [
  'wild',
  'captive',
  'frag'
]

export type Livestock = {
  id: string
  tankId: string
  nameCommon: string
  nameScientific: string | null
  category: LivestockCategory
  subCategory: string | null
  tankZone: LivestockTankZone | null
  origin: LivestockOrigin | null
  dateAdded: string
  dateRemoved: string | null
  status: LivestockStatus
  cost: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CreateLivestockInput = {
  tankId: string
  nameCommon: string
  nameScientific?: string | null
  category: LivestockCategory
  subCategory?: string | null
  tankZone?: LivestockTankZone | null
  origin?: LivestockOrigin | null
  dateAdded: string
  dateRemoved?: string | null
  status?: LivestockStatus
  cost?: number | null
  notes?: string | null
}

export type UpdateLivestockInput = {
  nameCommon?: string
  nameScientific?: string | null
  category?: LivestockCategory
  subCategory?: string | null
  tankZone?: LivestockTankZone | null
  origin?: LivestockOrigin | null
  dateAdded?: string
  dateRemoved?: string | null
  status?: LivestockStatus
  cost?: number | null
  notes?: string | null
}
