import type { TankLogEvent } from '~/types/event'
import type { Reminder } from '~/types/reminder'
import type { ParameterRange } from '~/composables/useParameterRanges'
import type { WaterTestSession } from '~/composables/useWaterTests'

const DB_NAME = 'tanklog-offline-v1'
const STORE = 'tankBundles'

export type TankOfflineBundle = {
  tankId: string
  cachedAt: number
  sessions: WaterTestSession[]
  reminders: Reminder[]
  events: TankLogEvent[]
  ranges: ParameterRange[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!import.meta.client || typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'tankId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export function useOfflineCache() {
  async function putTankBundle(
    tankId: string,
    data: Omit<TankOfflineBundle, 'tankId' | 'cachedAt'>
  ): Promise<void> {
    if (!import.meta.client) return
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('cache write failed'))
        tx.objectStore(STORE).put({
          tankId,
          cachedAt: Date.now(),
          ...data
        } satisfies TankOfflineBundle)
      })
      db.close()
    } catch {
      // best effort
    }
  }

  async function getTankBundle(tankId: string): Promise<TankOfflineBundle | null> {
    if (!import.meta.client) return null
    try {
      const db = await openDb()
      const row = await new Promise<TankOfflineBundle | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(tankId)
        req.onsuccess = () => resolve((req.result as TankOfflineBundle | undefined) ?? null)
        req.onerror = () => reject(req.error ?? new Error('cache read failed'))
      })
      db.close()
      return row
    } catch {
      return null
    }
  }

  return {
    putTankBundle,
    getTankBundle
  }
}
