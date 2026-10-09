<script setup lang="ts">
import {
  LIVESTOCK_CATEGORIES,
  LIVESTOCK_ORIGINS,
  LIVESTOCK_STATUSES,
  LIVESTOCK_TANK_ZONES,
  type Livestock,
  type LivestockCategory,
  type LivestockOrigin,
  type LivestockStatus,
  type LivestockTankZone
} from '~/types/livestock'
import { formatMoney, parseCostInput, sumCosts } from '~/utils/money'

definePageMeta({
  title: 'Livestock'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const livestockApi = useLivestock()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formTitle = computed(() => editingId.value ? t('livestock.edit') : t('livestock.new'))
const filterCategory = ref<'all' | LivestockCategory>('all')
const filterStatus = ref<'all' | LivestockStatus>('all')

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

const filterCategoryItems = computed(() => [
  { label: t('livestock.filters.allCategories'), value: 'all' },
  ...categoryItems.value
])

const filterStatusItems = computed(() => [
  { label: t('livestock.filters.allStatuses'), value: 'all' },
  ...statusItems.value
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
const selectedFilterCategory = computed({
  get: () => filterCategory.value,
  set: (value: unknown) => {
    filterCategory.value = value === 'all' ? 'all' : String(value) as LivestockCategory
  }
})
const selectedFilterStatus = computed({
  get: () => filterStatus.value,
  set: (value: unknown) => {
    filterStatus.value = value === 'all' ? 'all' : String(value) as LivestockStatus
  }
})

const filteredItems = computed(() => {
  return livestockApi.items.value.filter((item) => {
    if (filterCategory.value !== 'all' && item.category !== filterCategory.value) return false
    if (filterStatus.value !== 'all' && item.status !== filterStatus.value) return false
    return true
  })
})

const activeLivestockValue = computed(() =>
  sumCosts(
    livestockApi.items.value
      .filter(item => item.status === 'active')
      .map(item => item.cost)
  )
)

watch(status, (next) => {
  if (next !== 'active' && !dateRemoved.value) {
    dateRemoved.value = todayIsoDate()
  }
  if (next === 'active') {
    dateRemoved.value = ''
  }
})

function resetForm() {
  editingId.value = null
  nameCommon.value = ''
  nameScientific.value = ''
  category.value = 'fish'
  subCategory.value = ''
  tankZone.value = NONE
  origin.value = NONE
  dateAdded.value = todayIsoDate()
  dateRemoved.value = ''
  status.value = 'active'
  cost.value = ''
  notes.value = ''
  formError.value = null
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function startEdit(item: Livestock) {
  editingId.value = item.id
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
  formError.value = null
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  resetForm()
}

function statusTone(value: LivestockStatus) {
  if (value === 'active') return 'success' as const
  if (value === 'dead') return 'error' as const
  return 'neutral' as const
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
    await livestockApi.listByTank(tank.value.id, 'all')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function submit() {
  if (!tank.value) return
  busy.value = true
  formError.value = null
  try {
    let costValue: number | null
    try {
      costValue = parseCostInput(cost.value)
    } catch {
      throw new Error(t('common.invalidCost'))
    }

    const payload = {
      tankId: tank.value.id,
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
    }

    if (editingId.value) {
      await livestockApi.update(editingId.value, payload)
      toast.add({ title: t('livestock.updated'), color: 'success', icon: 'i-lucide-check' })
    } else {
      await livestockApi.create(payload)
      toast.add({ title: t('livestock.created'), color: 'success', icon: 'i-lucide-check' })
    }
    closeForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeItem(id: string) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('livestock.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await livestockApi.remove(id)
    if (editingId.value === id) closeForm()
    toast.add({ title: t('common.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
  } catch (e) {
    toast.add({
      title: e instanceof Error ? e.message : String(e),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
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
      class="mb-6"
    >
      ← {{ t('nav.dashboard') }}
    </UButton>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-semibold text-white">
          {{ t('livestock.title') }}
        </h1>
        <p class="mt-2 text-slate-400">
          {{ tank ? tank.name : t('common.loading') }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        {{ t('livestock.new') }}
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

    <div class="mt-6 flex flex-wrap gap-3">
      <UFormField :label="t('livestock.filters.category')">
        <USelect
          v-model="selectedFilterCategory"
          value-key="value"
          :items="filterCategoryItems"
          class="min-w-40"
        />
      </UFormField>
      <UFormField :label="t('livestock.filters.status')">
        <USelect
          v-model="selectedFilterStatus"
          value-key="value"
          :items="filterStatusItems"
          class="min-w-40"
        />
      </UFormField>
    </div>

    <div class="mt-8">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('livestock.inventory') }}
          <span class="ml-2 text-sm font-normal text-slate-400">
            ({{ filteredItems.length }})
          </span>
        </h2>
        <p
          v-if="activeLivestockValue > 0"
          class="text-sm text-slate-400"
        >
          {{ t('livestock.activeValue', { amount: formatMoney(activeLivestockValue, locale) }) }}
        </p>
      </div>

      <p
        v-if="livestockApi.loading.value"
        class="mt-4 text-sm text-slate-400"
      >
        {{ t('common.loading') }}
      </p>
      <UEmpty
        v-else-if="!filteredItems.length"
        class="mt-4"
        icon="i-lucide-fish"
        :title="t('livestock.empty')"
        :description="t('livestock.emptyHint')"
        :actions="[{ label: t('livestock.new'), color: 'primary', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <ul
        v-else
        class="mt-4 space-y-3"
      >
        <li
          v-for="item in filteredItems"
          :key="item.id"
          class="rounded-xl border border-cyan-500/10 bg-slate-950/50 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  :to="`/dashboard/tank/${tankId}/livestock/${item.id}`"
                  class="font-medium text-white hover:text-cyan-200"
                >
                  {{ item.nameCommon }}
                </NuxtLink>
                <UBadge
                  :color="statusTone(item.status)"
                  variant="subtle"
                  size="sm"
                >
                  {{ t(`livestock.statuses.${item.status}`) }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-slate-400">
                {{ t(`livestock.categories.${item.category}`) }}
                <span v-if="item.nameScientific"> · <em>{{ item.nameScientific }}</em></span>
                <span v-if="item.tankZone"> · {{ t(`livestock.zones.${item.tankZone}`) }}</span>
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ t('livestock.addedOn', { date: item.dateAdded }) }}
                <span v-if="item.cost != null"> · {{ formatMoney(item.cost, locale) }}</span>
              </p>
            </div>
            <div class="flex flex-wrap gap-1">
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                :to="`/dashboard/tank/${tankId}/livestock/${item.id}`"
              >
                {{ t('livestock.open') }}
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="startEdit(item)"
              >
                {{ t('common.edit') }}
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                @click="removeItem(item.id)"
              >
                {{ t('common.delete') }}
              </UButton>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <UModal
      v-if="formOpen"
      v-model:open="formOpen"
      :title="formTitle"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="(v: boolean) => { formOpen = v; if (!v) resetForm() }"
    >
      <template #body>
        <form
          id="livestock-form"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('livestock.nameCommon')">
            <UInput
              v-model="nameCommon"
              required
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <UFormField :label="t('livestock.nameScientific')">
            <UInput
              v-model="nameScientific"
              class="w-full"
              autocomplete="off"
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
              :rows="2"
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
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="close()"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            form="livestock-form"
            color="primary"
            :loading="busy"
          >
            {{ editingId ? t('common.save') : t('livestock.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
