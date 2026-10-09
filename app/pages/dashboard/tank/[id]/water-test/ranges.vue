<script setup lang="ts">
import type { ParameterRangeInput, ParameterRangeStatus } from '~/composables/useParameterRanges'
import type { TankType } from '~/types/tank'
import { getDefaultParameterRangesForTankType } from '~/utils/parameterRangeDefaults'

definePageMeta({
  title: 'Ranges'
})

const { t } = useI18n()
const route = useRoute()
const tanksApi = useTanks()
const rangesApi = useParameterRanges()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

type DraftRow = ParameterRangeInput & { key: string }

const draft = ref<DraftRow[]>([])
const busy = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)

const statusItems = computed(() => ([
  { label: t('ranges.status.optimal'), value: 'optimal' },
  { label: t('ranges.status.acceptable'), value: 'acceptable' },
  { label: t('ranges.status.critical'), value: 'critical' }
]))

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `r_${Date.now()}_${Math.random()}`
}

function toDraft(rows: ParameterRangeInput[]): DraftRow[] {
  return rows.map(row => ({ ...row, key: newKey() }))
}

async function load() {
  error.value = null
  if (!tanksApi.tanks.value.length) await tanksApi.refresh()
  if (!tank.value) {
    error.value = t('tanks.notFound')
    return
  }
  tanksApi.setActiveTankId(tank.value.id)
  const rows = await rangesApi.listForTank(tankId.value)
  draft.value = toDraft(rows.map(row => ({
    parameter: row.parameter,
    minValue: row.minValue,
    maxValue: row.maxValue,
    unit: row.unit,
    status: row.status,
    color: row.color
  })))
}

onMounted(() => {
  void load().catch((e) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
})

function addRow() {
  draft.value.push({
    key: newKey(),
    parameter: '',
    minValue: null,
    maxValue: null,
    unit: '',
    status: 'acceptable',
    color: null
  })
}

function removeRow(key: string) {
  draft.value = draft.value.filter(row => row.key !== key)
}

function applyPreset() {
  const type = (tank.value?.type ?? 'freshwater') as TankType
  draft.value = toDraft(getDefaultParameterRangesForTankType(type))
}

async function save() {
  busy.value = true
  message.value = null
  error.value = null
  try {
    const payload: ParameterRangeInput[] = draft.value.map(row => ({
      parameter: row.parameter,
      minValue: row.minValue,
      maxValue: row.maxValue,
      unit: row.unit,
      status: row.status as ParameterRangeStatus,
      color: row.color
    }))
    await rangesApi.saveForTank(tankId.value, payload)
    message.value = t('ranges.saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function parseNullableNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <UButton
      to="/dashboard"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      ← {{ t('nav.dashboard') }}
    </UButton>

    <h1 class="font-display text-3xl font-semibold text-white">
      {{ t('ranges.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ tank?.name }} — {{ t('ranges.subtitle') }}
    </p>

    <TankSubnav
      v-if="tank"
      class="mt-6"
      :tank-id="tank.id"
    />

    <div class="mt-6 flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="soft"
        @click="applyPreset"
      >
        {{ t('ranges.applyPreset') }}
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        @click="addRow"
      >
        {{ t('ranges.addRow') }}
      </UButton>
      <UButton
        color="primary"
        :loading="busy"
        @click="save"
      >
        {{ t('common.save') }}
      </UButton>
    </div>

    <p
      v-if="message"
      class="mt-4 text-sm text-cyan-400"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="error"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ error }}
    </p>

    <div class="mt-6 overflow-x-auto rounded-xl border border-cyan-500/15">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-slate-900/80 text-slate-300">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('ranges.parameter') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('ranges.min') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('ranges.max') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('ranges.unit') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('ranges.statusLabel') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('ranges.color') }}</th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in draft"
            :key="row.key"
            class="border-t border-white/5"
          >
            <td class="px-3 py-2">
              <UInput
                v-model="row.parameter"
                class="min-w-24"
              />
            </td>
            <td class="px-3 py-2">
              <UInput
                :model-value="row.minValue ?? ''"
                class="min-w-20"
                @update:model-value="(v: string | number) => { row.minValue = parseNullableNumber(String(v)) }"
              />
            </td>
            <td class="px-3 py-2">
              <UInput
                :model-value="row.maxValue ?? ''"
                class="min-w-20"
                @update:model-value="(v: string | number) => { row.maxValue = parseNullableNumber(String(v)) }"
              />
            </td>
            <td class="px-3 py-2">
              <UInput
                v-model="row.unit"
                class="min-w-20"
              />
            </td>
            <td class="px-3 py-2">
              <USelect
                v-model="row.status"
                :items="statusItems"
                class="min-w-32"
              />
            </td>
            <td class="px-3 py-2">
              <UInput
                :model-value="row.color || '#22d3ee'"
                type="color"
                class="min-w-14"
                @update:model-value="(v: string | number) => { row.color = String(v) }"
              />
            </td>
            <td class="px-3 py-2">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash"
                :aria-label="t('common.delete')"
                @click="removeRow(row.key)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
