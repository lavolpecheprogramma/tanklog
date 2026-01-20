<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
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

function reminderDueDateOnly(reminder: TankReminder): string {
  if (isDateOnly(reminder.nextDue)) return reminder.nextDue.trim()
  const date = new Date(reminder.nextDue)
  if (Number.isNaN(date.getTime())) return reminder.nextDue
  return toDateOnlyValue(date)
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

const completedReminders = computed(() => reminders.value.filter((reminder) => reminder.repeatEveryDays === null && reminder.lastDone !== null))

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

const titleInput = ref("")
const titleError = ref<string | null>(null)

const nextDueInput = ref("")
const nextDueError = ref<string | null>(null)

const repeatEveryDaysInput = ref("")
const repeatEveryDaysError = ref<string | null>(null)

const notesInput = ref("")

const actingReminderId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionStatus = ref<string | null>(null)

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

onMounted(() => {
  if (!nextDueInput.value) nextDueInput.value = toDatetimeLocalValue(new Date())
})

function resetFormErrors() {
  titleError.value = null
  nextDueError.value = null
  repeatEveryDaysError.value = null
  submitError.value = null
  submitStatus.value = null
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.toString().trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed <= 0) return null
  return parsed
}

function validate() {
  resetFormErrors()

  if (!tank.value) {
    submitError.value = t("pages.reminders.form.errors.noTank")
    return null
  }

  const title = titleInput.value.trim()
  if (!title) {
    titleError.value = t("pages.reminders.form.errors.missingTitle")
    return null
  }

  const nextDue = nextDueInput.value.trim()
  if (!nextDue) {
    nextDueError.value = t("pages.reminders.form.errors.missingNextDue")
    return null
  }

  const dueDate = new Date(nextDue)
  if (Number.isNaN(dueDate.getTime())) {
    nextDueError.value = t("pages.reminders.form.errors.invalidNextDue")
    return null
  }

  const repeatEveryDays = parsePositiveInteger(repeatEveryDaysInput.value)
  console.log(repeatEveryDays)
  if (!Number.isFinite(repeatEveryDays) && repeatEveryDays !== null) {
    repeatEveryDaysError.value = t("pages.reminders.form.errors.invalidRepeatEveryDays")
    return null
  }

  return {
    tank: tank.value,
    title,
    nextDue: dueDate.toISOString(),
    repeatEveryDays,
    notes: notesInput.value,
  }
}

async function onSubmit() {
  submitError.value = null
  submitStatus.value = null

  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    await remindersApi.createReminder({
      spreadsheetId: validated.tank.spreadsheetId,
      title: validated.title,
      nextDue: validated.nextDue,
      repeatEveryDays: validated.repeatEveryDays,
      notes: validated.notes,
    })

    await loadReminders()

    titleInput.value = ""
    repeatEveryDaysInput.value = ""
    notesInput.value = ""
    submitStatus.value = t("pages.reminders.form.success.saved")
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : t("pages.reminders.form.errors.saveFailed")
  } finally {
    isSubmitting.value = false
  }
}

async function onToggleDone(reminder: TankReminder) {
  if (!tank.value) return

  actionError.value = null
  actionStatus.value = null
  actingReminderId.value = reminder.reminderId

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
      })
    }

    await loadReminders()
    actionStatus.value = t("pages.reminders.actions.statusUpdated")
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
            <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.reminders.form.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.reminders.form.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="text-sm text-muted-foreground">
            <form class="space-y-5" @submit.prevent="onSubmit">
              <div class="space-y-2">
                <label for="reminder-title" class="text-foreground">{{ $t("pages.reminders.form.fields.title") }}</label>
                <input
                  id="reminder-title"
                  v-model="titleInput"
                  type="text"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.reminders.form.placeholders.title')"
                  :aria-invalid="titleError ? 'true' : 'false'"
                  aria-describedby="reminder-title-feedback"
                  required
                />
                <p v-if="titleError" id="reminder-title-feedback" class="text-sm text-destructive" role="alert">
                  {{ titleError }}
                </p>
                <p v-else id="reminder-title-feedback" class="sr-only"> </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="reminder-next-due" class="text-foreground">{{ $t("pages.reminders.form.fields.nextDue") }}</label>
                  <input
                    id="reminder-next-due"
                    v-model="nextDueInput"
                    type="datetime-local"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :aria-invalid="nextDueError ? 'true' : 'false'"
                    aria-describedby="reminder-next-due-hint reminder-next-due-feedback"
                    required
                  />
                  <p id="reminder-next-due-hint" class="text-xs text-muted-foreground">
                    {{ $t("pages.reminders.form.hints.nextDue") }}
                  </p>
                  <p v-if="nextDueError" id="reminder-next-due-feedback" class="text-sm text-destructive" role="alert">
                    {{ nextDueError }}
                  </p>
                  <p v-else id="reminder-next-due-feedback" class="sr-only"> </p>
                </div>

                <div class="space-y-2">
                  <label for="reminder-repeat" class="text-foreground">{{ $t("pages.reminders.form.fields.repeatEveryDays") }}</label>
                  <input
                    id="reminder-repeat"
                    v-model="repeatEveryDaysInput"
                    type="number"
                    inputmode="numeric"
                    autocomplete="off"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.reminders.form.placeholders.repeatEveryDays')"
                    :aria-invalid="repeatEveryDaysError ? 'true' : 'false'"
                    aria-describedby="reminder-repeat-hint reminder-repeat-feedback"
                  />
                  <p id="reminder-repeat-hint" class="text-xs text-muted-foreground">
                    {{ $t("pages.reminders.form.hints.repeatEveryDays") }}
                  </p>
                  <p v-if="repeatEveryDaysError" id="reminder-repeat-feedback" class="text-sm text-destructive" role="alert">
                    {{ repeatEveryDaysError }}
                  </p>
                  <p v-else id="reminder-repeat-feedback" class="sr-only"> </p>
                </div>
              </div>

              <div class="space-y-2">
                <label for="reminder-notes" class="text-foreground">{{ $t("pages.reminders.form.fields.notes") }}</label>
                <input
                  id="reminder-notes"
                  v-model="notesInput"
                  type="text"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.reminders.form.placeholders.notes')"
                />
              </div>

              <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
              <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

              <div class="flex flex-wrap gap-2">
                <Button type="submit" :disabled="isSubmitting">
                  <span v-if="isSubmitting">{{ $t("pages.reminders.form.saving") }}</span>
                  <span v-else>{{ $t("pages.reminders.form.save") }}</span>
                </Button>
                <Button variant="secondary" type="button" :disabled="listStatus === 'loading'" @click="loadReminders">
                  <span v-if="listStatus === 'loading'">{{ $t("pages.reminders.list.refreshing") }}</span>
                  <span v-else>{{ $t("pages.reminders.list.refresh") }}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
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
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
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
                        <div class="font-medium text-foreground">{{ reminder.title }}</div>
                        <div class="text-xs text-muted-foreground">{{ formatReminderDate(reminder.nextDue) }}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
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
              <NuxtLink :to="localePath(`/tank/${tankId}`)">{{ $t("nav.overview") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/tests`)">{{ $t("actions.goToWaterTests") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/photos`)">{{ $t("actions.goToPhotos") }}</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink :to="localePath(`/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
            </Button>
          </CardFooter>
        </Card>
      </template>
    </template>
  </section>
</template>

