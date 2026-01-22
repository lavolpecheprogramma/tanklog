<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "auth",
})

const { t } = useI18n()

useHead(() => ({
  title: t("pages.login.metaTitle"),
}))

const route = useRoute()
const auth = useAuth()
const googleClientId = useTankLogGoogleClientId()
googleClientId.hydrateFromStorage()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

const hasClientId = computed(() => googleClientId.hasGoogleClientId.value)

const clientIdInput = ref(googleClientId.googleClientId.value ?? "")
const clientIdError = ref<string | null>(null)
const clientIdStatus = ref<string | null>(null)

const redirectTarget = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== "string") return "/dashboard"
  if (!raw.startsWith("/")) return "/dashboard"
  if (raw.startsWith("//")) return "/dashboard"
  if (raw.startsWith("/login")) return "/dashboard"
  if (raw.startsWith("/dashboard/login")) return "/dashboard"
  return raw
})

watchEffect(() => {
  if (!import.meta.client) return
  if (!auth.isAuthenticated.value) return
  navigateTo(redirectTarget.value)
})

function onSaveClientId() {
  clientIdError.value = null
  clientIdStatus.value = null
  errorMessage.value = null

  if (!clientIdInput.value.trim()) {
    clientIdError.value = t("pages.login.clientId.errors.required")
    return
  }

  const normalized = googleClientId.setGoogleClientIdFromInput(clientIdInput.value)
  if (!normalized) {
    clientIdError.value = t("pages.login.clientId.errors.required")
    return
  }

  clientIdInput.value = normalized
  clientIdStatus.value = t("pages.login.clientId.success.saved")
}

function onRemoveClientId() {
  clientIdError.value = null
  clientIdStatus.value = null
  errorMessage.value = null

  googleClientId.clearGoogleClientId()
  clientIdInput.value = ""
  clientIdStatus.value = t("pages.login.clientId.success.removed")
}

async function onLogin() {
  errorMessage.value = null

  if (!hasClientId.value) {
    errorMessage.value = t("pages.login.errors.missingClientId")
    return
  }

  isSubmitting.value = true
  try {
    await auth.loginWithGoogle({ prompt: "select_account" })
    await navigateTo(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t("pages.login.errors.loginFailed")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-md space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.login.title") }}</h1>
      <p class="text-muted-foreground">
        {{ $t("pages.login.description") }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.login.cardTitle") }}</CardTitle>
        <CardDescription>{{ $t("pages.login.cardDescription") }}</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <div class="space-y-3 rounded-md border border-border/60 bg-background p-3">
          <div class="space-y-1">
            <div class="text-sm font-medium text-foreground">
              {{ $t("pages.login.clientId.title") }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.login.clientId.description") }}
            </p>
            <ul class="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>{{ $t("pages.login.clientId.steps.create") }}</li>
              <li>{{ $t("pages.login.clientId.steps.origins") }}</li>
              <li>{{ $t("pages.login.clientId.steps.paste") }}</li>
            </ul>
          </div>

          <form class="space-y-2" @submit.prevent="onSaveClientId">
            <label for="google-client-id" class="text-sm text-foreground">
              {{ $t("pages.login.clientId.label") }}
            </label>
            <input
              id="google-client-id"
              v-model="clientIdInput"
              type="text"
              inputmode="text"
              autocomplete="off"
              spellcheck="false"
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              :placeholder="$t('pages.login.clientId.placeholder')"
              :aria-invalid="clientIdError ? 'true' : 'false'"
              aria-describedby="google-client-id-hint google-client-id-feedback"
            />
            <p id="google-client-id-hint" class="text-xs text-muted-foreground">
              {{ $t("pages.login.clientId.hint") }}
            </p>

            <p v-if="clientIdError" id="google-client-id-feedback" class="text-sm text-destructive" role="alert">
              {{ clientIdError }}
            </p>
            <p v-else-if="clientIdStatus" id="google-client-id-feedback" class="text-sm text-foreground" role="status">
              {{ clientIdStatus }}
            </p>
            <p v-else id="google-client-id-feedback" class="sr-only"> </p>

            <div class="flex flex-wrap gap-2 pt-1">
              <Button type="submit" size="sm">
                {{ $t("pages.login.clientId.actions.save") }}
              </Button>
              <Button type="button" size="sm" variant="secondary" :disabled="!hasClientId" @click="onRemoveClientId">
                {{ $t("pages.login.clientId.actions.remove") }}
              </Button>
            </div>
          </form>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive" role="alert">
          {{ errorMessage }}
        </p>
      </CardContent>

      <CardFooter class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" class="w-full sm:w-auto" :disabled="isSubmitting || !hasClientId" @click="onLogin">
          <span v-if="isSubmitting">{{ $t("actions.signingIn") }}</span>
          <span v-else>{{ $t("actions.signInWithGoogle") }}</span>
        </Button>

        <p class="text-xs text-muted-foreground">
          {{ $t("pages.login.sessionNote") }}
        </p>
      </CardFooter>
    </Card>
  </section>
</template>

