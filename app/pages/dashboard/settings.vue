<script setup lang="ts">
definePageMeta({
  title: 'Settings'
})

const { t } = useI18n()
const config = useSupabaseConfig()
const auth = useAuth()
const health = useSchemaHealth()
const exportApi = useExportData()
const oneSignalConfig = useOneSignalConfig()
const oneSignal = useOneSignal()
const notifyPrefs = useNotificationPrefs()

const projectUrl = ref(config.url.value ?? '')
const anonKey = ref(config.anonKey.value ?? '')
const message = ref<string | null>(null)
const error = ref<string | null>(null)

const quietEnabled = ref(false)
const quietStart = ref('22:00')
const quietEnd = ref('08:00')
const quietMessage = ref<string | null>(null)
const quietError = ref<string | null>(null)

const oneSignalAppIdInput = ref(oneSignalConfig.appId.value ?? '')
const oneSignalProxyUrlInput = ref(oneSignalConfig.proxyUrl.value ?? '')
const oneSignalProxyKeyInput = ref(oneSignalConfig.proxyKey.value ?? '')
const oneSignalMessage = ref<string | null>(null)
const oneSignalError = ref<string | null>(null)
const oneSignalBusy = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordMessage = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const passwordBusy = ref(false)

const oneSignalStatusLabel = computed(() => {
  if (!oneSignalConfig.isEnabled.value) return t('settings.oneSignal.status.off')
  if (oneSignal.status.value === 'error') return t('settings.oneSignal.status.error')
  if (!oneSignal.isInitialized.value) return t('settings.oneSignal.status.loading')
  if (oneSignal.isOptedIn.value) return t('settings.oneSignal.status.subscribed')
  return t('settings.oneSignal.status.ready')
})

onMounted(() => {
  void health.check({ force: true })
  oneSignalConfig.hydrateFromStorage()
  oneSignalAppIdInput.value = oneSignalConfig.appId.value ?? ''
  oneSignalProxyUrlInput.value = oneSignalConfig.proxyUrl.value ?? ''
  oneSignalProxyKeyInput.value = oneSignalConfig.proxyKey.value ?? ''
  if (oneSignal.isInitialized.value) void oneSignal.refreshState()
  notifyPrefs.hydrateFromStorage()
  quietEnabled.value = notifyPrefs.quietEnabled.value
  quietStart.value = notifyPrefs.quietStart.value
  quietEnd.value = notifyPrefs.quietEnd.value
})

function saveQuietHours() {
  quietMessage.value = null
  quietError.value = null
  try {
    notifyPrefs.setQuietWindow(quietStart.value, quietEnd.value)
    notifyPrefs.setQuietEnabled(quietEnabled.value)
    quietMessage.value = t('settings.quiet.saved')
  } catch (e) {
    quietError.value = e instanceof Error ? e.message : String(e)
  }
}

async function exportHtml() {
  message.value = null
  error.value = null
  try {
    await exportApi.downloadHtml()
    message.value = t('settings.exportHtmlOk')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function saveConfig() {
  message.value = null
  error.value = null
  try {
    new URL(projectUrl.value.trim())
    config.setConfig({
      url: projectUrl.value.trim(),
      anonKey: anonKey.value.trim()
    })
    await auth.bootstrap()
    await health.check({ force: true })
    message.value = t('auth.configSaved')
  } catch {
    error.value = t('auth.errors.invalidUrl')
  }
}

async function disconnectProject() {
  await auth.signOut().catch(() => undefined)
  config.clearConfig()
  health.status.value = 'unknown'
  health.message.value = null
  await auth.bootstrap()
  await navigateTo('/dashboard/login')
}

async function logout() {
  await auth.signOut()
  health.status.value = 'unknown'
  await navigateTo('/dashboard/login')
}

function mapPasswordError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('current password is incorrect') || lower.includes('invalid login')) {
    return t('settings.password.errors.currentIncorrect')
  }
  if (lower.includes('at least 6')) return t('settings.password.errors.tooShort')
  if (lower.includes('must be different')) return t('settings.password.errors.sameAsCurrent')
  if (lower.includes('not signed in')) return t('settings.password.errors.notSignedIn')
  return raw
}

async function changePassword() {
  passwordMessage.value = null
  passwordError.value = null

  if (!currentPassword.value) {
    passwordError.value = t('settings.password.errors.currentRequired')
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = t('settings.password.errors.tooShort')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t('settings.password.errors.mismatch')
    return
  }
  if (newPassword.value === currentPassword.value) {
    passwordError.value = t('settings.password.errors.sameAsCurrent')
    return
  }

  passwordBusy.value = true
  try {
    await auth.updatePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordMessage.value = t('settings.password.saved')
  } catch (e) {
    passwordError.value = mapPasswordError(e instanceof Error ? e.message : String(e))
  } finally {
    passwordBusy.value = false
  }
}

