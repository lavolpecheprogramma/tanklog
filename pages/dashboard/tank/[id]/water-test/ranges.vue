<script setup lang="ts">
import AlertBanner from "@/components/AlertBanner.vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { type ParameterRangeStatus, useParameterRanges } from "@/composables/useParameterRanges"
import type { TankType } from "@/composables/useTanks"
import { WATER_TEST_PARAMETERS } from "@/composables/useWaterTests"
import { getDefaultColorForParameter, getDefaultParameterRangesForTankType } from "@/lib/parameterRangeDefaults"

definePageMeta({
  layout: "tank",
})

const { t } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.tests.rangesEditor.metaTitle"),
}))

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

const rangesApi = useParameterRanges()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const loadStatus = ref<LoadStatus>("idle")
const loadError = ref<string | null>(null)

const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveStatus = ref<string | null>(null)

type EditableBand = {
  minValue: string
  maxValue: string
}

type EditableParameterRanges = {
  id: string
  parameter: string
  unit: string
  color: string
  bands: {
    optimal: EditableBand
    acceptable: EditableBand
    critical: EditableBand
  }
}

const FALLBACK_PARAMETER_COLOR = "#94a3b8"

const bandOrder: ParameterRangeStatus[] = ["optimal", "acceptable", "critical"]

function blankBand(): EditableBand {
  return { minValue: "", maxValue: "" }
}

function generateId(prefix: string): string {
  const safePrefix = prefix.trim().replace(/[^a-z0-9_-]/gi, "") || "id"
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)

  try {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return `${safePrefix}_${uuid}`
  } catch {
    // ignore
  }

  return `${safePrefix}_${time}_${random}`
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function normalizeParameterKey(value: string): string {
  return value.trim().toLowerCase()
}

const parameters = ref<EditableParameterRanges[]>([])
const isApplyPresetOpen = ref(false)
const presetSource = ref<TankType>("freshwater")

watch(
  () => tank.value?.type,
  (type) => {
    if (!type) return
    presetSource.value = type
  },
  { immediate: true }
)

const parameterSuggestions = computed(() => {
  const known = WATER_TEST_PARAMETERS.map((item) => ({ parameter: item.parameter, unit: item.unit }))
  const extras = [
    { parameter: "Temp", unit: "°C" },
    { parameter: "Salinity", unit: "ppt" },
    { parameter: "NH3", unit: "ppm" },
    { parameter: "Ca", unit: "ppm" },
    { parameter: "Mg", unit: "ppm" },
  ]

  const byKey = new Map<string, { parameter: string; unit: string }>()
  for (const item of [...known, ...extras]) byKey.set(normalizeParameterKey(item.parameter), item)
  return Array.from(byKey.values()).sort((a, b) => a.parameter.localeCompare(b.parameter))
})

function maybeAutofillUnit(item: EditableParameterRanges) {
  if (item.unit.trim()) return
  const match = parameterSuggestions.value.find((candidate) => normalizeParameterKey(candidate.parameter) === normalizeParameterKey(item.parameter))
  if (!match) return
  item.unit = match.unit
}

function maybeAutofillColor(item: EditableParameterRanges) {
  if (item.color !== FALLBACK_PARAMETER_COLOR) return
  const suggested = getDefaultColorForParameter(item.parameter)
  if (!suggested) return
  item.color = suggested
}

function addParameter(initial?: Partial<Pick<EditableParameterRanges, "parameter" | "unit" | "color">>) {
  parameters.value.push({
    id: generateId("range-param"),
    parameter: initial?.parameter ?? "",
    unit: initial?.unit ?? "",
    color: initial?.color ?? FALLBACK_PARAMETER_COLOR,
    bands: {
      optimal: blankBand(),
      acceptable: blankBand(),
      critical: blankBand(),
    },
  })
}

function removeParameter(parameterId: string) {
  parameters.value = parameters.value.filter((item) => item.id !== parameterId)
}

