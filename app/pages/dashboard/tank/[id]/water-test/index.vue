<script setup lang="ts">
import type { ParameterRange } from '~/composables/useParameterRanges'
import type { WaterTestSession } from '~/composables/useWaterTests'
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '~/utils/datetime'
import { evaluateMeasurement, verdictTone, type RangeVerdict } from '~/utils/parameterRangeEval'

definePageMeta({
  title: 'Water tests'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const rangesApi = useParameterRanges()
const waterTests = useWaterTests()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const rangeRows = ref<ParameterRange[]>([])
const parameterOptions = ref<Array<{ parameter: string, unit: string, color: string | null }>>([])
const values = ref<Record<string, string>>({})
const measuredAtLocal = ref(toDatetimeLocalValue(new Date()))
const method = ref('')
const note = ref('')

const busy = ref(false)
const formError = ref<string | null>(null)
const loadError = ref<string | null>(null)

const formOpen = ref(false)
const editingTestGroupId = ref<string | null>(null)
const detailOpen = ref(false)
const selectedSession = ref<WaterTestSession | null>(null)
const actionId = ref<string | null>(null)

const formTitle = computed(() =>
  editingTestGroupId.value ? t('waterTests.editSession') : t('waterTests.newSession')
)

const chartParameter = ref('')
const chartDays = ref<number>(30)

function asSelectString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value)
  }
  return ''
}

