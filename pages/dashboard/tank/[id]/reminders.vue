<script setup lang="ts">
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { EVENT_TYPES, type EventType } from "@/composables/useEvents"
import type { TankReminder } from "@/composables/useReminders"

definePageMeta({
  layout: "tank",
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.reminders.metaTitle"),
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

const remindersApi = useReminders()
const eventsApi = useEvents()

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const reminders = ref<TankReminder[]>([])

const now = ref(new Date())
const today = computed(() => toDateOnlyValue(now.value))

function toDateOnlyValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

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

function toDueEpochMs(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (isDateOnly(trimmed)) {
    const parsed = parseDateOnly(trimmed)
    if (!parsed) return null
    const localEndOfDay = new Date(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999)
    if (Number.isNaN(localEndOfDay.getTime())) return null
    return localEndOfDay.getTime()
  }

  const epochMs = Date.parse(trimmed)
  return Number.isFinite(epochMs) ? epochMs : null
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

function formatDateTime(value: string): string {
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

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
  } catch {
    return String(value)
  }
}

function formatReminderDate(value: string): string {
  return isDateOnly(value) ? formatDateOnly(value) : formatDateTime(value)
}

function reminderDueDateOnly(reminder: TankReminder): string {
  if (isDateOnly(reminder.nextDue)) return reminder.nextDue.trim()
  const date = new Date(reminder.nextDue)
  if (Number.isNaN(date.getTime())) return reminder.nextDue
  return toDateOnlyValue(date)
}

function isReminderEnded(reminder: TankReminder): boolean {
  const endDue = reminder.endDue
  if (!endDue) return false

  const endEpochMs = toDueEpochMs(endDue)
  if (endEpochMs === null) return false

  const nowMs = now.value.getTime()
  if (nowMs > endEpochMs) return true

  const nextDueEpochMs = toDueEpochMs(reminder.nextDue)
  return nextDueEpochMs !== null && nextDueEpochMs > endEpochMs
}

function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function dueLocalDayIndex(value: string): number | null {
  const epochMs = toDueEpochMs(value)
  if (epochMs === null) return null
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return null
  return localDayIndex(date)
}

function reminderOccurrenceIndex(reminder: TankReminder, dueValue: string): number | null {
  if (reminder.repeatEveryDays === null) return null
  if (!reminder.startDue) return null
  if (!Number.isFinite(reminder.repeatEveryDays) || reminder.repeatEveryDays <= 0) return null

  const startIndex = dueLocalDayIndex(reminder.startDue)
  const dueIndex = dueLocalDayIndex(dueValue)
  if (startIndex === null || dueIndex === null) return null

  const diffDays = dueIndex - startIndex
  if (diffDays <= 0) return 1
  return Math.floor(diffDays / reminder.repeatEveryDays) + 1
}

function reminderTotalOccurrences(reminder: TankReminder): number | null {
  if (reminder.repeatEveryDays === null) return null
  if (!reminder.startDue || !reminder.endDue) return null
  if (!Number.isFinite(reminder.repeatEveryDays) || reminder.repeatEveryDays <= 0) return null

  const startIndex = dueLocalDayIndex(reminder.startDue)
  const endIndex = dueLocalDayIndex(reminder.endDue)
  if (startIndex === null || endIndex === null) return null
  if (endIndex < startIndex) return null

  return Math.floor((endIndex - startIndex) / reminder.repeatEveryDays) + 1
}

function reminderOccurrenceLabel(reminder: TankReminder): string | null {
  if (reminder.repeatEveryDays === null) return null
  if (!reminder.startDue) return null

  if (reminder.endDue) {
    const total = reminderTotalOccurrences(reminder)
    if (!total) return null

    const currentRaw = isReminderEnded(reminder)
      ? total
      : reminderOccurrenceIndex(reminder, reminder.nextDue)

    if (!currentRaw) return null
    const current = Math.min(Math.max(currentRaw, 1), total)
    return `${current}/${total}`
  }

  const current = reminderOccurrenceIndex(reminder, reminder.nextDue)
  if (!current) return null
  return `${current}`
}

async function loadReminders() {
  if (!import.meta.client) return

  if (!tank.value) {
    reminders.value = []
    listStatus.value = "idle"
    listError.value = null
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    reminders.value = await remindersApi.listReminders({ spreadsheetId: tank.value.spreadsheetId })
    now.value = new Date()
    listStatus.value = "ready"
  } catch (error) {
    reminders.value = []
    listError.value = error instanceof Error ? error.message : t("pages.reminders.list.errors.loadFailed")
    listStatus.value = "error"
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    loadReminders()
  },
  { immediate: true }
)

const completedReminders = computed(() =>
  reminders.value.filter((reminder) =>
    (reminder.repeatEveryDays === null && reminder.lastDone !== null) || isReminderEnded(reminder)
  )
)

const activeReminders = computed(() =>
  reminders.value.filter((reminder) =>
    !((reminder.repeatEveryDays === null && reminder.lastDone !== null) || isReminderEnded(reminder))
  )
)

const overdueReminders = computed(() =>
  activeReminders.value.filter((reminder) => {
    const dueEpochMs = toDueEpochMs(reminder.nextDue)
    return dueEpochMs !== null && dueEpochMs < now.value.getTime()
  })
)

const upcomingReminders = computed(() =>
  activeReminders.value.filter((reminder) => {
    const dueEpochMs = toDueEpochMs(reminder.nextDue)
    return dueEpochMs === null || dueEpochMs >= now.value.getTime()
  })
)

function reminderBadge(reminder: TankReminder): { label: string; className: string } {
  if (isReminderEnded(reminder)) {
    return {
      label: t("pages.reminders.list.badges.ended"),
      className: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400",
    }
  }

  if (reminder.repeatEveryDays === null && reminder.lastDone !== null) {
    return {
      label: t("pages.reminders.list.badges.done"),
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    }
  }

  const dueEpochMs = toDueEpochMs(reminder.nextDue)

  if (dueEpochMs !== null && dueEpochMs < now.value.getTime()) {
    return {
      label: t("pages.reminders.list.badges.overdue"),
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    }
  }

  if (reminderDueDateOnly(reminder) === today.value) {
    return {
      label: t("pages.reminders.list.badges.dueToday"),
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    }
  }

  return {
    label: t("pages.reminders.list.badges.upcoming"),
    className: "border-border bg-muted/30 text-muted-foreground",
  }
}

const actingReminderId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionStatus = ref<string | null>(null)

type ReminderFormPayload = {
  nextDue: string
  endDue: string | null
  repeatEveryDays: number | null
  eventType: EventType
  description: string
  quantity: number | null
  unit: string | null
  product: string | null
  note: string | null
}

function isReminderFormPayload(value: unknown): value is ReminderFormPayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.nextDue !== "string") return false
  if (candidate.endDue !== null && candidate.endDue !== undefined && typeof candidate.endDue !== "string") return false
  if (candidate.repeatEveryDays !== null && candidate.repeatEveryDays !== undefined && typeof candidate.repeatEveryDays !== "number") return false

  if (typeof candidate.eventType !== "string") return false
  if (!EVENT_TYPES.includes(candidate.eventType as EventType)) return false
  if (typeof candidate.description !== "string") return false

  if (candidate.quantity !== null && candidate.quantity !== undefined) {
    if (typeof candidate.quantity !== "number") return false
    if (!Number.isFinite(candidate.quantity)) return false
  }

  if (candidate.unit !== null && candidate.unit !== undefined && typeof candidate.unit !== "string") return false
  if (candidate.product !== null && candidate.product !== undefined && typeof candidate.product !== "string") return false
  if (candidate.note !== null && candidate.note !== undefined && typeof candidate.note !== "string") return false

  return true
}

