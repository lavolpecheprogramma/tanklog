<script setup lang="ts">
import {
  EQUIPMENT_TYPES,
  type Equipment,
  type EquipmentType
} from '~/types/equipment'
import { toErrorMessage } from '~/utils/errorMessage'
import { formatMoney, parseCostInput, sumCosts } from '~/utils/money'

definePageMeta({
  title: 'Equipment'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const equipmentApi = useEquipment()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formTitle = computed(() => editingId.value ? t('equipment.edit') : t('equipment.new'))

const typePreset = ref<EquipmentType>('filter')
const typeCustom = ref('')
const brandModel = ref('')
const installationDate = ref('')
const maintenanceInterval = ref('')
const cost = ref('')
const notes = ref('')

const equipmentValue = computed(() =>
  sumCosts(equipmentApi.items.value.map(item => item.cost))
)

const typeItems = computed(() =>
  EQUIPMENT_TYPES.map(value => ({
    label: t(`equipment.types.${value}`),
    value
  }))
)

const selectedTypePreset = computed({
  get: () => typePreset.value,
  set: (value: unknown) => { typePreset.value = String(value) as EquipmentType }
})

function resolvedType(): string {
  if (typePreset.value === 'other') {
    return typeCustom.value.trim() || 'other'
  }
  return typePreset.value
}

function typeLabel(value: string) {
  if ((EQUIPMENT_TYPES as string[]).includes(value)) {
    return t(`equipment.types.${value as EquipmentType}`)
  }
  return value
}

function resetForm() {
  editingId.value = null
  typePreset.value = 'filter'
  typeCustom.value = ''
  brandModel.value = ''
  installationDate.value = ''
  maintenanceInterval.value = ''
  cost.value = ''
  notes.value = ''
  formError.value = null
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function startEdit(item: Equipment) {
  editingId.value = item.id
  if ((EQUIPMENT_TYPES as string[]).includes(item.type) && item.type !== 'other') {
    typePreset.value = item.type as EquipmentType
    typeCustom.value = ''
  } else {
    typePreset.value = 'other'
    typeCustom.value = item.type === 'other' ? '' : item.type
  }
  brandModel.value = item.brandModel
  installationDate.value = item.installationDate ?? ''
  maintenanceInterval.value = item.maintenanceInterval ?? ''
  cost.value = item.cost != null ? String(item.cost) : ''
  notes.value = item.notes ?? ''
  formError.value = null
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  resetForm()
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
    await equipmentApi.listByTank(tank.value.id)
  } catch (e) {
    loadError.value = toErrorMessage(e)
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
      type: resolvedType(),
      brandModel: brandModel.value,
      installationDate: installationDate.value || null,
      maintenanceInterval: maintenanceInterval.value || null,
      cost: costValue,
      notes: notes.value || null
    }

    if (editingId.value) {
      await equipmentApi.update(editingId.value, payload)
      toast.add({ title: t('equipment.updated'), color: 'success', icon: 'i-lucide-check' })
    } else {
      await equipmentApi.create(payload)
      toast.add({ title: t('equipment.created'), color: 'success', icon: 'i-lucide-check' })
    }
    closeForm()
  } catch (e) {
    formError.value = toErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function removeItem(id: string) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('equipment.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await equipmentApi.remove(id)
    if (editingId.value === id) closeForm()
    toast.add({ title: t('common.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
  } catch (e) {
    toast.add({
      title: toErrorMessage(e),
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
          {{ t('equipment.title') }}
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
        {{ t('equipment.new') }}
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

    <div class="mt-8">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('equipment.inventory') }}
          <span class="ml-2 text-sm font-normal text-slate-400">
            ({{ equipmentApi.items.value.length }})
          </span>
        </h2>
        <p
          v-if="equipmentValue > 0"
          class="text-sm text-slate-400"
        >
          {{ t('equipment.totalValue', { amount: formatMoney(equipmentValue, locale) }) }}
        </p>
      </div>

      <p
        v-if="equipmentApi.loading.value"
        class="mt-4 text-sm text-slate-400"
      >
        {{ t('common.loading') }}
      </p>
      <UEmpty
        v-else-if="!equipmentApi.items.value.length"
        class="mt-4"
        icon="i-lucide-wrench"
        :title="t('equipment.empty')"
        :description="t('equipment.emptyHint')"
        :actions="[{ label: t('equipment.new'), color: 'primary', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <ul
        v-else
        class="mt-4 space-y-3"
      >
        <li
          v-for="item in equipmentApi.items.value"
          :key="item.id"
          class="rounded-xl border border-cyan-500/10 bg-slate-950/50 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium text-white">
                {{ item.brandModel }}
              </p>
              <p class="mt-1 text-sm text-slate-400">
                {{ typeLabel(item.type) }}
                <span v-if="item.cost != null"> · {{ formatMoney(item.cost, locale) }}</span>
                <span v-if="item.installationDate">
                  · {{ t('equipment.installedOn', { date: item.installationDate }) }}
                </span>
                <span v-if="item.maintenanceInterval">
                  · {{ t('equipment.intervalLabel', { interval: item.maintenanceInterval }) }}
                </span>
              </p>
              <p
                v-if="item.notes"
                class="mt-2 text-sm text-slate-400"
              >
                {{ item.notes }}
              </p>
            </div>
            <div class="flex flex-wrap gap-1">
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
      :open="formOpen"
      :title="formTitle"
      @update:open="(open) => { if (!open) closeForm() }"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('equipment.type')">
            <USelect
              v-model="selectedTypePreset"
              value-key="value"
              :items="typeItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="typePreset === 'other'"
            :label="t('equipment.typeCustom')"
          >
            <UInput
              v-model="typeCustom"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField :label="t('equipment.brandModel')">
            <UInput
              v-model="brandModel"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField :label="t('equipment.installationDate')">
            <UInput
              v-model="installationDate"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('equipment.maintenanceInterval')">
            <UInput
              v-model="maintenanceInterval"
              class="w-full"
              :placeholder="t('equipment.intervalPlaceholder')"
            />
          </UFormField>
          <UFormField
            :label="t('equipment.cost')"
            :hint="t('equipment.costHint')"
          >
            <UInput
              v-model="cost"
              type="text"
              inputmode="decimal"
              class="w-full"
              placeholder="0"
            />
          </UFormField>
          <UFormField :label="t('equipment.notes')">
            <UTextarea
              v-model="notes"
              class="w-full"
              :rows="3"
            />
          </UFormField>

          <p
            v-if="formError"
            class="text-sm text-red-400"
            role="alert"
          >
            {{ formError }}
          </p>

          <div class="flex flex-wrap gap-2">
            <UButton
              type="submit"
              color="primary"
              :loading="busy"
            >
              {{ t('equipment.save') }}
            </UButton>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="closeForm"
            >
              {{ t('common.cancel') }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </section>
</template>
