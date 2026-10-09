<script setup lang="ts">
import {
  LIVESTOCK_EVENT_TYPES,
  TANK_EVENT_TYPES,
  type EventTargetType,
  type TankLogEvent,
  type TankLogEventType
} from '~/types/event'
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '~/utils/datetime'

definePageMeta({
  title: 'Events'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const eventsApi = useEvents()
const livestockApi = useLivestock()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref<string | null>(null)

const occurredAtLocal = ref(toDatetimeLocalValue(new Date()))
const targetType = ref<EventTargetType>('tank')
const type = ref<TankLogEventType>('maintenance')
const description = ref('')
const quantity = ref('')
const unit = ref('')
const product = ref('')
const note = ref('')
const livestockId = ref('')

const formTitle = computed(() => editingId.value ? t('events.edit') : t('events.new'))

const targetItems = computed(() => [
  { label: t('events.target.tank'), value: 'tank' },
  { label: t('events.target.livestock'), value: 'livestock' }
])

const typeItems = computed(() => {
  const types = targetType.value === 'tank' ? TANK_EVENT_TYPES : LIVESTOCK_EVENT_TYPES
  return types.map(value => ({
    label: t(`events.types.${value}`),
    value
  }))
})

const livestockItems = computed(() =>
  livestockApi.items.value.map(item => ({
    label: item.nameCommon,
    value: item.id
  }))
)

const selectedTargetType = computed({
  get: () => targetType.value,
  set: (value: unknown) => {
    targetType.value = value === 'livestock' ? 'livestock' : 'tank'
  }
})

const selectedType = computed({
  get: () => type.value,
  set: (value: unknown) => {
    type.value = String(value) as TankLogEventType
  }
})

const selectedLivestockId = computed({
  get: () => livestockId.value,
  set: (value: unknown) => {
    livestockId.value = value == null ? '' : String(value)
  }
})

watch(targetType, (next) => {
  const allowed = next === 'tank' ? TANK_EVENT_TYPES : LIVESTOCK_EVENT_TYPES
  if (!allowed.includes(type.value as never)) {
    type.value = allowed[0]!
  }
  if (next === 'tank') livestockId.value = ''
})

function resetForm() {
  editingId.value = null
  occurredAtLocal.value = toDatetimeLocalValue(new Date())
  targetType.value = 'tank'
  type.value = 'maintenance'
  description.value = ''
  quantity.value = ''
  unit.value = ''
  product.value = ''
  note.value = ''
  livestockId.value = ''
  formError.value = null
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function startEdit(event: TankLogEvent) {
  editingId.value = event.id
  occurredAtLocal.value = toDatetimeLocalValue(new Date(event.occurredAt))
  targetType.value = event.targetType
  type.value = event.type
  description.value = event.description
  quantity.value = event.quantity == null ? '' : String(event.quantity)
  unit.value = event.unit ?? ''
  product.value = event.product ?? ''
  note.value = event.note ?? ''
  livestockId.value = event.livestockId ?? ''
  formError.value = null
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  resetForm()
}

function livestockName(id: string | null): string {
  if (!id) return ''
  return livestockApi.items.value.find(item => item.id === id)?.nameCommon ?? id
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
      eventsApi.listByTank(tank.value.id),
      livestockApi.listByTank(tank.value.id, 'active').catch(() => [])
    ])
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function submit() {
  if (!tank.value) return
  busy.value = true
  formError.value = null
  try {
    const occurredAt = fromDatetimeLocalValue(occurredAtLocal.value)
    if (!occurredAt) throw new Error(t('events.errors.invalidDate'))

    const qtyRaw = String(quantity.value ?? '').trim()
    const qty = qtyRaw ? Number(qtyRaw) : null
    if (qtyRaw && !Number.isFinite(qty)) throw new Error(t('events.errors.invalidQuantity'))

    const payload = {
      tankId: tank.value.id,
      occurredAt,
      type: type.value,
      description: description.value,
      quantity: qty,
      unit: unit.value || null,
      product: product.value || null,
      note: note.value || null,
      targetType: targetType.value,
      livestockId: targetType.value === 'livestock' ? livestockId.value || null : null
    }

    if (editingId.value) {
      await eventsApi.update(editingId.value, payload)
      toast.add({ title: t('events.updated'), color: 'success', icon: 'i-lucide-check' })
    } else {
      await eventsApi.create(payload)
      toast.add({ title: t('events.created'), color: 'success', icon: 'i-lucide-check' })
    }
    closeForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeEvent(id: string) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('events.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await eventsApi.remove(id)
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
          {{ t('events.title') }}
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
        {{ t('events.new') }}
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
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('events.history') }}
      </h2>

      <p
        v-if="eventsApi.loading.value"
        class="mt-4 text-sm text-slate-400"
      >
        {{ t('common.loading') }}
      </p>
      <UEmpty
        v-else-if="!eventsApi.events.value.length"
        class="mt-4"
        icon="i-lucide-calendar-days"
        :title="t('events.empty')"
        :description="t('events.emptyHint')"
        :actions="[{ label: t('events.new'), color: 'primary', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <ul
        v-else
        class="mt-4 space-y-3"
      >
        <li
          v-for="event in eventsApi.events.value"
          :key="event.id"
          class="rounded-xl border border-cyan-500/10 bg-slate-950/50 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-sm text-slate-400">
                {{ formatDateTime(event.occurredAt, locale) }}
              </p>
              <p class="mt-1 font-medium text-white">
                {{ event.description }}
              </p>
              <p class="mt-1 text-sm text-cyan-200/80">
                {{ t(`events.types.${event.type}`) }}
                <span v-if="event.targetType === 'livestock'">
                  · {{ livestockName(event.livestockId) }}
                </span>
                <span v-if="event.quantity != null">
                  · {{ event.quantity }}{{ event.unit ? ` ${event.unit}` : '' }}
                </span>
              </p>
              <p
                v-if="event.product || event.note"
                class="mt-1 text-sm text-slate-400"
              >
                <span v-if="event.product">{{ event.product }}</span>
                <span v-if="event.product && event.note"> · </span>
                <span v-if="event.note">{{ event.note }}</span>
              </p>
            </div>
            <div class="flex gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="startEdit(event)"
              >
                {{ t('common.edit') }}
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                @click="removeEvent(event.id)"
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
          id="event-form"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('events.occurredAt')">
            <UInput
              v-model="occurredAtLocal"
              type="datetime-local"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('events.targetLabel')">
            <USelect
              v-model="selectedTargetType"
              value-key="value"
              :items="targetItems"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="targetType === 'livestock'"
            :label="t('events.livestock')"
          >
            <USelect
              v-model="selectedLivestockId"
              value-key="value"
              :items="livestockItems"
              :placeholder="t('events.livestockPlaceholder')"
              class="w-full"
            />
            <p
              v-if="!livestockItems.length"
              class="mt-1 text-xs text-amber-300"
            >
              {{ t('events.noLivestock') }}
            </p>
          </UFormField>

          <UFormField :label="t('events.type')">
            <USelect
              v-model="selectedType"
              value-key="value"
              :items="typeItems"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('events.description')">
            <UInput
              v-model="description"
              required
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('events.quantity')">
              <UInput
                v-model="quantity"
                type="text"
                inputmode="decimal"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('events.unit')">
              <UInput
                v-model="unit"
                class="w-full"
                autocomplete="off"
              />
            </UFormField>
          </div>

          <UFormField :label="t('events.product')">
            <UInput
              v-model="product"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <UFormField :label="t('events.note')">
            <UTextarea
              v-model="note"
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
            form="event-form"
            color="primary"
            :loading="busy"
            :disabled="targetType === 'livestock' && !livestockId"
          >
            {{ editingId ? t('common.save') : t('events.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
