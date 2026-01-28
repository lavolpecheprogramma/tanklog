<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EVENT_TYPES, LIVESTOCK_EVENT_TYPES, type EventType, type TankEvent } from "@/composables/useEvents"
import type { TankLivestock } from "@/composables/useLivestock"
import type { TankPhoto } from "@/composables/usePhotos"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.livestock.detail.title"),
}))

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})
const livestockId = computed(() => {
  const raw = route.params.livestockId
  return Array.isArray(raw) ? raw[0] : raw
})

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const isStorageReady = computed(() => storage.hasRootFolderId.value)

const { tanks, status: tanksStatus, error: tanksError } = useTanks()
const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

const livestockApi = useLivestock()
const photosApi = usePhotos()
const eventsApi = useEvents()

type LoadStatus = "idle" | "loading" | "ready" | "error"

const loadStatus = ref<LoadStatus>("idle")
const loadError = ref<string | null>(null)
const item = ref<TankLivestock | null>(null)

const photosStatus = ref<LoadStatus>("idle")
const photosError = ref<string | null>(null)
const photos = ref<TankPhoto[]>([])

const eventsStatus = ref<LoadStatus>("idle")
const eventsError = ref<string | null>(null)
const livestockEvents = ref<TankEvent[]>([])

const featuredPhoto = computed(() => photos.value[0] ?? null)

const photoRevision = computed(() => {
  const spreadsheetId = tank.value?.spreadsheetId
  if (!spreadsheetId) return 0
  return photosApi.photoRevisions.value[spreadsheetId] ?? 0
})

const eventRevision = computed(() => {
  const spreadsheetId = tank.value?.spreadsheetId
  if (!spreadsheetId) return 0
  return eventsApi.eventRevisions.value[spreadsheetId] ?? 0
})

