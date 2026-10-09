<script setup lang="ts">
import {
  LIVESTOCK_CATEGORIES,
  LIVESTOCK_ORIGINS,
  LIVESTOCK_STATUSES,
  LIVESTOCK_TANK_ZONES,
  type LivestockCategory,
  type LivestockOrigin,
  type LivestockStatus,
  type LivestockTankZone
} from '~/types/livestock'
import { formatDateTime } from '~/utils/datetime'
import { parseCostInput } from '~/utils/money'

definePageMeta({
  title: 'Livestock detail'
})

const { t, locale } = useI18n()
const route = useRoute()
const tanksApi = useTanks()
const livestockApi = useLivestock()
const eventsApi = useEvents()
const photosApi = usePhotos()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const livestockId = computed(() => String(route.params.livestockId))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const formOk = ref<string | null>(null)
const busy = ref(false)
const notFound = ref(false)

function todayIsoDate() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const nameCommon = ref('')
const nameScientific = ref('')
const category = ref<LivestockCategory>('fish')
const subCategory = ref('')
const NONE = '__none__'
const tankZone = ref<LivestockTankZone | typeof NONE>(NONE)
const origin = ref<LivestockOrigin | typeof NONE>(NONE)
const dateAdded = ref(todayIsoDate())
const dateRemoved = ref('')
const status = ref<LivestockStatus>('active')
const cost = ref('')
const notes = ref('')

const relatedEvents = computed(() =>
  eventsApi.events.value.filter(event => event.livestockId === livestockId.value)
)

const relatedPhotos = computed(() =>
  photosApi.photos.value.filter(photo => photo.livestockId === livestockId.value)
)

const categoryItems = computed(() =>
  LIVESTOCK_CATEGORIES.map(value => ({
    label: t(`livestock.categories.${value}`),
    value
  }))
)
const statusItems = computed(() =>
  LIVESTOCK_STATUSES.map(value => ({
    label: t(`livestock.statuses.${value}`),
    value
  }))
)
const zoneItems = computed(() => [
  { label: t('livestock.zoneNone'), value: NONE },
  ...LIVESTOCK_TANK_ZONES.map(value => ({
    label: t(`livestock.zones.${value}`),
    value
  }))
])
const originItems = computed(() => [
  { label: t('livestock.originNone'), value: NONE },
  ...LIVESTOCK_ORIGINS.map(value => ({
    label: t(`livestock.origins.${value}`),
    value
  }))
])

const selectedCategory = computed({
  get: () => category.value,
  set: (value: unknown) => { category.value = String(value) as LivestockCategory }
})
const selectedStatus = computed({
  get: () => status.value,
  set: (value: unknown) => { status.value = String(value) as LivestockStatus }
})
const selectedZone = computed({
  get: () => tankZone.value,
  set: (value: unknown) => {
    const next = String(value ?? NONE)
    tankZone.value = next === NONE ? NONE : next as LivestockTankZone
  }
})
const selectedOrigin = computed({
  get: () => origin.value,
  set: (value: unknown) => {
    const next = String(value ?? NONE)
    origin.value = next === NONE ? NONE : next as LivestockOrigin
  }
})

watch(status, (next) => {
  if (next !== 'active' && !dateRemoved.value) dateRemoved.value = todayIsoDate()
  if (next === 'active') dateRemoved.value = ''
})

function hydrateFromItem() {
  const item = livestockApi.items.value.find(row => row.id === livestockId.value)
  if (!item) return
  nameCommon.value = item.nameCommon
  nameScientific.value = item.nameScientific ?? ''
  category.value = item.category
  subCategory.value = item.subCategory ?? ''
  tankZone.value = item.tankZone ?? NONE
  origin.value = item.origin ?? NONE
  dateAdded.value = item.dateAdded
  dateRemoved.value = item.dateRemoved ?? ''
  status.value = item.status
  cost.value = item.cost != null ? String(item.cost) : ''
  notes.value = item.notes ?? ''
}