function applyPreset(source: TankType) {
  const preset = getDefaultParameterRangesForTankType(source)
  const byKey = new Map<string, EditableParameterRanges>()

  for (const row of preset) {
    const key = normalizeParameterKey(row.parameter)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        id: generateId("range-param"),
        parameter: row.parameter,
        unit: row.unit,
        color: row.color ?? FALLBACK_PARAMETER_COLOR,
        bands: {
          optimal: blankBand(),
          acceptable: blankBand(),
          critical: blankBand(),
        },
      })
    }

    const target = byKey.get(key)!
    if (!target.unit.trim()) target.unit = row.unit
    if (target.color === FALLBACK_PARAMETER_COLOR && row.color) target.color = row.color
    target.bands[row.status] = {
      minValue: row.minValue === null ? "" : String(row.minValue),
      maxValue: row.maxValue === null ? "" : String(row.maxValue),
    }
  }

  parameters.value = Array.from(byKey.values()).sort((a, b) => a.parameter.localeCompare(b.parameter))
}

function onConfirmApplyPreset() {
  applyPreset(presetSource.value)
  isApplyPresetOpen.value = false
  saveStatus.value = null
  saveError.value = null
}

type ParameterValidation = { parameterId: string; message: string }

const validationErrors = computed<ParameterValidation[]>(() => {
  const errors: ParameterValidation[] = []
  const seen = new Set<string>()

  for (const item of parameters.value) {
    const parameter = item.parameter.trim()
    const unit = item.unit.trim()
    const hasAnyBand = bandOrder.some((status) => {
      const min = parseOptionalNumber(item.bands[status].minValue)
      const max = parseOptionalNumber(item.bands[status].maxValue)
      return min !== null || max !== null
    })

    if (!parameter && !unit && !hasAnyBand) continue

    if (!parameter) {
      errors.push({ parameterId: item.id, message: t("pages.tests.rangesEditor.validation.parameterRequired") })
      continue
    }

    const key = normalizeParameterKey(parameter)
    if (seen.has(key)) {
      errors.push({ parameterId: item.id, message: t("pages.tests.rangesEditor.validation.duplicateParameter", { parameter }) })
      continue
    }
    seen.add(key)

    if (!unit) {
      errors.push({ parameterId: item.id, message: t("pages.tests.rangesEditor.validation.unitRequired", { parameter }) })
      continue
    }

    if (!hasAnyBand) {
      errors.push({ parameterId: item.id, message: t("pages.tests.rangesEditor.validation.minOrMaxRequired", { parameter }) })
      continue
    }

    for (const status of bandOrder) {
      const min = parseOptionalNumber(item.bands[status].minValue)
      const max = parseOptionalNumber(item.bands[status].maxValue)
      if (min === null && max === null) continue

    if (min !== null && max !== null && min > max) {
        errors.push({
          parameterId: item.id,
          message: t("pages.tests.rangesEditor.validation.minGreaterThanMaxStatus", {
            parameter,
            status: t(`pages.tests.rangesEditor.status.options.${status}`),
          }),
        })
      }
    }
  }

  return errors
})

function parameterErrors(parameterId: string): string[] {
  return validationErrors.value.filter((item) => item.parameterId === parameterId).map((item) => item.message)
}

const hasErrors = computed(() => validationErrors.value.length > 0)

