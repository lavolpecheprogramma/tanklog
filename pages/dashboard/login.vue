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

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

const config = useRuntimeConfig()
const hasClientId = computed(() => Boolean(config.public.googleClientId))

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
        <p v-if="!hasClientId" class="text-sm text-destructive" role="alert">
          {{ $t("pages.login.missingClientIdPrefix") }}
          <code class="rounded bg-muted px-1 py-0.5">NUXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
          {{ $t("pages.login.missingClientIdSuffix") }}
          <code class="rounded bg-muted px-1 py-0.5">docs/google-setup.md</code>.
        </p>

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