const isTimelineBusy = computed(() => photosStatus.value === "loading" || eventsStatus.value === "loading")

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatPhotoDate(value: string): string {
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

async function loadItem() {
  if (!import.meta.client) return

  if (!tank.value || !livestockId.value) {
    item.value = null
    loadStatus.value = "idle"
    loadError.value = null
    return
  }

  loadStatus.value = "loading"
  loadError.value = null

  try {
    const all = await livestockApi.listLivestock({ spreadsheetId: tank.value.spreadsheetId })
    item.value = all.find((row) => row.livestockId === livestockId.value) ?? null
    if (!item.value) {
      loadStatus.value = "error"
      loadError.value = t("pages.livestock.detail.notFound")
      return
    }
    loadStatus.value = "ready"
  } catch (error) {
    item.value = null
    loadStatus.value = "error"
    loadError.value = error instanceof Error ? error.message : t("pages.livestock.form.errors.saveFailed")
  }
}

async function loadPhotos() {
  if (!import.meta.client) return

  if (!tank.value || !livestockId.value) {
    photos.value = []
    photosStatus.value = "idle"
    photosError.value = null
    return
  }

  photosStatus.value = "loading"
  photosError.value = null

  try {
    photos.value = await photosApi.listLivestockPhotos({ spreadsheetId: tank.value.spreadsheetId, livestockId: livestockId.value })
    photosStatus.value = "ready"
  } catch (error) {
    photos.value = []
    photosStatus.value = "error"
    photosError.value = error instanceof Error ? error.message : t("pages.photos.list.errors.loadFailed")
  }
}

async function loadEvents() {
  if (!import.meta.client) return

  if (!tank.value || !livestockId.value) {
    livestockEvents.value = []
    eventsStatus.value = "idle"
    eventsError.value = null
    return
  }

  eventsStatus.value = "loading"
  eventsError.value = null

  try {
    const all = await eventsApi.listEvents({ spreadsheetId: tank.value.spreadsheetId })
    livestockEvents.value = all.filter((event) => event.targetType === "livestock" && event.targetId === livestockId.value)
    eventsStatus.value = "ready"
  } catch (error) {
    livestockEvents.value = []
    eventsStatus.value = "error"
    eventsError.value = error instanceof Error ? error.message : t("pages.events.list.errors.loadFailed")
  }
}

async function refresh() {
  await Promise.all([loadItem(), loadPhotos(), loadEvents()])
}

watch(
  [() => tank.value?.spreadsheetId, () => livestockId.value, photoRevision, eventRevision],
  () => {
    void refresh()
  },
  { immediate: true }
)

const isViewerOpen = ref(false)
const viewerPhotoId = ref<string | null>(null)

const viewerIndex = computed(() => {
  if (!viewerPhotoId.value) return -1
  return photos.value.findIndex((photo) => photo.photoId === viewerPhotoId.value)
})

const viewerPhoto = computed(() => (viewerIndex.value >= 0 ? photos.value[viewerIndex.value] ?? null : null))

const hasViewerPrevious = computed(() => viewerIndex.value > 0)
const hasViewerNext = computed(() => viewerIndex.value >= 0 && viewerIndex.value < photos.value.length - 1)

function openViewer(photo: TankPhoto) {
  if (!import.meta.client) return
  viewerPhotoId.value = photo.photoId
  isViewerOpen.value = true
}

function goViewerPrevious() {
  const currentIndex = viewerIndex.value
  if (currentIndex <= 0) return
  const photo = photos.value[currentIndex - 1]
  if (!photo) return
  viewerPhotoId.value = photo.photoId
}

function goViewerNext() {
  const currentIndex = viewerIndex.value
  if (currentIndex < 0) return
  const photo = photos.value[currentIndex + 1]
  if (!photo) return
  viewerPhotoId.value = photo.photoId
}

watch(isViewerOpen, (open) => {
  if (open) return
  viewerPhotoId.value = null
})

const altForLivestockPhoto = (photo: TankPhoto) =>
  t("pages.livestock.photos.alt.photo", { name: item.value?.nameCommon || livestockId.value || "—", date: formatPhotoDate(photo.date) })

type ActivityTimelineItem =
  | { kind: "photo"; id: string; date: string; photo: TankPhoto }
  | { kind: "event"; id: string; date: string; event: TankEvent }

const timelineItems = computed<ActivityTimelineItem[]>(() => {
  const items: ActivityTimelineItem[] = []

  for (const photo of photos.value) {
    items.push({ kind: "photo", id: photo.photoId, date: photo.date, photo })
  }

  for (const event of livestockEvents.value) {
    items.push({ kind: "event", id: event.eventId, date: event.date, event })
  }

  items.sort((a, b) => (toEpochMs(b.date) ?? -Infinity) - (toEpochMs(a.date) ?? -Infinity))
  return items
})

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

const isCreateEventOpen = ref(false)

async function handleCreateLivestockEvent(payload: unknown) {
  if (!tank.value) throw new Error(t("pages.events.form.errors.noTank"))
  if (!livestockId.value) throw new Error(t("pages.livestock.detail.notFound"))
  if (!isEventFormPayload(payload)) throw new Error(t("pages.events.form.errors.saveFailed"))

  await eventsApi.createEvent({
    spreadsheetId: tank.value.spreadsheetId,
    date: payload.date,
    targetType: "livestock",
    targetId: livestockId.value,
    eventType: payload.eventType,
    description: payload.description,
    quantity: null,
    unit: null,
    product: null,
    note: payload.note,
  })

  await loadEvents()
}

type LivestockFormPayload = {
  nameCommon: string
  nameScientific: string | null
  category: TankLivestock["category"]
  subCategory: string | null
  tankZone: TankLivestock["tankZone"]
  origin: TankLivestock["origin"]
  dateAdded: string
  dateRemoved: string | null
  status: TankLivestock["status"]
  notes: string | null
}

async function handleUpdate(payload: LivestockFormPayload) {
  if (!tank.value) throw new Error(t("pages.livestock.form.errors.saveFailed"))
  if (!item.value) throw new Error(t("pages.livestock.detail.notFound"))

  const updated = await livestockApi.updateLivestock({
    spreadsheetId: tank.value.spreadsheetId,
    livestockId: item.value.livestockId,
    nameCommon: payload.nameCommon,
    nameScientific: payload.nameScientific,
    category: payload.category,
    subCategory: payload.subCategory,
    tankZone: payload.tankZone,
    origin: payload.origin,
    dateAdded: payload.dateAdded,
    dateRemoved: payload.dateRemoved,
    status: payload.status,
    notes: payload.notes,
  })

  item.value = updated
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.livestock.detail.title") }}</h1>
        <p class="max-w-prose text-muted-foreground">{{ $t("pages.livestock.detail.description") }}</p>
        <div v-if="tankId" class="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" as-child>
            <NuxtLink :to="localePath(`/dashboard/tank/${tankId}`)">{{ $t("actions.backToTank") }}</NuxtLink>
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/livestock`)">{{ $t("pages.livestock.actions.backToList") }}</NuxtLink>
        </Button>
      </div>
    </div>

    <Card v-if="!isStorageReady">
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.photos.locked") }}
      </CardContent>
      <CardFooter>
        <Button as-child>
          <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
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
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
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
            <NuxtLink :to="localePath('/dashboard')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle>{{ item?.nameCommon || $t("pages.livestock.detail.title") }}</CardTitle>
            <CardDescription>
              <span v-if="item">
                <span class="font-medium text-foreground">ID:</span>
                <code class="ml-2 rounded bg-muted px-1 py-0.5">{{ item.livestockId }}</code>
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <div v-if="loadStatus === 'loading'">{{ $t("pages.livestock.detail.loading") }}</div>

            <div v-else-if="loadStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ loadError || $t("pages.livestock.detail.notFound") }}
              </p>
              <Button variant="secondary" size="sm" type="button" @click="refresh">
                {{ $t("pages.livestock.list.refresh") }}
              </Button>
            </div>

            <div v-else-if="loadStatus === 'ready' && item" class="text-sm text-muted-foreground">
              <LivestockForm
                :id-base="`edit-livestock-${item.livestockId}`"
                :submit-label="$t('pages.livestock.form.save')"
                :saving-label="$t('pages.livestock.form.saving')"
                :success-message="$t('pages.livestock.form.success.saved')"
                :reset-after-submit="false"
                :initial-values="{
                  nameCommon: item.nameCommon,
                  nameScientific: item.nameScientific,
                  category: item.category,
                  subCategory: item.subCategory,
                  tankZone: item.tankZone,
                  origin: item.origin,
                  dateAdded: item.dateAdded,
                  dateRemoved: item.dateRemoved,
                  status: item.status,
                  notes: item.notes,
                }"
                :submit-handler="handleUpdate"
                @success="refresh"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <CardTitle>{{ $t("pages.livestock.timeline.cardTitle") }}</CardTitle>
                <CardDescription>{{ $t("pages.livestock.timeline.cardDescription") }}</CardDescription>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" type="button" :disabled="isTimelineBusy" @click="refresh">
                  <span v-if="isTimelineBusy">{{ $t("pages.photos.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.livestock.timeline.actions.refresh") }}</span>
                </Button>

                <Dialog v-model:open="isCreateEventOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" type="button">{{ $t("pages.livestock.timeline.actions.addEvent") }}</Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{{ $t("pages.livestock.timeline.eventDialog.title") }}</DialogTitle>
                      <DialogDescription>{{ $t("pages.livestock.timeline.eventDialog.description") }}</DialogDescription>
                    </DialogHeader>

                    <div class="text-sm text-muted-foreground">
                      <EventReminderForm
                        id-base="create-livestock-event"
                        mode="event"
                        :submit-label="$t('pages.events.form.save')"
                        :saving-label="$t('pages.events.form.saving')"
                        :event-types="LIVESTOCK_EVENT_TYPES"
                        :show-quantity-unit-product-fields="false"
                        :submit-handler="handleCreateLivestockEvent"
                        @success="isCreateEventOpen = false"
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

                <PhotoUploadDialog :tank="tank" kind="livestock" :livestock-id="livestockId" @uploaded="loadPhotos" />
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <div v-if="isTimelineBusy">{{ $t("pages.livestock.timeline.loading") }}</div>

            <div v-if="eventsStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.events.list.errors.loadFailed") }}
                <span v-if="eventsError">({{ eventsError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadEvents">
                {{ $t("pages.livestock.timeline.actions.refresh") }}
              </Button>
            </div>

            <div v-if="photosStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.livestock.photos.errors.loadFailed") }}
                <span v-if="photosError">({{ photosError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadPhotos">
                {{ $t("pages.livestock.timeline.actions.refresh") }}
              </Button>
            </div>

            <template v-if="eventsStatus === 'ready' || photosStatus === 'ready'">
              <ActivityTimeline :items="timelineItems" :alt-for-photo="altForLivestockPhoto" :format-date="formatPhotoDate" @open-photo="openViewer" />
            </template>
          </CardContent>
        </Card>

        <Dialog v-model:open="isViewerOpen">
          <DialogContent class="max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                {{ viewerPhoto ? formatPhotoDate(viewerPhoto.date) : $t("pages.livestock.photos.title") }}
              </DialogTitle>
              <DialogDescription>
                <span v-if="viewerPhoto?.note">{{ viewerPhoto.note }}</span>
                <span v-else>{{ $t("pages.photos.viewer.description") }}</span>
              </DialogDescription>
            </DialogHeader>

            <div v-if="viewerPhoto" class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" type="button" :disabled="!hasViewerPrevious" @click="goViewerPrevious">
                    {{ $t("pages.photos.timeline.actions.previous") }}
                  </Button>
                  <Button variant="secondary" size="sm" type="button" :disabled="!hasViewerNext" @click="goViewerNext">
                    {{ $t("pages.photos.timeline.actions.next") }}
                  </Button>
                </div>

                <a
                  class="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                  :href="viewerPhoto.driveUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ $t("pages.photos.list.labels.openInDrive") }}
                </a>
              </div>

              <div class="overflow-hidden rounded-md border border-border bg-muted">
                <DrivePhoto
                  :file-id="viewerPhoto.driveFileId"
                  :alt="altForLivestockPhoto(viewerPhoto)"
                  fit="contain"
                  :lazy="false"
                  img-class="max-h-[70vh] w-full"
                  show-error-details
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </template>
    </template>
  </section>
</template>

