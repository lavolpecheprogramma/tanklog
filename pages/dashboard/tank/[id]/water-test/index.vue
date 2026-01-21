<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ParameterRange, ParameterRangeStatus } from "@/composables/useParameterRanges"
import { useParameterRanges } from "@/composables/useParameterRanges"
import type { WaterTestSession } from "@/composables/useWaterTests"
import { DEFAULT_CHART_COLOR, hexToRgbaOrFallback } from "@/lib/colors"
import { ArrowDown, ArrowUp, CircleCheck, CircleDot, CircleQuestionMark, CircleX, TriangleAlert } from "lucide-vue-next"
import type { Component } from "vue"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.tests.metaTitle"),
}))

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()

const { tanks, status: tanksStatus, error: tanksError } = useTanks()
const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

const waterTests = useWaterTests()
const parameterRangesApi = useParameterRanges()

type HistoryStatus = "idle" | "loading" | "ready" | "error"

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseNumberInput(value: string | number): number | null {
  if (typeof value === "number") return value
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const dateInput = ref("")
const dateError = ref<string | null>(null)

const parameterValues = ref<Record<string, string>>({})
const parameterErrors = ref<Record<string, string | null>>({})

const methodInput = ref("")
const noteInput = ref("")

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

const historyStatus = ref<HistoryStatus>("idle")
const historyError = ref<string | null>(null)
const sessions = ref<WaterTestSession[]>([])

type RangesStatus = "idle" | "loading" | "ready" | "error"

const rangesStatus = ref<RangesStatus>("idle")
const rangesError = ref<string | null>(null)
const parameterRangeRows = ref<ParameterRange[]>([])
const parameterRanges = ref<ParameterRange[]>([])

const parameterOptions = computed(() => parameterRanges.value.map((range) => range.parameter))

function syncParameterState(parameters: string[]) {
  const nextValues: Record<string, string> = {}
  const nextErrors: Record<string, string | null> = {}

  for (const parameter of parameters) {
    nextValues[parameter] = parameterValues.value[parameter] ?? ""
    nextErrors[parameter] = parameterErrors.value[parameter] ?? null
  }

  parameterValues.value = nextValues
  parameterErrors.value = nextErrors
}

watch(
  parameterOptions,
  (options) => {
    syncParameterState(options)
  },
  { immediate: true }
)

const filterDateFrom = ref("")
const filterDateTo = ref("")
const filterParameter = ref("")

const trendParameter = ref("")

const selectedSession = ref<WaterTestSession | null>(null)
const isDetailOpen = ref(false)

onMounted(() => {
  if (!dateInput.value) dateInput.value = toDatetimeLocalValue(new Date())
})

const isStorageReady = computed(() => storage.hasRootFolderId.value)

watch(isDetailOpen, (open) => {
  if (open) return
  selectedSession.value = null
})

function parseDateOnlyParts(value: string): { year: number; monthIndex: number; day: number } | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null
  return { year, monthIndex, day }
}

function parseDateOnlyToMsLocal(value: string): number | null {
  const parts = parseDateOnlyParts(value)
  if (!parts) return null
  const date = new Date(parts.year, parts.monthIndex, parts.day)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : null
}

function parseDateOnlyToNextDayMsLocal(value: string): number | null {
  const parts = parseDateOnlyParts(value)
  if (!parts) return null
  const date = new Date(parts.year, parts.monthIndex, parts.day + 1)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : null
}

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(value)
  } catch {
    return String(value)
  }
}

function normalizeParameterKey(value: string): string {
  return value.trim().toLowerCase()
}

