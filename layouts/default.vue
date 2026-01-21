<script setup lang="ts">
import { Button } from "@/components/ui/button"
const auth = useAuth()
const localePath = useLocalePath()

const userEmail = computed(() => auth.user.value?.email ?? null)
const userName = computed(() => auth.user.value?.name ?? null)
const userPicture = computed(() => auth.user.value?.picture ?? null)

const userLabel = computed(() => userEmail.value || userName.value || null)

async function onLogout() {
  await auth.logout({ revoke: true })
  await navigateTo("/dashboard/login")
}
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      href="#main"
    >
      {{ $t("a11y.skipToContent") }}
    </a>

    <header class="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <NuxtLink
          class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          :to="localePath('/dashboard')"
        >
          TankLog
        </NuxtLink>

        <div class="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />

          <Button variant="secondary" size="sm" as-child>
            <NuxtLink :to="localePath('/dashboard/settings')">{{ $t("nav.settings") }}</NuxtLink>
          </Button>

          <div class="hidden items-center gap-2 sm:flex">
            <img
              v-if="userPicture"
              :src="userPicture"
              :alt="userLabel ? $t('a11y.googleAccountWithLabel', { label: userLabel }) : $t('a11y.googleAccount')"
              class="size-8 rounded-full border border-border"
              referrerpolicy="no-referrer"
            />
            <div v-if="userLabel" class="max-w-[16rem] truncate text-sm text-muted-foreground">
              {{ userLabel }}
            </div>
          </div>

          <Button type="button" variant="secondary" size="sm" @click="onLogout">
            {{ $t("actions.logout") }}
          </Button>
        </div>
      </div>
    </header>

    <main id="main" class="mx-auto w-full max-w-5xl px-4 py-6">
      <slot />
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <small class="text-muted-foreground">{{ $t("footer.tagline") }}</small>
          <nav aria-label="Footer" class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <NuxtLink
              class="underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              :to="localePath('/privacy')"
            >
              {{ $t("footer.privacy") }}
            </NuxtLink>
          </nav>
        </div>
      </div>
    </footer>
  </div>
</template>

