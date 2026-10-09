<script setup lang="ts">
definePageMeta({
  title: 'Reset password'
})

const { t } = useI18n()
const auth = useAuth()
const config = useSupabaseConfig()

const newPassword = ref('')
const confirmPassword = ref('')
const formMessage = ref<string | null>(null)
const formError = ref<string | null>(null)
const waitingForSession = ref(true)

onMounted(async () => {
  if (!auth.ready.value) await auth.bootstrap()

  // Give detectSessionInUrl a moment to hydrate the recovery session from the hash/query.
  const started = Date.now()
  while (Date.now() - started < 2500) {
    if (auth.isAuthenticated.value) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  waitingForSession.value = false

  if (auth.isAuthenticated.value && !auth.passwordRecoveryPending.value) {
    formMessage.value = t('auth.reset.useSettings')
  }
})

function mapError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('at least 6')) return t('settings.password.errors.tooShort')
  if (lower.includes('recovery session missing')) return t('auth.reset.errors.sessionMissing')
  return raw
}

async function submit() {
  formMessage.value = null
  formError.value = null
  auth.error.value = null

  if (!config.isConfigured.value) {
    formError.value = t('auth.errors.configRequired')
    return
  }
  if (newPassword.value.length < 6) {
    formError.value = t('settings.password.errors.tooShort')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    formError.value = t('settings.password.errors.mismatch')
    return
  }

  try {
    await auth.completePasswordRecovery(newPassword.value)
    formMessage.value = t('auth.reset.updated')
    newPassword.value = ''
    confirmPassword.value = ''
    await navigateTo('/dashboard')
  } catch (e) {
    formError.value = mapError(e instanceof Error ? e.message : String(e))
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <h1 class="font-display text-2xl font-semibold text-white">
      {{ t('auth.reset.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('auth.reset.subtitle') }}
    </p>

    <div
      v-if="waitingForSession"
      class="mt-8 text-sm text-slate-400"
      role="status"
    >
      {{ t('auth.reset.checking') }}
    </div>

    <div
      v-else-if="!auth.isAuthenticated.value"
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4"
    >
      <p class="text-sm text-slate-300">
        {{ t('auth.reset.sessionMissing') }}
      </p>
      <UButton
        to="/dashboard/login?mode=forgot"
        color="primary"
        variant="soft"
        size="sm"
      >
        {{ t('auth.reset.requestAgain') }}
      </UButton>
    </div>

    <form
      v-else-if="auth.isAuthenticated.value && auth.passwordRecoveryPending.value"
      class="mt-8 space-y-4"
      @submit.prevent="submit"
    >
      <UFormField :label="t('settings.password.next')">
        <UInput
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="6"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('settings.password.confirm')">
        <UInput
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="6"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        color="primary"
        block
        :loading="auth.busy.value"
        :disabled="auth.busy.value"
      >
        {{ t('auth.reset.save') }}
      </UButton>
    </form>

    <div
      v-else
      class="mt-8 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4"
    >
      <p class="text-sm text-slate-300">
        {{ formMessage || t('auth.reset.useSettings') }}
      </p>
      <UButton
        to="/dashboard/settings"
        color="primary"
        variant="soft"
        size="sm"
      >
        {{ t('nav.settings') }}
      </UButton>
    </div>

    <p
      v-if="formMessage && auth.passwordRecoveryPending.value"
      class="mt-4 text-sm text-cyan-400"
      role="status"
    >
      {{ formMessage }}
    </p>
    <p
      v-if="formError || auth.error.value"
      class="mt-4 text-sm text-red-400"
      role="alert"
    >
      {{ formError || auth.error.value }}
    </p>

    <p class="mt-6 text-sm text-slate-400">
      <NuxtLink
        to="/dashboard/login"
        class="text-cyan-400 hover:underline"
      >
        ← {{ t('auth.signIn') }}
      </NuxtLink>
    </p>
  </section>
</template>