async function loadRanges() {
  if (!import.meta.client) return

  loadError.value = null

  if (!tank.value) {
    parameters.value = []
    loadStatus.value = "idle"
    return
  }

  loadStatus.value = "loading"
  try {
    const result = await rangesApi.readParameterRangesSheet({
      spreadsheetId: tank.value.spreadsheetId,
      tankType: tank.value.type,
    })

    const byKey = new Map<string, EditableParameterRanges>()
    for (const range of result.ranges) {
      const key = normalizeParameterKey(range.parameter)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          id: generateId("range-param"),
          parameter: range.parameter,
          unit: range.unit,
          color: range.color ?? FALLBACK_PARAMETER_COLOR,
          bands: {
            optimal: blankBand(),
            acceptable: blankBand(),
            critical: blankBand(),
          },
        })
      }

      const target = byKey.get(key)!
      if (!target.unit.trim()) target.unit = range.unit
      if (target.color === FALLBACK_PARAMETER_COLOR && range.color) target.color = range.color
      target.bands[range.status] = {
        minValue: range.minValue === null ? "" : String(range.minValue),
        maxValue: range.maxValue === null ? "" : String(range.maxValue),
      }
    }

    parameters.value = Array.from(byKey.values()).sort((a, b) => a.parameter.localeCompare(b.parameter))

    loadStatus.value = "ready"
  } catch (error) {
    parameters.value = []
    loadError.value = error instanceof Error ? error.message : t("pages.tests.rangesEditor.errors.loadFailed")
    loadStatus.value = "error"
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    saveError.value = null
    saveStatus.value = null
    loadRanges()
  },
  { immediate: true }
)

