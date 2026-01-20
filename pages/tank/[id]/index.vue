<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { ParameterRange } from "@/composables/useParameterRanges"
import { useParameterRanges } from "@/composables/useParameterRanges"
import type { TankPhoto } from "@/composables/usePhotos"
import type { TankEvent } from "@/composables/useEvents"
import type { WaterTestSession } from "@/composables/useWaterTests"
import { DEFAULT_CHART_COLOR, hexToRgbaOrFallback } from "@/lib/colors"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const isStorageReady = computed(() => storage.hasRootFolderId.value)

const { tanks, status: tanksStatus, error: tanksError } = useTanks()
const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

useHead(() => ({
  title: tank.value?.name || t("pages.tank.metaTitle"),
}))

function tankTypeLabel(type: string) {
  if (type === "freshwater" || type === "planted" || type === "marine" || type === "reef") {
    return t(`pages.settings.tanks.types.${type}`)
  }
  return type
}

function formatVolume(volumeLiters: number | null) {
  if (volumeLiters === null) return null
  const rounded = Number.isInteger(volumeLiters) ? volumeLiters.toString() : volumeLiters.toFixed(1)
  return `${rounded} L`
}

type LoadStatus = "idle" | "loading" | "ready" | "error"

const waterTests = useWaterTests()
const parameterRangesApi = useParameterRanges()
const eventsApi = useEvents()
const photosApi = usePhotos()

const testsStatus = ref<LoadStatus>("idle")
const testsError = ref<string | null>(null)
const sessions = ref<WaterTestSession[]>([])

const rangesStatus = ref<LoadStatus>("idle")
const rangesError = ref<string | null>(null)
const parameterRanges = ref<ParameterRange[]>([])

const eventsStatus = ref<LoadStatus>("idle")
const eventsError = ref<string | null>(null)
const events = ref<TankEvent[]>([])

const photosStatus = ref<LoadStatus>("idle")
const photosError = ref<string | null>(null)
const photos = ref<TankPhoto[]>([])

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(value)
  } catch {
    return String(value)
  }
}

function formatSessionDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    return new Intl.DateTimeFormat(locale.value, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

async function loadTests() {
  if (!import.meta.client) return

  if (!tank.value) {
    sessions.value = []
    testsStatus.value = "idle"
    testsError.value = null
    return
  }

  testsStatus.value = "loading"
  testsError.value = null

  try {
    sessions.value = await waterTests.listWaterTestSessions({ spreadsheetId: tank.value.spreadsheetId })
    testsStatus.value = "ready"
  } catch (error) {
    sessions.value = []
    testsError.value = error instanceof Error ? error.message : t("pages.tests.history.errors.loadFailed")
    testsStatus.value = "error"
  }
}

async function loadRanges() {
  if (!import.meta.client) return

  if (!tank.value) {
    parameterRanges.value = []
    rangesStatus.value = "idle"
    rangesError.value = null
    return
  }

  rangesStatus.value = "loading"
  rangesError.value = null

  try {
    parameterRanges.value = await parameterRangesApi.listParameterRanges({
      spreadsheetId: tank.value.spreadsheetId,
      tankType: tank.value.type,
    })
    rangesStatus.value = "ready"
  } catch (error) {
    parameterRanges.value = []
    rangesError.value = error instanceof Error ? error.message : t("pages.tests.ranges.errors.loadFailed")
    rangesStatus.value = "error"
  }
}

async function loadEvents() {
  if (!import.meta.client) return

  if (!tank.value) {
    events.value = []
    eventsStatus.value = "idle"
    eventsError.value = null
    return
  }

  eventsStatus.value = "loading"
  eventsError.value = null

  try {
    events.value = await eventsApi.listEvents({ spreadsheetId: tank.value.spreadsheetId })
    eventsStatus.value = "ready"
  } catch (error) {
    events.value = []
    eventsError.value = error instanceof Error ? error.message : t("pages.events.list.errors.loadFailed")
    eventsStatus.value = "error"
  }
}

async function loadPhotos() {
  if (!import.meta.client) return

  if (!tank.value) {
    photos.value = []
    photosStatus.value = "idle"
    photosError.value = null
    return
  }

  photosStatus.value = "loading"
  photosError.value = null

  try {
    photos.value = await photosApi.listTankPhotos({ spreadsheetId: tank.value.spreadsheetId })
    photosStatus.value = "ready"
  } catch (error) {
    photos.value = []
    photosError.value = error instanceof Error ? error.message : t("pages.photos.list.errors.loadFailed")
    photosStatus.value = "error"
  }
}

async function refreshDashboard() {
  await Promise.all([loadTests(), loadRanges(), loadEvents(), loadPhotos()])
}

watch(
  () => [tank.value?.spreadsheetId, tank.value?.type] as const,
  () => {
    refreshDashboard()
  },
  { immediate: true }
)

const latestSession = computed(() => sessions.value[0] ?? null)
const recentEvents = computed(() => events.value.slice(0, 3))
const recentPhotos = computed(() => photos.value.slice(0, 3))

function normalizeParameterKey(value: string): string {
  return value.trim().toLowerCase()
}

function eventTypeLabel(value: string): string {
  if (value === "water_change" || value === "dosing" || value === "maintenance" || value === "livestock_addition" || value === "livestock_removal") {
    return t(`pages.events.types.${value}`)
  }
  return value
}

const rangeByParameterKey = computed(() => {
  const map = new Map<string, ParameterRange>()
  for (const range of parameterRanges.value) {
    map.set(normalizeParameterKey(range.parameter), range)
  }
  return map
})

function getColorForParameter(parameter: string): string | null {
  return rangeByParameterKey.value.get(normalizeParameterKey(parameter))?.color ?? null
}

function formatRange(range: ParameterRange): string {
  const min = range.minValue
  const max = range.maxValue

  if (min !== null && max !== null) return `${formatNumber(min)}–${formatNumber(max)} ${range.unit}`
  if (min !== null) return `≥ ${formatNumber(min)} ${range.unit}`
  if (max !== null) return `≤ ${formatNumber(max)} ${range.unit}`
  return range.unit
}

type Measurement = WaterTestSession["measurements"][number]
type MeasurementRangeStatus = "ok" | "low" | "high" | "unknown"

function getUnitForParameter(parameter: string): string {
  const unit = rangeByParameterKey.value.get(normalizeParameterKey(parameter))?.unit
  return unit ? unit : ""
}

function getDisplayUnitForMeasurement(measurement: Measurement): string {
  return getUnitForParameter(measurement.parameter) || measurement.unit
}

function getMeasurementRangeStatus(measurement: Measurement): { status: MeasurementRangeStatus; range: ParameterRange | null } {
  const range = rangeByParameterKey.value.get(normalizeParameterKey(measurement.parameter)) ?? null
  if (!range) return { status: "unknown", range: null }
  if (range.minValue !== null && measurement.value < range.minValue) return { status: "low", range }
  if (range.maxValue !== null && measurement.value > range.maxValue) return { status: "high", range }
  return { status: "ok", range }
}

function getOutOfRangeStatus(measurement: Measurement): "low" | "high" | null {
  const { status } = getMeasurementRangeStatus(measurement)
  return status === "low" || status === "high" ? status : null
}

function isMeasurementOutOfRange(measurement: Measurement): boolean {
  return getOutOfRangeStatus(measurement) !== null
}

function getMeasurementRangeText(measurement: Measurement): string | null {
  const { range } = getMeasurementRangeStatus(measurement)
  if (!range) return null
  return formatRange(range)
}

type OutOfRangeAlert = {
  measurementId: string
  parameter: string
  status: "low" | "high"
  actual: number
  unit: string
  expected: string
}

const latestAlerts = computed<OutOfRangeAlert[]>(() => {
  const session = latestSession.value
  if (!session) return []

  const alerts: OutOfRangeAlert[] = []
  for (const measurement of session.measurements) {
    const result = getMeasurementRangeStatus(measurement)
    if (result.status !== "low" && result.status !== "high") continue

    alerts.push({
      measurementId: measurement.id,
      parameter: measurement.parameter,
      status: result.status,
      actual: measurement.value,
      unit: getDisplayUnitForMeasurement(measurement),
      expected: result.range ? formatRange(result.range) : "",
    })
  }

  return alerts
})

const parameterOptions = computed(() => parameterRanges.value.map((range) => range.parameter))

const trendParameter = ref("")

watch(
  parameterOptions,
  (options) => {
    if (!options.length) {
      trendParameter.value = ""
      return
    }

    if (!trendParameter.value || !options.includes(trendParameter.value)) {
      trendParameter.value = options[0]
    }
  },
  { immediate: true }
)

type TrendRangeDays = 7 | 30 | 90
const trendRangeDays = ref<TrendRangeDays>(30)

function setTrendRangeDays(days: TrendRangeDays) {
  trendRangeDays.value = days
}

type TrendPoint = { x: number; y: number }

const trendPoints = computed<TrendPoint[]>(() => {
  const parameter = trendParameter.value.trim()
  if (!parameter) return []

  const now = Date.now()
  const startMs = now - trendRangeDays.value * 24 * 60 * 60 * 1000

  const points: TrendPoint[] = []
  for (const session of sessions.value) {
    const measurement = session.measurements.find((item) => item.parameter === parameter)
    if (!measurement) continue

    const ms = toEpochMs(session.date)
    if (ms === null) continue
    if (ms < startMs) continue

    points.push({ x: ms, y: measurement.value })
  }

  points.sort((a, b) => a.x - b.x)
  return points
})

const trendUnit = computed(() => {
  const parameter = trendParameter.value.trim()
  if (!parameter) return ""

  const rangeUnit = getUnitForParameter(parameter)
  if (rangeUnit) return rangeUnit

  for (const session of sessions.value) {
    const measurement = session.measurements.find((item) => item.parameter === parameter)
    if (measurement?.unit) return measurement.unit
  }

  return ""
})

function formatChartTick(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  try {
    return new Intl.DateTimeFormat(locale.value, { month: "short", day: "2-digit" }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

function formatChartTooltipDate(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  try {
    return new Intl.DateTimeFormat(locale.value, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

const trendChartAriaLabel = computed(() => t("pages.tests.trends.ariaLabel", { parameter: trendParameter.value || "—" }))

const trendStrokeColor = computed(() => getColorForParameter(trendParameter.value) ?? DEFAULT_CHART_COLOR)
const trendFillColor = computed(() =>
  hexToRgbaOrFallback({ hex: trendStrokeColor.value, alpha: 0.15, fallbackHex: DEFAULT_CHART_COLOR })
)

const trendChartData = computed(() => ({
  datasets: [
    {
      label: trendParameter.value,
      data: trendPoints.value,
      borderColor: trendStrokeColor.value,
      backgroundColor: trendFillColor.value,
      fill: true,
      tension: 0.25,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: trendStrokeColor.value,
      pointBorderColor: trendStrokeColor.value,
    },
  ],
}))

const trendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: "nearest", intersect: false },
  scales: {
    x: {
      type: "linear",
      title: { display: true, text: t("pages.tests.trends.axes.date") },
      ticks: {
        callback: (raw: string | number) => formatChartTick(typeof raw === "string" ? Number(raw) : raw),
      },
    },
    y: {
      title: { display: true, text: t("pages.tests.trends.axes.value") },
      ticks: {
        callback: (raw: string | number) => formatNumber(typeof raw === "string" ? Number(raw) : raw),
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: Array<{ parsed?: { x?: number } }>) => {
          const x = items?.[0]?.parsed?.x
          return typeof x === "number" ? formatChartTooltipDate(x) : ""
        },
        label: (item: { parsed?: { y?: number } }) => {
          const y = item?.parsed?.y
          if (typeof y !== "number") return ""

          const value = formatNumber(y)
          const unit = trendUnit.value
          const parameter = trendParameter.value
          return unit ? `${parameter}: ${value} ${unit}` : `${parameter}: ${value}`
        },
      },
    },
  },
}))
</script>

<template>
  <section class="space-y-6">
    <Card v-if="!isStorageReady">
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button as-child>
          <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <template v-else>
      <div v-if="tanksError" class="text-sm text-destructive" role="alert">
        {{ tanksError }}
      </div>

      <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
        {{ $t("pages.settings.tanks.loading") }}
      </div>

      <Card v-else-if="!tank">
        <CardHeader>
          <CardTitle>{{ $t("pages.tank.unknown.title") }}</CardTitle>
          <CardDescription>
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          {{ $t("pages.tank.unknown.body") }}
        </CardContent>
        <CardFooter>
          <Button as-child>
            <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle class="truncate">{{ tank.name }}</CardTitle>
            <CardDescription>
              <span>{{ tankTypeLabel(tank.type) }}</span>
              <span v-if="formatVolume(tank.volumeLiters)" class="text-muted-foreground"> · {{ formatVolume(tank.volumeLiters) }}</span>
            </CardDescription>
          </CardHeader>
          <CardContent class="text-sm text-muted-foreground">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-muted-foreground">ID:</span>
              <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
            </div>
          </CardContent>
          <CardFooter class="flex flex-wrap gap-2">
            <Button as-child>
              <NuxtLink :to="localePath(`/tank/${tank.id}/water-test`)">{{ $t("nav.tests") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tank.id}/photos`)">{{ $t("nav.photos") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tank.id}/events`)">{{ $t("nav.events") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tank.id}/reminders`)">{{ $t("nav.reminders") }}</NuxtLink>
            </Button>
          </CardFooter>
        </Card>

        <div class="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t("pages.tank.dashboard.latest.title") }}</CardTitle>
              <CardDescription>{{ $t("pages.tank.dashboard.latest.description") }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4 text-sm text-muted-foreground">
              <div v-if="testsStatus === 'loading'">{{ $t("pages.tank.dashboard.latest.loading") }}</div>
              <p v-else-if="testsStatus === 'error'" class="text-sm text-destructive" role="alert">{{ testsError }}</p>
              <div v-else-if="testsStatus === 'ready' && !sessions.length" class="space-y-2">
                <p class="text-sm text-muted-foreground">{{ $t("pages.tests.history.empty") }}</p>
                <p class="text-xs text-muted-foreground">{{ $t("pages.tank.dashboard.latest.emptyHint") }}</p>
                <Button as-child>
                  <NuxtLink :to="localePath(`/tank/${tank.id}/water-test`)">{{ $t("actions.openWaterTests") }}</NuxtLink>
                </Button>
              </div>

              <div v-else-if="latestSession" class="space-y-4">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">
                      {{ $t("pages.tank.dashboard.latest.lastTestLabel") }}: <span class="text-foreground">{{ formatSessionDate(latestSession.date) }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ $t("pages.tests.history.measurements", { count: latestSession.measurements.length }) }}
                    </p>
                    <p v-if="latestSession.method || latestSession.note" class="text-xs text-muted-foreground">
                      <span v-if="latestSession.method">{{ $t("pages.tests.history.labels.method") }}: {{ latestSession.method }}</span>
                      <span v-if="latestSession.method && latestSession.note"> · </span>
                      <span v-if="latestSession.note">{{ $t("pages.tests.history.labels.note") }}: {{ latestSession.note }}</span>
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" type="button" :disabled="testsStatus === 'loading'" @click="refreshDashboard">
                      {{ $t("pages.tests.history.refresh") }}
                    </Button>
                    <Button variant="secondary" size="sm" as-child>
                      <NuxtLink :to="localePath(`/tank/${tank.id}/water-test`)">{{ $t("actions.openWaterTests") }}</NuxtLink>
                    </Button>
                  </div>
                </div>

                <AlertBanner
                  v-if="latestAlerts.length"
                  variant="warning"
                  :title="$t('pages.tests.ranges.banner.title', { count: latestAlerts.length })"
                >
                  <p class="text-muted-foreground">
                    {{ $t("pages.tests.ranges.banner.description") }}
                  </p>
                  <ul class="mt-2 list-disc space-y-1 pl-4">
                    <li v-for="item in latestAlerts" :key="item.measurementId">
                      <span class="inline-flex items-center gap-2 font-medium text-foreground">
                        <span
                          class="inline-block size-2 shrink-0 rounded-full border border-border/60"
                          :style="{ backgroundColor: getColorForParameter(item.parameter) ?? 'transparent' }"
                          aria-hidden="true"
                        />
                        <span>{{ item.parameter }}</span>
                      </span>:
                      <span class="text-foreground">{{ formatNumber(item.actual) }} {{ item.unit }}</span>
                      <span class="text-muted-foreground"> — {{ $t("pages.tests.ranges.expected") }} {{ item.expected }}</span>
                      <span class="sr-only">
                        {{ item.status === "low" ? $t("pages.tests.ranges.low") : $t("pages.tests.ranges.high") }}
                      </span>
                    </li>
                  </ul>
                </AlertBanner>

                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <caption class="sr-only">{{ $t("pages.tests.detail.tableCaption") }}</caption>
                    <thead class="text-xs text-muted-foreground">
                      <tr class="border-b border-border">
                        <th scope="col" class="px-2 py-2 text-left font-medium">{{ $t("pages.tests.detail.columns.parameter") }}</th>
                        <th scope="col" class="px-2 py-2 text-right font-medium">{{ $t("pages.tests.detail.columns.value") }}</th>
                        <th scope="col" class="px-2 py-2 text-left font-medium">{{ $t("pages.tests.detail.columns.unit") }}</th>
                        <th scope="col" class="px-2 py-2 text-left font-medium">{{ $t("pages.tests.detail.columns.range") }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="measurement in latestSession.measurements" :key="measurement.id" class="border-b border-border/60">
                        <th scope="row" class="px-2 py-2 text-left font-medium">
                          <span class="inline-flex items-center gap-2">
                            <span
                              class="inline-block size-2 shrink-0 rounded-full border border-border/60"
                              :style="{ backgroundColor: getColorForParameter(measurement.parameter) ?? 'transparent' }"
                              aria-hidden="true"
                            />
                            <span>{{ measurement.parameter }}</span>
                          </span>
                        </th>
                        <td class="px-2 py-2 text-right">
                          <span :class="isMeasurementOutOfRange(measurement) ? 'font-semibold text-destructive' : ''">
                            {{ formatNumber(measurement.value) }}
                          </span>
                          <span v-if="getOutOfRangeStatus(measurement)" class="ml-2 text-xs font-medium text-destructive">
                            ({{ getOutOfRangeStatus(measurement) === "low" ? $t("pages.tests.ranges.low") : $t("pages.tests.ranges.high") }})
                          </span>
                        </td>
                        <td class="px-2 py-2 text-left text-muted-foreground">
                          {{ getDisplayUnitForMeasurement(measurement) }}
                        </td>
                        <td class="px-2 py-2 text-left text-muted-foreground">
                          {{ getMeasurementRangeText(measurement) ?? "—" }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p v-if="rangesStatus === 'loading'" class="text-xs text-muted-foreground">
                  {{ $t("pages.tests.ranges.loading") }}
                </p>
                <p v-else-if="rangesStatus === 'error'" class="text-xs text-destructive" role="alert">
                  {{ $t("pages.tests.ranges.errors.loadFailed") }}
                  <span v-if="rangesError">({{ rangesError }})</span>
                </p>
                <p v-else-if="rangesStatus === 'ready' && !parameterRanges.length" class="text-xs text-muted-foreground">
                  {{ $t("pages.tests.ranges.emptyHint") }}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{ $t("pages.tests.trends.title") }}</CardTitle>
              <CardDescription>{{ $t("pages.tests.trends.description") }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4 text-sm text-muted-foreground">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="overview-trend-parameter" class="text-sm font-medium text-foreground">
                    {{ $t("pages.tests.trends.fields.parameter") }}
                  </label>
                  <select
                    id="overview-trend-parameter"
                    v-model="trendParameter"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option v-for="param in parameterOptions" :key="param" :value="param">
                      {{ param }}
                    </option>
                  </select>
                </div>

                <fieldset class="space-y-2">
                  <legend class="text-sm font-medium text-foreground">{{ $t("pages.tank.dashboard.trends.rangeLabel") }}</legend>
                  <div class="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      :variant="trendRangeDays === 7 ? 'default' : 'secondary'"
                      :aria-pressed="trendRangeDays === 7 ? 'true' : 'false'"
                      @click="setTrendRangeDays(7)"
                    >
                      {{ $t("pages.tank.dashboard.trends.ranges.d7") }}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      :variant="trendRangeDays === 30 ? 'default' : 'secondary'"
                      :aria-pressed="trendRangeDays === 30 ? 'true' : 'false'"
                      @click="setTrendRangeDays(30)"
                    >
                      {{ $t("pages.tank.dashboard.trends.ranges.d30") }}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      :variant="trendRangeDays === 90 ? 'default' : 'secondary'"
                      :aria-pressed="trendRangeDays === 90 ? 'true' : 'false'"
                      @click="setTrendRangeDays(90)"
                    >
                      {{ $t("pages.tank.dashboard.trends.ranges.d90") }}
                    </Button>
                  </div>
                </fieldset>
              </div>

              <p class="text-xs text-muted-foreground">
                {{ $t("pages.tank.dashboard.trends.summary", { parameter: trendParameter || "—", days: trendRangeDays, count: trendPoints.length }) }}
              </p>

              <div v-if="testsStatus === 'loading'" class="text-sm text-muted-foreground">
                {{ $t("pages.tests.trends.loading") }}
              </div>
              <p v-else-if="testsStatus === 'error'" class="text-sm text-destructive" role="alert">
                {{ testsError }}
              </p>
              <div v-else-if="testsStatus === 'ready' && !sessions.length" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ $t("pages.tests.trends.empty.noHistory") }}</p>
                <p class="text-xs text-muted-foreground">{{ $t("pages.tests.trends.empty.noHistoryHint") }}</p>
              </div>
              <p v-else-if="testsStatus === 'ready' && !trendPoints.length" class="text-sm text-muted-foreground">
                {{ $t("pages.tests.trends.empty.noParameterData") }}
              </p>
              <ChartComponent
                v-else
                :aria-label="trendChartAriaLabel"
                :data="trendChartData"
                :options="trendChartOptions"
                container-class="h-72 sm:h-80"
              />
            </CardContent>
          </Card>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t("nav.photos") }}</CardTitle>
              <CardDescription>{{ $t("pages.photos.description") }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <div v-if="photosStatus === 'loading'">
                {{ $t("pages.photos.list.loading") }}
              </div>
              <p v-else-if="photosStatus === 'error'" class="text-sm text-destructive" role="alert">
                {{ photosError }}
              </p>
              <div v-else-if="photosStatus === 'ready' && !photos.length" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ $t("pages.photos.list.empty") }}</p>
                <p class="text-xs text-muted-foreground">{{ $t("pages.photos.list.emptyHint") }}</p>
              </div>
              <div v-else-if="photosStatus === 'ready'" class="space-y-3">
                <ul role="list" class="space-y-2">
                  <li
                    v-for="photo in recentPhotos"
                    :key="photo.photoId"
                    class="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                  >
                    <div class="min-w-0 space-y-1">
                      <div class="text-sm font-medium text-foreground">
                        {{ formatSessionDate(photo.date) }}
                      </div>
                      <p v-if="photo.note" class="line-clamp-2 text-xs text-muted-foreground">
                        {{ photo.note }}
                      </p>
                    </div>

                    <a
                      class="text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                      :href="photo.driveUrl"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ $t("pages.photos.list.labels.openInDrive") }}
                    </a>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" as-child>
                <NuxtLink :to="localePath(`/tank/${tank.id}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{ $t("nav.events") }}</CardTitle>
              <CardDescription>{{ $t("pages.tank.dashboard.events.description") }}</CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <div v-if="eventsStatus === 'loading'">{{ $t("pages.tank.dashboard.events.loading") }}</div>
              <p v-else-if="eventsStatus === 'error'" class="text-sm text-destructive" role="alert">
                {{ eventsError }}
              </p>
              <div v-else-if="eventsStatus === 'ready' && !events.length" class="space-y-2">
                <p class="text-sm text-muted-foreground">{{ $t("pages.tank.dashboard.events.empty") }}</p>
                <p class="text-xs text-muted-foreground">{{ $t("pages.tank.dashboard.events.emptyHint") }}</p>
              </div>
              <div v-else-if="eventsStatus === 'ready'" class="space-y-3">
                <p class="text-xs text-muted-foreground">
                  {{ $t("pages.tank.dashboard.events.count", { count: events.length }) }}
                </p>
                <ul role="list" class="space-y-2">
                  <li
                    v-for="event in recentEvents"
                    :key="event.eventId"
                    class="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground">
                      <span>{{ eventTypeLabel(event.eventType) }}</span>
                      <span>{{ formatSessionDate(event.date) }}</span>
                    </div>
                    <div class="text-sm text-foreground">
                      {{ event.description }}
                    </div>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" as-child>
                <NuxtLink :to="localePath(`/tank/${tank.id}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </template>
    </template>
  </section>
</template>

