<script setup lang="ts">
import { formatDateTime } from '~/utils/datetime'
import { getReminderDueStatus } from '~/utils/reminderDue'
import { evaluateMeasurement, verdictTone } from '~/utils/parameterRangeEval'
import { computeParameterTrends, summarizeTrends } from '~/utils/parameterTrends'

definePageMeta({
  title: 'Tank'
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const tanksApi = useTanks()
const waterTests = useWaterTests()
const remindersApi = useReminders()
const eventsApi = useEvents()
const rangesApi = useParameterRanges()
const equipmentApi = useEquipment()
const offlineCache = useOfflineCache()
const notifyPrefs = useNotificationPrefs()

const tankId = computed(() => String(route.params.id))
const tank = computed(() => tanksApi.tanks.value.find(item => item.id === tankId.value) ?? null)

const loadError = ref<string | null>(null)
const loading = ref(true)
const markingId = ref<string | null>(null)
const staleBanner = ref<string | null>(null)
const rangeRows = ref<Awaited<ReturnType<typeof rangesApi.listForTank>>>([])

const latestSession = computed(() => waterTests.sessions.value[0] ?? null)
const dueReminders = computed(() => [
  ...remindersApi.dueBuckets.value.overdue,
  ...remindersApi.dueBuckets.value.today
].slice(0, 5))
const recentEvents = computed(() => eventsApi.events.value.slice(0, 5))

const trends = computed(() =>
  computeParameterTrends(waterTests.sessions.value, rangeRows.value)
)
const trendSummary = computed(() => summarizeTrends(trends.value))
const topTrendAlerts = computed(() => trendSummary.value.alerts.slice(0, 4))

async function load() {
  loading.value = true
  loadError.value = null
  staleBanner.value = null
  try {
    if (!tanksApi.tanks.value.length) await tanksApi.refresh()
    if (!tank.value) {
      loadError.value = t('tanks.notFound')
      return
    }
    tanksApi.setActiveTankId(tank.value.id)
    const id = tank.value.id
    const [, , , ranges] = await Promise.all([
      waterTests.listSessions(id),
      remindersApi.listByTank(id),
      eventsApi.listByTank(id),
      rangesApi.listForTank(id).catch(() => [])
    ])
    rangeRows.value = ranges ?? []
    void equipmentApi.listByTank(id).catch(() => undefined)

    await offlineCache.putTankBundle(id, {
      sessions: waterTests.sessions.value,
      reminders: remindersApi.reminders.value,
      events: eventsApi.events.value,
      ranges: rangeRows.value
    })

    const summary = summarizeTrends(
      computeParameterTrends(waterTests.sessions.value, rangeRows.value)
    )
    const strongAlerts = summary.worsening.filter(item => item.alert).length
    if (strongAlerts > 0 && !notifyPrefs.isQuietNow()) {
      toast.add({
        title: t('overview.stabilityAlert', { count: strongAlerts }),
        color: 'warning',
        icon: 'i-lucide-trending-down'
      })
    }
  } catch (e) {
    const cached = tank.value
      ? await offlineCache.getTankBundle(tank.value.id)
      : null
    if (cached) {
      waterTests.sessions.value = cached.sessions
      remindersApi.reminders.value = cached.reminders
      eventsApi.events.value = cached.events
      rangeRows.value = cached.ranges
      staleBanner.value = t('overview.staleCache', {
        when: formatDateTime(new Date(cached.cachedAt).toISOString(), locale.value)
      })
    } else {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    loading.value = false
  }
}

async function markReminderDone(id: string) {
  markingId.value = id
  try {
    await remindersApi.markDone(id, { createEvent: true })
    await eventsApi.listByTank(tankId.value).catch(() => undefined)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    markingId.value = null
  }
}

function dueTone(nextDue: string) {
  const status = getReminderDueStatus(nextDue)
  if (status === 'overdue') return 'error' as const
  if (status === 'today') return 'warning' as const
  return 'neutral' as const
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
          {{ tank?.name || t('tanks.detailTitle') }}
        </h1>
        <p
          v-if="tank"
          class="mt-2 text-slate-400"
        >
          {{ t(`tanks.types.${tank.type}`) }}
          <span v-if="tank.volumeLiters != null"> · {{ tank.volumeLiters }} L</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          :to="`/dashboard/tank/${tankId}/water-test`"
          color="primary"
          size="sm"
        >
          {{ t('overview.newTest') }}
        </UButton>
        <UButton
          :to="`/dashboard/tank/${tankId}/configuration`"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ t('tanks.configTitle') }}
        </UButton>
      </div>
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

    <p
      v-if="loading"
      class="mt-8 text-slate-400"
    >
      {{ t('common.loading') }}
    </p>

    <div
      v-else-if="tank"
      class="mt-8 space-y-6"
    >
      <section
        v-if="trendSummary.total > 0"
        class="rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-display text-lg font-semibold text-cyan-100">
            {{ t('overview.stability') }}
          </h2>
          <p class="text-sm text-slate-400">
            {{ t('overview.stabilitySummary', {
              inRange: trendSummary.inRange,
              total: trendSummary.total,
              worsening: trendSummary.worseningCount,
              improving: trendSummary.improvingCount
            }) }}
          </p>
        </div>
        <ul
          v-if="topTrendAlerts.length"
          class="mt-3 flex flex-wrap gap-2"
        >
          <li
            v-for="item in topTrendAlerts"
            :key="item.parameter"
          >
            <UBadge
              :color="item.alert || item.latestVerdict === 'critical'
                ? 'error'
                : item.worsening
                  ? 'warning'
                  : item.improving
                    ? 'success'
                    : 'warning'"
              variant="subtle"
            >
              {{ item.parameter }}
              <span v-if="item.alert"> · {{ t('overview.worsening') }}</span>
              <span v-else-if="item.worsening"> · {{ t('overview.worseningMild') }}</span>
              <span v-else-if="item.improving"> · {{ t('overview.improving') }}</span>
            </UBadge>
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-sm text-slate-400"
        >
          {{ t('overview.stabilityOk') }}
        </p>
        <p
          v-if="equipmentApi.items.value.length"
          class="mt-3 text-xs text-slate-400"
        >
          {{ t('overview.equipmentCount', { count: equipmentApi.items.value.length }) }}
        </p>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-display text-lg font-semibold text-cyan-100">
            {{ t('overview.latestTest') }}
          </h2>
          <UButton
            :to="`/dashboard/tank/${tankId}/water-test`"
            size="xs"
            color="neutral"
            variant="ghost"
          >
            {{ t('overview.seeAll') }}
          </UButton>
        </div>

        <div
          v-if="!latestSession"
          class="mt-6 text-center"
        >
          <p class="text-sm text-slate-400">
            {{ t('overview.noTests') }}
          </p>
          <UButton
            class="mt-4"
            :to="`/dashboard/tank/${tankId}/water-test`"
            color="primary"
            size="sm"
          >
            {{ t('overview.newTest') }}
          </UButton>
        </div>

        <div
          v-else
          class="mt-4"
        >
          <p class="text-sm text-slate-400">
            {{ formatDateTime(latestSession.measuredAt, locale) }}
            · {{ t('waterTests.measurementCount', { count: latestSession.measurements.length }) }}
          </p>
          <ul class="mt-3 flex flex-wrap gap-2">
            <li
              v-for="m in latestSession.measurements"
              :key="m.id"
            >
              <UBadge
                :color="verdictTone(evaluateMeasurement(m.parameter, m.value, rangeRows))"
                variant="subtle"
              >
                {{ m.parameter }} {{ m.value }}
              </UBadge>
            </li>
          </ul>
        </div>
      </section>

      <section class="rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-display text-lg font-semibold text-cyan-100">
            {{ t('overview.dueReminders') }}
          </h2>
          <UButton
            :to="`/dashboard/tank/${tankId}/reminders`"
            size="xs"
            color="neutral"
            variant="ghost"
          >
            {{ t('overview.seeAll') }}
          </UButton>
        </div>

        <p
          v-if="!dueReminders.length"
          class="mt-6 text-sm text-slate-400"
        >
          {{ t('overview.noDue') }}
        </p>
        <ul
          v-else
          class="mt-4 space-y-3"
        >
          <li
            v-for="reminder in dueReminders"
            :key="reminder.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/10 bg-slate-950/40 px-3 py-2"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-white">
                  {{ reminder.title }}
                </p>
                <UBadge
                  :color="dueTone(reminder.nextDue)"
                  variant="subtle"
                  size="sm"
                >
                  {{ t(`reminders.dueStatus.${getReminderDueStatus(reminder.nextDue)}`) }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-400">
                {{ formatDateTime(reminder.nextDue, locale) }}
              </p>
            </div>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              :loading="markingId === reminder.id"
              @click="markReminderDone(reminder.id)"
            >
              {{ t('reminders.markDone') }}
            </UButton>
          </li>
        </ul>
      </section>

      <section class="rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5 lg:col-span-2">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-display text-lg font-semibold text-cyan-100">
            {{ t('overview.recentEvents') }}
          </h2>
          <UButton
            :to="`/dashboard/tank/${tankId}/events`"
            size="xs"
            color="neutral"
            variant="ghost"
          >
            {{ t('overview.seeAll') }}
          </UButton>
        </div>

        <p
          v-if="!recentEvents.length"
          class="mt-6 text-sm text-slate-400"
        >
          {{ t('overview.noEvents') }}
        </p>
        <ul
          v-else
          class="mt-4 divide-y divide-cyan-500/10"
        >
          <li
            v-for="event in recentEvents"
            :key="event.id"
            class="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p class="font-medium text-white">
                {{ event.description }}
              </p>
              <p class="text-sm text-slate-400">
                {{ t(`events.types.${event.type}`) }}
              </p>
            </div>
            <p class="text-xs text-slate-400">
              {{ formatDateTime(event.occurredAt, locale) }}
            </p>
          </li>
        </ul>
      </section>

      <div class="flex flex-wrap gap-2 lg:col-span-2">
        <UButton
          :to="`/dashboard/tank/${tankId}/reminders`"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ t('overview.newReminder') }}
        </UButton>
        <UButton
          :to="`/dashboard/tank/${tankId}/events`"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ t('overview.logEvent') }}
        </UButton>
        <UButton
          :to="`/dashboard/tank/${tankId}/photos`"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ t('overview.openPhotos') }}
        </UButton>
        <UButton
          :to="`/dashboard/tank/${tankId}/equipment`"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ t('tanks.nav.equipment') }}
        </UButton>
      </div>
      </div>
    </div>
  </section>
</template>
