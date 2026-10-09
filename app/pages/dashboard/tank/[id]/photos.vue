<script setup lang="ts">
import type { Photo, PhotoRelatedType } from '~/types/photo'
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '~/utils/datetime'

definePageMeta({
  title: 'Photos'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const photosApi = usePhotos()
const livestockApi = useLivestock()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const formOk = ref<string | null>(null)
const busy = ref(false)
const formOpen = ref(false)

const file = ref<File | null>(null)
const fileInputKey = ref(0)
const takenAtLocal = ref(toDatetimeLocalValue(new Date()))
const relatedType = ref<PhotoRelatedType>('tank')
const livestockId = ref('')
const note = ref('')
const tagsInput = ref('')
const filter = ref<'all' | PhotoRelatedType>('all')
const NONE = '__none__'
const tagFilter = ref<string>(NONE)
const growthLivestockId = ref<string>(NONE)

const compareMode = ref(false)
const compareIds = ref<string[]>([])
const fullscreenId = ref<string | null>(null)
const fullscreenOpen = computed({
  get: () => fullscreenId.value != null,
  set: (open: boolean) => {
    if (!open) fullscreenId.value = null
  }
})

const relatedItems = computed(() => [
  { label: t('photos.related.tank'), value: 'tank' },
  { label: t('photos.related.livestock'), value: 'livestock' }
])

const filterItems = computed(() => [
  { label: t('photos.filters.all'), value: 'all' },
  { label: t('photos.related.tank'), value: 'tank' },
  { label: t('photos.related.livestock'), value: 'livestock' }
])

const livestockItems = computed(() =>
  livestockApi.items.value.map(item => ({
    label: item.nameCommon,
    value: item.id
  }))
)

const selectedRelatedType = computed({
  get: () => relatedType.value,
  set: (value: unknown) => {
    relatedType.value = value === 'livestock' ? 'livestock' : 'tank'
  }
})

const selectedLivestockId = computed({
  get: () => livestockId.value,
  set: (value: unknown) => {
    livestockId.value = value == null ? '' : String(value)
  }
})

const selectedFilter = computed({
  get: () => filter.value,
  set: (value: unknown) => {
    const next = String(value)
    filter.value = next === 'tank' || next === 'livestock' ? next : 'all'
  }
})

function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
}

const allTags = computed(() => {
  const set = new Set<string>()
  for (const photo of photosApi.photos.value) {
    for (const tag of photo.tags) set.add(tag)
  }
  return [...set].sort()
})

const tagFilterItems = computed(() => [
  { label: t('photos.filters.allTags'), value: NONE },
  ...allTags.value.map(tag => ({ label: tag, value: tag }))
])

const selectedTagFilter = computed({
  get: () => tagFilter.value,
  set: (value: unknown) => {
    const next = String(value ?? NONE)
    tagFilter.value = next || NONE
  }
})

const selectedGrowthLivestock = computed({
  get: () => growthLivestockId.value,
  set: (value: unknown) => {
    const next = String(value ?? NONE)
    growthLivestockId.value = next || NONE
  }
})

const filteredPhotos = computed(() => {
  let list = photosApi.photos.value
  if (filter.value !== 'all') {
    list = list.filter(p => p.relatedType === filter.value)
  }
  if (tagFilter.value !== NONE) {
    list = list.filter(p => p.tags.includes(tagFilter.value))
  }
  if (growthLivestockId.value !== NONE) {
    list = list.filter(
      p => p.relatedType === 'livestock' && p.livestockId === growthLivestockId.value
    )
  }
  return list
})

const fullscreenPhoto = computed(() =>
  photosApi.photos.value.find(p => p.id === fullscreenId.value) ?? null
)

const comparePhotos = computed(() =>
  compareIds.value
    .map(id => photosApi.photos.value.find(p => p.id === id))
    .filter((p): p is Photo => Boolean(p))
)

watch(relatedType, (next) => {
  if (next === 'tank') livestockId.value = ''
})

function livestockName(id: string | null): string {
  if (!id) return ''
  return livestockApi.items.value.find(item => item.id === id)?.nameCommon ?? id
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

function resetForm() {
  file.value = null
  fileInputKey.value += 1
  takenAtLocal.value = toDatetimeLocalValue(new Date())
  relatedType.value = 'tank'
  livestockId.value = ''
  note.value = ''
  tagsInput.value = ''
  formError.value = null
  formOk.value = null
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function startGrowthCompare() {
  if (growthLivestockId.value === NONE) return
  const series = [...photosApi.photos.value]
    .filter(p => p.relatedType === 'livestock' && p.livestockId === growthLivestockId.value)
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
  if (series.length < 2) {
    toast.add({
      title: t('photos.growthNeedTwo'),
      color: 'warning',
      icon: 'i-lucide-images'
    })
    return
  }
  compareMode.value = true
  compareIds.value = [series[0]!.id, series[series.length - 1]!.id]
}

function openFullscreen(photo: Photo) {
  if (compareMode.value) {
    toggleCompare(photo.id)
    return
  }
  fullscreenId.value = photo.id
}

function toggleCompare(id: string) {
  const idx = compareIds.value.indexOf(id)
  if (idx >= 0) {
    compareIds.value = compareIds.value.filter(item => item !== id)
    return
  }
  if (compareIds.value.length >= 2) {
    compareIds.value = [compareIds.value[1]!, id]
    return
  }
  compareIds.value = [...compareIds.value, id]
}

function exitCompare() {
  compareMode.value = false
  compareIds.value = []
}

async function load() {
  loadError.value = null
  try {
    if (!tanksApi.tanks.value.length) await tanksApi.refresh()
    if (!tank.value) {
      loadError.value = t('tanks.notFound')
      return
    }
    tanksApi.setActiveTankId(tank.value.id)
    await Promise.all([
      photosApi.listByTank(tank.value.id),
      livestockApi.listByTank(tank.value.id, 'active').catch(() => [])
    ])
  } catch (e) {
    if (e instanceof Error) loadError.value = e.message
    else if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
      loadError.value = (e as { message: string }).message
    } else {
      loadError.value = String(e)
    }
  }
}

async function submit() {
  if (!tank.value) return
  busy.value = true
  formError.value = null
  formOk.value = null
  try {
    if (!file.value) throw new Error(t('photos.errors.needFile'))
    const takenAt = fromDatetimeLocalValue(takenAtLocal.value)
    if (!takenAt) throw new Error(t('photos.errors.invalidDate'))

    await photosApi.upload({
      tankId: tank.value.id,
      file: file.value,
      takenAt,
      relatedType: relatedType.value,
      livestockId: relatedType.value === 'livestock' ? livestockId.value || null : null,
      note: note.value || null,
      tags: parseTagsInput(tagsInput.value)
    })
    toast.add({ title: t('photos.uploaded'), color: 'success', icon: 'i-lucide-check' })
    resetForm()
    formOpen.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removePhoto(id: string) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('photos.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await photosApi.remove(id)
    if (fullscreenId.value === id) fullscreenId.value = null
    compareIds.value = compareIds.value.filter(item => item !== id)
    toast.add({ title: t('common.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <UButton
      to="/dashboard"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      ← {{ t('nav.dashboard') }}
    </UButton>

    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold text-white sm:text-3xl">
          {{ t('photos.title') }}
        </h1>
        <p class="mt-2 text-slate-400">
          {{ tank ? tank.name : t('common.loading') }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-upload"
        class="shrink-0"
        @click="openCreate"
      >
        {{ t('photos.upload') }}
      </UButton>
    </div>

    <TankSubnav
      v-if="tank"
      class="mt-6"
      :tank-id="tank.id"
    />

    <p
      v-if="loadError"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div class="mt-6 sm:mt-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('photos.timeline') }}
        </h2>
        <div class="flex w-full flex-wrap gap-2 sm:w-auto">
          <UFormField
            :label="t('photos.filters.label')"
            class="min-w-0 flex-1 basis-28 sm:flex-none"
          >
            <USelect
              v-model="selectedFilter"
              value-key="value"
              :items="filterItems"
              class="w-full min-w-28"
            />
          </UFormField>
          <UFormField
            :label="t('photos.filters.tag')"
            class="min-w-0 flex-1 basis-28 sm:flex-none"
          >
            <USelect
              v-model="selectedTagFilter"
              value-key="value"
              :items="tagFilterItems"
              class="w-full min-w-28"
            />
          </UFormField>
          <UButton
            size="sm"
            :color="compareMode ? 'primary' : 'neutral'"
            :variant="compareMode ? 'soft' : 'ghost'"
            class="self-end"
            @click="compareMode ? exitCompare() : (compareMode = true)"
          >
            {{ compareMode ? t('photos.compareExit') : t('photos.compare') }}
          </UButton>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-cyan-500/10 bg-slate-950/40 p-3">
        <UFormField
          :label="t('photos.growth')"
          class="min-w-0 flex-1 basis-44"
        >
          <USelect
            v-model="selectedGrowthLivestock"
            value-key="value"
            :items="[{ label: t('photos.growthNone'), value: NONE }, ...livestockItems]"
            class="w-full"
          />
        </UFormField>
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          class="self-end"
          :disabled="growthLivestockId === NONE"
          @click="startGrowthCompare"
        >
          {{ t('photos.growthCompare') }}
        </UButton>
      </div>

      <p
        v-if="compareMode"
        class="mt-2 text-sm text-amber-200/90"
      >
        {{ t('photos.compareHint', { count: compareIds.length }) }}
      </p>

      <div
        v-if="comparePhotos.length === 2"
        class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-cyan-500/20 bg-slate-950/60 p-3"
      >
        <figure
          v-for="photo in comparePhotos"
          :key="photo.id"
          class="min-w-0"
        >
          <PhotoThumb
            :storage-path="photo.storagePath"
            :alt="photo.note || t('photos.title')"
            eager
          />
          <figcaption class="mt-2 text-xs text-slate-400">
            {{ formatDateTime(photo.takenAt, locale) }}
            <span v-if="photo.relatedType === 'livestock'">
              · {{ livestockName(photo.livestockId) }}
            </span>
          </figcaption>
        </figure>
      </div>

      <p
        v-if="photosApi.loading.value"
        class="mt-4 text-sm text-slate-400"
      >
        {{ t('common.loading') }}
      </p>
      <UEmpty
        v-else-if="!filteredPhotos.length"
        class="mt-4"
        icon="i-lucide-image"
        :title="t('photos.empty')"
        :description="t('photos.emptyHint')"
        :actions="[{ label: t('photos.upload'), color: 'primary', icon: 'i-lucide-upload', onClick: openCreate }]"
      />

      <ul
        v-else
        class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
        :aria-label="t('photos.timeline')"
      >
        <li
          v-for="photo in filteredPhotos"
          :key="photo.id"
          class="group relative"
        >
          <button
            type="button"
            class="w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            :aria-pressed="compareMode ? compareIds.includes(photo.id) : undefined"
            @click="openFullscreen(photo)"
          >
            <div
              class="ring-offset-2 ring-offset-slate-950 transition"
              :class="compareIds.includes(photo.id) ? 'ring-2 ring-cyan-400' : ''"
            >
              <PhotoThumb
                :storage-path="photo.storagePath"
                :alt="photo.note || formatDateTime(photo.takenAt, locale)"
              />
            </div>
            <p class="mt-1 truncate text-xs text-slate-400">
              {{ formatDateTime(photo.takenAt, locale) }}
            </p>
            <p
              v-if="photo.tags.length"
              class="truncate text-[11px] text-cyan-300/80"
            >
              {{ photo.tags.join(', ') }}
            </p>
          </button>
          <UButton
            size="xs"
            color="error"
            variant="ghost"
            class="absolute right-1 top-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
            @click.stop="removePhoto(photo.id)"
          >
            {{ t('common.delete') }}
          </UButton>
        </li>
      </ul>
    </div>

    <UModal
      v-if="formOpen"
      v-model:open="formOpen"
      :title="t('photos.upload')"
      :ui="{
        content: 'w-[calc(100%-1rem)] max-w-lg max-h-[90dvh] sm:w-full',
        body: 'overflow-y-auto'
      }"
      @update:open="(v: boolean) => { formOpen = v; if (!v) resetForm() }"
    >
      <template #body>
        <form
          id="photo-upload-form"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('photos.file')">
            <input
              :key="fileInputKey"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              class="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100"
              @change="onFileChange"
            >
            <p class="mt-1 text-xs text-slate-400">
              {{ t('photos.fileHint') }}
            </p>
          </UFormField>

          <UFormField :label="t('photos.takenAt')">
            <UInput
              v-model="takenAtLocal"
              type="datetime-local"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('photos.relatedLabel')">
            <USelect
              v-model="selectedRelatedType"
              value-key="value"
              :items="relatedItems"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="relatedType === 'livestock'"
            :label="t('photos.livestock')"
          >
            <USelect
              v-model="selectedLivestockId"
              value-key="value"
              :items="livestockItems"
              :placeholder="t('photos.livestockPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('photos.note')">
            <UTextarea
              v-model="note"
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <UFormField :label="t('photos.tags')">
            <UInput
              v-model="tagsInput"
              class="w-full"
              :placeholder="t('photos.tagsPlaceholder')"
            />
          </UFormField>

          <p
            v-if="formError"
            class="text-sm text-red-400"
            role="alert"
          >
            {{ formError }}
          </p>
        </form>
      </template>

      <template #footer="{ close }">
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="close()"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            form="photo-upload-form"
            color="primary"
            :loading="busy"
            :disabled="relatedType === 'livestock' && !livestockId"
            block
            class="sm:w-auto"
          >
            {{ t('photos.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="fullscreenOpen">
      <template #content>
        <div class="p-4 sm:p-6">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-white">
                {{ fullscreenPhoto ? formatDateTime(fullscreenPhoto.takenAt, locale) : '' }}
              </p>
              <p
                v-if="fullscreenPhoto?.relatedType === 'livestock'"
                class="text-sm text-slate-400"
              >
                {{ livestockName(fullscreenPhoto.livestockId) }}
              </p>
              <p
                v-if="fullscreenPhoto?.note"
                class="mt-1 text-sm text-slate-300"
              >
                {{ fullscreenPhoto.note }}
              </p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              @click="fullscreenOpen = false"
            >
              {{ t('common.close') }}
            </UButton>
          </div>
          <div
            v-if="fullscreenPhoto"
            class="max-h-[70vh] overflow-hidden rounded-xl bg-black"
          >
            <PhotoThumb
              :storage-path="fullscreenPhoto.storagePath"
              :alt="fullscreenPhoto.note || t('photos.title')"
              fit="contain"
              eager
            />
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
