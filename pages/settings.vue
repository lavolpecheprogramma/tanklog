<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: 'Settings'
})

const auth = useAuth()

const isLoggingOut = ref(false)

const userEmail = computed(() => auth.user.value?.email ?? null)
const userName = computed(() => auth.user.value?.name ?? null)
const scopes = computed(() => (auth.session.value?.scope ? auth.session.value.scope.split(" ") : []))

const tokenExpiresAt = computed(() => auth.session.value?.expiresAt ?? null)
const tokenExpiresText = computed(() => {
  if (!tokenExpiresAt.value) return null
  try {
    return new Date(tokenExpiresAt.value).toLocaleString()
  } catch {
    return null
  }
})

async function onLogout() {
  isLoggingOut.value = true
  try {
    await auth.logout({ revoke: true })
    await navigateTo("/login")
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="max-w-prose text-muted-foreground">
        Account, language, and spreadsheet connection live here.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Signed in with Google (frontend-only OAuth).</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        <div class="space-y-3">
          <div>
            <div class="text-foreground">Google user</div>
            <div v-if="userName || userEmail">
              <span v-if="userName">{{ userName }}</span>
              <span v-if="userName && userEmail" class="text-muted-foreground"> · </span>
              <span v-if="userEmail">{{ userEmail }}</span>
            </div>
            <div v-else>Profile unavailable (token-only session).</div>
          </div>

          <div v-if="tokenExpiresText">
            <div class="text-foreground">Token expires</div>
            <div>{{ tokenExpiresText }}</div>
          </div>

          <div>
            <div class="text-foreground">Scopes</div>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li v-for="scope in scopes" :key="scope">
                <code class="rounded bg-muted px-1 py-0.5">{{ scope }}</code>
              </li>
            </ul>
          </div>

          <div class="pt-2">
            <Button type="button" variant="secondary" :disabled="isLoggingOut" @click="onLogout">
              <span v-if="isLoggingOut">Logging out…</span>
              <span v-else>Logout</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

