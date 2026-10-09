<script setup lang="ts">
definePageMeta({
  title: 'Migrate'
})

const { t } = useI18n()
const migrate = useMigrateFromGoogle()

const clientIdInput = ref('')

onMounted(() => {
  migrate.hydrateClientId()
  clientIdInput.value = migrate.clientId.value
})

async function saveClientId() {
  try {
    migrate.saveClientId(clientIdInput.value)
  } catch (e) {
    migrate.error.value = e instanceof Error ? e.message : String(e)
  }
}

function statusColor(status: 'ok' | 'skipped' | 'error') {
  if (status === 'ok') return 'success' as const
  if (status === 'skipped') return 'warning' as const
  return 'error' as const
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <UButton
      to="/dashboard/settings"
      color="neutral"
      variant="ghost"
      class="mb-6"
    >
      ← {{ t('nav.settings') }}
    </UButton>

    <h1 class="font-display text-3xl font-semibold text-white">
      {{ t('migrate.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('migrate.subtitle') }}
    </p>

    <ol class="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
      <li
        v-for="(label, index) in [
          t('migrate.steps.clientId'),
          t('migrate.steps.connect'),
          t('migrate.steps.root'),
          t('migrate.steps.tanks'),
          t('migrate.steps.run')
        ]"
        :key="label"
        class="rounded-full border px-2.5 py-1"
        :class="index <= ['clientId','connect','pickRoot','pickTanks','running','done'].indexOf(migrate.step.value)
          ? 'border-cyan-500/40 text-cyan-200'
          : 'border-slate-700'"
      >
        {{ index + 1 }}. {{ label }}
      </li>
    </ol>

    <p
      v-if="migrate.error.value"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ migrate.error.value }}
    </p>

    <div
      v-if="migrate.step.value === 'clientId' || migrate.step.value === 'connect'"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('migrate.clientIdTitle') }}
      </h2>
      <p class="text-sm text-slate-400">
        {{ t('migrate.clientIdBody') }}
      </p>
      <UFormField :label="t('migrate.clientId')">
        <UInput
          v-model="clientIdInput"
          class="w-full"
          autocomplete="off"
          :placeholder="t('migrate.clientIdPlaceholder')"
        />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          @click="saveClientId"
        >
          {{ t('migrate.saveClientId') }}
        </UButton>
        <UButton
          color="primary"
          :loading="migrate.busy.value"
          :disabled="!clientIdInput.trim()"
          @click="migrate.connectGoogle()"
        >
          {{ t('migrate.connectGoogle') }}
        </UButton>
      </div>
      <p class="text-xs text-slate-400">
        {{ t('migrate.scopesHint') }}
      </p>
    </div>

    <div
      v-else-if="migrate.step.value === 'pickRoot'"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('migrate.rootTitle') }}
      </h2>
      <p
        v-if="!migrate.roots.value.length"
        class="text-sm text-amber-200"
      >
        {{ t('migrate.noRoots') }}
      </p>
      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="root in migrate.roots.value"
          :key="root.id"
        >
          <UButton
            color="primary"
            variant="soft"
            block
            :loading="migrate.busy.value"
            @click="migrate.discoverTanks(root.id)"
          >
            {{ root.name }}
          </UButton>
        </li>
      </ul>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        @click="migrate.discoverRoots()"
      >
        {{ t('migrate.refreshRoots') }}
      </UButton>
    </div>

    <div
      v-else-if="migrate.step.value === 'pickTanks' || migrate.step.value === 'running'"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('migrate.tanksTitle') }}
      </h2>
      <p
        v-if="!migrate.candidates.value.length"
        class="text-sm text-amber-200"
      >
        {{ t('migrate.noTanks') }}
      </p>
      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="tank in migrate.candidates.value"
          :key="tank.legacyTankId"
          class="flex items-center gap-3 rounded-lg border border-cyan-500/10 bg-slate-950/40 px-3 py-2"
        >
          <UCheckbox
            :model-value="migrate.selectedLegacyIds.value.includes(tank.legacyTankId)"
            :label="`${tank.displayName} (${tank.legacyTankId})`"
            @update:model-value="migrate.toggleTank(tank.legacyTankId, Boolean($event))"
          />
        </li>
      </ul>

      <p
        v-if="migrate.progressMessage.value"
        class="text-sm text-cyan-300"
        role="status"
      >
        {{ migrate.progressMessage.value }}
      </p>

      <UButton
        color="primary"
        :loading="migrate.busy.value"
        :disabled="!migrate.selectedLegacyIds.value.length || migrate.step.value === 'running'"
        block
        @click="migrate.runImport()"
      >
        {{ t('migrate.runImport') }}
      </UButton>
    </div>

    <div
      v-else-if="migrate.step.value === 'done'"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('migrate.reportTitle') }}
      </h2>
      <ul class="space-y-3">
        <li
          v-for="report in migrate.reports.value"
          :key="report.legacyTankId"
          class="rounded-lg border border-cyan-500/10 bg-slate-950/50 p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-white">
              {{ report.displayName }}
            </p>
            <UBadge
              :color="statusColor(report.status)"
              variant="subtle"
              size="sm"
            >
              {{ t(`migrate.status.${report.status}`) }}
            </UBadge>
          </div>
          <p
            v-if="report.message"
            class="mt-1 text-sm text-slate-400"
          >
            {{ report.message }}
          </p>
          <p
            v-if="report.counts"
            class="mt-1 text-xs text-slate-400"
          >
            {{ t('migrate.counts', report.counts) }}
          </p>
          <ul
            v-if="report.errors.length"
            class="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200/90"
          >
            <li
              v-for="(err, idx) in report.errors.slice(0, 8)"
              :key="idx"
            >
              {{ err }}
            </li>
            <li v-if="report.errors.length > 8">
              {{ t('migrate.moreErrors', { n: report.errors.length - 8 }) }}
            </li>
          </ul>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <UButton
          color="primary"
          to="/dashboard"
        >
          {{ t('migrate.goDashboard') }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          @click="migrate.disconnectGoogle()"
        >
          {{ t('migrate.disconnectGoogle') }}
        </UButton>
      </div>
    </div>

    <div
      v-if="migrate.accessToken.value && migrate.step.value !== 'done'"
      class="mt-6"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        @click="migrate.disconnectGoogle()"
      >
        {{ t('migrate.disconnectGoogle') }}
      </UButton>
    </div>
  </section>
</template>
