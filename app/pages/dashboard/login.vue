<script setup lang="ts">
definePageMeta({
  title: 'Login'
})

const { t } = useI18n()
const route = useRoute()
const config = useSupabaseConfig()
const auth = useAuth()

const projectUrl = ref(config.url.value ?? '')
const anonKey = ref(config.anonKey.value ?? '')
const configOpen = ref(!config.isConfigured.value)
const configMessage = ref<string | null>(null)
const configError = ref<string | null>(null)

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const formMessage = ref<string | null>(null)

async function saveConfig() {
  configError.value = null
  configMessage.value = null
  const nextUrl = projectUrl.value.trim()
  const nextKey = anonKey.value.trim()
  if (!nextUrl || !nextKey) {
    configError.value = t('auth.errors.configRequired')
    return
  }
  try {
    // Validate URL shape before persisting

    new URL(nextUrl)
  } catch {
    configError.value = t('auth.errors.invalidUrl')
    return
  }

  config.setConfig({ url: nextUrl, anonKey: nextKey })
  await auth.bootstrap()
  configMessage.value = t('auth.configSaved')
  configOpen.value = false
}

async function submitAuth() {
  formMessage.value = null
  auth.error.value = null

  if (!config.isConfigured.value) {
    formMessage.value = t('auth.errors.configRequired')
    configOpen.value = true
    return
  }

  try {
    if (mode.value === 'signin') {
      await auth.signInWithPassword(email.value, password.value)
    } else {
      const result = await auth.signUpWithPassword(email.value, password.value)
      if (!result.session) {
        formMessage.value = t('auth.checkEmail')
        return
      }
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch {
    // error surfaced via auth.error
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <h1 class="font-display text-2xl font-semibold text-white">
      {{ t('auth.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('auth.subtitle') }}
    </p>

    <div class="mt-8 rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        :aria-expanded="configOpen"
        @click="configOpen = !configOpen"
      >
        <div>
          <p class="font-medium text-slate-100">
            {{ t('auth.projectConfig') }}
          </p>
          <p class="mt-1 text-sm text-slate-400">
            {{ config.isConfigured ? t('auth.projectConfigured') : t('auth.projectMissing') }}
          </p>
        </div>
        <UIcon
          :name="configOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-5 text-slate-400"
        />
      </button>

      <form
        v-if="configOpen"
        class="mt-4 space-y-4 border-t border-white/5 pt-4"
        @submit.prevent="saveConfig"
      >
        <UFormField :label="t('auth.supabaseUrl')">
          <UInput
            v-model="projectUrl"
            type="url"
            placeholder="https://xxxx.supabase.co"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('auth.anonKey')">
          <UInput
            v-model="anonKey"
            type="password"
            placeholder="eyJ..."
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          color="neutral"
          variant="soft"
          block
        >
          {{ t('auth.saveProject') }}
        </UButton>
        <p
          v-if="configMessage"
          class="text-sm text-cyan-400"
          role="status"
        >
          {{ configMessage }}
        </p>
        <p
          v-if="configError"
          class="text-sm text-red-400"
          role="alert"
        >
          {{ configError }}
        </p>
      </form>
    </div>

    <form
      class="mt-8 space-y-4"
      @submit.prevent="submitAuth"
    >
      <div class="flex gap-2">
        <UButton
          type="button"
          size="sm"
          :color="mode === 'signin' ? 'primary' : 'neutral'"
          :variant="mode === 'signin' ? 'solid' : 'ghost'"
          @click="mode = 'signin'"
        >
          {{ t('auth.signIn') }}
        </UButton>
        <UButton
          type="button"
          size="sm"
          :color="mode === 'signup' ? 'primary' : 'neutral'"
          :variant="mode === 'signup' ? 'solid' : 'ghost'"
          @click="mode = 'signup'"
        >
          {{ t('auth.signUp') }}
        </UButton>
      </div>

      <UFormField :label="t('auth.email')">
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('auth.password')">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
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
        {{ mode === 'signin' ? t('auth.signIn') : t('auth.signUp') }}
      </UButton>

      <p
        v-if="formMessage"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ formMessage }}
      </p>
      <p
        v-if="auth.error.value"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ auth.error.value }}
      </p>
    </form>

    <p class="mt-6 text-sm text-slate-400">
      <NuxtLink
        to="/onboarding"
        class="text-cyan-400 hover:underline"
      >
        {{ t('auth.firstTime') }}
      </NuxtLink>
      ·
      <NuxtLink
        to="/"
        class="text-cyan-400 hover:underline"
      >
        ← {{ t('nav.home') }}
      </NuxtLink>
    </p>
  </section>
</template>
