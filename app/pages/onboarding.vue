<script setup lang="ts">
definePageMeta({
  title: 'Onboarding'
})

const { t } = useI18n()
const config = useSupabaseConfig()
const auth = useAuth()
const health = useSchemaHealth()
const site = useSiteMeta()

useSeoMeta({
  title: () => t('onboarding.title'),
  description: () => t('onboarding.subtitle'),
  ogTitle: () => t('onboarding.title'),
  ogDescription: () => t('onboarding.subtitle'),
  ogImage: () => site.ogImage.value,
  twitterCard: 'summary_large_image'
})

const step = ref(1)
const projectUrl = ref(config.url.value ?? '')
const anonKey = ref(config.anonKey.value ?? '')
const email = ref('')
const password = ref('')
const mode = ref<'signup' | 'signin'>('signup')
const message = ref<string | null>(null)
const error = ref<string | null>(null)
const copying = ref(false)

const maxStep = 4

onMounted(() => {
  if (config.isConfigured.value) {
    step.value = Math.max(step.value, 3)
  }
  if (auth.isAuthenticated.value) {
    void health.check({ force: true }).then(() => {
      step.value = health.isHealthy.value ? 4 : 2
    })
  }
})

async function copySql() {
  copying.value = true
  error.value = null
  message.value = null
  try {
    await health.copySchemaSql()
    message.value = t('setup.copied')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    copying.value = false
  }
}

async function saveKeys() {
  message.value = null
  error.value = null
  try {
    new URL(projectUrl.value.trim())
  } catch {
    error.value = t('auth.errors.invalidUrl')
    return
  }
  if (!anonKey.value.trim()) {
    error.value = t('auth.errors.configRequired')
    return
  }
  config.setConfig({
    url: projectUrl.value.trim(),
    anonKey: anonKey.value.trim()
  })
  await auth.bootstrap()
  message.value = t('auth.configSaved')
  step.value = 4
}

