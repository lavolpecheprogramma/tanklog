<script setup lang="ts">
import {
  BEA_AEQUILIBRIUM_PROTOCOL_KEY,
  BEA_AEQUILIBRIUM_VARIANTS,
  PROTOCOL_CATALOG,
  type BeaAequilibriumVariant
} from '~/data/protocols'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '~/utils/datetime'

const open = defineModel<boolean>({ default: false })

const props = defineProps<{
  tankId: string
  volumeLiters: number | null
}>()

const emit = defineEmits<{
  applied: [payload: { created: number, runId: string }]
}>()

const { t, locale } = useI18n()
const toast = useToast()
const tanksApi = useTanks()
const wizard = useProtocolWizard()

const protocolKey = ref(BEA_AEQUILIBRIUM_PROTOCOL_KEY)
const variant = ref<BeaAequilibriumVariant>('mantenimento')
const startLocal = ref(toDatetimeLocalValue(new Date()))
const volumeInput = ref<number | undefined>(undefined)
const saveVolumeToTank = ref(false)
const runId = ref(crypto.randomUUID())
const busy = ref(false)
const formError = ref<string | null>(null)

const protocolItems = computed(() =>
  PROTOCOL_CATALOG.map(item => ({
    label: t(`reminders.protocol.protocols.${item.labelKey}`),
    value: item.key
  }))
)

const variantItems = computed(() =>
  BEA_AEQUILIBRIUM_VARIANTS.map(value => ({
    label: t(`reminders.protocol.variants.${value}`),
    value
  }))
)

const selectedProtocol = computed({
  get: () => protocolKey.value,
  set: (value: unknown) => {
    protocolKey.value = String(value)
  }
})

const selectedVariant = computed({
  get: () => variant.value,
  set: (value: unknown) => {
    variant.value = String(value) as BeaAequilibriumVariant
  }
})

const effectiveVolume = computed(() => {
  const raw = volumeInput.value
  if (raw == null || !Number.isFinite(raw)) return null
  return raw
})

const startDate = computed(() => fromDatetimeLocalValue(startLocal.value))

const preview = computed(() => {
  const start = startDate.value
  const volume = effectiveVolume.value
  if (!start || volume == null || volume <= 0) return null
  try {
    return wizard.buildPreview({
      protocolKey: protocolKey.value,
      variant: variant.value,
      start,
      volumeLiters: volume,
      runId: runId.value
    })
  } catch {
    return null
  }
})

const variantHelp = computed(() => t(`reminders.protocol.variantHelp.${variant.value}`))

function formatCellDate(date: Date): string {
  return new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date)
}

