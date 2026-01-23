<script setup lang="ts">
import type { ParameterRange, ParameterRangeStatus } from "@/composables/useParameterRanges"
import type { WaterTestMeasurement } from "@/composables/useWaterTests"
import { ArrowDown, ArrowUp, CircleCheck, CircleDot, CircleQuestionMark, CircleX, TriangleAlert } from "lucide-vue-next"
import type { Component } from "vue"

const props = defineProps<{
  measurements: WaterTestMeasurement[]
  parameterRangeRows?: ParameterRange[]
}>()

const { t, locale } = useI18n()

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

function formatRange(range: ParameterRange): string {
  const min = range.minValue
  const max = range.maxValue

  if (min !== null && max !== null) return `${formatNumber(min)}–${formatNumber(max)} ${range.unit}`
  if (min !== null) return `≥ ${formatNumber(min)} ${range.unit}`
  if (max !== null) return `≤ ${formatNumber(max)} ${range.unit}`
  return range.unit
}

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

const metaByParameterKey = computed(() => {
  const grouped = new Map<string, ParameterRange[]>()
  for (const range of props.parameterRangeRows ?? []) {
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

function getDisplayUnitForMeasurement(measurement: WaterTestMeasurement): string {
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
  return meta.bands.optimal ?? meta.bands.acceptable ?? meta.bands.critical ?? null
}

function getMeasurementRangeText(measurement: WaterTestMeasurement): string | null {
  const expected = getExpectedRangeForParameter(measurement.parameter)
  return expected ? formatRange(expected) : null
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

function getMeasurementVerdictBadge(measurement: WaterTestMeasurement): VerdictBadge {
  const { verdict } = getMeasurementVerdict(measurement.parameter, measurement.value)
  const meta = metaByParameterKey.value.get(normalizeParameterKey(measurement.parameter))
  const referenceRange = meta?.bands.optimal ?? meta?.bands.acceptable ?? meta?.bands.critical ?? null
  const direction = getDirectionRelativeToRange(measurement.value, referenceRange)
  return makeVerdictBadge(verdict, direction)
}

function measurementValueClass(measurement: WaterTestMeasurement): string {
  const { verdict } = getMeasurementVerdict(measurement.parameter, measurement.value)
  if (verdict === "worst") return "font-semibold text-destructive"
  if (verdict === "critical") return "font-semibold text-amber-700 dark:text-amber-400"
  return ""
}
</script>

<template>
  <div class="max-w-full overflow-x-auto">
    <table class="w-full text-sm">
      <caption class="sr-only">{{ t("pages.tests.detail.tableCaption") }}</caption>
      <thead class="text-xs text-muted-foreground">
        <tr class="border-b border-border">
          <th scope="col" class="px-2 py-2 text-left font-medium">{{ t("pages.tests.detail.columns.parameter") }}</th>
          <th scope="col" class="px-2 py-2 text-right font-medium">{{ t("pages.tests.detail.columns.value") }}</th>
          <th scope="col" class="hidden px-2 py-2 text-left font-medium sm:table-cell">
            {{ t("pages.tests.detail.columns.unit") }}
          </th>
          <th scope="col" class="hidden px-2 py-2 text-left font-medium md:table-cell">
            {{ t("pages.tests.detail.columns.range") }}
          </th>
          <th scope="col" class="hidden px-2 py-2 text-left font-medium md:table-cell">
            {{ t("pages.tests.detail.columns.result") }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="measurement in measurements" :key="measurement.id" class="border-b border-border/60">
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
            <div class="flex items-center justify-end">
              <span :class="measurementValueClass(measurement)">
                {{ formatNumber(measurement.value) }}
              </span>
            </div>
            <div class="mt-1 text-xs text-muted-foreground sm:hidden">
              {{ getDisplayUnitForMeasurement(measurement) }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground md:hidden">
              {{ t("pages.tests.detail.columns.range") }}: {{ getMeasurementRangeText(measurement) ?? "—" }}
            </div>
            <div class="mt-1 flex flex-wrap items-center justify-end gap-2 md:hidden">
              <span class="text-xs text-muted-foreground">{{ t("pages.tests.detail.columns.result") }}:</span>
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
          <td class="hidden px-2 py-2 text-left text-muted-foreground sm:table-cell">
            {{ getDisplayUnitForMeasurement(measurement) }}
          </td>
          <td class="hidden px-2 py-2 text-left text-muted-foreground md:table-cell">
            {{ getMeasurementRangeText(measurement) ?? "—" }}
          </td>
          <td class="hidden px-2 py-2 text-left md:table-cell">
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
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

