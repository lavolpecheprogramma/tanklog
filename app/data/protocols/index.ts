import {
  BEA_AEQUILIBRIUM_PROTOCOL_KEY,
  BEA_AEQUILIBRIUM_VARIANTS
} from './beaAequilibrium'

export type ProtocolDefinition = {
  key: string
  /** i18n key under reminders.protocol.protocols.* */
  labelKey: string
  variants: readonly string[]
}

export const PROTOCOL_CATALOG: ProtocolDefinition[] = [
  {
    key: BEA_AEQUILIBRIUM_PROTOCOL_KEY,
    labelKey: 'beaAequilibrium',
    variants: BEA_AEQUILIBRIUM_VARIANTS
  }
]

export type {
  BeaAequilibriumVariant,
  ProtocolCalendarCell,
  ProtocolPreviewDose,
  ProtocolSchedulePreview
} from './beaAequilibrium'
export {
  BEA_AEQUILIBRIUM_PROTOCOL_KEY,
  BEA_AEQUILIBRIUM_VARIANTS,
  buildBeaAequilibriumPreview,
  parseProtocolTag,
  previewToReminderInputs,
  productLabel,
  protocolTag
} from './beaAequilibrium'