function formatListDate(date: Date): string {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function reset() {
  protocolKey.value = BEA_AEQUILIBRIUM_PROTOCOL_KEY
  variant.value = 'mantenimento'
  startLocal.value = toDatetimeLocalValue(new Date())
  volumeInput.value = props.volumeLiters ?? undefined
  saveVolumeToTank.value = false
  runId.value = crypto.randomUUID()
  formError.value = null
  busy.value = false
}

watch(open, (value) => {
  if (value) reset()
})

watch(
  () => props.volumeLiters,
  (value) => {
    if (open.value && volumeInput.value == null) {
      volumeInput.value = value ?? undefined
    }
  }
)

async function submit() {
  formError.value = null
  const start = startDate.value
  const volume = effectiveVolume.value
  if (!start) {
    formError.value = t('reminders.protocol.errors.invalidDate')
    return
  }
  if (volume == null || volume <= 0) {
    formError.value = t('reminders.protocol.errors.invalidVolume')
    return
  }

  busy.value = true
  try {
    if (saveVolumeToTank.value) {
      await tanksApi.updateTank(props.tankId, { volumeLiters: volume })
    }

    const result = await wizard.apply({
      tankId: props.tankId,
      protocolKey: protocolKey.value,
      variant: variant.value,
      start,
      volumeLiters: volume,
      runId: runId.value
    })

    if (result.created === 0) {
      formError.value = result.lastError ?? t('reminders.protocol.errors.createFailed')
      return
    }

    toast.add({
      title: t('reminders.protocol.created', { count: result.created }),
      description: result.failed
        ? t('reminders.protocol.partialFail', { failed: result.failed })
        : undefined,
      color: result.failed ? 'warning' : 'success',
      icon: 'i-lucide-flask-conical'
    })

    emit('applied', { created: result.created, runId: result.runId })
    open.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('reminders.protocol.title')"
    :description="t('reminders.protocol.subtitle')"
    class="max-w-3xl"
  >
    <template #body>
      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <UFormField :label="t('reminders.protocol.protocol')">
          <USelect
            v-model="selectedProtocol"
            :items="protocolItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('reminders.protocol.calendar')"
          :hint="variantHelp"
        >
          <USelect
            v-model="selectedVariant"
            :items="variantItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('reminders.protocol.startAt')"
            required
          >
            <UInput
              v-model="startLocal"
              type="datetime-local"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('reminders.protocol.volume')"
            required
          >
            <UInput
              v-model.number="volumeInput"
              type="number"
              min="1"
              step="1"
              required
              class="w-full"
            />
          </UFormField>
        </div>

        <UCheckbox
          v-if="volumeLiters == null || volumeLiters !== effectiveVolume"
          v-model="saveVolumeToTank"
          :label="t('reminders.protocol.saveVolume')"
        />

        <div
          v-if="preview"
          class="space-y-4"
        >
          <div>
            <p class="text-sm font-medium text-cyan-100">
              {{ t('reminders.protocol.calendarPreview') }}
            </p>
            <p class="mt-1 text-xs text-slate-400">
              {{ t('reminders.protocol.doseSummary', {
                quantity: preview.quantity,
                unit: t('reminders.protocol.unitCapsule')
              }) }}
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="(weekCells, weekIndex) in preview.weeks"
              :key="weekIndex"
              class="rounded-lg border border-cyan-500/15 bg-slate-950/60 p-2"
            >
              <p class="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
                {{ t('reminders.protocol.week', { n: weekIndex + 1 }) }}
              </p>
              <ul class="space-y-1">
                <li
                  v-for="cell in weekCells"
                  :key="`${cell.week}-${cell.day}`"
                  class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
                  :class="cell.product
                    ? 'bg-orange-500/20 text-orange-50 ring-1 ring-orange-400/30'
                    : 'bg-slate-900/40 text-slate-500'"
                >
                  <span class="min-w-0 truncate">
                    {{ formatCellDate(cell.date) }}
                  </span>
                  <span
                    v-if="cell.product"
                    class="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-900"
                  >
                    {{ cell.product }}
                  </span>
                  <span
                    v-else
                    class="shrink-0 text-[11px] text-slate-600"
                  >
                    —
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <p class="text-sm font-medium text-cyan-100">
              {{ t('reminders.protocol.doseList') }}
            </p>
            <ul class="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">
              <li
                v-for="(dose, index) in preview.doses"
                :key="index"
                class="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/80 py-1.5"
              >
                <span>{{ formatListDate(dose.date) }}</span>
                <span class="font-medium text-cyan-100">
                  {{ dose.product }}
                  ·
                  {{ dose.quantity }}
                  {{ t('reminders.protocol.unitCapsule') }}
                </span>
              </li>
              <li class="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-slate-400">
                <span>{{ formatListDate(preview.review.date) }}</span>
                <span>{{ t('reminders.protocol.reviewReminder') }}</span>
              </li>
            </ul>
          </div>
        </div>

        <p
          v-else
          class="text-sm text-slate-400"
        >
          {{ t('reminders.protocol.previewHint') }}
        </p>

        <p
          v-if="formError"
          class="text-sm text-red-400"
          role="alert"
        >
          {{ formError }}
        </p>

        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :disabled="busy"
            @click="open = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            icon="i-lucide-flask-conical"
            :loading="busy"
            :disabled="!preview"
          >
            {{ t('reminders.protocol.apply') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
