<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { EVENT_TYPES, type EventType, type TankEvent } from "@/composables/useEvents"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.events.metaTitle"),
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

const eventsApi = useEvents()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const events = ref<TankEvent[]>([])

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

function formatEventDate(value: string): string {
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
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
  } catch {
    return String(value)
  }
}

function eventTypeLabel(value: string): string {
  if (value === "water_change" || value === "dosing" || value === "maintenance" || value === "livestock_addition" || value === "livestock_removal") {
    return t(`pages.events.types.${value}`)
  }
  return value
}

async function loadEvents() {
  if (!import.meta.client) return

  if (!tank.value) {
    events.value = []
    listStatus.value = "idle"
    listError.value = null
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    events.value = await eventsApi.listEvents({ spreadsheetId: tank.value.spreadsheetId })
    listStatus.value = "ready"
  } catch (error) {
    events.value = []
    listError.value = error instanceof Error ? error.message : t("pages.events.list.errors.loadFailed")
    listStatus.value = "error"
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    loadEvents()
  },
  { immediate: true }
)

const dateInput = ref("")
const dateError = ref<string | null>(null)

const eventTypeInput = ref<EventType | "">("")
const eventTypeError = ref<string | null>(null)

const descriptionInput = ref("")
const descriptionError = ref<string | null>(null)

const quantityInput = ref("")
const quantityError = ref<string | null>(null)

const unitInput = ref("")
const productInput = ref("")
const noteInput = ref("")

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

onMounted(() => {
  if (!dateInput.value) dateInput.value = toDatetimeLocalValue(new Date())
})

watch(eventTypeInput, (value) => {
  if (value === "water_change" && !unitInput.value.trim()) unitInput.value = "L"
  if (value === "dosing" && !unitInput.value.trim()) unitInput.value = "ml"
})

function resetFormErrors() {
  dateError.value = null
  eventTypeError.value = null
  descriptionError.value = null
  quantityError.value = null
  submitError.value = null
  submitStatus.value = null
}

function validate() {
  resetFormErrors()

  if (!tank.value) {
    submitError.value = t("pages.events.form.errors.noTank")
    return null
  }

  if (!dateInput.value) {
    dateError.value = t("pages.events.form.errors.missingDate")
    return null
  }

  const date = new Date(dateInput.value)
  if (Number.isNaN(date.getTime())) {
    dateError.value = t("pages.events.form.errors.invalidDate")
    return null
  }

  const eventType = eventTypeInput.value
  if (!eventType) {
    eventTypeError.value = t("pages.events.form.errors.missingType")
    return null
  }

  const description = descriptionInput.value.trim()
  if (!description) {
    descriptionError.value = t("pages.events.form.errors.missingDescription")
    return null
  }

  const quantity = parseNumberInput(quantityInput.value)
  if (quantity !== null && quantity < 0) {
    quantityError.value = t("pages.events.form.errors.invalidQuantity")
    return null
  }

  return {
    tank: tank.value,
    date,
    eventType,
    description,
    quantity,
    unit: unitInput.value,
    product: productInput.value,
    note: noteInput.value,
  }
}