async function exportJson() {
  message.value = null
  error.value = null
  try {
    await exportApi.downloadJson()
    message.value = t('settings.exportOk')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function saveOneSignalConfig() {
  oneSignalMessage.value = null
  oneSignalError.value = null

  const appId = oneSignalConfig.setAppIdFromInput(oneSignalAppIdInput.value)
  if (!appId) {
    oneSignalError.value = t('settings.oneSignal.errors.invalidAppId')
    return
  }

  const proxyRaw = oneSignalProxyUrlInput.value.trim()
  if (proxyRaw) {
    const proxyUrl = oneSignalConfig.setProxyUrlFromInput(proxyRaw)
    if (!proxyUrl) {
      oneSignalError.value = t('settings.oneSignal.errors.invalidProxyUrl')
      return
    }
    const proxyKeyRaw = oneSignalProxyKeyInput.value.trim()
    if (proxyKeyRaw) oneSignalConfig.setProxyKeyFromInput(proxyKeyRaw)
    else oneSignalConfig.clearProxyKey()
  } else {
    oneSignalConfig.clearProxyUrl()
    oneSignalConfig.clearProxyKey()
  }

  oneSignalConfig.setEnabled(true)
  oneSignalMessage.value = t('settings.oneSignal.saved')
}

async function subscribeOneSignal() {
  oneSignalMessage.value = null
  oneSignalError.value = null
  oneSignalBusy.value = true
  try {
    if (!oneSignalConfig.appId.value) {
      throw new Error(t('settings.oneSignal.errors.invalidAppId'))
    }
    oneSignalConfig.setEnabled(true)
    if (!oneSignal.isInitialized.value) {
      await oneSignal.init({ appId: oneSignalConfig.appId.value })
    }
    await oneSignal.requestPermission()
    await oneSignal.optIn()
    const userId = auth.user.value?.id
    if (userId) await oneSignal.login(userId)
    await oneSignal.refreshState()
    oneSignalMessage.value = t('settings.oneSignal.subscribed')
  } catch (e) {
    oneSignalError.value = e instanceof Error ? e.message : String(e)
  } finally {
    oneSignalBusy.value = false
  }
}

async function disableOneSignal() {
  oneSignalBusy.value = true
  oneSignalMessage.value = null
  oneSignalError.value = null
  try {
    if (oneSignal.isInitialized.value) {
      await oneSignal.optOut().catch(() => undefined)
    }
    oneSignalConfig.setEnabled(false)
    oneSignalMessage.value = t('settings.oneSignal.disabled')
  } finally {
    oneSignalBusy.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <h1 class="font-display text-2xl font-semibold text-white">
      {{ t('nav.settings') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('settings.subtitle') }}
    </p>

    <form
      class="mt-8 space-y-4"
      @submit.prevent="saveConfig"
    >
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
      <UButton
        type="submit"
        color="primary"
        block
      >
        {{ t('auth.saveProject') }}
      </UButton>
      <p
        v-if="message"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ message }}
      </p>
      <p
        v-if="error"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ error }}
      </p>
    </form>

    <form
      class="mt-10 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4"
      @submit.prevent="changePassword"
    >
      <div>
        <p class="font-medium text-slate-100">
          {{ t('settings.password.title') }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {{ t('settings.password.body') }}
        </p>
        <p
          v-if="auth.user.value?.email"
          class="mt-2 text-sm text-cyan-200/80"
        >
          {{ t('dashboard.signedInAs', { email: auth.user.value.email }) }}
        </p>
      </div>

      <UFormField :label="t('settings.password.current')">
        <UInput
          v-model="currentPassword"
          type="password"
          class="w-full"
          autocomplete="current-password"
        />
      </UFormField>
      <UFormField :label="t('settings.password.next')">
        <UInput
          v-model="newPassword"
          type="password"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>
      <UFormField :label="t('settings.password.confirm')">
        <UInput
          v-model="confirmPassword"
          type="password"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>

      <UButton
        type="submit"
        color="primary"
        variant="soft"
        size="sm"
        :loading="passwordBusy || auth.busy.value"
      >
        {{ t('settings.password.save') }}
      </UButton>

      <p
        v-if="passwordMessage"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ passwordMessage }}
      </p>
      <p
        v-if="passwordError"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ passwordError }}
      </p>
    </form>

    <div class="mt-10 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <div>
        <p class="font-medium text-slate-100">
          {{ t('settings.quiet.title') }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {{ t('settings.quiet.body') }}
        </p>
      </div>
      <UCheckbox
        v-model="quietEnabled"
        :label="t('settings.quiet.enable')"
      />
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('settings.quiet.start')">
          <UInput
            v-model="quietStart"
            type="time"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('settings.quiet.end')">
          <UInput
            v-model="quietEnd"
            type="time"
            class="w-full"
          />
        </UFormField>
      </div>
      <UButton
        color="primary"
        variant="soft"
        size="sm"
        @click="saveQuietHours"
      >
        {{ t('settings.quiet.save') }}
      </UButton>
      <p
        v-if="quietMessage"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ quietMessage }}
      </p>
      <p
        v-if="quietError"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ quietError }}
      </p>
    </div>

    <div class="mt-10 space-y-4 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <div>
        <p class="font-medium text-slate-100">
          {{ t('settings.oneSignal.title') }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {{ t('settings.oneSignal.body') }}
        </p>
        <p class="mt-2 text-sm text-cyan-200/80">
          {{ oneSignalStatusLabel }}
          <span v-if="oneSignalConfig.hasSchedulingProxy.value">
            · {{ t('settings.oneSignal.schedulingReady') }}
          </span>
        </p>
      </div>

      <UFormField :label="t('settings.oneSignal.appId')">
        <UInput
          v-model="oneSignalAppIdInput"
          class="w-full"
          autocomplete="off"
          :placeholder="t('settings.oneSignal.appIdPlaceholder')"
        />
      </UFormField>
      <UFormField :label="t('settings.oneSignal.proxyUrl')">
        <UInput
          v-model="oneSignalProxyUrlInput"
          type="url"
          class="w-full"
          autocomplete="off"
          :placeholder="t('settings.oneSignal.proxyUrlPlaceholder')"
        />
      </UFormField>
      <UFormField :label="t('settings.oneSignal.proxyKey')">
        <UInput
          v-model="oneSignalProxyKeyInput"
          type="password"
          class="w-full"
          autocomplete="off"
        />
      </UFormField>

      <div class="flex flex-wrap gap-2">
        <UButton
          color="primary"
          variant="soft"
          size="sm"
          @click="saveOneSignalConfig"
        >
          {{ t('settings.oneSignal.save') }}
        </UButton>
        <UButton
          color="primary"
          size="sm"
          :loading="oneSignalBusy"
          :disabled="!oneSignalConfig.appId.value && !oneSignalAppIdInput.trim()"
          @click="subscribeOneSignal"
        >
          {{ t('settings.oneSignal.subscribe') }}
        </UButton>
        <UButton
          v-if="oneSignalConfig.enabled.value"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="oneSignalBusy"
          @click="disableOneSignal"
        >
          {{ t('settings.oneSignal.disable') }}
        </UButton>
      </div>

      <p class="text-xs text-slate-400">
        {{ t('settings.oneSignal.docsHint') }}
        <NuxtLink
          to="/privacy"
          class="text-cyan-400 hover:underline"
        >
          {{ t('nav.privacy') }}
        </NuxtLink>
      </p>

      <p
        v-if="oneSignalMessage"
        class="text-sm text-cyan-400"
        role="status"
      >
        {{ oneSignalMessage }}
      </p>
      <p
        v-if="oneSignalError || oneSignal.error.value"
        class="text-sm text-red-400"
        role="alert"
      >
        {{ oneSignalError || oneSignal.error.value }}
      </p>
    </div>

    <div class="mt-10 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <p class="font-medium text-slate-100">
        {{ t('settings.exportSection') }}
      </p>
      <p class="mt-2 text-sm text-slate-400">
        {{ t('settings.exportBody') }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          :loading="exportApi.busy.value"
          @click="exportJson"
        >
          {{ t('settings.exportCta') }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          :loading="exportApi.busy.value"
          @click="exportHtml"
        >
          {{ t('settings.exportHtmlCta') }}
        </UButton>
      </div>
      <p class="mt-2 text-xs text-slate-400">
        {{ t('settings.exportHtmlBody') }}
      </p>
    </div>

    <div class="mt-10 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <p class="font-medium text-slate-100">
        {{ t('settings.migrateSection') }}
      </p>
      <p class="mt-2 text-sm text-slate-400">
        {{ t('settings.migrateBody') }}
      </p>
      <UButton
        class="mt-4"
        to="/dashboard/migrate"
        color="primary"
        variant="soft"
        size="sm"
      >
        {{ t('settings.migrateCta') }}
      </UButton>
    </div>

    <div class="mt-10 rounded-xl border border-cyan-500/15 bg-slate-900/40 p-4">
      <p class="font-medium text-slate-100">
        {{ t('settings.schemaSection') }}
      </p>
      <p class="mt-2 text-sm text-slate-400">
        {{ health.isHealthy.value ? t('settings.schemaOk') : t('settings.schemaMissing') }}
      </p>
      <UButton
        class="mt-4"
        to="/dashboard/setup"
        color="neutral"
        variant="soft"
        size="sm"
      >
        {{ t('nav.setup') }}
      </UButton>
    </div>

    <div class="mt-10 flex flex-col gap-3">
      <UButton
        color="neutral"
        variant="soft"
        block
        :loading="auth.busy.value"
        @click="logout"
      >
        {{ t('auth.signOut') }}
      </UButton>
      <UButton
        color="error"
        variant="outline"
        block
        @click="disconnectProject"
      >
        {{ t('settings.disconnectProject') }}
      </UButton>
      <UButton
        to="/dashboard"
        color="neutral"
        variant="ghost"
        block
      >
        ← {{ t('nav.dashboard') }}
      </UButton>
    </div>
  </section>
</template>
