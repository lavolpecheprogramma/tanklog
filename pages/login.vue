<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "auth",
})

useHead({
  title: "Login",
})

const route = useRoute()
const auth = useAuth()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

const config = useRuntimeConfig()
const hasClientId = computed(() => Boolean(config.public.googleClientId))

const redirectTarget = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== "string") return "/"
  if (!raw.startsWith("/")) return "/"
  if (raw.startsWith("//")) return "/"
  if (raw.startsWith("/login")) return "/"
  return raw
})

watchEffect(() => {
  if (!process.client) return
  if (!auth.isAuthenticated.value) return
  navigateTo(redirectTarget.value)
})

async function onLogin() {
  errorMessage.value = null

  if (!hasClientId.value) {
    errorMessage.value = "Missing Google Client ID. Set NUXT_PUBLIC_GOOGLE_CLIENT_ID and reload."
    return
  }

  isSubmitting.value = true
  try {
    await auth.loginWithGoogle({ prompt: "select_account" })
    await navigateTo(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Login failed."
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-md space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p class="text-muted-foreground">
        TankLog uses Google to access your own Google Sheets + Drive (no backend, no proprietary DB).
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Continue with Google</CardTitle>
        <CardDescription>We’ll request access to Sheets and Drive (files created by TankLog).</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <p v-if="!hasClientId" class="text-sm text-destructive" role="alert">
          Missing <code class="rounded bg-muted px-1 py-0.5">NUXT_PUBLIC_GOOGLE_CLIENT_ID</code>. See
          <code class="rounded bg-muted px-1 py-0.5">docs/google-setup.md</code>.
        </p>

        <p v-if="errorMessage" class="text-sm text-destructive" role="alert">
          {{ errorMessage }}
        </p>
      </CardContent>

      <CardFooter class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" class="w-full sm:w-auto" :disabled="isSubmitting || !hasClientId" @click="onLogin">
          <span v-if="isSubmitting">Signing in…</span>
          <span v-else>Sign in with Google</span>
        </Button>

        <p class="text-xs text-muted-foreground">
          Session is stored in this browser tab (session storage).
        </p>
      </CardFooter>
    </Card>
  </section>
</template>

