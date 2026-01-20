<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TankPhoto } from "@/composables/usePhotos"
import { normalizeImageBlobForBrowser } from "@/lib/images"

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
const drive = useGoogleDrive()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const photos = ref<TankPhoto[]>([])

type PreviewStatus = "idle" | "loading" | "ready" | "error"
type PhotoPreview = {
  status: PreviewStatus
  objectUrl: string | null
  error: string | null
}

const previewByPhotoId = reactive<Record<string, PhotoPreview>>({})
const previewGeneration = ref(0)

function getPreview(photoId: string): PhotoPreview {
  const existing = previewByPhotoId[photoId]
  if (existing) return existing
  const created: PhotoPreview = { status: "idle", objectUrl: null, error: null }
  previewByPhotoId[photoId] = created
  // Return the reactive proxy so later mutations trigger UI updates.
  return previewByPhotoId[photoId]!
}

function revokeObjectUrl(url: string | null) {
  if (!import.meta.client) return
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

function resetAllPreviews() {
  if (!import.meta.client) return
  previewGeneration.value += 1
  for (const preview of Object.values(previewByPhotoId)) {
    revokeObjectUrl(preview.objectUrl)
  }
  for (const key of Object.keys(previewByPhotoId)) {
    delete previewByPhotoId[key]
  }
}

function prunePreviews(validIds: Set<string>) {
  if (!import.meta.client) return
  for (const [photoId, preview] of Object.entries(previewByPhotoId)) {
    if (validIds.has(photoId)) continue
    revokeObjectUrl(preview.objectUrl)
    delete previewByPhotoId[photoId]
  }
}

async function ensurePreview(photo: TankPhoto) {
  if (!import.meta.client) return
  const preview = getPreview(photo.photoId)
  if (preview.status === "loading" || preview.status === "ready") return

  const generation = previewGeneration.value
  preview.status = "loading"
  preview.error = null

  try {
    const blob = await drive.downloadFile({ fileId: photo.driveFileId })
    const normalized = await normalizeImageBlobForBrowser(blob)
    const objectUrl = URL.createObjectURL(normalized.blob)
    if (generation !== previewGeneration.value) {
      revokeObjectUrl(objectUrl)
      return
    }

    revokeObjectUrl(preview.objectUrl)
    preview.objectUrl = objectUrl
    preview.status = "ready"
  } catch (error) {
    preview.error = error instanceof Error ? error.message : t("pages.photos.timeline.errors.previewFailed")
    preview.status = "error"
  }
}

function onPreviewImageError(photoId: string) {
  const preview = getPreview(photoId)
  preview.error = preview.error || t("pages.photos.timeline.errors.previewFailed")
  preview.status = "error"
  revokeObjectUrl(preview.objectUrl)
  preview.objectUrl = null
}

const viewMode = ref<"gallery" | "list">("gallery")

const compareSelection = ref<string[]>([])
const isCompareOpen = ref(false)
const compareMode = ref<"sideBySide" | "toggle">("sideBySide")
const compareToggleIndex = ref<0 | 1>(0)

function isCompareSelected(photoId: string): boolean {
  return compareSelection.value.includes(photoId)
}

function toggleCompare(photo: TankPhoto) {
  const ids = compareSelection.value
  const existingIndex = ids.indexOf(photo.photoId)
  if (existingIndex >= 0) {
    ids.splice(existingIndex, 1)
    return
  }

  if (ids.length >= 2) {
    ids.shift()
  }
  ids.push(photo.photoId)
  void ensurePreview(photo)
}

function clearCompareSelection() {
  compareSelection.value = []
  compareToggleIndex.value = 0
}

const comparePhotos = computed(() =>
  compareSelection.value
    .map((photoId) => photos.value.find((photo) => photo.photoId === photoId) ?? null)
    .filter((photo): photo is TankPhoto => photo !== null),
)

const comparePhotoA = computed(() => comparePhotos.value[0] ?? null)
const comparePhotoB = computed(() => comparePhotos.value[1] ?? null)

const comparePreviewA = computed(() => (comparePhotoA.value ? getPreview(comparePhotoA.value.photoId) : null))
const comparePreviewB = computed(() => (comparePhotoB.value ? getPreview(comparePhotoB.value.photoId) : null))

function openCompareDialog() {
  isCompareOpen.value = true
  compareToggleIndex.value = 0
  const first = comparePhotoA.value
  const second = comparePhotoB.value
  if (first) void ensurePreview(first)
  if (second) void ensurePreview(second)
}

function swapCompareSelection() {
  if (compareSelection.value.length !== 2) return
  compareSelection.value = [compareSelection.value[1], compareSelection.value[0]]
  compareToggleIndex.value = 0
}

function toggleComparePreview() {
  compareToggleIndex.value = compareToggleIndex.value === 0 ? 1 : 0
}

const isViewerOpen = ref(false)
const viewerPhotoId = ref<string | null>(null)

const viewerIndex = computed(() => {
  if (!viewerPhotoId.value) return -1
  return photos.value.findIndex((photo) => photo.photoId === viewerPhotoId.value)
})

const viewerPhoto = computed(() => (viewerIndex.value >= 0 ? photos.value[viewerIndex.value] ?? null : null))
const viewerPreview = computed(() => (viewerPhoto.value ? getPreview(viewerPhoto.value.photoId) : null))

const hasViewerPrevious = computed(() => viewerIndex.value > 0)
const hasViewerNext = computed(() => viewerIndex.value >= 0 && viewerIndex.value < photos.value.length - 1)

function openViewer(photo: TankPhoto) {
  if (!import.meta.client) return
  viewerPhotoId.value = photo.photoId
  isViewerOpen.value = true
  void ensurePreview(photo)
}

function goViewerPrevious() {
  const currentIndex = viewerIndex.value
  if (currentIndex <= 0) return
  const targetIndex = currentIndex - 1
  const photo = photos.value[targetIndex]
  if (!photo) return
  viewerPhotoId.value = photo.photoId
  void ensurePreview(photo)
}

function goViewerNext() {
  const currentIndex = viewerIndex.value
  if (currentIndex < 0) return
  const targetIndex = currentIndex + 1
  const photo = photos.value[targetIndex]
  if (!photo) return
  viewerPhotoId.value = photo.photoId
  void ensurePreview(photo)
}

function resetTimelineState() {
  if (!import.meta.client) return
  isViewerOpen.value = false
  viewerPhotoId.value = null
  isCompareOpen.value = false
  compareSelection.value = []
  compareMode.value = "sideBySide"
  compareToggleIndex.value = 0
  resetAllPreviews()
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
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

async function loadPhotos() {
  if (!import.meta.client) return

  if (!tank.value) {
    photos.value = []
    listStatus.value = "idle"
    listError.value = null
    clearCompareSelection()
    isCompareOpen.value = false
    isViewerOpen.value = false
    viewerPhotoId.value = null
    resetAllPreviews()
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    photos.value = await photosApi.listTankPhotos({ spreadsheetId: tank.value.spreadsheetId })
    listStatus.value = "ready"

    const validIds = new Set(photos.value.map((photo) => photo.photoId))
    prunePreviews(validIds)
    compareSelection.value = compareSelection.value.filter((photoId) => validIds.has(photoId))

    if (viewerPhotoId.value && !validIds.has(viewerPhotoId.value)) {
      isViewerOpen.value = false
      viewerPhotoId.value = null
    }

    for (const photo of photos.value.slice(0, 4)) {
      void ensurePreview(photo)
    }
  } catch (error) {
    photos.value = []
    listError.value = error instanceof Error ? error.message : t("pages.photos.list.errors.loadFailed")
    listStatus.value = "error"
    clearCompareSelection()
    isCompareOpen.value = false
    isViewerOpen.value = false
    viewerPhotoId.value = null
    prunePreviews(new Set())
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    resetTimelineState()
    loadPhotos()
  },
  { immediate: true }
)

const dateInput = ref("")
const dateError = ref<string | null>(null)

const noteInput = ref("")

const fileInputEl = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref<string | null>(null)

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

onMounted(() => {
  if (!dateInput.value) dateInput.value = toDatetimeLocalValue(new Date())
})

watch(
  isViewerOpen,
  (open) => {
    if (open) return
    viewerPhotoId.value = null
  },
)

watch(
  isCompareOpen,
  (open) => {
    if (open) return
    compareMode.value = "sideBySide"
    compareToggleIndex.value = 0
  },
)

onBeforeUnmount(() => {
  resetAllPreviews()
})

function resetFormErrors() {
  dateError.value = null
  fileError.value = null
  submitError.value = null
  submitStatus.value = null
}

function onFileChange(event: Event) {
  fileError.value = null
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  selectedFile.value = file
}

function validate() {
  resetFormErrors()

  if (!tank.value) {
    submitError.value = t("pages.photos.form.errors.noTank")
    return null
  }

  if (!dateInput.value) {
    dateError.value = t("pages.photos.form.errors.missingDate")
    return null
  }

  const date = new Date(dateInput.value)
  if (Number.isNaN(date.getTime())) {
    dateError.value = t("pages.photos.form.errors.invalidDate")
    return null
  }

  const file = selectedFile.value
  if (!file) {
    fileError.value = t("pages.photos.form.errors.missingFile")
    return null
  }

  if (!file.type || !file.type.startsWith("image/")) {
    fileError.value = t("pages.photos.form.errors.invalidFile")
    return null
  }

  return {
    tank: tank.value,
    date,
    file,
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
    await photosApi.uploadTankPhoto({
      spreadsheetId: validated.tank.spreadsheetId,
      tankFolderId: validated.tank.folderId,
      file: validated.file,
      date: validated.date,
      note: validated.note,
    })

    await loadPhotos()

    selectedFile.value = null
    if (fileInputEl.value) fileInputEl.value.value = ""
    noteInput.value = ""
    submitStatus.value = t("pages.photos.form.success.saved")
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : t("pages.photos.form.errors.saveFailed")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.photos.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.photos.description") }}
      </p>
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
        {{ $t("pages.photos.loadingTanks") }}
      </div>

      <Card v-else-if="!tanks.length">
        <CardHeader>
          <CardTitle>{{ $t("pages.photos.noTanks.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.photos.noTanks.description") }}</CardDescription>
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
            <CardTitle>{{ $t("pages.photos.form.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.photos.form.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="text-sm text-muted-foreground">
            <form class="space-y-5" @submit.prevent="onSubmit">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="photo-date" class="text-foreground">{{ $t("pages.photos.form.fields.date") }}</label>
                  <input
                    id="photo-date"
                    v-model="dateInput"
                    type="datetime-local"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :aria-invalid="dateError ? 'true' : 'false'"
                    aria-describedby="photo-date-hint photo-date-feedback"
                    required
                  />
                  <p id="photo-date-hint" class="text-xs text-muted-foreground">{{ $t("pages.photos.form.hints.date") }}</p>
                  <p v-if="dateError" id="photo-date-feedback" class="text-sm text-destructive" role="alert">
                    {{ dateError }}
                  </p>
                  <p v-else id="photo-date-feedback" class="sr-only"> </p>
                </div>

                <div class="space-y-2">
                  <label for="photo-file" class="text-foreground">{{ $t("pages.photos.form.fields.file") }}</label>
                  <input
                    id="photo-file"
                    ref="fileInputEl"
                    type="file"
                    accept="image/*"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring"
                    :aria-invalid="fileError ? 'true' : 'false'"
                    aria-describedby="photo-file-hint photo-file-feedback"
                    @change="onFileChange"
                    required
                  />
                  <p id="photo-file-hint" class="text-xs text-muted-foreground">{{ $t("pages.photos.form.hints.file") }}</p>
                  <p v-if="fileError" id="photo-file-feedback" class="text-sm text-destructive" role="alert">
                    {{ fileError }}
                  </p>
                  <p v-else id="photo-file-feedback" class="sr-only"> </p>
                </div>
              </div>

              <div class="space-y-2">
                <label for="photo-note" class="text-foreground">{{ $t("pages.photos.form.fields.note") }}</label>
                <input
                  id="photo-note"
                  v-model="noteInput"
                  type="text"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.photos.form.placeholders.note')"
                />
              </div>

              <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
              <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

              <div class="flex flex-wrap gap-2">
                <Button type="submit" :disabled="isSubmitting">
                  <span v-if="isSubmitting">{{ $t("pages.photos.form.saving") }}</span>
                  <span v-else>{{ $t("pages.photos.form.save") }}</span>
                </Button>
                <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadPhotos">
                  <span v-if="listStatus === 'loading'">{{ $t("pages.photos.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.photos.list.refresh") }}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
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

                <Button variant="outline" size="sm" type="button" :disabled="viewMode === 'gallery'" @click="viewMode = 'gallery'">
                  {{ $t("pages.photos.timeline.viewModes.gallery") }}
                </Button>
                <Button variant="outline" size="sm" type="button" :disabled="viewMode === 'list'" @click="viewMode = 'list'">
                  {{ $t("pages.photos.timeline.viewModes.list") }}
                </Button>
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

            <div v-else-if="listStatus === 'ready' && !photos.length" class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ $t("pages.photos.list.empty") }}</p>
              <p class="text-xs text-muted-foreground">{{ $t("pages.photos.list.emptyHint") }}</p>
            </div>

            <template v-else-if="listStatus === 'ready'">
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <p class="text-xs text-muted-foreground">
                  {{ $t("pages.photos.timeline.selection.selectedCount", { count: compareSelection.length }) }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    :disabled="!compareSelection.length"
                    @click="clearCompareSelection"
                  >
                    {{ $t("pages.photos.timeline.actions.clearSelection") }}
                  </Button>
                  <Button size="sm" type="button" :disabled="compareSelection.length !== 2" @click="openCompareDialog">
                    {{ $t("pages.photos.timeline.actions.compare") }}
                  </Button>
                </div>
              </div>

              <div v-if="viewMode === 'gallery'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="photo in photos"
                  :key="photo.photoId"
                  class="relative overflow-hidden rounded-md border border-border bg-background"
                  :class="isCompareSelected(photo.photoId) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''"
                >
                  <button
                    type="button"
                    class="block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    @click="openViewer(photo)"
                  >
                    <div class="aspect-[4/3] w-full bg-muted">
                      <img
                        v-if="getPreview(photo.photoId).status === 'ready' && getPreview(photo.photoId).objectUrl"
                        :src="getPreview(photo.photoId).objectUrl || undefined"
                        class="h-full w-full object-cover"
                        :alt="$t('pages.photos.timeline.alt.tankPhoto', { date: formatPhotoDate(photo.date) })"
                        @error="onPreviewImageError(photo.photoId)"
                      />
                      <div v-else class="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                        <template v-if="getPreview(photo.photoId).status === 'loading'">
                          {{ $t("pages.photos.timeline.actions.loadingPreview") }}
                        </template>
                        <template v-else-if="getPreview(photo.photoId).status === 'error'">
                          <span class="text-destructive">
                            {{ $t("pages.photos.timeline.errors.previewFailed") }}
                            <span v-if="getPreview(photo.photoId).error">({{ getPreview(photo.photoId).error }})</span>
                          </span>
                        </template>
                        <template v-else>
                          {{ $t("pages.photos.timeline.actions.loadPreview") }}
                        </template>
                      </div>
                    </div>

                    <div class="space-y-1 p-3">
                      <div class="text-sm font-medium text-foreground">{{ formatPhotoDate(photo.date) }}</div>
                      <p v-if="photo.note" class="line-clamp-2 text-xs text-muted-foreground">
                        {{ photo.note }}
                      </p>
                    </div>
                  </button>

                  <div class="absolute left-2 top-2 flex flex-wrap gap-2">
                    <Button
                      v-if="getPreview(photo.photoId).status !== 'ready'"
                      variant="secondary"
                      size="xs"
                      type="button"
                      :disabled="getPreview(photo.photoId).status === 'loading'"
                      @click.stop="ensurePreview(photo)"
                    >
                      <span v-if="getPreview(photo.photoId).status === 'loading'">{{ $t("pages.photos.timeline.actions.loadingPreview") }}</span>
                      <span v-else-if="getPreview(photo.photoId).status === 'error'">{{ $t("pages.photos.timeline.actions.retryPreview") }}</span>
                      <span v-else>{{ $t("pages.photos.timeline.actions.loadPreview") }}</span>
                    </Button>
                  </div>

                  <div class="absolute right-2 top-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      type="button"
                      :aria-pressed="isCompareSelected(photo.photoId) ? 'true' : 'false'"
                      :aria-label="
                        isCompareSelected(photo.photoId)
                          ? $t('pages.photos.timeline.actions.unselectForCompare')
                          : $t('pages.photos.timeline.actions.selectForCompare')
                      "
                      @click.stop="toggleCompare(photo)"
                    >
                      <span class="sr-only">
                        {{
                          isCompareSelected(photo.photoId)
                            ? $t("pages.photos.timeline.actions.unselectForCompare")
                            : $t("pages.photos.timeline.actions.selectForCompare")
                        }}
                      </span>
                      <span aria-hidden="true">
                        {{ isCompareSelected(photo.photoId) ? "✓" : "+" }}
                      </span>
                    </Button>
                  </div>

                  <div class="absolute bottom-2 right-2">
                    <a
                      class="rounded bg-background/80 px-2 py-1 text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                      :href="photo.driveUrl"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ $t("pages.photos.list.labels.openInDrive") }}
                    </a>
                  </div>
                </div>
              </div>

              <ul
                v-else
                role="list"
                class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
              >
                <li v-for="photo in photos" :key="photo.photoId" class="px-4 py-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="space-y-1">
                      <button
                        type="button"
                        class="text-left font-medium text-foreground underline underline-offset-4 hover:text-foreground/90"
                        @click="openViewer(photo)"
                      >
                        {{ formatPhotoDate(photo.date) }}
                      </button>
                      <p v-if="photo.note" class="text-xs text-muted-foreground">
                        {{ $t("pages.photos.list.labels.note") }}: {{ photo.note }}
                      </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        type="button"
                        :aria-pressed="isCompareSelected(photo.photoId) ? 'true' : 'false'"
                        :aria-label="
                          isCompareSelected(photo.photoId)
                            ? $t('pages.photos.timeline.actions.unselectForCompare')
                            : $t('pages.photos.timeline.actions.selectForCompare')
                        "
                        @click="toggleCompare(photo)"
                      >
                        <span aria-hidden="true">{{ isCompareSelected(photo.photoId) ? "✓" : "+" }}</span>
                      </Button>

                      <a
                        class="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                        :href="photo.driveUrl"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {{ $t("pages.photos.list.labels.openInDrive") }}
                      </a>
                    </div>
                  </div>
                </li>
              </ul>
            </template>
          </CardContent>
          <CardFooter class="flex flex-wrap gap-2">
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}`)">{{ $t("nav.overview") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/tests`)">{{ $t("actions.goToWaterTests") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/reminders`)">{{ $t("actions.goToReminders") }}</NuxtLink>
            </Button>
          </CardFooter>
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
                <img
                  v-if="viewerPreview?.status === 'ready' && viewerPreview.objectUrl"
                  :src="viewerPreview.objectUrl"
                  class="max-h-[70vh] w-full object-contain"
                  :alt="$t('pages.photos.timeline.alt.tankPhoto', { date: formatPhotoDate(viewerPhoto.date) })"
                  @error="onPreviewImageError(viewerPhoto.photoId)"
                />
                <div v-else class="space-y-3 p-6 text-sm text-muted-foreground">
                  <p v-if="viewerPreview?.status === 'loading'">{{ $t("pages.photos.timeline.actions.loadingPreview") }}</p>
                  <p v-else-if="viewerPreview?.status === 'error'">
                    {{ viewerPreview.error || $t("pages.photos.timeline.errors.previewFailed") }}
                  </p>
                  <p v-else>{{ $t("pages.photos.timeline.actions.loadPreview") }}</p>

                  <Button
                    v-if="viewerPreview?.status !== 'loading'"
                    variant="secondary"
                    size="sm"
                    type="button"
                    @click="ensurePreview(viewerPhoto)"
                  >
                    <span v-if="viewerPreview?.status === 'error'">{{ $t("pages.photos.timeline.actions.retryPreview") }}</span>
                    <span v-else>{{ $t("pages.photos.timeline.actions.loadPreview") }}</span>
                  </Button>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  :aria-pressed="isCompareSelected(viewerPhoto.photoId) ? 'true' : 'false'"
                  @click="toggleCompare(viewerPhoto)"
                >
                  {{
                    isCompareSelected(viewerPhoto.photoId)
                      ? $t("pages.photos.timeline.actions.unselectForCompare")
                      : $t("pages.photos.timeline.actions.selectForCompare")
                  }}
                </Button>

                <Button size="sm" type="button" :disabled="compareSelection.length !== 2" @click="openCompareDialog">
                  {{ $t("pages.photos.timeline.actions.compare") }}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog v-model:open="isCompareOpen">
          <DialogContent class="max-w-6xl">
            <DialogHeader>
              <DialogTitle>{{ $t("pages.photos.compare.title") }}</DialogTitle>
              <DialogDescription>{{ $t("pages.photos.compare.description") }}</DialogDescription>
            </DialogHeader>

            <div v-if="comparePhotoA && comparePhotoB" class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    :disabled="compareMode === 'sideBySide'"
                    @click="compareMode = 'sideBySide'"
                  >
                    {{ $t("pages.photos.compare.modes.sideBySide") }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    :disabled="compareMode === 'toggle'"
                    @click="compareMode = 'toggle'"
                  >
                    {{ $t("pages.photos.compare.modes.toggle") }}
                  </Button>
                </div>

                <Button variant="secondary" size="sm" type="button" @click="swapCompareSelection">
                  {{ $t("pages.photos.timeline.actions.swap") }}
                </Button>
              </div>

              <div v-if="compareMode === 'sideBySide'" class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <div class="text-xs text-muted-foreground">{{ formatPhotoDate(comparePhotoA.date) }}</div>
                  <div class="overflow-hidden rounded-md border border-border bg-muted">
                    <img
                      v-if="comparePreviewA?.status === 'ready' && comparePreviewA.objectUrl"
                      :src="comparePreviewA.objectUrl"
                      class="max-h-[60vh] w-full object-contain"
                      :alt="$t('pages.photos.timeline.alt.tankPhoto', { date: formatPhotoDate(comparePhotoA.date) })"
                      @error="onPreviewImageError(comparePhotoA.photoId)"
                    />
                    <div v-else class="space-y-3 p-4 text-sm text-muted-foreground">
                      <p v-if="comparePreviewA?.status === 'loading'">{{ $t("pages.photos.timeline.actions.loadingPreview") }}</p>
                      <p v-else-if="comparePreviewA?.status === 'error'">
                        {{ comparePreviewA.error || $t("pages.photos.timeline.errors.previewFailed") }}
                      </p>
                      <Button
                        v-if="comparePreviewA?.status !== 'loading'"
                        variant="secondary"
                        size="sm"
                        type="button"
                        @click="ensurePreview(comparePhotoA)"
                      >
                        <span v-if="comparePreviewA?.status === 'error'">{{ $t("pages.photos.timeline.actions.retryPreview") }}</span>
                        <span v-else>{{ $t("pages.photos.timeline.actions.loadPreview") }}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="text-xs text-muted-foreground">{{ formatPhotoDate(comparePhotoB.date) }}</div>
                  <div class="overflow-hidden rounded-md border border-border bg-muted">
                    <img
                      v-if="comparePreviewB?.status === 'ready' && comparePreviewB.objectUrl"
                      :src="comparePreviewB.objectUrl"
                      class="max-h-[60vh] w-full object-contain"
                      :alt="$t('pages.photos.timeline.alt.tankPhoto', { date: formatPhotoDate(comparePhotoB.date) })"
                      @error="onPreviewImageError(comparePhotoB.photoId)"
                    />
                    <div v-else class="space-y-3 p-4 text-sm text-muted-foreground">
                      <p v-if="comparePreviewB?.status === 'loading'">{{ $t("pages.photos.timeline.actions.loadingPreview") }}</p>
                      <p v-else-if="comparePreviewB?.status === 'error'">
                        {{ comparePreviewB.error || $t("pages.photos.timeline.errors.previewFailed") }}
                      </p>
                      <Button
                        v-if="comparePreviewB?.status !== 'loading'"
                        variant="secondary"
                        size="sm"
                        type="button"
                        @click="ensurePreview(comparePhotoB)"
                      >
                        <span v-if="comparePreviewB?.status === 'error'">{{ $t("pages.photos.timeline.actions.retryPreview") }}</span>
                        <span v-else>{{ $t("pages.photos.timeline.actions.loadPreview") }}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-xs text-muted-foreground">
                    {{
                      compareToggleIndex === 0
                        ? formatPhotoDate(comparePhotoA.date)
                        : formatPhotoDate(comparePhotoB.date)
                    }}
                  </div>
                  <Button variant="secondary" size="sm" type="button" @click="toggleComparePreview">
                    {{
                      compareToggleIndex === 0
                        ? $t("pages.photos.compare.actions.showSecond")
                        : $t("pages.photos.compare.actions.showFirst")
                    }}
                  </Button>
                </div>

                <div class="overflow-hidden rounded-md border border-border bg-muted">
                  <img
                    v-if="
                      (compareToggleIndex === 0 && comparePreviewA?.status === 'ready' && comparePreviewA.objectUrl)
                        || (compareToggleIndex === 1 && comparePreviewB?.status === 'ready' && comparePreviewB.objectUrl)
                    "
                    :src="compareToggleIndex === 0 ? (comparePreviewA?.objectUrl || undefined) : (comparePreviewB?.objectUrl || undefined)"
                    class="max-h-[70vh] w-full object-contain"
                    :alt="
                      $t('pages.photos.timeline.alt.tankPhoto', {
                        date: compareToggleIndex === 0 ? formatPhotoDate(comparePhotoA.date) : formatPhotoDate(comparePhotoB.date),
                      })
                    "
                    @error="onPreviewImageError(compareToggleIndex === 0 ? comparePhotoA.photoId : comparePhotoB.photoId)"
                  />
                  <div v-else class="space-y-3 p-6 text-sm text-muted-foreground">
                    <p>{{ $t("pages.photos.timeline.actions.loadPreview") }}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      @click="ensurePreview(compareToggleIndex === 0 ? comparePhotoA : comparePhotoB)"
                    >
                      {{ $t("pages.photos.timeline.actions.loadPreview") }}
                    </Button>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-3 text-sm">
                <a
                  class="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                  :href="comparePhotoA.driveUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ $t("pages.photos.list.labels.openInDrive") }} (A)
                </a>
                <a
                  class="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                  :href="comparePhotoB.driveUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ $t("pages.photos.list.labels.openInDrive") }} (B)
                </a>
              </div>
            </div>

            <div v-else class="text-sm text-muted-foreground">
              {{ $t("pages.photos.compare.errors.needTwo") }}
            </div>
          </DialogContent>
        </Dialog>
      </template>
    </template>
  </section>
</template>

