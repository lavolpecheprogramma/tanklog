<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { LivestockCategory, LivestockStatus, TankLivestock } from "@/composables/useLivestock"
import type { TankPhoto } from "@/composables/usePhotos"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.livestock.metaTitle"),
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

const livestockApi = useLivestock()
const photosApi = usePhotos()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const livestock = ref<TankLivestock[]>([])

const featuredStatus = ref<LoadStatus>("idle")
const featuredError = ref<string | null>(null)
const featuredByLivestockId = ref<Record<string, TankPhoto>>({})

const photoRevision = computed(() => {
  const spreadsheetId = tank.value?.spreadsheetId
  if (!spreadsheetId) return 0
  return photosApi.photoRevisions.value[spreadsheetId] ?? 0
})

const actionError = ref<string | null>(null)
const actionStatus = ref<string | null>(null)

const isCreateOpen = ref(false)

type FilterCategory = "all" | LivestockCategory
const filterCategory = ref<FilterCategory>("all")
const searchQuery = ref("")

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

function formatDateOnly(value: string): string {
  const parsed = parseDateOnly(value)
  if (!parsed) return value
  const date = new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(locale.value, { year: "numeric", month: "short", day: "2-digit" }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

function statusBadge(status: LivestockStatus): { label: string; className: string } {
  if (status === "active") {
    return {
      label: t("pages.livestock.options.status.active"),
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    }
  }
  if (status === "dead") {
    return {
      label: t("pages.livestock.options.status.dead"),
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    }
  }
  return {
    label: t("pages.livestock.options.status.removed"),
    className: "border-border bg-muted/30 text-muted-foreground",
  }
}

async function loadLivestock() {
  if (!import.meta.client) return

  if (!tank.value) {
    livestock.value = []
    listStatus.value = "idle"
    listError.value = null
    featuredByLivestockId.value = {}
    featuredStatus.value = "idle"
    featuredError.value = null
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    livestock.value = await livestockApi.listLivestock({ spreadsheetId: tank.value.spreadsheetId })
    listStatus.value = "ready"
  } catch (error) {
    livestock.value = []
    listError.value = error instanceof Error ? error.message : t("pages.livestock.list.errors.loadFailed")
    listStatus.value = "error"
  }
}

async function loadFeaturedPhotos() {
  if (!import.meta.client) return

  if (!tank.value) {
    featuredByLivestockId.value = {}
    featuredStatus.value = "idle"
    featuredError.value = null
    return
  }

  featuredStatus.value = "loading"
  featuredError.value = null

  try {
    const all = await photosApi.listAllPhotos({ spreadsheetId: tank.value.spreadsheetId })
    const map: Record<string, TankPhoto> = {}
    for (const photo of all) {
      if (photo.relatedType !== "livestock") continue
      const id = photo.relatedId
      if (!id) continue
      if (map[id]) continue
      map[id] = photo
    }
    featuredByLivestockId.value = map
    featuredStatus.value = "ready"
  } catch (error) {
    featuredByLivestockId.value = {}
    featuredStatus.value = "error"
    featuredError.value = error instanceof Error ? error.message : t("pages.photos.list.errors.loadFailed")
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    loadLivestock()
    loadFeaturedPhotos()
  },
  { immediate: true }
)

watch(photoRevision, () => {
  loadFeaturedPhotos()
})

const filteredLivestock = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const category = filterCategory.value

  const matchesQuery = (item: TankLivestock) => {
    if (!query) return true
    const haystack = `${item.nameCommon} ${item.nameScientific ?? ""}`.toLowerCase()
    return haystack.includes(query)
  }

  const matchesCategory = (item: TankLivestock) => {
    if (category === "all") return true
    return item.category === category
  }

  const rankStatus = (status: LivestockStatus) => (status === "active" ? 0 : status === "removed" ? 1 : 2)

  const sorted = [...livestock.value]
  sorted.sort((a, b) => {
    const statusDiff = rankStatus(a.status) - rankStatus(b.status)
    if (statusDiff !== 0) return statusDiff
    return (b.dateAdded ?? "").localeCompare(a.dateAdded ?? "")
  })

  return sorted.filter((item) => matchesCategory(item) && matchesQuery(item))
})

type LivestockFormPayload = {
  nameCommon: string
  nameScientific: string | null
  category: LivestockCategory
  subCategory: string | null
  tankZone: TankLivestock["tankZone"]
  origin: TankLivestock["origin"]
  dateAdded: string
  dateRemoved: string | null
  status: LivestockStatus
  notes: string | null
}

