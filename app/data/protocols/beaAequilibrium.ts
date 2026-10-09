import type { CreateReminderInput } from '~/types/reminder'
import { capsuleDoseFromLiters, PROTOCOL_DOSE_UNIT } from '~/utils/protocolDose'

export type BeaAequilibriumVariant = 'maturazione' | 'risoluzione' | 'mantenimento'

export type BeaProduct = 'A' | 'E' | 'Z' | 'PRO'

export type ProtocolDoseStep = {
  week: 1 | 2 | 3 | 4
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  product: BeaProduct
}

export type ProtocolCalendarCell = {
  week: 1 | 2 | 3 | 4
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  product: BeaProduct | null
  date: Date
}

export type ProtocolPreviewDose = {
  date: Date
  product: BeaProduct
  productLabel: string
  quantity: number
  unit: typeof PROTOCOL_DOSE_UNIT
  title: string
  notes: string
  eventType: 'dosing'
}

export type ProtocolPreviewReview = {
  date: Date
  title: string
  notes: string
  eventType: 'maintenance'
}

export type ProtocolSchedulePreview = {
  cells: ProtocolCalendarCell[]
  weeks: ProtocolCalendarCell[][]
  doses: ProtocolPreviewDose[]
  review: ProtocolPreviewReview
  quantity: number
  unit: typeof PROTOCOL_DOSE_UNIT
  runId: string
}

const MATURAZIONE: ProtocolDoseStep[] = [
  { week: 1, day: 1, product: 'A' },
  { week: 1, day: 4, product: 'E' },
  { week: 1, day: 7, product: 'PRO' },
  { week: 2, day: 1, product: 'A' },
  { week: 2, day: 5, product: 'E' },
  { week: 3, day: 1, product: 'Z' },
  { week: 3, day: 5, product: 'PRO' },
  { week: 4, day: 1, product: 'A' },
  { week: 4, day: 3, product: 'Z' },
  { week: 4, day: 5, product: 'E' },
  { week: 4, day: 7, product: 'PRO' }
]

const RISOLUZIONE: ProtocolDoseStep[] = [
  { week: 1, day: 1, product: 'A' },
  { week: 1, day: 3, product: 'Z' },
  { week: 1, day: 5, product: 'E' },
  { week: 1, day: 7, product: 'PRO' },
  { week: 2, day: 4, product: 'PRO' },
  { week: 3, day: 1, product: 'A' },
  { week: 3, day: 3, product: 'Z' },
  { week: 3, day: 5, product: 'E' },
  { week: 3, day: 7, product: 'PRO' },
  { week: 4, day: 4, product: 'PRO' }
]

const MANTENIMENTO: ProtocolDoseStep[] = [
  { week: 1, day: 1, product: 'A' },
  { week: 1, day: 5, product: 'PRO' },
  { week: 2, day: 1, product: 'E' },
  { week: 2, day: 5, product: 'PRO' },
  { week: 3, day: 1, product: 'A' },
  { week: 3, day: 5, product: 'PRO' },
  { week: 4, day: 1, product: 'Z' },
  { week: 4, day: 5, product: 'PRO' }
]

const STEPS_BY_VARIANT: Record<BeaAequilibriumVariant, ProtocolDoseStep[]> = {
  maturazione: MATURAZIONE,
  risoluzione: RISOLUZIONE,
  mantenimento: MANTENIMENTO
}

export const BEA_AEQUILIBRIUM_VARIANTS: BeaAequilibriumVariant[] = [
  'maturazione',
  'risoluzione',
  'mantenimento'
]

export const BEA_AEQUILIBRIUM_PROTOCOL_KEY = 'bea-aequilibrium'

export function productLabel(product: BeaProduct): string {
  return `BEA Aequilibrium ${product}`
}

export function protocolTag(variant: BeaAequilibriumVariant, runId: string): string {
  return `protocol:${BEA_AEQUILIBRIUM_PROTOCOL_KEY}:${variant}:${runId}`
}