function toParameterInputId(parameter: string): string {
  const safeKey = normalizeParameterKey(parameter).replace(/[^a-z0-9_-]+/g, "-")
  return `param-${safeKey || "parameter"}`
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

type MeasurementDirection = "low" | "high" | null
type MeasurementVerdict = "optimal" | "acceptable" | "critical" | "worst" | "unknown"

type ParameterBands = {
  optimal: ParameterRange | null
  acceptable: ParameterRange | null
  critical: ParameterRange | null
}

type ParameterMeta = {
  parameter: string
  unit: string
  color: string | null
  bands: ParameterBands
}

type VerdictBadge = {
  label: string
  className: string
  icon: Component
  directionIcon: Component | null
  directionLabel: string | null
  ariaLabel: string
}

function pickPreferredColor(ranges: ParameterRange[]): string | null {
  const preferredOrder: ParameterRangeStatus[] = ["acceptable", "optimal", "critical"]
  for (const status of preferredOrder) {
    const match = ranges.find((range) => range.status === status && Boolean(range.color))
    if (match?.color) return match.color
  }
  return ranges.find((range) => Boolean(range.color))?.color ?? null
}

function pickRepresentativeRange(ranges: ParameterRange[]): ParameterRange | null {
  return (
    ranges.find((range) => range.status === "acceptable")
    ?? ranges.find((range) => range.status === "optimal")
    ?? ranges.find((range) => range.status === "critical")
    ?? null
  )
}

function buildRepresentativeRanges(rows: ParameterRange[]): ParameterRange[] {
  const grouped = new Map<string, ParameterRange[]>()
  for (const range of rows) {
    const key = normalizeParameterKey(range.parameter)
    const list = grouped.get(key) ?? []
    list.push(range)
    grouped.set(key, list)
  }

  const representative: ParameterRange[] = []
  for (const list of grouped.values()) {
    const selected = pickRepresentativeRange(list)
    if (!selected) continue
    const color = selected.color ?? pickPreferredColor(list)
    representative.push({ ...selected, color })
  }

  representative.sort((a, b) => a.parameter.localeCompare(b.parameter))
  return representative
}

const metaByParameterKey = computed(() => {
  const grouped = new Map<string, ParameterRange[]>()
  for (const range of parameterRangeRows.value) {
    const key = normalizeParameterKey(range.parameter)
    const list = grouped.get(key) ?? []
    list.push(range)
    grouped.set(key, list)
  }

  const map = new Map<string, ParameterMeta>()
  for (const [key, list] of grouped.entries()) {
    const representative = pickRepresentativeRange(list)
    if (!representative) continue

    map.set(key, {
      parameter: representative.parameter,
      unit: representative.unit,
      color: representative.color ?? pickPreferredColor(list),
      bands: {
        optimal: list.find((range) => range.status === "optimal") ?? null,
        acceptable: list.find((range) => range.status === "acceptable") ?? null,
        critical: list.find((range) => range.status === "critical") ?? null,
      },
    })
  }

  return map
})

function getColorForParameter(parameter: string): string | null {
  return metaByParameterKey.value.get(normalizeParameterKey(parameter))?.color ?? null
}

function getUnitForParameter(parameter: string): string {
  const unit = metaByParameterKey.value.get(normalizeParameterKey(parameter))?.unit
  return unit ? unit : ""
}

function getDisplayUnitForMeasurement(measurement: Measurement): string {
  return getUnitForParameter(measurement.parameter) || measurement.unit
}

function isValueWithinRange(value: number, range: ParameterRange | null): boolean {
  if (!range) return false
  if (range.minValue !== null && value < range.minValue) return false
  if (range.maxValue !== null && value > range.maxValue) return false
  return true
}

function getDirectionRelativeToRange(value: number, range: ParameterRange | null): MeasurementDirection {
  if (!range) return null
  if (range.minValue !== null && value < range.minValue) return "low"
  if (range.maxValue !== null && value > range.maxValue) return "high"
  return null
}

function getExpectedRangeForParameter(parameter: string): ParameterRange | null {
  const meta = metaByParameterKey.value.get(normalizeParameterKey(parameter))
  if (!meta) return null
  return meta.bands.acceptable ?? meta.bands.optimal ?? meta.bands.critical ?? null
}

function getExpectedRangeTextForParameter(parameter: string): string | null {
  const expected = getExpectedRangeForParameter(parameter)
  return expected ? formatRange(expected) : null
}

function getMeasurementExpectedLabel(measurement: Measurement): string | null {
  const rangeText = getExpectedRangeTextForParameter(measurement.parameter)
  if (!rangeText) return null
  return t("pages.tests.ranges.expectedLabel", { range: rangeText })
}

function getMeasurementRangeText(measurement: Measurement): string | null {
  return getExpectedRangeTextForParameter(measurement.parameter)
}

function getMeasurementVerdict(parameter: string, value: number): { verdict: MeasurementVerdict; direction: MeasurementDirection } {
  const meta = metaByParameterKey.value.get(normalizeParameterKey(parameter))
  if (!meta) return { verdict: "unknown", direction: null }

  const optimal = meta.bands.optimal
  const acceptable = meta.bands.acceptable
  const critical = meta.bands.critical

  const outer = critical ?? acceptable ?? optimal
  if (outer && !isValueWithinRange(value, outer)) {
    return { verdict: "worst", direction: getDirectionRelativeToRange(value, outer) }
  }

  if (acceptable) {
    if (!isValueWithinRange(value, acceptable)) {
      return { verdict: "critical", direction: getDirectionRelativeToRange(value, acceptable) }
    }

    if (optimal && isValueWithinRange(value, optimal)) return { verdict: "optimal", direction: null }
    return { verdict: "acceptable", direction: null }
  }

  if (critical) {
    if (optimal && isValueWithinRange(value, optimal)) return { verdict: "optimal", direction: null }
    return { verdict: "critical", direction: null }
  }

  if (optimal) {
    if (isValueWithinRange(value, optimal)) return { verdict: "optimal", direction: null }
    return { verdict: "worst", direction: getDirectionRelativeToRange(value, optimal) }
  }

  return { verdict: "unknown", direction: null }
}

function verdictLabel(verdict: MeasurementVerdict): string {
  if (verdict === "optimal") return t("pages.tests.ranges.verdict.optimal")
  if (verdict === "acceptable") return t("pages.tests.ranges.verdict.acceptable")
  if (verdict === "critical") return t("pages.tests.ranges.verdict.critical")
  if (verdict === "worst") return t("pages.tests.ranges.verdict.worst")
  return t("pages.tests.ranges.verdict.unknown")
}

function verdictClassName(verdict: MeasurementVerdict): string {
  if (verdict === "optimal") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (verdict === "acceptable") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
  if (verdict === "critical") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
  if (verdict === "worst") return "border-destructive/40 bg-destructive/10 text-destructive"
  return "border-border bg-muted/30 text-muted-foreground"
}

function verdictIcon(verdict: MeasurementVerdict): Component {
  if (verdict === "optimal") return CircleCheck
  if (verdict === "acceptable") return CircleDot
  if (verdict === "critical") return TriangleAlert
  if (verdict === "worst") return CircleX
  return CircleQuestionMark
}

function verdictDirectionIcon(direction: MeasurementDirection): Component | null {
  if (direction === "low") return ArrowDown
  if (direction === "high") return ArrowUp
  return null
}

function makeVerdictBadge(verdict: MeasurementVerdict, direction: MeasurementDirection): VerdictBadge {
  const label = verdictLabel(verdict)
  const directionLabel = direction ? (direction === "low" ? t("pages.tests.ranges.low") : t("pages.tests.ranges.high")) : null
  return {
    label,
    className: verdictClassName(verdict),
    icon: verdictIcon(verdict),
    directionIcon: verdictDirectionIcon(direction),
    directionLabel,
    ariaLabel: directionLabel ? `${label} (${directionLabel})` : label,
  }
}

function getMeasurementVerdictBadge(measurement: Measurement): VerdictBadge {
  const result = getMeasurementVerdict(measurement.parameter, measurement.value)
  return makeVerdictBadge(result.verdict, result.direction)
}

function getInputVerdictBadge(parameter: string): VerdictBadge | null {
  const parsed = parseNumberInput(parameterValues.value[parameter] ?? "")
  if (parsed === null || parsed < 0) return null
  const result = getMeasurementVerdict(parameter, parsed)
  return makeVerdictBadge(result.verdict, result.direction)
}

function measurementValueClass(measurement: Measurement): string {
  const { verdict } = getMeasurementVerdict(measurement.parameter, measurement.value)
  if (verdict === "worst") return "font-semibold text-destructive"
  if (verdict === "critical") return "font-semibold text-amber-700 dark:text-amber-400"
  return ""
}

type OutOfRangeAlert = {
  measurementId: string
  parameter: string
  verdict: Exclude<MeasurementVerdict, "optimal" | "acceptable" | "unknown">
  direction: MeasurementDirection
  actual: number
  unit: string
  expected: string
}

function getSessionOutOfRangeAlerts(session: WaterTestSession): OutOfRangeAlert[] {
  const alerts: OutOfRangeAlert[] = []

  for (const measurement of session.measurements) {
    const verdictResult = getMeasurementVerdict(measurement.parameter, measurement.value)
    if (verdictResult.verdict !== "critical" && verdictResult.verdict !== "worst") continue

    alerts.push({
      measurementId: measurement.id,
      parameter: measurement.parameter,
      verdict: verdictResult.verdict,
      direction: verdictResult.direction,
      actual: measurement.value,
      unit: getDisplayUnitForMeasurement(measurement),
      expected: getExpectedRangeTextForParameter(measurement.parameter) ?? "",
    })
  }

  return alerts
}

const outOfRangeBySessionId = computed(() => {
  const map = new Map<string, OutOfRangeAlert[]>()
  for (const session of sessions.value) {
    map.set(session.testGroupId, getSessionOutOfRangeAlerts(session))
  }
  return map
})

function getSessionAlertCount(session: WaterTestSession): number {
  return outOfRangeBySessionId.value.get(session.testGroupId)?.length ?? 0
}

const selectedSessionAlerts = computed(() => {
  const session = selectedSession.value
  if (!session) return []
  return outOfRangeBySessionId.value.get(session.testGroupId) ?? []
})

type TrendPoint = { x: number; y: number }

watch(
  parameterOptions,
  (options) => {
    if (!options.length) {
      trendParameter.value = ""
      if (filterParameter.value) filterParameter.value = ""
      return
    }

    if (!trendParameter.value || !options.includes(trendParameter.value)) {
      trendParameter.value = options[0]
    }

    if (filterParameter.value && !options.includes(filterParameter.value)) {
      filterParameter.value = ""
    }
  },
  { immediate: true }
)

const trendPoints = computed<TrendPoint[]>(() => {
  const parameter = trendParameter.value.trim()
  if (!parameter) return []

  const points: TrendPoint[] = []

  for (const session of sessions.value) {
    const measurement = session.measurements.find((item) => item.parameter === parameter)
    if (!measurement) continue

    const ms = toEpochMs(session.date)
    if (ms === null) continue

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
  animation: false as const,
  interaction: { mode: "nearest" as const, intersect: false },
  scales: {
    x: {
      type: "linear" as const,
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
        title: (items: any[]) => {
          const x = items?.[0]?.parsed?.x
          return typeof x === "number" ? formatChartTooltipDate(x) : ""
        },
        label: (item: any) => {
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

const hasActiveFilters = computed(() => Boolean(filterDateFrom.value || filterDateTo.value || filterParameter.value))

const filteredSessions = computed(() => {
  const fromMs = filterDateFrom.value ? parseDateOnlyToMsLocal(filterDateFrom.value) : null
  const toMsExclusive = filterDateTo.value ? parseDateOnlyToNextDayMsLocal(filterDateTo.value) : null

  const parameter = filterParameter.value.trim()

  return sessions.value.filter((session) => {
    const sessionMs = toEpochMs(session.date)
    if (fromMs !== null) {
      if (sessionMs === null || sessionMs < fromMs) return false
    }
    if (toMsExclusive !== null) {
      if (sessionMs === null || sessionMs >= toMsExclusive) return false
    }

    if (parameter) {
      return session.measurements.some((measurement) => measurement.parameter === parameter)
    }

    return true
  })
})

function clearFilters() {
  filterDateFrom.value = ""
  filterDateTo.value = ""
  filterParameter.value = ""
}

function openSessionDetail(session: WaterTestSession) {
  selectedSession.value = session
  isDetailOpen.value = true
}

async function loadHistory() {
  if (!import.meta.client) return
  if (!tank.value) return

  historyStatus.value = "loading"
  historyError.value = null

  try {
    sessions.value = await waterTests.listWaterTestSessions({ spreadsheetId: tank.value.spreadsheetId })
    historyStatus.value = "ready"
  } catch (error) {
    sessions.value = []
    historyError.value = error instanceof Error ? error.message : t("pages.tests.history.errors.loadFailed")
    historyStatus.value = "error"
  }
}

async function loadRanges() {
  if (!import.meta.client) return
  if (!tank.value) {
    parameterRangeRows.value = []
    parameterRanges.value = []
    rangesStatus.value = "idle"
    rangesError.value = null
    return
  }

  rangesStatus.value = "loading"
  rangesError.value = null

  try {
    const result = await parameterRangesApi.readParameterRangesSheet({
      spreadsheetId: tank.value.spreadsheetId,
      tankType: tank.value.type,
    })
    parameterRangeRows.value = result.ranges
    parameterRanges.value = buildRepresentativeRanges(result.ranges)
    rangesStatus.value = "ready"
  } catch (error) {
    parameterRangeRows.value = []
    parameterRanges.value = []
    rangesError.value = error instanceof Error ? error.message : t("pages.tests.ranges.errors.loadFailed")
    rangesStatus.value = "error"
  }
}

watch(
  () => [tank.value?.spreadsheetId, tank.value?.type] as const,
  () => {
    loadHistory()
    loadRanges()
  },
  { immediate: true }
)

function resetForm() {
  dateError.value = null
  submitError.value = null
  submitStatus.value = null
  parameterErrors.value = Object.fromEntries(parameterOptions.value.map((parameter) => [parameter, null])) as Record<
    string,
    string | null
  >
}

function validate() {
  resetForm()

  if (!tank.value) {
    submitError.value = t("pages.tests.form.errors.noTank")
    return null
  }

  if (!dateInput.value) {
    dateError.value = t("pages.tests.form.errors.missingDate")
    return null
  }

  const date = new Date(dateInput.value)
  if (Number.isNaN(date.getTime())) {
    dateError.value = t("pages.tests.form.errors.invalidDate")
    return null
  }

  if (rangesStatus.value === "loading") {
    submitError.value = t("pages.tests.ranges.loading")
    return null
  }

  if (rangesStatus.value === "error") {
    submitError.value = rangesError.value || t("pages.tests.ranges.errors.loadFailed")
    return null
  }

  if (!parameterRanges.value.length) {
    submitError.value = t("pages.tests.ranges.emptyHint")
    return null
  }

  const measurements: Array<{ parameter: string; value: number; unit: string }> = []

  for (const range of parameterRanges.value) {
    const raw = parameterValues.value[range.parameter] ?? ""
    const parsed = parseNumberInput(raw)
    if (parsed === null) continue

    if (parsed < 0) {
      parameterErrors.value[range.parameter] = t("pages.tests.form.errors.mustBePositive")
      continue
    }

    measurements.push({ parameter: range.parameter, value: parsed, unit: range.unit })
  }

  const hasErrors = Object.values(parameterErrors.value).some((value) => Boolean(value))
  if (hasErrors) {
    submitError.value = t("pages.tests.form.errors.fixFields")
    return null
  }

  if (!measurements.length) {
    submitError.value = t("pages.tests.form.errors.noMeasurements")
    return null
  }

  return { tank: tank.value, date, measurements }
}

async function onSubmit() {
  submitError.value = null
  submitStatus.value = null

  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    await waterTests.createWaterTestSession({
      spreadsheetId: validated.tank.spreadsheetId,
      date: validated.date,
      measurements: validated.measurements,
      method: methodInput.value,
      note: noteInput.value,
    })

    loadHistory()

    parameterValues.value = Object.fromEntries(parameterOptions.value.map((parameter) => [parameter, ""])) as Record<string, string>
    methodInput.value = ""
    noteInput.value = ""
    submitStatus.value = t("pages.tests.form.success.saved", { count: validated.measurements.length })
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : t("pages.tests.form.errors.saveFailed")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.tests.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.tests.description") }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.tests.form.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.tests.form.description") }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        <div v-if="!isStorageReady" class="space-y-2">
          <p>{{ $t("pages.tests.form.locked") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
          {{ $t("pages.tests.form.loadingTanks") }}
        </div>

        <div v-else-if="tanksError" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tanks.length" class="space-y-2">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tank" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </div>

        <form v-else class="space-y-5" @submit.prevent="onSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label for="test-date" class="text-foreground">{{ $t("pages.tests.form.fields.date") }}</label>
              <input
                id="test-date"
                v-model="dateInput"
                type="datetime-local"
                autocomplete="off"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :aria-invalid="dateError ? 'true' : 'false'"
                aria-describedby="test-date-hint test-date-feedback"
                required
              />
              <p id="test-date-hint" class="text-xs text-muted-foreground">{{ $t("pages.tests.form.hints.date") }}</p>
              <p v-if="dateError" id="test-date-feedback" class="text-sm text-destructive" role="alert">
                {{ dateError }}
              </p>
              <p v-else id="test-date-feedback" class="sr-only"> </p>
            </div>

            <div class="space-y-2">
              <div class="text-foreground">{{ $t("pages.tests.form.fields.tank") }}</div>
              <div class="text-sm text-foreground">
                {{ tank.name }}
              </div>
              <p class="text-xs text-muted-foreground">{{ $t("pages.tests.form.hints.tank") }}</p>
            </div>
          </div>

          <fieldset class="space-y-3">
            <legend class="text-sm font-medium text-foreground">{{ $t("pages.tests.form.fields.parameters") }}</legend>
            <p v-if="rangesStatus === 'loading'" class="text-xs text-muted-foreground">
              {{ $t("pages.tests.ranges.loading") }}
            </p>
            <p v-else-if="rangesStatus === 'error'" class="text-xs text-destructive" role="alert">
              {{ $t("pages.tests.ranges.errors.loadFailed") }}
              <span v-if="rangesError">({{ rangesError }})</span>
            </p>
            <div v-else-if="!parameterRanges.length" class="space-y-2 rounded-md border border-border/60 bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">
                {{ $t("pages.tests.ranges.emptyHint") }}
              </p>
              <Button as-child variant="secondary" size="sm">
                <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/water-test/ranges`)">{{ $t("actions.editRanges") }}</NuxtLink>
              </Button>
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2">
              <div v-for="range in parameterRanges" :key="range.parameter" class="space-y-2">
                <label :for="toParameterInputId(range.parameter)" class="text-foreground">
                  <span class="inline-flex items-center gap-2">
                    <span
                      class="inline-block size-2 shrink-0 rounded-full border border-border/60"
                      :style="{ backgroundColor: range.color ?? 'transparent' }"
                      aria-hidden="true"
                    />
                    <span>{{ range.parameter }}</span>
                  </span>
                  <span class="text-xs text-muted-foreground">({{ range.unit }})</span>
                </label>
                <input
                  :id="toParameterInputId(range.parameter)"
                  v-model="parameterValues[range.parameter]"
                  type="number"
                  inputmode="decimal"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  step="any"
                  min="0"
                  :placeholder="$t('pages.tests.form.placeholders.value')"
                  :aria-invalid="parameterErrors[range.parameter] ? 'true' : 'false'"
                  :aria-describedby="`${toParameterInputId(range.parameter)}-feedback`"
                />
                <p
                  v-if="parameterErrors[range.parameter]"
                  :id="`${toParameterInputId(range.parameter)}-feedback`"
                  class="text-sm text-destructive"
                  role="alert"
                >
                  {{ parameterErrors[range.parameter] }}
                </p>
                <p v-else :id="`${toParameterInputId(range.parameter)}-feedback`" class="text-xs text-muted-foreground">
                  <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      v-if="getInputVerdictBadge(range.parameter)"
                      class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none"
                      :class="getInputVerdictBadge(range.parameter)!.className"
                      :title="getInputVerdictBadge(range.parameter)!.ariaLabel"
                    >
                      <component :is="getInputVerdictBadge(range.parameter)!.icon" class="size-3.5" aria-hidden="true" />
                      <span>{{ getInputVerdictBadge(range.parameter)!.label }}</span>
                      <component
                        v-if="getInputVerdictBadge(range.parameter)!.directionIcon"
                        :is="getInputVerdictBadge(range.parameter)!.directionIcon"
                        class="size-3.5"
                        aria-hidden="true"
                      />
                      <span v-if="getInputVerdictBadge(range.parameter)!.directionLabel" class="sr-only">
                        ({{ getInputVerdictBadge(range.parameter)!.directionLabel }})
                      </span>
                    </span>
                    <span v-if="getExpectedRangeTextForParameter(range.parameter)">
                      {{ $t("pages.tests.ranges.expected") }} {{ getExpectedRangeTextForParameter(range.parameter) }}
                    </span>
                  </span>
                </p>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">{{ $t("pages.tests.form.hints.parameters") }}</p>
          </fieldset>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label for="test-method" class="text-foreground">{{ $t("pages.tests.form.fields.method") }}</label>
              <input
                id="test-method"
                v-model="methodInput"
                type="text"
                autocomplete="off"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :placeholder="$t('pages.tests.form.placeholders.method')"
              />
            </div>

            <div class="space-y-2">
              <label for="test-note" class="text-foreground">{{ $t("pages.tests.form.fields.note") }}</label>
              <input
                id="test-note"
                v-model="noteInput"
                type="text"
                autocomplete="off"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :placeholder="$t('pages.tests.form.placeholders.note')"
              />
            </div>
          </div>

          <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
          <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

          <div class="flex flex-wrap gap-2">
            <Button type="submit" :disabled="isSubmitting || rangesStatus !== 'ready' || !parameterRanges.length">
              <span v-if="isSubmitting">{{ $t("pages.tests.form.saving") }}</span>
              <span v-else>{{ $t("pages.tests.form.save") }}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.tests.history.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.tests.history.description") }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4 text-sm text-muted-foreground">
        <div v-if="!isStorageReady" class="space-y-2">
          <p>{{ $t("pages.tests.form.locked") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
          {{ $t("pages.tests.history.loadingTanks") }}
        </div>

        <div v-else-if="tanksError" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tanks.length" class="space-y-2">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tank" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </div>

        <div v-else class="space-y-4">
          <section aria-labelledby="tests-trends-title" class="space-y-3 rounded-md border border-border bg-muted/20 p-4">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <h3 id="tests-trends-title" class="text-base font-medium text-foreground">
                  {{ $t("pages.tests.trends.title") }}
                </h3>
                <p class="text-sm text-muted-foreground">{{ $t("pages.tests.trends.description") }}</p>
              </div>

              <div class="space-y-2 sm:w-72">
                <label for="trend-parameter" class="text-sm font-medium text-foreground">
                  {{ $t("pages.tests.trends.fields.parameter") }}
                </label>
                <select
                  id="trend-parameter"
                  v-model="trendParameter"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option v-for="param in parameterOptions" :key="param" :value="param">
                    {{ param }}
                  </option>
                </select>
              </div>
            </div>

            <p class="text-xs text-muted-foreground">{{ $t("pages.tests.trends.points", { count: trendPoints.length }) }}</p>

            <div v-if="historyStatus === 'loading'" class="text-sm text-muted-foreground">
              {{ $t("pages.tests.trends.loading") }}
            </div>
            <p v-else-if="historyStatus === 'error'" class="text-sm text-destructive" role="alert">
              {{ historyError }}
            </p>
            <div v-else-if="historyStatus === 'ready' && !sessions.length" class="space-y-1">
              <p class="text-sm text-muted-foreground">{{ $t("pages.tests.trends.empty.noHistory") }}</p>
              <p class="text-xs text-muted-foreground">{{ $t("pages.tests.trends.empty.noHistoryHint") }}</p>
            </div>
            <p v-else-if="historyStatus === 'ready' && !trendPoints.length" class="text-sm text-muted-foreground">
              {{ $t("pages.tests.trends.empty.noParameterData") }}
            </p>
            <ChartComponent
              v-else
              :ariaLabel="trendChartAriaLabel"
              :data="trendChartData"
              :options="trendChartOptions"
              container-class="h-72 sm:h-80"
            />
          </section>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="space-y-2">
              <label for="history-from" class="text-foreground">{{ $t("pages.tests.history.filters.from") }}</label>
              <input
                id="history-from"
                v-model="filterDateFrom"
                type="date"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div class="space-y-2">
              <label for="history-to" class="text-foreground">{{ $t("pages.tests.history.filters.to") }}</label>
              <input
                id="history-to"
                v-model="filterDateTo"
                type="date"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div class="space-y-2">
              <label for="history-param" class="text-foreground">{{ $t("pages.tests.history.filters.parameter") }}</label>
              <select
                id="history-param"
                v-model="filterParameter"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{{ $t("pages.tests.history.filters.anyParameter") }}</option>
                <option v-for="param in parameterOptions" :key="param" :value="param">
                  {{ param }}
                </option>
              </select>
            </div>
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

          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.tests.history.results", { count: filteredSessions.length }) }}
            </p>

            <div class="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" type="button" :disabled="historyStatus === 'loading'" @click="loadHistory">
                <span v-if="historyStatus === 'loading'">{{ $t("pages.tests.history.refreshing") }}</span>
                <span v-else>{{ $t("pages.tests.history.refresh") }}</span>
              </Button>
              <Button v-if="hasActiveFilters" variant="ghost" size="sm" type="button" @click="clearFilters">
                {{ $t("pages.tests.history.filters.clear") }}
              </Button>
            </div>
          </div>

          <div v-if="historyStatus === 'loading'" class="text-sm text-muted-foreground">
            {{ $t("pages.tests.history.loading") }}
          </div>

          <div v-else-if="historyStatus === 'error'" class="space-y-2">
            <p class="text-sm text-destructive" role="alert">{{ historyError }}</p>
            <Button variant="secondary" size="sm" type="button" @click="loadHistory">
              {{ $t("pages.tests.history.refresh") }}
            </Button>
          </div>

          <div v-else-if="historyStatus === 'ready' && !sessions.length" class="space-y-2">
            <p class="text-sm text-muted-foreground">{{ $t("pages.tests.history.empty") }}</p>
            <p class="text-xs text-muted-foreground">{{ $t("pages.tests.history.emptyHint") }}</p>
          </div>

          <div v-else-if="historyStatus === 'ready' && !filteredSessions.length" class="space-y-2">
            <p class="text-sm text-muted-foreground">{{ $t("pages.tests.history.noResults") }}</p>
            <Button variant="secondary" size="sm" type="button" @click="clearFilters">
              {{ $t("pages.tests.history.filters.clear") }}
            </Button>
          </div>

          <ul
            v-else
            role="list"
            class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
          >
            <li v-for="session in filteredSessions" :key="session.testGroupId">
              <button
                type="button"
                class="w-full space-y-2 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                @click="openSessionDetail(session)"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="font-medium">
                    {{ formatSessionDate(session.date) }}
                  </div>
                  <div class="space-y-1 text-right text-xs">
                    <div class="text-muted-foreground">
                      {{ $t("pages.tests.history.measurements", { count: session.measurements.length }) }}
                    </div>
                    <div v-if="getSessionAlertCount(session)" class="font-medium text-destructive">
                      {{ $t("pages.tests.ranges.sessionAlerts", { count: getSessionAlertCount(session) }) }}
                    </div>
                  </div>
                </div>

                <p v-if="session.method || session.note" class="text-xs text-muted-foreground">
                  <span v-if="session.method">{{ $t("pages.tests.history.labels.method") }}: {{ session.method }}</span>
                  <span v-if="session.method && session.note"> · </span>
                  <span v-if="session.note">{{ $t("pages.tests.history.labels.note") }}: {{ session.note }}</span>
                </p>

                <div class="flex flex-wrap gap-1">
                  <div
                    v-for="measurement in session.measurements"
                    :key="measurement.id"
                    :title="getMeasurementExpectedLabel(measurement) ?? undefined"
                    class="rounded px-2 py-1 text-xs bg-muted text-foreground"
                  >
                    <span class="inline-flex items-center gap-1.5 font-medium">
                      <span
                        class="inline-block size-2 shrink-0 rounded-full border border-border/60"
                        :style="{ backgroundColor: getColorForParameter(measurement.parameter) ?? 'transparent' }"
                        aria-hidden="true"
                      />
                      <span>{{ measurement.parameter }}</span>
                    </span>:
                    
                      {{ formatNumber(measurement.value) }} {{ getDisplayUnitForMeasurement(measurement) }}
  
                      <span
                        class="ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none"
                        :class="getMeasurementVerdictBadge(measurement).className"
                        :title="getMeasurementVerdictBadge(measurement).ariaLabel"
                      >
                        <component :is="getMeasurementVerdictBadge(measurement).icon" class="size-3.5" aria-hidden="true" />
                        <span>{{ getMeasurementVerdictBadge(measurement).label }}</span>
                        <component
                          v-if="getMeasurementVerdictBadge(measurement).directionIcon"
                          :is="getMeasurementVerdictBadge(measurement).directionIcon"
                          class="size-3.5"
                          aria-hidden="true"
                        />
                        <span v-if="getMeasurementVerdictBadge(measurement).directionLabel" class="sr-only">
                          ({{ getMeasurementVerdictBadge(measurement).directionLabel }})
                        </span>
                      </span>
                  </div>
                </div>
              </button>
            </li>
          </ul>

          <Dialog v-model:open="isDetailOpen">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {{ selectedSession ? formatSessionDate(selectedSession.date) : $t("pages.tests.detail.title") }}
                </DialogTitle>
                <DialogDescription>
                  <span v-if="selectedSession">
                    {{ $t("pages.tests.detail.groupId") }}:
                    <code class="rounded bg-muted px-1 py-0.5">{{ selectedSession.testGroupId }}</code>
                  </span>
                  <span v-else>{{ $t("pages.tests.detail.description") }}</span>
                </DialogDescription>
              </DialogHeader>

              <div v-if="selectedSession" class="space-y-4">
                <div v-if="selectedSession.method || selectedSession.note" class="space-y-1 text-sm text-muted-foreground">
                  <p v-if="selectedSession.method">
                    <span class="font-medium text-foreground">{{ $t("pages.tests.history.labels.method") }}:</span>
                    {{ selectedSession.method }}
                  </p>
                  <p v-if="selectedSession.note">
                    <span class="font-medium text-foreground">{{ $t("pages.tests.history.labels.note") }}:</span>
                    {{ selectedSession.note }}
                  </p>
                </div>

                <AlertBanner
                  v-if="selectedSessionAlerts.length"
                  variant="warning"
                  :title="$t('pages.tests.ranges.banner.title', { count: selectedSessionAlerts.length })"
                >
                  <p class="text-muted-foreground">
                    {{ $t("pages.tests.ranges.banner.description") }}
                  </p>
                  <ul class="mt-2 list-disc space-y-1 pl-4">
                    <li v-for="item in selectedSessionAlerts" :key="item.measurementId">
                      <span class="inline-flex items-center gap-2 font-medium text-foreground">
                        <span
                          class="inline-block size-2 shrink-0 rounded-full border border-border/60"
                          :style="{ backgroundColor: getColorForParameter(item.parameter) ?? 'transparent' }"
                          aria-hidden="true"
                        />
                        <span>{{ item.parameter }}</span>
                      </span>:
                      <span class="text-foreground">{{ formatNumber(item.actual) }} {{ item.unit }}</span>
                      <span
                        class="ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none"
                        :class="makeVerdictBadge(item.verdict, item.direction).className"
                        :title="makeVerdictBadge(item.verdict, item.direction).ariaLabel"
                      >
                        <component :is="makeVerdictBadge(item.verdict, item.direction).icon" class="size-3.5" aria-hidden="true" />
                        <span>{{ makeVerdictBadge(item.verdict, item.direction).label }}</span>
                        <component
                          v-if="makeVerdictBadge(item.verdict, item.direction).directionIcon"
                          :is="makeVerdictBadge(item.verdict, item.direction).directionIcon"
                          class="size-3.5"
                          aria-hidden="true"
                        />
                        <span v-if="makeVerdictBadge(item.verdict, item.direction).directionLabel" class="sr-only">
                          ({{ makeVerdictBadge(item.verdict, item.direction).directionLabel }})
                        </span>
                      </span>
                      <span v-if="item.expected" class="text-muted-foreground">
                        — {{ $t("pages.tests.ranges.expected") }} {{ item.expected }}
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
                      <tr v-for="measurement in selectedSession.measurements" :key="measurement.id" class="border-b border-border/60">
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
                          <div class="flex flex-wrap items-center justify-end gap-2">
                            <span :class="measurementValueClass(measurement)">
                              {{ formatNumber(measurement.value) }}
                            </span>
                            <span
                              class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none"
                              :class="getMeasurementVerdictBadge(measurement).className"
                              :title="getMeasurementVerdictBadge(measurement).ariaLabel"
                            >
                              <component :is="getMeasurementVerdictBadge(measurement).icon" class="size-3.5" aria-hidden="true" />
                              <span>{{ getMeasurementVerdictBadge(measurement).label }}</span>
                              <component
                                v-if="getMeasurementVerdictBadge(measurement).directionIcon"
                                :is="getMeasurementVerdictBadge(measurement).directionIcon"
                                class="size-3.5"
                                aria-hidden="true"
                              />
                              <span v-if="getMeasurementVerdictBadge(measurement).directionLabel" class="sr-only">
                                ({{ getMeasurementVerdictBadge(measurement).directionLabel }})
                              </span>
                            </span>
                          </div>
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
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child variant="secondary">
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/water-test/ranges`)">{{ $t("actions.editRanges") }}</NuxtLink>
        </Button>
        <Button as-child variant="secondary">
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
        </Button>
        <Button as-child variant="secondary">
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