async function handleCreateLivestock(payload: LivestockFormPayload) {
  if (!tank.value) throw new Error(t("pages.livestock.form.errors.saveFailed"))

  actionError.value = null
  actionStatus.value = null

  const created = await livestockApi.createLivestock({
    spreadsheetId: tank.value.spreadsheetId,
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

  await loadLivestock()
  isCreateOpen.value = false
  actionStatus.value = t("pages.livestock.form.success.saved")

  await navigateTo(localePath(`/dashboard/tank/${tank.value.id}/livestock/${created.livestockId}`))
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.livestock.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.livestock.description") }}
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
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <CardTitle>{{ $t("pages.livestock.list.title") }}</CardTitle>
                <CardDescription>{{ $t("pages.livestock.list.description") }}</CardDescription>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" type="button" :disabled="listStatus === 'loading'" @click="loadLivestock">
                  <span v-if="listStatus === 'loading'">{{ $t("pages.livestock.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.livestock.list.refresh") }}</span>
                </Button>

                <Dialog v-model:open="isCreateOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" type="button">{{ $t("pages.livestock.actions.add") }}</Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{{ $t("pages.livestock.actions.add") }}</DialogTitle>
                      <DialogDescription>{{ $t("pages.livestock.form.description") }}</DialogDescription>
                    </DialogHeader>

                    <div class="text-sm text-muted-foreground">
                      <LivestockForm
                        id-base="create-livestock"
                        :submit-label="$t('pages.livestock.form.save')"
                        :saving-label="$t('pages.livestock.form.saving')"
                        :submit-handler="handleCreateLivestock"
                      >
                        <template #actions>
                          <DialogClose as-child>
                            <Button variant="secondary" type="button">{{ $t("actions.cancel") }}</Button>
                          </DialogClose>
                        </template>
                      </LivestockForm>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <p v-if="actionError" class="text-sm text-destructive" role="alert">{{ actionError }}</p>
            <p v-else-if="actionStatus" class="text-sm text-foreground" role="status">{{ actionStatus }}</p>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-2">
                <label for="livestock-search" class="text-foreground">{{ $t("pages.livestock.filters.searchPlaceholder") }}</label>
                <input
                  id="livestock-search"
                  v-model.trim="searchQuery"
                  type="search"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.livestock.filters.searchPlaceholder')"
                />
              </div>

              <div class="space-y-2">
                <div class="text-foreground">{{ $t("pages.livestock.form.fields.category") }}</div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    type="button"
                    :variant="filterCategory === 'all' ? 'default' : 'secondary'"
                    @click="filterCategory = 'all'"
                  >
                    {{ $t("pages.livestock.filters.all") }}
                  </Button>
                  <Button
                    v-for="cat in (['fish','coral','invertebrate','plant'] as const)"
                    :key="cat"
                    size="sm"
                    type="button"
                    :variant="filterCategory === cat ? 'default' : 'secondary'"
                    @click="filterCategory = cat"
                  >
                    {{ $t(`pages.livestock.filters.${cat}`) }}
                  </Button>
                </div>
              </div>
            </div>

            <div v-if="listStatus === 'loading'">{{ $t("pages.livestock.list.loading") }}</div>

            <div v-else-if="listStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.livestock.list.errors.loadFailed") }}
                <span v-if="listError">({{ listError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadLivestock">
                {{ $t("pages.livestock.list.refresh") }}
              </Button>
            </div>

            <div v-else-if="listStatus === 'ready' && !filteredLivestock.length" class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ $t("pages.livestock.list.empty") }}</p>
              <p class="text-xs text-muted-foreground">{{ $t("pages.livestock.list.emptyHint") }}</p>
            </div>

            <template v-else-if="listStatus === 'ready'">
              <div class="text-xs text-muted-foreground">
                {{ $t("pages.livestock.list.results", { count: filteredLivestock.length }) }}
              </div>

              <ul
                role="list"
                class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
              >
                <li v-for="item in filteredLivestock" :key="item.livestockId" class="px-4 py-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="flex min-w-0 items-start gap-3">
                      <div class="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        <DrivePhoto
                          v-if="featuredByLivestockId[item.livestockId]"
                          :file-id="featuredByLivestockId[item.livestockId].driveFileId"
                          :alt="$t('pages.livestock.photos.alt.featured', { name: item.nameCommon })"
                          fit="cover"
                        />
                        <span v-else class="sr-only">{{ $t("pages.livestock.photos.alt.noPhoto", { name: item.nameCommon }) }}</span>
                      </div>

                      <div class="min-w-0 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <NuxtLink
                            class="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            :to="localePath(`/dashboard/tank/${tankId}/livestock/${item.livestockId}`)"
                          >
                            {{ item.nameCommon }}
                          </NuxtLink>
                          <span
                            class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                            :class="statusBadge(item.status).className"
                          >
                            {{ statusBadge(item.status).label }}
                          </span>
                        </div>
                        <div v-if="item.nameScientific" class="truncate text-xs text-muted-foreground">
                          {{ item.nameScientific }}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {{ $t(`pages.livestock.options.category.${item.category}`) }}
                          <span v-if="item.subCategory"> · {{ item.subCategory }}</span>
                          <span v-if="item.origin"> · {{ $t(`pages.livestock.options.origin.${item.origin}`) }}</span>
                          <span v-if="item.tankZone"> · {{ $t(`pages.livestock.options.tankZone.${item.tankZone}`) }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <div class="text-right text-xs text-muted-foreground">
                        {{ formatDateOnly(item.dateAdded) }}
                      </div>
                      <Button size="xs" variant="secondary" as-child>
                        <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/livestock/${item.livestockId}`)">
                          {{ $t("pages.livestock.actions.open") }}
                        </NuxtLink>
                      </Button>
                    </div>
                  </div>
                </li>
              </ul>
            </template>
          </CardContent>

          <CardFooter class="flex flex-wrap gap-2">
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/dashboard/tank/${tankId}`)">{{ $t("nav.overview") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
            </Button>
          </CardFooter>
        </Card>
      </template>
    </template>
  </section>
</template>