async function load() {
  loadError.value = null
  notFound.value = false
  try {
    if (!tanksApi.tanks.value.length) await tanksApi.refresh()
    if (!tank.value) {
      loadError.value = t('tanks.notFound')
      return
    }
    tanksApi.setActiveTankId(tank.value.id)

    const item = await livestockApi.getById(livestockId.value)
    if (!item || item.tankId !== tank.value.id) {
      notFound.value = true
      loadError.value = t('livestock.notFound')
      return
    }
    hydrateFromItem()

    await Promise.all([
      eventsApi.listByTank(tank.value.id).catch(() => []),
      photosApi.listByTank(tank.value.id).catch(() => [])
    ])
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function save() {
  busy.value = true
  formError.value = null
  formOk.value = null
  try {
    let costValue: number | null
    try {
      costValue = parseCostInput(cost.value)
    } catch {
      throw new Error(t('common.invalidCost'))
    }

    await livestockApi.update(livestockId.value, {
      nameCommon: nameCommon.value,
      nameScientific: nameScientific.value || null,
      category: category.value,
      subCategory: subCategory.value || null,
      tankZone: tankZone.value === NONE ? null : tankZone.value,
      origin: origin.value === NONE ? null : origin.value,
      dateAdded: dateAdded.value,
      dateRemoved: status.value === 'active' ? null : (dateRemoved.value || null),
      status: status.value,
      cost: costValue,
      notes: notes.value || null
    })
    formOk.value = t('livestock.updated')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeItem() {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('livestock.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await livestockApi.remove(livestockId.value)
    await navigateTo(`/dashboard/tank/${tankId.value}/livestock`)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <UButton
      :to="`/dashboard/tank/${tankId}/livestock`"
      color="neutral"
      variant="ghost"
      class="mb-6"
    >
      ← {{ t('livestock.title') }}
    </UButton>

    <h1 class="font-display text-3xl font-semibold text-white">
      {{ nameCommon || t('livestock.detailTitle') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ tank ? tank.name : t('common.loading') }}
    </p>

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

    <form
      v-if="!notFound"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
      @submit.prevent="save"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('livestock.detailTitle') }}
      </h2>

      <UFormField :label="t('livestock.nameCommon')">
        <UInput
          v-model="nameCommon"
          required
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('livestock.nameScientific')">
        <UInput
          v-model="nameScientific"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('livestock.category')">
          <USelect
            v-model="selectedCategory"
            value-key="value"
            :items="categoryItems"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('livestock.status')">
          <USelect
            v-model="selectedStatus"
            value-key="value"
            :items="statusItems"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField :label="t('livestock.subCategory')">
        <UInput
          v-model="subCategory"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('livestock.tankZone')">
          <USelect
            v-model="selectedZone"
            value-key="value"
            :items="zoneItems"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('livestock.origin')">
          <USelect
            v-model="selectedOrigin"
            value-key="value"
            :items="originItems"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('livestock.dateAdded')">
          <UInput
            v-model="dateAdded"
            type="date"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="status !== 'active'"
          :label="t('livestock.dateRemoved')"
        >
          <UInput
            v-model="dateRemoved"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField
        :label="t('livestock.cost')"
        :hint="t('livestock.costHint')"
      >
        <UInput
          v-model="cost"
          type="text"
          inputmode="decimal"
          class="w-full"
          placeholder="0"
        />
      </UFormField>

      <UFormField :label="t('livestock.notes')">
        <UTextarea
          v-model="notes"
          class="w-full"
          :rows="3"
        />
      </UFormField>

      <div class="flex flex-wrap gap-2">
        <UButton
          type="submit"
          color="primary"
          :loading="busy"
        >
          {{ t('common.save') }}
        </UButton>
        <UButton
          type="button"
          color="error"
          variant="ghost"
          @click="removeItem"
        >
          {{ t('common.delete') }}
        </UButton>
      </div>

      <p
        v-if="formOk"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ formOk }}
      </p>
      <p
        v-if="formError"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ formError }}
      </p>
    </form>

    <section
      v-if="!notFound"
      class="mt-10"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('livestock.relatedEvents') }}
      </h2>
      <p
        v-if="!relatedEvents.length"
        class="mt-3 text-sm text-slate-400"
      >
        {{ t('livestock.noRelatedEvents') }}
      </p>
      <ul
        v-else
        class="mt-3 space-y-3"
      >
        <li
          v-for="event in relatedEvents"
          :key="event.id"
          class="rounded-xl border border-cyan-500/10 bg-slate-950/50 p-4"
        >
          <p class="text-sm text-slate-400">
            {{ formatDateTime(event.occurredAt, locale) }}
          </p>
          <p class="mt-1 font-medium text-white">
            {{ event.description }}
          </p>
          <p class="mt-1 text-sm text-cyan-200/80">
            {{ t(`events.types.${event.type}`) }}
          </p>
        </li>
      </ul>
      <UButton
        class="mt-4"
        color="neutral"
        variant="soft"
        size="sm"
        :to="`/dashboard/tank/${tankId}/events`"
      >
        {{ t('livestock.logEvent') }}
      </UButton>
    </section>

    <section
      v-if="!notFound"
      class="mt-10"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('livestock.relatedPhotos') }}
      </h2>
      <p
        v-if="!relatedPhotos.length"
        class="mt-3 text-sm text-slate-400"
      >
        {{ t('livestock.noRelatedPhotos') }}
      </p>
      <ul
        v-else
        class="mt-3 grid grid-cols-3 gap-2"
      >
        <li
          v-for="photo in relatedPhotos"
          :key="photo.id"
        >
          <PhotoThumb
            :storage-path="photo.storagePath"
            :alt="photo.note || formatDateTime(photo.takenAt, locale)"
          />
        </li>
      </ul>
      <UButton
        class="mt-4"
        color="neutral"
        variant="soft"
        size="sm"
        :to="`/dashboard/tank/${tankId}/photos`"
      >
        {{ t('livestock.viewPhotos') }}
      </UButton>
    </section>
  </section>
</template>