async function submitAuth() {
  message.value = null
  error.value = null
  auth.error.value = null
  if (!config.isConfigured.value) {
    error.value = t('auth.errors.configRequired')
    step.value = 3
    return
  }
  try {
    if (mode.value === 'signin') {
      await auth.signInWithPassword(email.value, password.value)
    } else {
      const result = await auth.signUpWithPassword(email.value, password.value)
      if (!result.session) {
        message.value = t('auth.checkEmail')
        return
      }
    }
    await health.check({ force: true })
    if (health.needsSetup.value) {
      message.value = t('onboarding.schemaStillMissing')
      step.value = 2
      return
    }
    await navigateTo('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : (auth.error.value || String(e))
  }
}

async function finishIfReady() {
  error.value = null
  await health.check({ force: true })
  if (!auth.isAuthenticated.value) {
    step.value = 4
    return
  }
  if (health.needsSetup.value) {
    error.value = t('onboarding.schemaStillMissing')
    step.value = 2
    return
  }
  await navigateTo('/dashboard')
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <p class="font-display text-sm font-medium tracking-[0.2em] text-cyan-400/80 uppercase">
      {{ t('app.name') }}
    </p>
    <h1 class="font-display mt-3 text-3xl font-semibold text-white">
      {{ t('onboarding.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('onboarding.subtitle') }}
    </p>

    <ol class="mt-6 flex flex-wrap gap-2 text-xs">
      <li
        v-for="n in maxStep"
        :key="n"
        class="rounded-full border px-2.5 py-1"
        :class="n <= step
          ? 'border-cyan-500/40 text-cyan-200'
          : 'border-slate-700 text-slate-400'"
      >
        {{ n }}. {{ t(`onboarding.steps.${n}`) }}
      </li>
    </ol>

    <p
      v-if="message"
      class="mt-4 text-sm text-cyan-400"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="error || auth.error.value"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ error || auth.error.value }}
    </p>

    <div
      v-if="step === 1"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('onboarding.step1Title') }}
      </h2>
      <ol class="list-decimal space-y-2 ps-5 text-sm text-slate-300">
        <li>{{ t('onboarding.step1a') }}</li>
        <li>{{ t('onboarding.step1b') }}</li>
        <li>{{ t('onboarding.step1c') }}</li>
      </ol>
      <div class="flex flex-wrap gap-2">
        <UButton
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener"
          color="primary"
          trailing-icon="i-lucide-external-link"
        >
          {{ t('onboarding.openSupabase') }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          @click="step = 2"
        >
          {{ t('onboarding.next') }}
        </UButton>
      </div>
    </div>

    <div
      v-else-if="step === 2"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('onboarding.step2Title') }}
      </h2>
      <ol class="list-decimal space-y-2 ps-5 text-sm text-slate-300">
        <li>{{ t('setup.step1') }}</li>
        <li>{{ t('setup.step2') }}</li>
        <li>{{ t('setup.step3') }}</li>
      </ol>
      <div class="flex flex-wrap gap-2">
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
      </div>
      <div class="flex flex-wrap gap-2 pt-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="step = 1"
        >
          {{ t('onboarding.back') }}
        </UButton>
        <UButton
          color="primary"
          @click="step = 3"
        >
          {{ t('onboarding.next') }}
        </UButton>
      </div>
    </div>

    <div
      v-else-if="step === 3"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('onboarding.step3Title') }}
      </h2>
      <p class="text-sm text-slate-400">
        {{ t('onboarding.step3Body') }}
      </p>
      <UFormField :label="t('auth.supabaseUrl')">
        <UInput
          v-model="projectUrl"
          type="url"
          class="w-full"
          autocomplete="off"
        />
      </UFormField>
      <UFormField :label="t('auth.anonKey')">
        <UInput
          v-model="anonKey"
          type="password"
          class="w-full"
          autocomplete="off"
        />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="step = 2"
        >
          {{ t('onboarding.back') }}
        </UButton>
        <UButton
          color="primary"
          @click="saveKeys"
        >
          {{ t('auth.saveProject') }}
        </UButton>
      </div>
    </div>

    <div
      v-else
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-5"
    >
      <h2 class="font-display text-lg font-semibold text-cyan-100">
        {{ t('onboarding.step4Title') }}
      </h2>
      <div class="flex gap-2">
        <UButton
          type="button"
          size="sm"
          :color="mode === 'signup' ? 'primary' : 'neutral'"
          :variant="mode === 'signup' ? 'solid' : 'ghost'"
          @click="mode = 'signup'"
        >
          {{ t('auth.signUp') }}
        </UButton>
        <UButton
          type="button"
          size="sm"
          :color="mode === 'signin' ? 'primary' : 'neutral'"
          :variant="mode === 'signin' ? 'solid' : 'ghost'"
          @click="mode = 'signin'"
        >
          {{ t('auth.signIn') }}
        </UButton>
      </div>
      <form
        class="space-y-4"
        @submit.prevent="submitAuth"
      >
        <UFormField :label="t('auth.email')">
          <UInput
            v-model="email"
            type="email"
            required
            class="w-full"
            autocomplete="email"
          />
        </UFormField>
        <UFormField :label="t('auth.password')">
          <UInput
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full"
            autocomplete="new-password"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            type="button"
            @click="step = 3"
          >
            {{ t('onboarding.back') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="auth.busy.value"
          >
            {{ mode === 'signup' ? t('auth.signUp') : t('auth.signIn') }}
          </UButton>
          <UButton
            v-if="auth.isAuthenticated.value"
            type="button"
            color="neutral"
            variant="soft"
            @click="finishIfReady"
          >
            {{ t('onboarding.openDashboard') }}
          </UButton>
        </div>
      </form>
    </div>

    <p class="mt-8 text-sm text-slate-400">
      <NuxtLink
        to="/dashboard/login"
        class="text-cyan-400 hover:underline"
      >
        {{ t('onboarding.haveAccount') }}
      </NuxtLink>
      ·
      <NuxtLink
        to="/privacy"
        class="text-cyan-400 hover:underline"
      >
        {{ t('nav.privacy') }}
      </NuxtLink>
    </p>
  </section>
</template>