async function onSubmit() {
  submitError.value = null
  submitStatus.value = null

  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    await eventsApi.createEvent({
      spreadsheetId: validated.tank.spreadsheetId,
      date: validated.date,
      eventType: validated.eventType,
      description: validated.description,
      quantity: validated.quantity,
      unit: validated.unit,
      product: validated.product,
      note: validated.note,
    })

    await loadEvents()

    eventTypeInput.value = ""
    descriptionInput.value = ""
    quantityInput.value = ""
    unitInput.value = ""
    productInput.value = ""
    noteInput.value = ""
    submitStatus.value = t("pages.events.form.success.saved")
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : t("pages.events.form.errors.saveFailed")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.events.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.events.description") }}
      </p>
    </div>

    <Card v-if="!isStorageReady">
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.events.locked") }}
      </CardContent>
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
        {{ $t("pages.events.loadingTanks") }}
      </div>

      <Card v-else-if="!tanks.length">
        <CardHeader>
          <CardTitle>{{ $t("pages.events.noTanks.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.events.noTanks.description") }}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button as-child>
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

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
            <CardTitle>{{ $t("pages.events.form.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.events.form.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="text-sm text-muted-foreground">
            <form class="space-y-5" @submit.prevent="onSubmit">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="event-date" class="text-foreground">{{ $t("pages.events.form.fields.date") }}</label>
                  <input
                    id="event-date"
                    v-model="dateInput"
                    type="datetime-local"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :aria-invalid="dateError ? 'true' : 'false'"
                    aria-describedby="event-date-hint event-date-feedback"
                    required
                  />
                  <p id="event-date-hint" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.date") }}</p>
                  <p v-if="dateError" id="event-date-feedback" class="text-sm text-destructive" role="alert">
                    {{ dateError }}
                  </p>
                  <p v-else id="event-date-feedback" class="sr-only"> </p>
                </div>

                <div class="space-y-2">
                  <label for="event-type" class="text-foreground">{{ $t("pages.events.form.fields.type") }}</label>
                  <select
                    id="event-type"
                    v-model="eventTypeInput"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :aria-invalid="eventTypeError ? 'true' : 'false'"
                    aria-describedby="event-type-hint event-type-feedback"
                    required
                  >
                    <option value="">{{ $t("pages.events.form.placeholders.type") }}</option>
                    <option v-for="type in EVENT_TYPES" :key="type" :value="type">
                      {{ $t(`pages.events.types.${type}`) }}
                    </option>
                  </select>
                  <p id="event-type-hint" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.type") }}</p>
                  <p v-if="eventTypeError" id="event-type-feedback" class="text-sm text-destructive" role="alert">
                    {{ eventTypeError }}
                  </p>
                  <p v-else id="event-type-feedback" class="sr-only"> </p>
                </div>
              </div>

              <div class="space-y-2">
                <label for="event-description" class="text-foreground">{{ $t("pages.events.form.fields.description") }}</label>
                <input
                  id="event-description"
                  v-model="descriptionInput"
                  type="text"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.events.form.placeholders.description')"
                  :aria-invalid="descriptionError ? 'true' : 'false'"
                  aria-describedby="event-description-hint event-description-feedback"
                  required
                />
                <p id="event-description-hint" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.description") }}</p>
                <p v-if="descriptionError" id="event-description-feedback" class="text-sm text-destructive" role="alert">
                  {{ descriptionError }}
                </p>
                <p v-else id="event-description-feedback" class="sr-only"> </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="event-quantity" class="text-foreground">{{ $t("pages.events.form.fields.quantity") }}</label>
                  <input
                    id="event-quantity"
                    v-model="quantityInput"
                    type="number"
                    inputmode="decimal"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.events.form.placeholders.quantity')"
                    :aria-invalid="quantityError ? 'true' : 'false'"
                    aria-describedby="event-quantity-hint event-quantity-feedback"
                  />
                  <p id="event-quantity-hint" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.quantity") }}</p>
                  <p v-if="quantityError" id="event-quantity-feedback" class="text-sm text-destructive" role="alert">
                    {{ quantityError }}
                  </p>
                  <p v-else id="event-quantity-feedback" class="sr-only"> </p>
                </div>

                <div class="space-y-2">
                  <label for="event-unit" class="text-foreground">{{ $t("pages.events.form.fields.unit") }}</label>
                  <input
                    id="event-unit"
                    v-model="unitInput"
                    type="text"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.events.form.placeholders.unit')"
                  />
                  <p class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.unit") }}</p>
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="event-product" class="text-foreground">{{ $t("pages.events.form.fields.product") }}</label>
                  <input
                    id="event-product"
                    v-model="productInput"
                    type="text"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.events.form.placeholders.product')"
                  />
                </div>

                <div class="space-y-2">
                  <label for="event-note" class="text-foreground">{{ $t("pages.events.form.fields.note") }}</label>
                  <input
                    id="event-note"
                    v-model="noteInput"
                    type="text"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.events.form.placeholders.note')"
                  />
                </div>
              </div>

              <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
              <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

              <div class="flex flex-wrap gap-2">
                <Button type="submit" :disabled="isSubmitting">
                  <span v-if="isSubmitting">{{ $t("pages.events.form.saving") }}</span>
                  <span v-else>{{ $t("pages.events.form.save") }}</span>
                </Button>
                <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadEvents">
                  <span v-if="listStatus === 'loading'">{{ $t("pages.events.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.events.list.refresh") }}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.events.list.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.events.list.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <div v-if="listStatus === 'loading'">{{ $t("pages.events.list.loading") }}</div>

            <div v-else-if="listStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.events.list.errors.loadFailed") }}
                <span v-if="listError">({{ listError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadEvents">
                {{ $t("pages.events.list.refresh") }}
              </Button>
            </div>

            <div v-else-if="listStatus === 'ready' && !events.length" class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ $t("pages.events.list.empty") }}</p>
              <p class="text-xs text-muted-foreground">{{ $t("pages.events.list.emptyHint") }}</p>
            </div>

            <ul
              v-else-if="listStatus === 'ready'"
              role="list"
              class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
            >
              <li v-for="event in events" :key="event.eventId" class="px-4 py-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="space-y-1">
                    <div class="font-medium">{{ eventTypeLabel(event.eventType) }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ formatEventDate(event.date) }}
                    </div>
                  </div>

                  <div v-if="event.quantity !== null" class="text-right text-sm text-foreground">
                    {{ formatNumber(event.quantity) }}
                    <span v-if="event.unit" class="text-muted-foreground">{{ event.unit }}</span>
                  </div>
                </div>

                <p class="mt-2 text-sm text-foreground">
                  {{ event.description }}
                </p>

                <p v-if="event.product || event.note" class="mt-1 text-xs text-muted-foreground">
                  <span v-if="event.product">{{ $t("pages.events.list.labels.product") }}: {{ event.product }}</span>
                  <span v-if="event.product && event.note"> · </span>
                  <span v-if="event.note">{{ $t("pages.events.list.labels.note") }}: {{ event.note }}</span>
                </p>
              </li>
            </ul>
          </CardContent>
          <CardFooter class="flex flex-wrap gap-2">
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}`)">{{ $t("nav.overview") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/tests`)">{{ $t("actions.goToWaterTests") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/reminders`)">{{ $t("actions.goToReminders") }}</NuxtLink>
            </Button>
          </CardFooter>
        </Card>
      </template>
    </template>
  </section>
</template>