async function handleCreateReminder(payload: unknown) {
  if (!tank.value) throw new Error(t("pages.reminders.form.errors.noTank"))
  if (!isReminderFormPayload(payload)) throw new Error(t("pages.reminders.form.errors.saveFailed"))

  await remindersApi.createReminder({
    spreadsheetId: tank.value.spreadsheetId,
    title: payload.description,
    nextDue: payload.nextDue,
    eventType: payload.eventType,
    repeatEveryDays: payload.repeatEveryDays,
    endDue: payload.endDue ?? null,
    quantity: payload.quantity,
    unit: payload.unit,
    product: payload.product,
    notes: payload.note,
  })

  await loadReminders()
}

async function logEventFromReminder(reminder: TankReminder, doneAt: Date) {
  if (!tank.value) return
  if (!reminder.eventType) return

  await eventsApi.createEvent({
    spreadsheetId: tank.value.spreadsheetId,
    date: doneAt,
    eventType: reminder.eventType,
    description: reminder.title,
    quantity: reminder.quantity,
    unit: reminder.unit,
    product: reminder.product,
    note: reminder.notes,
  })
}

async function onToggleDone(reminder: TankReminder) {
  if (!tank.value) return

  actionError.value = null
  actionStatus.value = null
  actingReminderId.value = reminder.reminderId

  const doneAt = new Date()
  const shouldLogEvent = reminder.repeatEveryDays !== null || reminder.lastDone === null

  try {
    if (reminder.repeatEveryDays === null) {
      await remindersApi.setReminderDone({
        spreadsheetId: tank.value.spreadsheetId,
        reminderId: reminder.reminderId,
        done: reminder.lastDone === null,
      })
    } else {
      await remindersApi.markReminderDone({
        spreadsheetId: tank.value.spreadsheetId,
        reminderId: reminder.reminderId,
        doneAt,
      })
    }

    if (shouldLogEvent) {
      try {
        await logEventFromReminder(reminder, doneAt)
      } catch (error) {
        const message = error instanceof Error ? error.message : t("pages.reminders.actions.errors.eventLogFailed")
        actionError.value = t("pages.reminders.actions.errors.eventLogFailedWithMessage", { message })
      }
    }

    await loadReminders()
    if (!actionError.value) {
      actionStatus.value = shouldLogEvent && reminder.eventType ? t("pages.reminders.actions.statusUpdatedAndLogged") : t("pages.reminders.actions.statusUpdated")
    }
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t("pages.reminders.actions.errors.updateFailed")
  } finally {
    actingReminderId.value = null
  }
}

