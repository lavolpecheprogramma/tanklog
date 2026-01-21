<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

const actingEventId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionStatus = ref<string | null>(null)

const isEditOpen = ref(false)
const editingEvent = ref<TankEvent | null>(null)

watch(isEditOpen, (open) => {
  if (!open) editingEvent.value = null
})

function coerceEventType(value: string): EventType | null {
  return EVENT_TYPES.includes(value as EventType) ? (value as EventType) : null
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

type EventFormPayload = {
  date: Date
  eventType: EventType
  description: string
  quantity: number | null
  unit: string | null
  product: string | null
  note: string | null
}

function isEventFormPayload(value: unknown): value is EventFormPayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (!(candidate.date instanceof Date)) return false
  if (typeof candidate.eventType !== "string") return false
  if (!EVENT_TYPES.includes(candidate.eventType as EventType)) return false
  if (typeof candidate.description !== "string") return false

  if (candidate.quantity !== null && candidate.quantity !== undefined) {
    if (typeof candidate.quantity !== "number") return false
    if (!Number.isFinite(candidate.quantity)) return false
  }

  if (candidate.unit !== null && candidate.unit !== undefined && typeof candidate.unit !== "string") return false
  if (candidate.product !== null && candidate.product !== undefined && typeof candidate.product !== "string") return false
  if (candidate.note !== null && candidate.note !== undefined && typeof candidate.note !== "string") return false

  return true
}

async function handleCreateEvent(payload: unknown) {
  if (!tank.value) throw new Error(t("pages.events.form.errors.noTank"))
  if (!isEventFormPayload(payload)) throw new Error(t("pages.events.form.errors.saveFailed"))

  await eventsApi.createEvent({
    spreadsheetId: tank.value.spreadsheetId,
    date: payload.date,
    eventType: payload.eventType,
    description: payload.description,
    quantity: payload.quantity,
    unit: payload.unit,
    product: payload.product,
    note: payload.note,
  })

  await loadEvents()
}

function startEdit(event: TankEvent) {
  actionError.value = null
  actionStatus.value = null
  editingEvent.value = event
  isEditOpen.value = true
}

async function handleUpdateEvent(payload: unknown) {
  if (!tank.value) throw new Error(t("pages.events.form.errors.noTank"))
  if (!editingEvent.value) throw new Error(t("pages.events.actions.errors.updateFailed"))
  if (!isEventFormPayload(payload)) throw new Error(t("pages.events.actions.errors.updateFailed"))

  await eventsApi.updateEvent({
    spreadsheetId: tank.value.spreadsheetId,
    eventId: editingEvent.value.eventId,
    date: payload.date,
    eventType: payload.eventType,
    description: payload.description,
    quantity: payload.quantity,
    unit: payload.unit,
    product: payload.product,
    note: payload.note,
  })

  await loadEvents()
  actionStatus.value = t("pages.events.actions.statusUpdated")
}

async function onDeleteEvent(event: TankEvent) {
  if (!tank.value) return

  actionError.value = null
  actionStatus.value = null

  const confirmed = confirm(
    t("pages.events.actions.confirmDelete", {
      description: event.description,
    })
  )
  if (!confirmed) return

  actingEventId.value = event.eventId
  try {
    await eventsApi.deleteEvent({ spreadsheetId: tank.value.spreadsheetId, eventId: event.eventId })
    await loadEvents()
    actionStatus.value = t("pages.events.actions.statusDeleted")
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t("pages.events.actions.errors.deleteFailed")
  } finally {
    actingEventId.value = null
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
        <Dialog v-model:open="isEditOpen">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{{ $t("pages.events.editDialog.title") }}</DialogTitle>
              <DialogDescription>{{ $t("pages.events.editDialog.description") }}</DialogDescription>
            </DialogHeader>

            <div v-if="editingEvent" class="text-sm text-muted-foreground">
              <EventReminderForm
                :id-base="`edit-event-${editingEvent.eventId}`"
                mode="event"
                :submit-label="$t('pages.events.actions.saveChanges')"
                :saving-label="$t('pages.events.actions.savingChanges')"
                :success-message="$t('pages.events.actions.statusUpdated')"
                :reset-after-submit="false"
                :initial-values="{
                  date: editingEvent.date,
                  eventType: coerceEventType(editingEvent.eventType),
                  description: editingEvent.description,
                  quantity: editingEvent.quantity,
                  unit: editingEvent.unit,
                  product: editingEvent.product,
                  note: editingEvent.note,
                }"
                :submit-handler="handleUpdateEvent"
                @success="isEditOpen = false"
              >
                <template #actions>
                  <DialogClose as-child>
                    <Button variant="secondary" type="button">{{ $t("actions.cancel") }}</Button>
                  </DialogClose>
                </template>
              </EventReminderForm>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.events.form.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.events.form.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="text-sm text-muted-foreground">
            <EventReminderForm
              id-base="create-event"
              mode="event"
              :submit-label="$t('pages.events.form.save')"
              :saving-label="$t('pages.events.form.saving')"
              :submit-handler="handleCreateEvent"
            >
              <template #actions>
                <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadEvents">
                  <span v-if="listStatus === 'loading'">{{ $t("pages.events.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.events.list.refresh") }}</span>
                </Button>
              </template>
            </EventReminderForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.events.list.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.events.list.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <p v-if="actionError" class="text-sm text-destructive" role="alert">{{ actionError }}</p>
            <p v-else-if="actionStatus" class="text-sm text-foreground" role="status">{{ actionStatus }}</p>

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

                  <div class="flex flex-wrap items-center gap-2">
                    <div v-if="event.quantity !== null" class="text-right text-sm text-foreground">
                      {{ formatNumber(event.quantity) }}
                      <span v-if="event.unit" class="text-muted-foreground">{{ event.unit }}</span>
                    </div>

                    <Button size="xs" variant="secondary" type="button" :disabled="actingEventId === event.eventId" @click="startEdit(event)">
                      {{ $t("pages.events.actions.edit") }}
                    </Button>
                    <Button size="xs" variant="destructive" type="button" :disabled="actingEventId === event.eventId" @click="onDeleteEvent(event)">
                      {{ $t("pages.events.actions.delete") }}
                    </Button>
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

