<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { TankReminder } from "@/composables/useReminders"

const localePath = useLocalePath()

const { t, locale } = useI18n()

useHead(() => ({
  title: t("pages.reminders.metaTitle"),
}))

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const isStorageReady = computed(() => storage.hasRootFolderId.value)

const { tanks, status: tanksStatus, error: tanksError } = useTanks()

const remindersApi = useReminders()
const eventsApi = useEvents()

type ReminderWithTank = TankReminder & { tankId: string; tankName: string; spreadsheetId: string }

type LoadStatus = "idle" | "loading" | "ready" | "error"
const listStatus = ref<LoadStatus>("idle")
const listError = ref<string | null>(null)
const reminders = ref<ReminderWithTank[]>([])

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

function formatReminderDate(value: string): string {
  return isDateOnly(value) ? formatDateOnly(value) : formatDateTime(value)
}

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
  } catch {
    return String(value)
  }
}

function reminderDueDateOnly(reminder: ReminderWithTank): string {
  if (isDateOnly(reminder.nextDue)) return reminder.nextDue.trim()
  const date = new Date(reminder.nextDue)
  if (Number.isNaN(date.getTime())) return reminder.nextDue
  return toDateOnlyValue(date)
}

function reminderBadge(reminder: TankReminder): { label: string; className: string } {
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

  if (reminderDueDateOnly(reminder as ReminderWithTank) === today.value) {
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

const completedReminders = computed(() =>
  reminders.value.filter((reminder) => reminder.repeatEveryDays === null && reminder.lastDone !== null)
)

const activeReminders = computed(() =>
  reminders.value.filter((reminder) => !(reminder.repeatEveryDays === null && reminder.lastDone !== null))
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

const actingReminderKey = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionStatus = ref<string | null>(null)

async function logEventFromReminder(reminder: ReminderWithTank, doneAt: Date) {
  if (!reminder.eventType) return

  await eventsApi.createEvent({
    spreadsheetId: reminder.spreadsheetId,
    date: doneAt,
    eventType: reminder.eventType,
    description: reminder.title,
    quantity: reminder.quantity,
    unit: reminder.unit,
    product: reminder.product,
    note: reminder.notes,
  })
}

async function loadAllReminders() {
  if (!import.meta.client) return

  if (tanksStatus.value === "loading") return

  if (!tanks.value.length) {
    reminders.value = []
    listStatus.value = "idle"
    listError.value = null
    return
  }

  listStatus.value = "loading"
  listError.value = null

  try {
    const batches = await Promise.all(
      tanks.value.map(async (tank) => {
        const items = await remindersApi.listReminders({ spreadsheetId: tank.spreadsheetId })
        return items.map((reminder) => ({ ...reminder, tankId: tank.id, tankName: tank.name, spreadsheetId: tank.spreadsheetId }))
      })
    )

    reminders.value = batches.flat().sort((a, b) => (toDueEpochMs(a.nextDue) ?? Infinity) - (toDueEpochMs(b.nextDue) ?? Infinity))
    now.value = new Date()
    listStatus.value = "ready"
  } catch (error) {
    reminders.value = []
    listError.value = error instanceof Error ? error.message : t("pages.reminders.list.errors.loadFailed")
    listStatus.value = "error"
  }
}

async function onToggleDone(reminder: ReminderWithTank) {
  actionError.value = null
  actionStatus.value = null
  actingReminderKey.value = `${reminder.tankId}-${reminder.reminderId}`

  const doneAt = new Date()
  const shouldLogEvent = reminder.repeatEveryDays !== null || reminder.lastDone === null

  try {
    if (reminder.repeatEveryDays === null) {
      await remindersApi.setReminderDone({
        spreadsheetId: reminder.spreadsheetId,
        reminderId: reminder.reminderId,
        done: reminder.lastDone === null,
      })
    } else {
      await remindersApi.markReminderDone({
        spreadsheetId: reminder.spreadsheetId,
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

    await loadAllReminders()
    if (!actionError.value) {
      actionStatus.value = shouldLogEvent && reminder.eventType ? t("pages.reminders.actions.statusUpdatedAndLogged") : t("pages.reminders.actions.statusUpdated")
    }
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t("pages.reminders.actions.errors.updateFailed")
  } finally {
    actingReminderKey.value = null
  }
}

async function onDeleteReminder(reminder: ReminderWithTank) {
  actionError.value = null
  actionStatus.value = null

  const confirmed = confirm(
    t("pages.reminders.actions.confirmDelete", {
      title: reminder.title,
    })
  )
  if (!confirmed) return

  actingReminderKey.value = `${reminder.tankId}-${reminder.reminderId}`
  try {
    await remindersApi.deleteReminder({ spreadsheetId: reminder.spreadsheetId, reminderId: reminder.reminderId })
    await loadAllReminders()
    actionStatus.value = t("pages.reminders.actions.statusDeleted")
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t("pages.reminders.actions.errors.deleteFailed")
  } finally {
    actingReminderKey.value = null
  }
}

watchEffect(() => {
  if (!import.meta.client) return
  if (tanksStatus.value === "loading") return
  if (!isStorageReady.value) return
  if (tanksError.value) return
  if (tanksStatus.value !== "ready") return

  loadAllReminders()
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.reminders.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.reminders.description") }}
      </p>
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
          <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
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
            <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

      <Card v-else>
        <CardHeader>
          <CardTitle>{{ $t("pages.reminders.list.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.reminders.list.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 text-sm text-muted-foreground">
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadAllReminders">
              <span v-if="listStatus === 'loading'">{{ $t("pages.reminders.list.refreshing") }}</span>
              <span v-else>{{ $t("pages.reminders.list.refresh") }}</span>
            </Button>
          </div>

          <div v-if="listStatus === 'loading'">{{ $t("pages.reminders.list.loading") }}</div>

          <div v-else-if="listStatus === 'error'" class="space-y-2">
            <p class="text-sm text-destructive" role="alert">
              {{ $t("pages.reminders.list.errors.loadFailed") }}
              <span v-if="listError">({{ listError }})</span>
            </p>
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
                <li v-for="reminder in overdueReminders" :key="`${reminder.tankId}-${reminder.reminderId}`" class="px-4 py-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <NuxtLink
                          class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          :to="localePath(`/tank/${reminder.tankId}/reminders`)"
                        >
                          {{ reminder.tankName }}
                        </NuxtLink>
                      </div>
                      <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
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
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
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
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
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
                <li v-for="reminder in upcomingReminders" :key="`${reminder.tankId}-${reminder.reminderId}`" class="px-4 py-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <NuxtLink
                          class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          :to="localePath(`/tank/${reminder.tankId}/reminders`)"
                        >
                          {{ reminder.tankName }}
                        </NuxtLink>
                      </div>
                      <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
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
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
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
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
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
                <li v-for="reminder in completedReminders" :key="`${reminder.tankId}-${reminder.reminderId}`" class="px-4 py-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <NuxtLink
                          class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          :to="localePath(`/tank/${reminder.tankId}/reminders`)"
                        >
                          {{ reminder.tankName }}
                        </NuxtLink>
                      </div>
                      <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
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
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
                        @click="onToggleDone(reminder)"
                      >
                        {{ $t("pages.reminders.actions.undo") }}
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        type="button"
                        :disabled="actingReminderKey === `${reminder.tankId}-${reminder.reminderId}`"
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
      </Card>
    </template>
  </section>
</template>

