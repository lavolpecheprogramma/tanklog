export type EquipmentType =
  | 'light'
  | 'pump'
  | 'filter'
  | 'heater'
  | 'skimmer'
  | 'ato'
  | 'other'

export const EQUIPMENT_TYPES: EquipmentType[] = [
  'light',
  'pump',
  'filter',
  'heater',
  'skimmer',
  'ato',
  'other'
]

export type Equipment = {
  id: string
  tankId: string
  type: string
  brandModel: string
  installationDate: string | null
  maintenanceInterval: string | null
  cost: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CreateEquipmentInput = {
  tankId: string
  type: string
  brandModel: string
  installationDate?: string | null
  maintenanceInterval?: string | null
  cost?: number | null
  notes?: string | null
}

export type UpdateEquipmentInput = {
  type?: string
  brandModel?: string
  installationDate?: string | null
  maintenanceInterval?: string | null
  cost?: number | null
  notes?: string | null
}