async function onDeleteReminder(reminder: TankReminder) {
  if (!tank.value) return

  actionError.value = null
  actionStatus.value = null

  const confirmed = confirm(
    t("pages.reminders.actions.confirmDelete", {
      title: reminder.title,
    })
  )
  if (!confirmed) return

  actingReminderId.value = reminder.reminderId
  try {
    await remindersApi.deleteReminder({ spreadsheetId: tank.value.spreadsheetId, reminderId: reminder.reminderId })
    await loadReminders()
    actionStatus.value = t("pages.reminders.actions.statusDeleted")
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t("pages.reminders.actions.errors.deleteFailed")
  } finally {
    actingReminderId.value = null
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.reminders.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.reminders.description") }}
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
        {{ $t("pages.reminders.locked") }}
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
        {{ $t("pages.reminders.loadingTanks") }}
      </div>

      <Card v-else-if="!tanks.length">
        <CardHeader>
          <CardTitle>{{ $t("pages.reminders.noTanks.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.reminders.noTanks.description") }}</CardDescription>
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
        <Accordion type="single" collapsible :default-value="undefined">
          <AccordionItem value="create-reminder">
            <AccordionTrigger>
              <div class="flex flex-col gap-y-1.5">
                <div class="font-semibold leading-none tracking-tight">
                  {{ $t("pages.reminders.form.title") }}
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ $t("pages.reminders.form.description") }}
                </p>
              </div>
            </AccordionTrigger>

            <AccordionContent>
              <div class="text-sm text-muted-foreground">
                <EventReminderForm
                  id-base="create-reminder"
                  mode="reminder"
                  :submit-label="$t('pages.reminders.form.save')"
                  :saving-label="$t('pages.reminders.form.saving')"
                  :submit-handler="handleCreateReminder"
                >
                  <template #actions>
                    <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadReminders">
                      <span v-if="listStatus === 'loading'">{{ $t("pages.reminders.list.refreshing") }}</span>
                      <span v-else>{{ $t("pages.reminders.list.refresh") }}</span>
                    </Button>
                  </template>
                </EventReminderForm>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.reminders.list.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.reminders.list.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <div v-if="listStatus === 'loading'">{{ $t("pages.reminders.list.loading") }}</div>

            <div v-else-if="listStatus === 'error'" class="space-y-2">
              <p class="text-sm text-destructive" role="alert">
                {{ $t("pages.reminders.list.errors.loadFailed") }}
                <span v-if="listError">({{ listError }})</span>
              </p>
              <Button variant="secondary" size="sm" type="button" @click="loadReminders">
                {{ $t("pages.reminders.list.refresh") }}
              </Button>
            </div>

            <div v-else-if="listStatus === 'ready' && !reminders.length" class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ $t("pages.reminders.list.empty") }}</p>
              <p class="text-xs text-muted-foreground">{{ $t("pages.reminders.list.emptyHint") }}</p>
            </div>

            <div v-else-if="listStatus === 'ready'" class="space-y-6">
              <p v-if="actionError" class="text-sm text-destructive" role="alert">{{ actionError }}</p>
              <p v-else-if="actionStatus" class="text-sm text-foreground" role="status">{{ actionStatus }}</p>

              <div class="space-y-2">
                <h2 class="text-sm font-medium text-foreground">{{ $t("pages.reminders.list.sections.overdue") }}</h2>
                <p v-if="!overdueReminders.length" class="text-xs text-muted-foreground">—</p>
                <ul
                  v-else
                  role="list"
                  class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
                >
                  <li v-for="reminder in overdueReminders" :key="reminder.reminderId" class="px-4 py-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="font-medium text-foreground">{{ reminder.title }}</div>
                          <span
                            v-if="reminderOccurrenceLabel(reminder)"
                            class="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          >
                            {{ reminderOccurrenceLabel(reminder) }}
                          </span>
                        </div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                        <div class="text-xs text-muted-foreground">
                          {{ $t("pages.reminders.list.labels.initial") }}:
                          <span>{{ reminder.startDue ? formatReminderDate(reminder.startDue) : "—" }}</span>
                          <template v-if="reminder.endDue">
                            <span> · </span>
                            <span>{{ $t("pages.reminders.list.labels.end") }}: {{ formatReminderDate(reminder.endDue) }}</span>
                          </template>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                      <div v-if="reminder.quantity !== null" class="text-right text-sm text-foreground">
                        {{ formatNumber(reminder.quantity) }}
                        <span v-if="reminder.unit" class="text-muted-foreground">{{ reminder.unit }}</span>
                      </div>
                        <span
                          class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                          :class="reminderBadge(reminder).className"
                        >
                          {{ reminderBadge(reminder).label }}
                        </span>
                        <Button
                          size="xs"
                          variant="secondary"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onToggleDone(reminder)"
                        >
                          <span v-if="reminder.repeatEveryDays === null && reminder.lastDone !== null">
                            {{ $t("pages.reminders.actions.undo") }}
                          </span>
                          <span v-else>{{ $t("pages.reminders.actions.done") }}</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onDeleteReminder(reminder)"
                        >
                          {{ $t("pages.reminders.actions.delete") }}
                        </Button>
                      </div>
                    </div>

                    <p
                      v-if="reminder.repeatEveryDays !== null || reminder.notes || reminder.lastDone"
                      class="mt-2 text-xs text-muted-foreground"
                    >
                      <span v-if="reminder.repeatEveryDays !== null">
                        {{ $t("pages.reminders.list.labels.repeatEveryDays") }}: {{ reminder.repeatEveryDays }}
                      </span>
                      <span v-if="reminder.repeatEveryDays !== null && (reminder.notes || reminder.lastDone)"> · </span>
                      <span v-if="reminder.notes">{{ $t("pages.reminders.list.labels.notes") }}: {{ reminder.notes }}</span>
                      <span v-if="reminder.notes && reminder.lastDone"> · </span>
                      <span v-if="reminder.lastDone">
                        {{ $t("pages.reminders.list.labels.lastDone") }}: {{ formatReminderDate(reminder.lastDone) }}
                      </span>
                    </p>
                  </li>
                </ul>
              </div>

              <div class="space-y-2">
                <h2 class="text-sm font-medium text-foreground">{{ $t("pages.reminders.list.sections.upcoming") }}</h2>
                <p v-if="!upcomingReminders.length" class="text-xs text-muted-foreground">—</p>
                <ul
                  v-else
                  role="list"
                  class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
                >
                  <li v-for="reminder in upcomingReminders" :key="reminder.reminderId" class="px-4 py-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="font-medium text-foreground">{{ reminder.title }}</div>
                          <span
                            v-if="reminderOccurrenceLabel(reminder)"
                            class="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          >
                            {{ reminderOccurrenceLabel(reminder) }}
                          </span>
                        </div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                        <div class="text-xs text-muted-foreground">
                          {{ $t("pages.reminders.list.labels.initial") }}:
                          <span>{{ reminder.startDue ? formatReminderDate(reminder.startDue) : "—" }}</span>
                          <template v-if="reminder.endDue">
                            <span> · </span>
                            <span>{{ $t("pages.reminders.list.labels.end") }}: {{ formatReminderDate(reminder.endDue) }}</span>
                          </template>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                      <div v-if="reminder.quantity !== null" class="text-right text-sm text-foreground">
                        {{ formatNumber(reminder.quantity) }}
                        <span v-if="reminder.unit" class="text-muted-foreground">{{ reminder.unit }}</span>
                      </div>
                        <span
                          class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                          :class="reminderBadge(reminder).className"
                        >
                          {{ reminderBadge(reminder).label }}
                        </span>
                        <Button
                          size="xs"
                          variant="secondary"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onToggleDone(reminder)"
                        >
                          <span v-if="reminder.repeatEveryDays === null && reminder.lastDone !== null">
                            {{ $t("pages.reminders.actions.undo") }}
                          </span>
                          <span v-else>{{ $t("pages.reminders.actions.done") }}</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onDeleteReminder(reminder)"
                        >
                          {{ $t("pages.reminders.actions.delete") }}
                        </Button>
                      </div>
                    </div>

                    <p
                      v-if="reminder.repeatEveryDays !== null || reminder.notes || reminder.lastDone"
                      class="mt-2 text-xs text-muted-foreground"
                    >
                      <span v-if="reminder.repeatEveryDays !== null">
                        {{ $t("pages.reminders.list.labels.repeatEveryDays") }}: {{ reminder.repeatEveryDays }}
                      </span>
                      <span v-if="reminder.repeatEveryDays !== null && (reminder.notes || reminder.lastDone)"> · </span>
                      <span v-if="reminder.notes">{{ $t("pages.reminders.list.labels.notes") }}: {{ reminder.notes }}</span>
                      <span v-if="reminder.notes && reminder.lastDone"> · </span>
                      <span v-if="reminder.lastDone">
                        {{ $t("pages.reminders.list.labels.lastDone") }}: {{ formatReminderDate(reminder.lastDone) }}
                      </span>
                    </p>
                  </li>
                </ul>
              </div>

              <div class="space-y-2">
                <h2 class="text-sm font-medium text-foreground">{{ $t("pages.reminders.list.sections.completed") }}</h2>
                <p v-if="!completedReminders.length" class="text-xs text-muted-foreground">—</p>
                <ul
                  v-else
                  role="list"
                  class="divide-y divide-border overflow-hidden rounded-md border border-border bg-background text-sm text-foreground"
                >
                  <li v-for="reminder in completedReminders" :key="reminder.reminderId" class="px-4 py-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="font-medium text-foreground">{{ reminder.title }}</div>
                          <span
                            v-if="reminderOccurrenceLabel(reminder)"
                            class="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          >
                            {{ reminderOccurrenceLabel(reminder) }}
                          </span>
                        </div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                        <div class="text-xs text-muted-foreground">
                          {{ $t("pages.reminders.list.labels.initial") }}:
                          <span>{{ reminder.startDue ? formatReminderDate(reminder.startDue) : "—" }}</span>
                          <template v-if="reminder.endDue">
                            <span> · </span>
                            <span>{{ $t("pages.reminders.list.labels.end") }}: {{ formatReminderDate(reminder.endDue) }}</span>
                          </template>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <div v-if="reminder.quantity !== null" class="text-right text-sm text-foreground">
                          {{ formatNumber(reminder.quantity) }}
                          <span v-if="reminder.unit" class="text-muted-foreground">{{ reminder.unit }}</span>
                        </div>
                        <span
                          class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                          :class="reminderBadge(reminder).className"
                        >
                          {{ reminderBadge(reminder).label }}
                        </span>
                        <Button
                          v-if="!isReminderEnded(reminder) && reminder.repeatEveryDays === null && reminder.lastDone !== null"
                          size="xs"
                          variant="secondary"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onToggleDone(reminder)"
                        >
                          {{ $t("pages.reminders.actions.undo") }}
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          type="button"
                          :disabled="actingReminderId === reminder.reminderId"
                          @click="onDeleteReminder(reminder)"
                        >
                          {{ $t("pages.reminders.actions.delete") }}
                        </Button>
                      </div>
                    </div>

                    <p v-if="reminder.notes || reminder.lastDone" class="mt-2 text-xs text-muted-foreground">
                      <span v-if="reminder.notes">{{ $t("pages.reminders.list.labels.notes") }}: {{ reminder.notes }}</span>
                      <span v-if="reminder.notes && reminder.lastDone"> · </span>
                      <span v-if="reminder.lastDone">
                        {{ $t("pages.reminders.list.labels.lastDone") }}: {{ formatReminderDate(reminder.lastDone) }}
                      </span>
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter class="flex flex-wrap gap-2">
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/dashboard/tank/${tankId}`)">{{ $t("nav.overview") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/dashboard/tank/${tankId}/water-test`)">{{ $t("actions.goToWaterTests") }}</NuxtLink>
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

