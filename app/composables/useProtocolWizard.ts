import {
  BEA_AEQUILIBRIUM_PROTOCOL_KEY,
  buildBeaAequilibriumPreview,
  parseProtocolTag,
  previewToReminderInputs,
  type BeaAequilibriumVariant,
  type ProtocolSchedulePreview
} from '~/data/protocols'
import type { Reminder } from '~/types/reminder'

export function useProtocolWizard() {
  const { t } = useI18n()
  const remindersApi = useReminders()

  function buildPreview(options: {
    protocolKey: string
    variant: BeaAequilibriumVariant
    start: Date
    volumeLiters: number
    runId?: string
  }): ProtocolSchedulePreview {
    if (options.protocolKey !== BEA_AEQUILIBRIUM_PROTOCOL_KEY) {
      throw new Error(`Unsupported protocol: ${options.protocolKey}`)
    }
    return buildBeaAequilibriumPreview({
      start: options.start,
      volumeLiters: options.volumeLiters,
      variant: options.variant,
      runId: options.runId
    })
  }

  function localizeInputs(inputs: ReturnType<typeof previewToReminderInputs>) {
    const doseNote = t('reminders.protocol.doseNotes')
    const reviewNote = t('reminders.protocol.reviewNotes')
    const reviewTitle = t('reminders.protocol.reviewReminderTitle')

    return inputs.map((input) => {
      const tag = parseProtocolTag(input.notes)
      const tagLine = tag
        ? `protocol:${tag.protocolKey}:${tag.variant}:${tag.runId}`
        : null
      const isReview = input.eventType === 'maintenance'
      const body = isReview ? reviewNote : doseNote
      return {
        ...input,
        title: isReview ? reviewTitle : input.title,
        notes: tagLine ? `${body}\n${tagLine}` : body
      }
    })
  }

  async function apply(options: {
    tankId: string
    protocolKey: string
    variant: BeaAequilibriumVariant
    start: Date
    volumeLiters: number
    runId?: string
  }): Promise<{ created: number, runId: string, failed: number, lastError: string | null }> {
    const preview = buildPreview(options)
    const inputs = localizeInputs(previewToReminderInputs(options.tankId, preview))

    let created = 0
    let failed = 0
    let lastError: string | null = null

    for (const input of inputs) {
      try {
        await remindersApi.create(input)
        created++
      } catch (e) {
        failed++
        lastError = e instanceof Error ? e.message : String(e)
      }
    }

    return { created, runId: preview.runId, failed, lastError }
  }

  function remindersForRun(runId: string, list?: Reminder[]): Reminder[] {
    const source = list ?? remindersApi.reminders.value
    return source.filter((reminder) => {
      const tag = parseProtocolTag(reminder.notes)
      return tag?.runId === runId
    })
  }

  async function removeRun(runId: string): Promise<number> {
    const targets = remindersForRun(runId)
    let removed = 0
    for (const reminder of targets) {
      await remindersApi.remove(reminder.id)
      removed++
    }
    return removed
  }

  return {
    buildPreview,
    apply,
    remindersForRun,
    removeRun
  }
}
