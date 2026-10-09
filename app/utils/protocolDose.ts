/**
 * BEA Aequilibrium capsule dose from tank volume.
 * ≤500 L → half capsule; above that → 1 capsule per 1000 L (ceil).
 */
export function capsuleDoseFromLiters(volumeLiters: number): number {
  if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
    throw new Error('Volume must be a positive number')
  }
  if (volumeLiters <= 500) return 0.5
  return Math.ceil(volumeLiters / 1000)
}

export const PROTOCOL_DOSE_UNIT = 'capsule' as const