async function onSave() {
  saveError.value = null
  saveStatus.value = null

  if (!tank.value) {
    saveError.value = t("pages.tests.rangesEditor.errors.noTank")
    return
  }

  if (hasErrors.value) {
    saveError.value = t("pages.tests.rangesEditor.errors.fixErrors")
    return
  }

  const payload = parameters.value.flatMap((item) => {
    const parameter = item.parameter.trim()
    const unit = item.unit.trim()
    if (!parameter || !unit) return []

    return bandOrder
      .map((status) => {
        const minValue = parseOptionalNumber(item.bands[status].minValue)
        const maxValue = parseOptionalNumber(item.bands[status].maxValue)
        if (minValue === null && maxValue === null) return null
        return { parameter, unit, status, minValue, maxValue, color: item.color }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
  })

  isSaving.value = true
  try {
    const result = await rangesApi.saveParameterRanges({
      spreadsheetId: tank.value.spreadsheetId,
      tankType: tank.value.type,
      ranges: payload,
      existingRowCount: null,
    })
    saveStatus.value = t("pages.tests.rangesEditor.success.saved", { count: result.savedCount })
    await loadRanges()
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : t("pages.tests.rangesEditor.errors.saveFailed")
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.tests.rangesEditor.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.tests.rangesEditor.description") }}
      </p>
    </div>

    <Card v-if="!isStorageReady">
      <CardContent class="space-y-2 text-sm text-muted-foreground">
          <p>{{ $t("pages.tests.form.locked") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
      </CardContent>
    </Card>

    <Card v-else-if="tanksStatus === 'loading'">
      <CardContent class="text-sm text-muted-foreground">
          {{ $t("pages.tests.form.loadingTanks") }}
      </CardContent>
    </Card>

    <Card v-else-if="tanksError">
      <CardContent class="space-y-2 text-sm text-muted-foreground">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
      </CardContent>
    </Card>

    <Card v-else-if="!tanks.length">
      <CardContent class="space-y-2 text-sm text-muted-foreground">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
      </CardContent>
    </Card>

    <Card v-else-if="!tank">
      <CardContent class="space-y-2 text-sm text-muted-foreground">
          <p class="text-sm text-destructive" role="alert">
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </p>
        <Button as-child variant="secondary">
            <NuxtLink :to="localePath('/dashboard')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
      </CardContent>
    </Card>

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.tests.rangesEditor.table.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.tests.rangesEditor.table.description") }}</CardDescription>
        </CardHeader>

        <CardContent class="space-y-4 text-sm text-muted-foreground">
          <div class="rounded-md border border-border/60 p-4">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.tests.rangesEditor.preset.tankTypeLabel") }}
            <span class="font-medium text-foreground">{{ $t(`pages.settings.tanks.types.${tank.type}`) }}</span>
          </p>

            <div class="space-y-2">
              <label for="preset-source" class="text-foreground">
                {{ $t("pages.tests.rangesEditor.preset.sourceLabel") }}
              </label>
              <select
                id="preset-source"
                v-model="presetSource"
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="freshwater">{{ $t("pages.settings.tanks.types.freshwater") }}</option>
                <option value="planted">{{ $t("pages.settings.tanks.types.planted") }}</option>
                <option value="marine">{{ $t("pages.settings.tanks.types.marine") }}</option>
                <option value="reef">{{ $t("pages.settings.tanks.types.reef") }}</option>
              </select>
            </div>

                <div class="flex flex-wrap items-end gap-2">
              <Dialog v-model:open="isApplyPresetOpen">
                <DialogTrigger as-child>
                  <Button type="button" variant="secondary">
                    {{ $t("pages.tests.rangesEditor.preset.apply") }}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{{ $t("pages.tests.rangesEditor.preset.confirmTitle") }}</DialogTitle>
                    <DialogDescription>
                      {{ $t("pages.tests.rangesEditor.preset.confirmDescription") }}
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <Button type="button" @click="onConfirmApplyPreset">
                      {{ $t("pages.tests.rangesEditor.preset.confirmApply") }}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button type="button" variant="secondary" :disabled="loadStatus === 'loading'" @click="loadRanges">
                {{ $t("pages.tests.rangesEditor.actions.reload") }}
              </Button>
            </div>
          </div>

          <p class="text-xs text-muted-foreground">
            {{ $t("pages.tests.rangesEditor.preset.note") }}
          </p>
        </div>
        </div>

          <div v-if="loadStatus === 'loading'">
          {{ $t("pages.tests.rangesEditor.loading") }}
        </div>

        <div v-else-if="loadStatus === 'error'" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ loadError }}</p>
        </div>

        <div v-else class="space-y-4">
            <p class="text-xs text-muted-foreground">
            {{ $t("pages.tests.rangesEditor.table.count", { count: parameters.length }) }}
          </p>

            <AlertBanner
              v-if="hasErrors"
              variant="warning"
              :title="$t('pages.tests.rangesEditor.validation.bannerTitle', { count: validationErrors.length })"
            >
            <ul class="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                <li v-for="(item, index) in validationErrors" :key="`${item.parameterId}-${index}`">
                {{ item.message }}
              </li>
            </ul>
          </AlertBanner>

          <p v-if="saveError" class="text-sm text-destructive" role="alert">{{ saveError }}</p>
          <p v-else-if="saveStatus" class="text-sm text-foreground" role="status">{{ saveStatus }}</p>

            <div v-if="!parameters.length" class="rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
                    {{ $t("pages.tests.rangesEditor.table.empty") }}
            </div>

            <div v-else class="grid gap-4 lg:grid-cols-2">
              <Card v-for="(item, index) in parameters" :key="item.id">
                <CardHeader class="pb-3">
                  <CardTitle class="flex items-start justify-between gap-3">
                    <span class="flex min-w-0 items-center gap-2">
                      <span
                        class="mt-1 inline-block size-2 shrink-0 rounded-full border border-border/60"
                        :style="{ backgroundColor: item.color }"
                        aria-hidden="true"
                      />
                      <span class="truncate">
                        {{ item.parameter.trim() || $t("pages.tests.rangesEditor.table.columns.parameter") }}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      :aria-label="$t('pages.tests.rangesEditor.table.removeRowAria', { row: index + 1, parameter: item.parameter || '' })"
                      @click="removeParameter(item.id)"
                    >
                      {{ $t("pages.tests.rangesEditor.actions.removeRow") }}
                    </Button>
                  </CardTitle>
                  <CardDescription class="text-xs">
                    {{ $t("pages.tests.rangesEditor.table.columns.unit") }}:
                    <span class="font-medium text-foreground">{{ item.unit.trim() || "—" }}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent class="space-y-4 text-sm text-muted-foreground">
                  <div class="grid gap-3 sm:grid-cols-3">
                    <div class="space-y-1">
                      <label :for="`parameter-${item.id}`" class="text-xs font-medium text-foreground">
                        {{ $t("pages.tests.rangesEditor.table.columns.parameter") }}
                      </label>
                      <input
                        :id="`parameter-${item.id}`"
                        v-model="item.parameter"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        list="parameter-list"
                        :aria-describedby="parameterErrors(item.id).length ? `errors-${item.id}` : undefined"
                        @blur="
                          maybeAutofillUnit(item);
                          maybeAutofillColor(item);
                        "
                      />
                    </div>

                    <div class="space-y-1">
                      <label :for="`unit-${item.id}`" class="text-xs font-medium text-foreground">
                        {{ $t("pages.tests.rangesEditor.table.columns.unit") }}
                      </label>
                      <input
                        :id="`unit-${item.id}`"
                        v-model="item.unit"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        :aria-describedby="parameterErrors(item.id).length ? `errors-${item.id}` : undefined"
                      />
                    </div>

                    <div class="space-y-1">
                      <label :for="`color-${item.id}`" class="text-xs font-medium text-foreground">
                        {{ $t("pages.tests.rangesEditor.table.columns.color") }}
                      </label>
                      <input
                        :id="`color-${item.id}`"
                        v-model="item.color"
                        type="color"
                        class="h-9 w-full rounded-md border border-input bg-background px-2 py-1 shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        :aria-describedby="parameterErrors(item.id).length ? `errors-${item.id}` : undefined"
                      />
                    </div>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-3">
                    <div
                      v-for="status in bandOrder"
                      :key="`${item.id}-${status}`"
                      class="rounded-md border border-border/60 p-3"
                    >
                      <p class="text-xs font-medium text-muted-foreground">
                        {{ $t(`pages.tests.rangesEditor.status.options.${status}`) }}
                      </p>

                      <div class="mt-2 grid gap-3">
                        <div class="space-y-1">
                          <label :for="`min-${item.id}-${status}`" class="text-xs text-muted-foreground">
                            {{ $t("pages.tests.rangesEditor.table.columns.min") }}
                          </label>
                          <input
                            :id="`min-${item.id}-${status}`"
                            v-model="item.bands[status].minValue"
                            type="number"
                            inputmode="decimal"
                            class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            :placeholder="$t('pages.tests.rangesEditor.table.placeholders.none')"
                            :aria-describedby="parameterErrors(item.id).length ? `errors-${item.id}` : undefined"
                          />
                        </div>

                        <div class="space-y-1">
                          <label :for="`max-${item.id}-${status}`" class="text-xs text-muted-foreground">
                            {{ $t("pages.tests.rangesEditor.table.columns.max") }}
                          </label>
                          <input
                            :id="`max-${item.id}-${status}`"
                            v-model="item.bands[status].maxValue"
                            type="number"
                            inputmode="decimal"
                            class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            :placeholder="$t('pages.tests.rangesEditor.table.placeholders.none')"
                            :aria-describedby="parameterErrors(item.id).length ? `errors-${item.id}` : undefined"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <ul
                    v-if="parameterErrors(item.id).length"
                    :id="`errors-${item.id}`"
                    class="space-y-1 text-sm text-destructive"
                    role="alert"
                  >
                    <li v-for="(msg, msgIndex) in parameterErrors(item.id)" :key="`${item.id}-${msgIndex}`">
                          {{ msg }}
                        </li>
                      </ul>
                </CardContent>
              </Card>
          </div>

          <datalist id="parameter-list">
            <option v-for="item in parameterSuggestions" :key="item.parameter" :value="item.parameter" />
          </datalist>
        </div>
      </CardContent>

      <CardFooter class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button as-child variant="secondary">
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/water-test`)">{{ $t("pages.tests.rangesEditor.actions.backToTests") }}</NuxtLink>
        </Button>

        <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" @click="addParameter()">
            {{ $t("pages.tests.rangesEditor.actions.addRow") }}
          </Button>
          <Button type="button" :disabled="isSaving || !tank" @click="onSave">
            <span v-if="isSaving">{{ $t("pages.tests.rangesEditor.actions.saving") }}</span>
            <span v-else>{{ $t("pages.tests.rangesEditor.actions.save") }}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
    </template>
  </section>
</template>