function asSelectNumber(value: unknown, fallback: number): number {
  const raw = asSelectString(value)
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const selectedChartParameter = computed({
  get: () => chartParameter.value,
  set: (value: unknown) => {
    chartParameter.value = asSelectString(value)
  }
})

const selectedChartDays = computed({
  get: () => chartDays.value,
  set: (value: unknown) => {
    chartDays.value = asSelectNumber(value, 30)
  }
})

const dayItems = computed(() => ([
  { label: t('charts.days7'), value: 7 },
  { label: t('charts.days30'), value: 30 },
  { label: t('charts.days90'), value: 90 }
]))

const chartParameterItems = computed(() =>
  parameterOptions.value.map(option => ({
    label: `${option.parameter} (${option.unit})`,
    value: option.parameter
  }))
)

const chartColor = computed(() => {
  const option = parameterOptions.value.find(item => item.parameter === chartParameter.value)
  return option?.color || '#22d3ee'
})

const chartPoints = computed(() => {
  const parameter = chartParameter.value
  if (!parameter) return []
  const cutoff = Date.now() - chartDays.value * 24 * 60 * 60 * 1000
  const points: Array<{ label: string, value: number, at: number }> = []

  for (const session of waterTests.sessions.value) {
    const at = Date.parse(session.measuredAt)
    if (!Number.isFinite(at) || at < cutoff) continue
    const measurement = session.measurements.find(m => m.parameter === parameter)
    if (!measurement) continue
    points.push({
      at,
      value: measurement.value,
      label: formatDateTime(session.measuredAt, locale.value)
    })
  }

  return points
    .sort((a, b) => a.at - b.at)
    .map(({ label, value }) => ({ label, value }))
})

const chartSummary = computed(() => {
  if (!chartPoints.value.length) return t('charts.empty')
  const valuesOnly = chartPoints.value.map(p => p.value)
  const min = Math.min(...valuesOnly)
  const max = Math.max(...valuesOnly)
  const last = valuesOnly[valuesOnly.length - 1]
  return t('charts.summary', { count: valuesOnly.length, min, max, last })
})

const chartRenderKey = computed(() => `${chartParameter.value}:${chartDays.value}:${chartPoints.value.length}`)

function countRecentPoints(parameter: string): number {
  const cutoff = Date.now() - chartDays.value * 24 * 60 * 60 * 1000
  let count = 0
  for (const session of waterTests.sessions.value) {
    const at = Date.parse(session.measuredAt)
    if (!Number.isFinite(at) || at < cutoff) continue
    if (session.measurements.some(m => m.parameter === parameter)) count += 1
  }
  return count
}

function parameterHasRecentData(parameter: string): boolean {
  return countRecentPoints(parameter) > 0
}

/** Prefer parameter with most points in the selected window; fallback alphabetical. */
function pickDefaultChartParameter(): string {
  let best = parameterOptions.value[0]?.parameter ?? ''
  let bestCount = -1
  for (const option of parameterOptions.value) {
    const count = countRecentPoints(option.parameter)
    if (count > bestCount) {
      best = option.parameter
      bestCount = count
    }
  }
  return best
}

async function ensureTank() {
  if (!tanksApi.tanks.value.length) {
    await tanksApi.refresh()
  }
  if (!tank.value) {
    throw new Error(t('tanks.notFound'))
  }
  tanksApi.setActiveTankId(tank.value.id)
}

const offlineCache = useOfflineCache()
const staleBanner = ref<string | null>(null)

async function load() {
  loadError.value = null
  staleBanner.value = null
  try {
    await ensureTank()
    rangeRows.value = await rangesApi.listForTank(tankId.value)
    parameterOptions.value = rangesApi.toParameterOptions(rangeRows.value)
    const next: Record<string, string> = {}
    for (const option of parameterOptions.value) {
      next[option.parameter] = values.value[option.parameter] ?? ''
    }
    values.value = next
    await waterTests.listSessions(tankId.value)
    if (!chartParameter.value || !parameterHasRecentData(chartParameter.value)) {
      chartParameter.value = pickDefaultChartParameter()
    }
    const previous = await offlineCache.getTankBundle(tankId.value)
    await offlineCache.putTankBundle(tankId.value, {
      sessions: waterTests.sessions.value,
      reminders: previous?.reminders ?? [],
      events: previous?.events ?? [],
      ranges: rangeRows.value
    })
  } catch (e) {
    const cached = await offlineCache.getTankBundle(tankId.value)
    if (cached?.sessions?.length || cached?.ranges?.length) {
      waterTests.sessions.value = cached.sessions
      rangeRows.value = cached.ranges
      parameterOptions.value = rangesApi.toParameterOptions(rangeRows.value)
      staleBanner.value = t('overview.staleCache', {
        when: formatDateTime(new Date(cached.cachedAt).toISOString(), locale.value)
      })
    } else {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }
}

onMounted(() => {
  void load()
})

function openCreate() {
  resetFormFields()
  formOpen.value = true
}

function openDetail(session: WaterTestSession) {
  selectedSession.value = session
  detailOpen.value = true
}

function openEdit(session: WaterTestSession) {
  editingTestGroupId.value = session.testGroupId
  measuredAtLocal.value = toDatetimeLocalValue(new Date(session.measuredAt))
  method.value = session.method ?? ''
  note.value = session.note ?? ''
  const next: Record<string, string> = {}
  for (const option of parameterOptions.value) {
    const existing = session.measurements.find(m => m.parameter === option.parameter)
    next[option.parameter] = existing ? String(existing.value) : ''
  }
  // Keep any extra parameters from the session that are no longer in ranges
  for (const measurement of session.measurements) {
    if (!(measurement.parameter in next)) {
      next[measurement.parameter] = String(measurement.value)
      if (!parameterOptions.value.some(o => o.parameter === measurement.parameter)) {
        parameterOptions.value = [
          ...parameterOptions.value,
          {
            parameter: measurement.parameter,
            unit: measurement.unit,
            color: null
          }
        ]
      }
    }
  }
  values.value = next
  formError.value = null
  detailOpen.value = false
  formOpen.value = true
}

function resetFormFields() {
  editingTestGroupId.value = null
  for (const key of Object.keys(values.value)) {
    values.value[key] = ''
  }
  // Reset to range-defined options only (drop edit-time extras)
  parameterOptions.value = rangesApi.toParameterOptions(rangeRows.value)
  for (const option of parameterOptions.value) {
    values.value[option.parameter] = ''
  }
  note.value = ''
  method.value = ''
  measuredAtLocal.value = toDatetimeLocalValue(new Date())
  formError.value = null
}

async function persistOfflineCache() {
  const previous = await offlineCache.getTankBundle(tankId.value)
  await offlineCache.putTankBundle(tankId.value, {
    sessions: waterTests.sessions.value,
    reminders: previous?.reminders ?? [],
    events: previous?.events ?? [],
    ranges: rangeRows.value
  })
}

function verdictFor(parameter: string, value: number): RangeVerdict {
  return evaluateMeasurement(parameter, value, rangeRows.value)
}

function sessionHasAlert(session: WaterTestSession): boolean {
  return session.measurements.some((m) => {
    const verdict = verdictFor(m.parameter, m.value)
    return verdict === 'warning' || verdict === 'critical'
  })
}

async function submit() {
  formError.value = null
  busy.value = true
  try {
    const measuredAt = fromDatetimeLocalValue(measuredAtLocal.value)
    if (!measuredAt) throw new Error(t('waterTests.errors.invalidDate'))

    const measurements = parameterOptions.value
      .map((option) => {
        const raw = values.value[option.parameter]?.trim() ?? ''
        if (!raw) return null
        const normalized = raw.replace(',', '.')
        const value = Number(normalized)
        if (!Number.isFinite(value)) {
          throw new Error(t('waterTests.errors.invalidValue', { parameter: option.parameter }))
        }
        return {
          parameter: option.parameter,
          value,
          unit: option.unit
        }
      })
      .filter((item): item is { parameter: string, value: number, unit: string } => item !== null)

    if (!measurements.length) {
      throw new Error(t('waterTests.errors.needOne'))
    }

    if (editingTestGroupId.value) {
      await waterTests.updateSession({
        tankId: tankId.value,
        testGroupId: editingTestGroupId.value,
        measuredAt,
        measurements,
        method: method.value,
        note: note.value
      })
      toast.add({ title: t('waterTests.updated'), color: 'success', icon: 'i-lucide-check' })
    } else {
      await waterTests.createSession({
        tankId: tankId.value,
        measuredAt,
        measurements,
        method: method.value,
        note: note.value
      })
      toast.add({ title: t('waterTests.created'), color: 'success', icon: 'i-lucide-check' })
    }

    await persistOfflineCache()
    resetFormFields()
    formOpen.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeSession(session: WaterTestSession) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('waterTests.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return

  actionId.value = session.testGroupId
  try {
    await waterTests.removeSession(tankId.value, session.testGroupId)
    if (selectedSession.value?.testGroupId === session.testGroupId) {
      selectedSession.value = null
      detailOpen.value = false
    }
    await persistOfflineCache()
    toast.add({ title: t('common.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
  } catch (e) {
    toast.add({
      title: e instanceof Error ? e.message : String(e),
      color: 'error',
      icon: 'i-lucide-triangle-alert'
    })
  } finally {
    actionId.value = null
  }
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

    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold text-white sm:text-3xl">
          {{ t('waterTests.title') }}
        </h1>
        <p class="mt-2 text-slate-400">
          {{ tank ? tank.name : t('common.loading') }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        class="shrink-0"
        @click="openCreate"
      >
        {{ t('waterTests.newSession') }}
      </UButton>
    </div>

    <TankSubnav
      v-if="tank"
      class="mt-6"
      :tank-id="tank.id"
    />

    <p
      v-if="loadError"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-if="staleBanner"
      class="mt-4 text-sm text-amber-300"
      role="status"
    >
      {{ staleBanner }}
    </p>

    <div class="mt-6 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4 sm:mt-8 sm:p-5">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField
          :label="t('charts.parameter')"
          class="min-w-0 flex-1 basis-40"
        >
          <USelect
            v-model="selectedChartParameter"
            value-key="value"
            :items="chartParameterItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('charts.range')"
          class="min-w-0 basis-32"
        >
          <USelect
            v-model="selectedChartDays"
            value-key="value"
            :items="dayItems"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="mt-4 min-w-0 overflow-x-auto">
        <ParameterChart
          :key="chartRenderKey"
          :points="chartPoints"
          :label="chartParameter || t('charts.parameter')"
          :color="chartColor"
          :empty-text="t('charts.empty')"
        />
      </div>
      <p class="mt-3 text-sm text-slate-400">
        {{ chartSummary }}
      </p>
    </div>

    <div class="mt-8">
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('waterTests.history') }}
      </h2>

      <p
        v-if="waterTests.loading.value"
        class="mt-4 text-slate-400"
      >
        {{ t('common.loading') }}
      </p>

      <UEmpty
        v-else-if="!waterTests.sessions.value.length"
        class="mt-4"
        icon="i-lucide-flask-conical"
        :title="t('waterTests.emptyHistory')"
        :description="t('waterTests.emptyHint')"
        :actions="[{ label: t('waterTests.newSession'), color: 'primary', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <ul
        v-else
        class="mt-4 space-y-3"
      >
        <li
          v-for="session in waterTests.sessions.value"
          :key="session.testGroupId"
          class="rounded-xl border bg-slate-900/40 p-4"
          :class="sessionHasAlert(session) ? 'border-amber-400/40' : 'border-cyan-500/15'"
        >
          <button
            type="button"
            class="w-full text-left transition hover:opacity-90"
            @click="openDetail(session)"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="font-medium text-white">
                {{ formatDateTime(session.measuredAt, locale) }}
              </p>
              <UBadge
                v-if="sessionHasAlert(session)"
                color="warning"
                variant="subtle"
              >
                {{ t('ranges.alert') }}
              </UBadge>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              {{ t('waterTests.measurementCount', { count: session.measurements.length }) }}
              <span v-if="session.method"> · {{ session.method }}</span>
            </p>
            <p class="mt-2 flex flex-wrap gap-2 text-sm">
              <UBadge
                v-for="m in session.measurements"
                :key="m.id"
                :color="verdictTone(verdictFor(m.parameter, m.value))"
                variant="subtle"
              >
                {{ m.parameter }} {{ m.value }}
              </UBadge>
            </p>
          </button>
          <div class="mt-3 flex flex-wrap justify-end gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              @click="openEdit(session)"
            >
              {{ t('common.edit') }}
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              :loading="actionId === session.testGroupId"
              @click="removeSession(session)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
        </li>
      </ul>
    </div>

    <UModal
      v-if="formOpen"
      v-model:open="formOpen"
      :title="formTitle"
      :ui="{
        content: 'w-[calc(100%-1rem)] max-w-lg max-h-[90dvh] sm:w-full',
        body: 'overflow-y-auto'
      }"
      @update:open="(v: boolean) => { formOpen = v; if (!v) resetFormFields() }"
    >
      <template #body>
        <form
          id="water-test-form"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('waterTests.date')">
            <UInput
              v-model="measuredAtLocal"
              type="datetime-local"
              required
              class="w-full"
            />
          </UFormField>

          <div
            v-if="!parameterOptions.length"
            class="text-sm text-amber-300"
          >
            {{ t('waterTests.noParameters') }}
          </div>

          <div
            v-else
            class="space-y-3"
          >
            <div
              v-for="option in parameterOptions"
              :key="option.parameter"
              class="space-y-1.5"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="text-sm font-medium text-slate-200">
                  {{ option.parameter }} ({{ option.unit }})
                </label>
                <ParameterWaitTimer :parameter="option.parameter" />
              </div>
              <UInput
                v-model="values[option.parameter]"
                type="text"
                inputmode="decimal"
                class="w-full"
                :placeholder="t('waterTests.valuePlaceholder')"
              />
            </div>
          </div>

          <UFormField :label="t('waterTests.method')">
            <UInput
              v-model="method"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <UFormField :label="t('waterTests.note')">
            <UTextarea
              v-model="note"
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <p
            v-if="formError"
            class="text-sm text-red-400"
            role="alert"
          >
            {{ formError }}
          </p>
        </form>
      </template>

      <template #footer="{ close }">
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="close()"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            form="water-test-form"
            color="primary"
            :loading="busy"
            :disabled="!parameterOptions.length"
            block
            class="sm:w-auto"
          >
            {{ editingTestGroupId ? t('common.save') : t('waterTests.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="detailOpen"
      :title="selectedSession ? formatDateTime(selectedSession.measuredAt, locale) : t('waterTests.detail')"
      :ui="{ content: 'w-[calc(100%-1rem)] max-w-lg sm:w-full' }"
    >
      <template #body>
        <div v-if="selectedSession">
          <p
            v-if="selectedSession.method"
            class="text-sm text-slate-400"
          >
            {{ t('waterTests.method') }}: {{ selectedSession.method }}
          </p>
          <p
            v-if="selectedSession.note"
            class="mt-1 text-sm text-slate-400"
          >
            {{ selectedSession.note }}
          </p>

          <ul class="mt-4 divide-y divide-white/5">
            <li
              v-for="m in selectedSession.measurements"
              :key="m.id"
              class="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span class="text-slate-200">{{ m.parameter }}</span>
              <UBadge
                :color="verdictTone(verdictFor(m.parameter, m.value))"
                variant="subtle"
              >
                {{ m.value }} {{ m.unit }} · {{ t(`ranges.verdict.${verdictFor(m.parameter, m.value)}`) }}
              </UBadge>
            </li>
          </ul>
        </div>
      </template>

      <template
        v-if="selectedSession"
        #footer
      >
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="error"
            variant="ghost"
            :loading="actionId === selectedSession.testGroupId"
            block
            class="sm:w-auto"
            @click="removeSession(selectedSession)"
          >
            {{ t('common.delete') }}
          </UButton>
          <UButton
            color="primary"
            block
            class="sm:w-auto"
            @click="openEdit(selectedSession)"
          >
            {{ t('common.edit') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
