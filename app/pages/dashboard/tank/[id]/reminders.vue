<script setup lang="ts">
import { TANK_EVENT_TYPES, type TankEventType } from '~/types/event'
import type { Reminder } from '~/types/reminder'
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '~/utils/datetime'
import { getReminderDueStatus, isReminderTimeDue } from '~/utils/reminderDue'

definePageMeta({
  title: 'Reminders'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const remindersApi = useReminders()
const notifications = useNotifications()
const oneSignalConfig = useOneSignalConfig()
const oneSignal = useOneSignal()
const { confirm: askConfirm } = useConfirmDialog()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const actionId = ref<string | null>(null)

const title = ref('')
const nextDueLocal = ref(toDatetimeLocalValue(new Date()))
const eventType = ref<TankEventType>('maintenance')
const repeatEveryDays = ref('')
const endDue = ref('')
const notes = ref('')
const quantity = ref('')
const unit = ref('')
const product = ref('')
const createEventOnDone = ref(true)

const formTitle = computed(() => editingId.value ? t('reminders.edit') : t('reminders.new'))

const eventTypeItems = computed(() =>
  TANK_EVENT_TYPES.map(value => ({
    label: t(`events.types.${value}`),
    value
  }))
)

const selectedEventType = computed({
  get: () => eventType.value,
  set: (value: unknown) => {
    eventType.value = String(value) as TankEventType
  }
})

const permissionLabel = computed(() => {
  const state = notifications.permission.value
  if (state === 'unsupported') return t('reminders.notifications.unsupported')
  if (state === 'granted') return t('reminders.notifications.granted')
  if (state === 'denied') return t('reminders.notifications.denied')
  return t('reminders.notifications.default')
})

const oneSignalLabel = computed(() => {
  if (!oneSignalConfig.isEnabled.value) return t('reminders.oneSignal.off')
  if (oneSignalConfig.canSchedule.value && oneSignal.isOptedIn.value) {
    return t('reminders.oneSignal.scheduled')
  }
  if (oneSignal.isOptedIn.value) return t('reminders.oneSignal.subscribed')
  return t('reminders.oneSignal.enabled')
})

const buckets = computed(() => ([
  { key: 'overdue' as const, items: remindersApi.dueBuckets.value.overdue },
  { key: 'today' as const, items: remindersApi.dueBuckets.value.today },
  { key: 'upcoming' as const, items: remindersApi.dueBuckets.value.upcoming }
]))

function resetForm() {
  editingId.value = null
  title.value = ''
  nextDueLocal.value = toDatetimeLocalValue(new Date())
  eventType.value = 'maintenance'
  repeatEveryDays.value = ''
  endDue.value = ''
  notes.value = ''
  quantity.value = ''
  unit.value = ''
  product.value = ''
  formError.value = null
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function startEdit(reminder: Reminder) {
  editingId.value = reminder.id
  title.value = reminder.title
  nextDueLocal.value = toDatetimeLocalValue(new Date(reminder.nextDue))
  eventType.value = reminder.eventType
  repeatEveryDays.value = reminder.repeatEveryDays == null ? '' : String(reminder.repeatEveryDays)
  endDue.value = reminder.endDue ?? ''
  notes.value = reminder.notes ?? ''
  quantity.value = reminder.quantity == null ? '' : String(reminder.quantity)
  unit.value = reminder.unit ?? ''
  product.value = reminder.product ?? ''
  formError.value = null
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  resetForm()
}

function dueTone(status: ReturnType<typeof getReminderDueStatus>) {
  if (status === 'overdue') return 'error' as const
  if (status === 'today') return 'warning' as const
  return 'neutral' as const
}

function notifyDueReminders() {
  // Local Notification is an in-app fallback. Only fire once the clock time is due —
  // calendar "today" must not notify hours early. When OneSignal already scheduled
  // a push for this reminder, skip local to avoid an instant duplicate.
  for (const reminder of remindersApi.reminders.value) {
    if (!isReminderTimeDue(reminder.nextDue)) continue
    if (oneSignalConfig.canSchedule.value && reminder.oneSignalMessageId) continue

    const status = getReminderDueStatus(reminder.nextDue)
    notifications.notifyOnce(
      reminder.id,
      reminder.title,
      t(`reminders.dueStatus.${status}`)
    )
  }
}

async function requestNotifyPermission() {
  await notifications.requestPermission()
  notifyDueReminders()
}

const offlineCache = useOfflineCache()
const staleBanner = ref<string | null>(null)

async function load() {
  loadError.value = null
  staleBanner.value = null
  notifications.refreshPermission()
  try {
    if (!tanksApi.tanks.value.length) await tanksApi.refresh()
    if (!tank.value) {
      loadError.value = t('tanks.notFound')
      return
    }
    tanksApi.setActiveTankId(tank.value.id)
    await remindersApi.listByTank(tank.value.id)
    const previous = await offlineCache.getTankBundle(tank.value.id)
    await offlineCache.putTankBundle(tank.value.id, {
      sessions: previous?.sessions ?? [],
      reminders: remindersApi.reminders.value,
      events: previous?.events ?? [],
      ranges: previous?.ranges ?? []
    })
    notifyDueReminders()
  } catch (e) {
    const cached = tank.value
      ? await offlineCache.getTankBundle(tank.value.id)
      : null
    if (cached?.reminders?.length) {
      remindersApi.reminders.value = cached.reminders
      staleBanner.value = t('overview.staleCache', {
        when: formatDateTime(new Date(cached.cachedAt).toISOString(), locale.value)
      })
    } else {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }
}

async function submit() {
  if (!tank.value) return
  busy.value = true
  formError.value = null
  try {
    const nextDue = fromDatetimeLocalValue(nextDueLocal.value)
    if (!nextDue) throw new Error(t('reminders.errors.invalidDate'))

    const repeatRaw = String(repeatEveryDays.value ?? '').trim()
    const repeat = repeatRaw ? Number(repeatRaw) : null
    if (repeatRaw && (!Number.isInteger(repeat) || (repeat ?? 0) <= 0)) {
      throw new Error(t('reminders.errors.invalidRepeat'))
    }

    const qtyRaw = String(quantity.value ?? '').trim()
    const qty = qtyRaw ? Number(qtyRaw) : null
    if (qtyRaw && !Number.isFinite(qty)) throw new Error(t('reminders.errors.invalidQuantity'))

    const payload = {
      tankId: tank.value.id,
      title: title.value,
      nextDue,
      eventType: eventType.value,
      repeatEveryDays: repeat,
      endDue: endDue.value || null,
      notes: notes.value || null,
      quantity: qty,
      unit: unit.value || null,
      product: product.value || null
    }

    if (editingId.value) {
      await remindersApi.update(editingId.value, payload)
      toast.add({ title: t('reminders.updated'), color: 'success', icon: 'i-lucide-check' })
    } else {
      await remindersApi.create(payload)
      toast.add({ title: t('reminders.created'), color: 'success', icon: 'i-lucide-check' })
    }
    closeForm()
    notifyDueReminders()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function markDone(id: string) {
  actionId.value = id
  try {
    await remindersApi.markDone(id, { createEvent: createEventOnDone.value })
    toast.add({ title: t('reminders.markedDone'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({
      title: e instanceof Error ? e.message : String(e),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    actionId.value = null
  }
}

async function snooze(id: string, amount: '1h' | '1d') {
  actionId.value = id
  try {
    const reminder = remindersApi.reminders.value.find(item => item.id === id)
    if (!reminder) throw new Error(t('reminders.notFound'))
    const base = Math.max(Date.parse(reminder.nextDue), Date.now())
    const next = new Date(base)
    if (amount === '1h') next.setHours(next.getHours() + 1)
    else next.setDate(next.getDate() + 1)
    await remindersApi.update(id, { nextDue: next })
    toast.add({ title: t('reminders.snoozed'), color: 'success', icon: 'i-lucide-alarm-clock' })
  } catch (e) {
    toast.add({
      title: e instanceof Error ? e.message : String(e),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    actionId.value = null
  }
}

async function removeReminder(id: string) {
  const ok = await askConfirm({
    title: t('common.confirmTitle'),
    description: t('reminders.confirmDelete'),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await remindersApi.remove(id)
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

let pollTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pollTimer = setInterval(notifyDueReminders, 60_000)
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
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
          {{ t('reminders.title') }}
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
        {{ t('reminders.new') }}
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
    <p
      v-if="staleBanner"
      class="mt-4 text-sm text-amber-300"
      role="status"
    >
      {{ staleBanner }}
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-cyan-100">
          {{ t('reminders.notifications.title') }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          {{ permissionLabel }}
        </p>
      </div>
      <UButton
        v-if="notifications.permission.value === 'default'"
        color="primary"
        variant="soft"
        @click="requestNotifyPermission"
      >
        {{ t('reminders.notifications.enable') }}
      </UButton>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-cyan-100">
          {{ t('reminders.oneSignal.title') }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          {{ oneSignalLabel }}
        </p>
      </div>
      <UButton
        to="/dashboard/settings"
        color="neutral"
        variant="soft"
        size="sm"
      >
        {{ t('reminders.oneSignal.openSettings') }}
      </UButton>
    </div>

    <div class="mt-6 flex items-center gap-2">
      <UCheckbox
        v-model="createEventOnDone"
        :label="t('reminders.createEventOnDone')"
      />
    </div>

    <div class="mt-8 space-y-8">
      <section
        v-for="bucket in buckets"
        :key="bucket.key"
      >
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t(`reminders.buckets.${bucket.key}`) }}
          <span class="ml-2 text-sm font-normal text-slate-400">
            ({{ bucket.items.length }})
          </span>
        </h2>

        <p
          v-if="remindersApi.loading.value && !remindersApi.reminders.value.length"
          class="mt-3 text-sm text-slate-400"
        >
          {{ t('common.loading') }}
        </p>
        <UEmpty
          v-else-if="!bucket.items.length"
          class="mt-3"
          size="sm"
          icon="i-lucide-bell-off"
          :title="t('reminders.emptyBucket')"
          :actions="bucket.key === 'upcoming' ? [{ label: t('reminders.new'), color: 'primary', variant: 'soft', size: 'sm', icon: 'i-lucide-plus', onClick: openCreate }] : undefined"
        />

        <ul
          v-else
          class="mt-3 space-y-3"
        >
          <li
            v-for="reminder in bucket.items"
            :key="reminder.id"
            class="rounded-xl border border-cyan-500/10 bg-slate-950/50 p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-medium text-white">
                    {{ reminder.title }}
                  </p>
                  <UBadge
                    :color="dueTone(getReminderDueStatus(reminder.nextDue))"
                    variant="subtle"
                    size="sm"
                  >
                    {{ t(`reminders.dueStatus.${getReminderDueStatus(reminder.nextDue)}`) }}
                  </UBadge>
                </div>
                <p class="mt-1 text-sm text-slate-400">
                  {{ formatDateTime(reminder.nextDue, locale) }}
                  · {{ t(`events.types.${reminder.eventType}`) }}
                  <span v-if="reminder.repeatEveryDays">
                    · {{ t('reminders.everyNDays', { n: reminder.repeatEveryDays }) }}
                  </span>
                </p>
              </div>
              <div class="flex flex-wrap gap-1">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  :loading="actionId === reminder.id"
                  @click="markDone(reminder.id)"
                >
                  {{ t('reminders.markDone') }}
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :loading="actionId === reminder.id"
                  @click="snooze(reminder.id, '1h')"
                >
                  {{ t('reminders.snooze1h') }}
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :loading="actionId === reminder.id"
                  @click="snooze(reminder.id, '1d')"
                >
                  {{ t('reminders.snooze1d') }}
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="startEdit(reminder)"
                >
                  {{ t('common.edit') }}
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="removeReminder(reminder.id)"
                >
                  {{ t('common.delete') }}
                </UButton>
              </div>
            </div>
          </li>
        </ul>
      </section>
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
          id="reminder-form"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField :label="t('reminders.fieldTitle')">
            <UInput
              v-model="title"
              required
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <UFormField :label="t('reminders.nextDue')">
            <UInput
              v-model="nextDueLocal"
              type="datetime-local"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('reminders.eventType')">
            <USelect
              v-model="selectedEventType"
              value-key="value"
              :items="eventTypeItems"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('reminders.repeatEveryDays')">
            <UInput
              v-model="repeatEveryDays"
              type="number"
              min="1"
              step="1"
              class="w-full"
              :placeholder="t('reminders.repeatPlaceholder')"
            />
          </UFormField>

          <UFormField :label="t('reminders.endDue')">
            <UInput
              v-model="endDue"
              type="date"
              class="w-full"
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
              />
            </UFormField>
          </div>

          <UFormField :label="t('events.product')">
            <UInput
              v-model="product"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('reminders.notes')">
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
            form="reminder-form"
            color="primary"
            :loading="busy"
          >
            {{ editingId ? t('common.save') : t('reminders.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
