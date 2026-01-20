<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WATER_TEST_PARAMETERS, type WaterTestParameter, type WaterTestSession } from "@/composables/useWaterTests"

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

function createEmptyParameterMap<T>(defaultValue: T): Record<WaterTestParameter, T> {
  return WATER_TEST_PARAMETERS.reduce(
    (acc, item) => {
      acc[item.parameter] = defaultValue
      return acc
    },
    {} as Record<WaterTestParameter, T>
  )
}

const dateInput = ref("")
const dateError = ref<string | null>(null)

const parameterValues = ref<Record<WaterTestParameter, string>>(createEmptyParameterMap(""))
const parameterErrors = ref<Record<WaterTestParameter, string | null>>(createEmptyParameterMap(null))

const methodInput = ref("")
const noteInput = ref("")

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

const historyStatus = ref<HistoryStatus>("idle")
const historyError = ref<string | null>(null)
const sessions = ref<WaterTestSession[]>([])

const filterDateFrom = ref("")
const filterDateTo = ref("")
const filterParameter = ref("")

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

const parameterOptions = computed(() => {
  const known = WATER_TEST_PARAMETERS.map((item) => item.parameter)
  const unknown = new Set<string>()

  for (const session of sessions.value) {
    for (const measurement of session.measurements) {
      if (!known.includes(measurement.parameter as WaterTestParameter)) unknown.add(measurement.parameter)
    }
  }

  return [...known, ...Array.from(unknown).sort((a, b) => a.localeCompare(b))]
})

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

watch(
  () => tank.value?.spreadsheetId,
  () => {
    loadHistory()
  },
  { immediate: true }
)

function resetForm() {
  dateError.value = null
  submitError.value = null
  submitStatus.value = null
  parameterErrors.value = createEmptyParameterMap(null)
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

  const measurements: Array<{ parameter: WaterTestParameter; value: number; unit: string }> = []

  for (const config of WATER_TEST_PARAMETERS) {
    const raw = parameterValues.value[config.parameter]
    const parsed = parseNumberInput(raw)
    if (parsed === null) continue

    if (config.min !== undefined && parsed < config.min) {
      parameterErrors.value[config.parameter] = t("pages.tests.form.errors.mustBePositive")
      continue
    }

    measurements.push({ parameter: config.parameter, value: parsed, unit: config.unit })
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

    parameterValues.value = createEmptyParameterMap("")
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
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
          {{ $t("pages.tests.form.loadingTanks") }}
        </div>

        <div v-else-if="tanksError" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tanks.length" class="space-y-2">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tank" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </p>
          <Button as-child>
            <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
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
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="config in WATER_TEST_PARAMETERS" :key="config.parameter" class="space-y-2">
                <label :for="`param-${config.parameter}`" class="text-foreground">
                  {{ config.label }}
                  <span class="text-xs text-muted-foreground">({{ config.unit }})</span>
                </label>
                <input
                  :id="`param-${config.parameter}`"
                  v-model="parameterValues[config.parameter]"
                  type="number"
                  inputmode="decimal"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :step="config.step ?? 'any'"
                  :min="config.min"
                  :placeholder="$t('pages.tests.form.placeholders.value')"
                  :aria-invalid="parameterErrors[config.parameter] ? 'true' : 'false'"
                  :aria-describedby="`param-${config.parameter}-feedback`"
                />
                <p v-if="parameterErrors[config.parameter]" :id="`param-${config.parameter}-feedback`" class="text-sm text-destructive" role="alert">
                  {{ parameterErrors[config.parameter] }}
                </p>
                <p v-else :id="`param-${config.parameter}-feedback`" class="sr-only"> </p>
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
            <Button type="submit" :disabled="isSubmitting">
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
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
          {{ $t("pages.tests.history.loadingTanks") }}
        </div>

        <div v-else-if="tanksError" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tanks.length" class="space-y-2">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!tank" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </p>
          <Button as-child>
            <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </div>

        <div v-else class="space-y-4">
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
                  <div class="text-xs text-muted-foreground">
                    {{ $t("pages.tests.history.measurements", { count: session.measurements.length }) }}
                  </div>
                </div>

                <p v-if="session.method || session.note" class="text-xs text-muted-foreground">
                  <span v-if="session.method">{{ $t("pages.tests.history.labels.method") }}: {{ session.method }}</span>
                  <span v-if="session.method && session.note"> · </span>
                  <span v-if="session.note">{{ $t("pages.tests.history.labels.note") }}: {{ session.note }}</span>
                </p>

                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="measurement in session.measurements"
                    :key="measurement.id"
                    class="rounded bg-muted px-2 py-1 text-xs text-foreground"
                  >
                    {{ measurement.parameter }}: {{ formatNumber(measurement.value) }} {{ measurement.unit }}
                  </span>
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

                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <caption class="sr-only">{{ $t("pages.tests.detail.tableCaption") }}</caption>
                    <thead class="text-xs text-muted-foreground">
                      <tr class="border-b border-border">
                        <th scope="col" class="px-2 py-2 text-left font-medium">{{ $t("pages.tests.detail.columns.parameter") }}</th>
                        <th scope="col" class="px-2 py-2 text-right font-medium">{{ $t("pages.tests.detail.columns.value") }}</th>
                        <th scope="col" class="px-2 py-2 text-left font-medium">{{ $t("pages.tests.detail.columns.unit") }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="measurement in selectedSession.measurements" :key="measurement.id" class="border-b border-border/60">
                        <th scope="row" class="px-2 py-2 text-left font-medium">
                          {{ measurement.parameter }}
                        </th>
                        <td class="px-2 py-2 text-right">
                          {{ formatNumber(measurement.value) }}
                        </td>
                        <td class="px-2 py-2 text-left text-muted-foreground">
                          {{ measurement.unit }}
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
          <NuxtLink :to="localePath(`/tank/${tankId}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
        </Button>
        <Button as-child variant="secondary">
          <NuxtLink :to="localePath(`/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

