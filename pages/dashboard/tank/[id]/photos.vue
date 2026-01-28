<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TankPhoto } from "@/composables/usePhotos"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.photos.metaTitle"),
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

const photosApi = usePhotos()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const photos = ref<TankPhoto[]>([])

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

async function loadPhotos() {
  if (!import.meta.client) return

  if (!tank.value) {
    photos.value = []
    listStatus.value = "idle"
    listError.value = null
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    photos.value = await photosApi.listTankPhotos({ spreadsheetId: tank.value.spreadsheetId })
    listStatus.value = "ready"
  } catch (error) {
    photos.value = []
    listError.value = error instanceof Error ? error.message : t("pages.photos.list.errors.loadFailed")
    listStatus.value = "error"
  }
}

watch([() => tank.value?.spreadsheetId, photoRevision], () => {
  loadPhotos()
}, { immediate: true })

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

const altForTankPhoto = (photo: TankPhoto) => t("pages.photos.timeline.alt.tankPhoto", { date: formatPhotoDate(photo.date) })
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.photos.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.photos.description") }}
      </p>
      <div v-if="tankId" class="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" as-child>
          <NuxtLink :to="localePath(`/dashboard/tank/${tankId}`)">{{ $t("actions.backToTank") }}</NuxtLink>
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
        {{ $t("pages.photos.loadingTanks") }}
      </div>

      <Card v-else-if="!tanks.length">
        <CardHeader>
          <CardTitle>{{ $t("pages.photos.noTanks.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.photos.noTanks.description") }}</CardDescription>
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

      <Card v-else>
        <CardHeader>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
              <CardTitle>{{ $t("pages.photos.timeline.title") }}</CardTitle>
              <CardDescription>{{ $t("pages.photos.timeline.description") }}</CardDescription>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" type="button" :disabled="listStatus === 'loading'" @click="loadPhotos">
                <span v-if="listStatus === 'loading'">{{ $t("pages.photos.list.refreshing") }}</span>
                <span v-else>{{ $t("pages.photos.list.refresh") }}</span>
              </Button>

              <PhotoUploadDialog :tank="tank" kind="tank" @uploaded="loadPhotos" />
            </div>
          </div>
        </CardHeader>

        <CardContent class="space-y-4 text-sm text-muted-foreground">
          <div v-if="listStatus === 'loading'">{{ $t("pages.photos.list.loading") }}</div>

          <div v-else-if="listStatus === 'error'" class="space-y-2">
            <p class="text-sm text-destructive" role="alert">
              {{ $t("pages.photos.list.errors.loadFailed") }}
              <span v-if="listError">({{ listError }})</span>
            </p>
            <Button variant="secondary" size="sm" type="button" @click="loadPhotos">
              {{ $t("pages.photos.list.refresh") }}
            </Button>
          </div>

          <template v-else-if="listStatus === 'ready'">
            <PhotoTimeline :photos="photos" :alt-for="altForTankPhoto" :format-date="formatPhotoDate" @open="openViewer" />
          </template>
        </CardContent>
      </Card>

      <Dialog v-model:open="isViewerOpen">
        <DialogContent class="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {{ viewerPhoto ? formatPhotoDate(viewerPhoto.date) : $t("pages.photos.title") }}
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
                :alt="altForTankPhoto(viewerPhoto)"
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
  </section>
</template>

