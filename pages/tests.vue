<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { WATER_TEST_PARAMETERS, type WaterTestParameter } from "@/composables/useWaterTests"

const { t } = useI18n()

useHead(() => ({
  title: t("pages.tests.metaTitle"),
}))

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()

const { activeTank } = useActiveTank()
const { status: tanksStatus, error: tanksError } = useTanks()

const waterTests = useWaterTests()

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
  if(typeof value === "number") return value
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

onMounted(() => {
  if (!dateInput.value) dateInput.value = toDatetimeLocalValue(new Date())
})

const isStorageReady = computed(() => storage.hasRootFolderId.value)

function resetForm() {
  dateError.value = null
  submitError.value = null
  submitStatus.value = null
  parameterErrors.value = createEmptyParameterMap(null)
}

function validate() {
  resetForm()

  const tank = activeTank.value
  if (!tank) {
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

  return { tank, date, measurements }
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
            <NuxtLink to="/settings">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
          {{ $t("pages.tests.form.loadingTanks") }}
        </div>

        <div v-else-if="tanksError" class="space-y-2">
          <p class="text-sm text-destructive" role="alert">{{ tanksError }}</p>
          <Button as-child>
            <NuxtLink to="/settings">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </div>

        <div v-else-if="!activeTank" class="space-y-2">
          <p>{{ $t("pages.tests.form.noTanks") }}</p>
          <Button as-child>
            <NuxtLink to="/settings">{{ $t("actions.goToSettings") }}</NuxtLink>
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
                {{ activeTank.name }}
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
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.tests.history.body") }}
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child variant="secondary">
          <NuxtLink to="/photos">{{ $t("actions.goToPhotos") }}</NuxtLink>
        </Button>
        <Button as-child variant="secondary">
          <NuxtLink to="/events">{{ $t("actions.goToEvents") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