export function parseProtocolTag(notes: string | null | undefined): {
  protocolKey: string
  variant: string
  runId: string
} | null {
  if (!notes) return null
  const match = /protocol:([a-z0-9-]+):([a-z0-9-]+):([a-f0-9-]{8,})/i.exec(notes)
  if (!match) return null
  return {
    protocolKey: match[1]!,
    variant: match[2]!,
    runId: match[3]!
  }
}

function addLocalDays(start: Date, offsetDays: number): Date {
  const next = new Date(start.getTime())
  next.setDate(next.getDate() + offsetDays)
  return next
}

function dayOffset(week: number, day: number): number {
  return (week - 1) * 7 + (day - 1)
}

function doseNotes(variant: BeaAequilibriumVariant, runId: string): string {
  return [
    'Dilute capsule in 100 ml aquarium water; dose in high-flow area (sump). Skimmer off ~30 min.',
    protocolTag(variant, runId)
  ].join('\n')
}

function reviewNotes(variant: BeaAequilibriumVariant, runId: string): string {
  return [
    'BEA cycle pause week ended — evaluate whether to repeat or switch calendar.',
    protocolTag(variant, runId)
  ].join('\n')
}

export function getBeaSteps(variant: BeaAequilibriumVariant): ProtocolDoseStep[] {
  return STEPS_BY_VARIANT[variant]
}

export function buildBeaAequilibriumPreview(options: {
  start: Date
  volumeLiters: number
  variant: BeaAequilibriumVariant
  runId?: string
}): ProtocolSchedulePreview {
  const { start, volumeLiters, variant } = options
  if (Number.isNaN(start.getTime())) throw new Error('Invalid start date')

  const quantity = capsuleDoseFromLiters(volumeLiters)
  const runId = options.runId ?? crypto.randomUUID()
  const stepMap = new Map<string, BeaProduct>()
  for (const step of getBeaSteps(variant)) {
    stepMap.set(`${step.week}-${step.day}`, step.product)
  }

  const cells: ProtocolCalendarCell[] = []
  for (let week = 1; week <= 4; week++) {
    for (let day = 1; day <= 7; day++) {
      const w = week as 1 | 2 | 3 | 4
      const d = day as 1 | 2 | 3 | 4 | 5 | 6 | 7
      cells.push({
        week: w,
        day: d,
        product: stepMap.get(`${week}-${day}`) ?? null,
        date: addLocalDays(start, dayOffset(week, day))
      })
    }
  }

  const weeks: ProtocolCalendarCell[][] = [1, 2, 3, 4].map(week =>
    cells.filter(cell => cell.week === week)
  )

  const doses: ProtocolPreviewDose[] = getBeaSteps(variant).map((step) => {
    const date = addLocalDays(start, dayOffset(step.week, step.day))
    return {
      date,
      product: step.product,
      productLabel: productLabel(step.product),
      quantity,
      unit: PROTOCOL_DOSE_UNIT,
      title: `BEA Aequilibrium · ${step.product}`,
      notes: doseNotes(variant, runId),
      eventType: 'dosing'
    }
  })

  const review: ProtocolPreviewReview = {
    date: addLocalDays(start, 34),
    title: 'BEA Aequilibrium · review after pause',
    notes: reviewNotes(variant, runId),
    eventType: 'maintenance'
  }

  return {
    cells,
    weeks,
    doses,
    review,
    quantity,
    unit: PROTOCOL_DOSE_UNIT,
    runId
  }
}

export function previewToReminderInputs(
  tankId: string,
  preview: ProtocolSchedulePreview
): CreateReminderInput[] {
  const dosing: CreateReminderInput[] = preview.doses.map(dose => ({
    tankId,
    title: dose.title,
    nextDue: dose.date,
    eventType: dose.eventType,
    repeatEveryDays: null,
    notes: dose.notes,
    quantity: dose.quantity,
    unit: dose.unit,
    product: dose.productLabel
  }))

  const review: CreateReminderInput = {
    tankId,
    title: preview.review.title,
    nextDue: preview.review.date,
    eventType: preview.review.eventType,
    repeatEveryDays: null,
    notes: preview.review.notes
  }

  return [...dosing, review]
}
