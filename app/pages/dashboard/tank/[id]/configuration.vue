<script setup lang="ts">
import type { TankType } from '~/types/tank'
import { formatMoney, sumCosts } from '~/utils/money'

definePageMeta({
  title: 'Tank configuration'
})

const { t, locale } = useI18n()
const route = useRoute()
const tanksApi = useTanks()
const livestockApi = useLivestock()
const equipmentApi = useEquipment()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const name = ref('')
const type = ref<TankType>('freshwater')
const volumeLiters = ref<number | undefined>(undefined)
const startDate = ref('')
const notes = ref('')
const busy = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)

const livestockValue = computed(() =>
  sumCosts(
    livestockApi.items.value
      .filter(item => item.status === 'active')
      .map(item => item.cost)
  )
)
const equipmentValue = computed(() =>
  sumCosts(equipmentApi.items.value.map(item => item.cost))
)
const tankValue = computed(() => livestockValue.value + equipmentValue.value)
const showTankValue = computed(() =>
  livestockApi.items.value.length > 0 || equipmentApi.items.value.length > 0
)

const typeItems = computed(() => ([
  { label: t('tanks.types.freshwater'), value: 'freshwater' },
  { label: t('tanks.types.planted'), value: 'planted' },
  { label: t('tanks.types.marine'), value: 'marine' },
  { label: t('tanks.types.reef'), value: 'reef' }
]))

const selectedType = computed({
  get: () => type.value,
  set: (value: unknown) => {
    type.value = String(value) as TankType
  }
})

function hydrate() {
  const current = tank.value
  if (!current) return
  name.value = current.name
  type.value = current.type
  volumeLiters.value = current.volumeLiters ?? undefined
  startDate.value = current.startDate ?? ''
  notes.value = current.notes ?? ''
}

onMounted(async () => {
  if (!tanksApi.tanks.value.length) {
    try {
      await tanksApi.refresh()
    } catch {
      // ignore
    }
  }
  if (!tank.value) {
    error.value = t('tanks.notFound')
    return
  }
  tanksApi.setActiveTankId(tank.value.id)
  hydrate()
  await Promise.all([
    livestockApi.listByTank(tank.value.id, 'all').catch(() => undefined),
    equipmentApi.listByTank(tank.value.id).catch(() => undefined)
  ])
})

watch(tank, () => hydrate())

async function save() {
  if (!tank.value) return
  busy.value = true
  message.value = null
  error.value = null
  try {
    await tanksApi.updateTank(tank.value.id, {
      name: name.value,
      type: type.value,
      volumeLiters: volumeLiters.value ?? null,
      startDate: startDate.value || null,
      notes: notes.value || null
    })
    message.value = t('tanks.saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
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

    <h1 class="font-display text-3xl font-semibold text-white">
      {{ t('tanks.configTitle') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ tank ? tank.name : t('common.loading') }}
    </p>

    <TankSubnav
      v-if="tank"
      class="mt-6"
      :tank-id="tank.id"
    />

    <div
      v-if="tank"
      class="mt-8 space-y-6"
    >
      <form
        class="space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
        @submit.prevent="save"
      >
        <UFormField
          :label="t('tanks.name')"
          required
        >
          <UInput
            v-model="name"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('tanks.type')">
          <USelect
            v-model="selectedType"
            value-key="value"
            :items="typeItems"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('tanks.volume')">
          <UInput
            v-model.number="volumeLiters"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('tanks.startDate')">
          <UInput
            v-model="startDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('tanks.notes')">
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UButton
          type="submit"
          color="primary"
          :loading="busy"
        >
          {{ t('common.save') }}
        </UButton>

        <p
          v-if="message"
          class="text-sm text-cyan-400"
          role="status"
        >
          {{ message }}
        </p>
        <p
          v-if="error"
          class="text-sm text-red-400"
          role="alert"
        >
          {{ error }}
        </p>
      </form>

      <section
        v-if="showTankValue"
        class="rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
      >
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('tanks.tankValue') }}
        </h2>
        <p class="mt-2 text-2xl font-semibold text-white">
          {{ t('tanks.tankValueTotal', { amount: formatMoney(tankValue, locale) }) }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          {{ t('tanks.tankValueBreakdown', {
            livestock: formatMoney(livestockValue, locale),
            equipment: formatMoney(equipmentValue, locale)
          }) }}
        </p>
        <p class="mt-2 text-xs text-slate-500">
          {{ t('tanks.tankValueHint') }}
        </p>
      </section>
    </div>

    <p
      v-else-if="error"
      class="mt-8 text-red-400"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>
