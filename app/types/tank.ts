export type TankType = 'freshwater' | 'planted' | 'marine' | 'reef'

export type Tank = {
  id: string
  name: string
  type: TankType
  volumeLiters: number | null
  startDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTankInput = {
  name: string
  type: TankType
  volumeLiters?: number | null
  startDate?: string | null
  notes?: string | null
}

export type UpdateTankInput = {
  name?: string
  type?: TankType
  volumeLiters?: number | null
  startDate?: string | null
  notes?: string | null
}
