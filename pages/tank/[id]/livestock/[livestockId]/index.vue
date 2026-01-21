<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

type LoadStatus = "idle" | "loading" | "ready" | "error"

const loadStatus = ref<LoadStatus>("idle")
const loadError = ref<string | null>(null)
const item = ref<TankLivestock | null>(null)

const photosStatus = ref<LoadStatus>("idle")
const photosError = ref<string | null>(null)
const photos = ref<TankPhoto[]>([])

const featuredPhoto = computed(() => photos.value[0] ?? null)

const photoRevision = computed(() => {
  const spreadsheetId = tank.value?.spreadsheetId
  if (!spreadsheetId) return 0
  return photosApi.photoRevisions.value[spreadsheetId] ?? 0
})

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

async function refresh() {
  await Promise.all([loadItem(), loadPhotos()])
}

watch(
  [() => tank.value?.spreadsheetId, () => livestockId.value, photoRevision],
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
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.livestock.detail.title") }}</h1>
        <p class="max-w-prose text-muted-foreground">{{ $t("pages.livestock.detail.description") }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath(`/tank/${tankId}/livestock`)">{{ $t("pages.livestock.actions.backToList") }}</NuxtLink>
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
                <CardTitle>{{ $t("pages.livestock.photos.cardTitle") }}</CardTitle>
                <CardDescription>{{ $t("pages.livestock.photos.cardDescription") }}</CardDescription>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" type="button" :disabled="photosStatus === 'loading'" @click="loadPhotos">
                  <span v-if="photosStatus === 'loading'">{{ $t("pages.photos.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.livestock.photos.actions.refresh") }}</span>
                </Button>
                <PhotoUploadDialog :tank="tank" kind="livestock" :livestock-id="livestockId" @uploaded="loadPhotos" />
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <div v-if="photosStatus === 'loading'">{{ $t("pages.livestock.photos.loading") }}</div>

            <div v-else-if="photosStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.livestock.photos.errors.loadFailed") }}
                <span v-if="photosError">({{ photosError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadPhotos">
                {{ $t("pages.livestock.photos.actions.refresh") }}
              </Button>
            </div>

            <template v-else-if="photosStatus === 'ready'">
              <PhotoTimeline :photos="photos" :alt-for="altForLivestockPhoto" :format-date="formatPhotoDate" @open="openViewer">
                <template #emptyHint>
                  {{ $t("pages.livestock.photos.emptyHint") }}
                </template>
              </PhotoTimeline>
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

