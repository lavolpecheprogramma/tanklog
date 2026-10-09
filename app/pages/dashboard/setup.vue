<script setup lang="ts">
definePageMeta({
  title: 'Setup'
})

const { t } = useI18n()
const health = useSchemaHealth()
const copying = ref(false)
const copyOk = ref(false)
const copyError = ref<string | null>(null)

onMounted(() => {
  void health.check({ force: true })
})

async function recheck() {
  copyOk.value = false
  copyError.value = null
  await health.check({ force: true })
  if (health.isHealthy.value) {
    await navigateTo('/dashboard')
  }
}

async function copySql() {
  copying.value = true
  copyOk.value = false
  copyError.value = null
  try {
    await health.copySchemaSql()
    copyOk.value = true
  } catch (e) {
    copyError.value = e instanceof Error ? e.message : String(e)
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <h1 class="font-display text-3xl font-semibold text-white">
      {{ t('setup.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('setup.subtitle') }}
    </p>

    <div
      class="mt-8 rounded-xl border p-5"
      :class="health.isHealthy.value
        ? 'border-emerald-500/30 bg-emerald-950/30'
        : 'border-amber-500/30 bg-amber-950/20'"
    >
      <p class="font-medium text-slate-100">
        {{ health.isHealthy.value ? t('setup.statusOk') : t('setup.statusMissing') }}
      </p>
      <p
        v-if="health.message.value"
        class="mt-2 break-words font-mono text-sm text-slate-400"
        role="status"
      >
        {{ health.message.value }}
      </p>
    </div>

    <ol class="mt-8 list-decimal space-y-3 ps-5 text-slate-300">
      <li>{{ t('setup.step1') }}</li>
      <li>{{ t('setup.step2') }}</li>
      <li>{{ t('setup.step3') }}</li>
      <li>{{ t('setup.step4') }}</li>
    </ol>

    <div class="mt-8 flex flex-wrap gap-3">
      <UButton
        color="primary"
        :loading="copying"
        @click="copySql"
      >
        {{ t('setup.copySql') }}
      </UButton>
      <UButton
        :to="health.schemaSqlUrl"
        target="_blank"
        color="neutral"
        variant="soft"
        trailing-icon="i-lucide-download"
      >
        {{ t('setup.downloadSql') }}
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        :loading="health.status.value === 'checking'"
        @click="recheck"
      >
        {{ t('setup.recheck') }}
      </UButton>
    </div>

    <p
      v-if="copyOk"
      class="mt-4 text-sm text-cyan-400"
      role="status"
    >
      {{ t('setup.copied') }}
    </p>
    <p
      v-if="copyError"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ copyError }}
    </p>

    <p class="mt-10 text-sm text-slate-400">
      {{ t('setup.docsHint') }}
      <code class="text-cyan-400/90">docs/supabase-setup.md</code>
    </p>

    <div class="mt-6 flex gap-3">
      <UButton
        to="/dashboard/settings"
        color="neutral"
        variant="ghost"
      >
        {{ t('nav.settings') }}
      </UButton>
      <UButton
        v-if="health.isHealthy.value"
        to="/dashboard"
        color="primary"
        variant="soft"
      >
        {{ t('nav.dashboard') }}
      </UButton>
    </div>
  </section>
</template>
