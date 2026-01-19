<script setup lang="ts">
import { Button } from "@/components/ui/button"

const route = useRoute()
const { activeTankId } = useActiveTank()
const auth = useAuth()
const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()

const isStorageReady = computed(() => storage.hasRootFolderId.value)

const userEmail = computed(() => auth.user.value?.email ?? null)
const userName = computed(() => auth.user.value?.name ?? null)
const userPicture = computed(() => auth.user.value?.picture ?? null)

const userLabel = computed(() => userEmail.value || userName.value || null)

const navItems = computed(() => {
  if (!isStorageReady.value) {
    return [{ to: "/settings", labelKey: "nav.settings", isActive: route.path.startsWith("/settings") }]
  }

  const tankHref = activeTankId.value ? `/vasques/${activeTankId.value}` : "/settings"

  return [
    { to: "/", labelKey: "nav.home", isActive: route.path === "/" },
    { to: tankHref, labelKey: "nav.tank", isActive: route.path.startsWith("/vasques") },
    { to: "/tests", labelKey: "nav.tests", isActive: route.path.startsWith("/tests") },
    { to: "/photos", labelKey: "nav.photos", isActive: route.path.startsWith("/photos") },
    { to: "/events", labelKey: "nav.events", isActive: route.path.startsWith("/events") },
    { to: "/reminders", labelKey: "nav.reminders", isActive: route.path.startsWith("/reminders") },
    { to: "/settings", labelKey: "nav.settings", isActive: route.path.startsWith("/settings") },
  ]
})

async function onLogout() {
  await auth.logout({ revoke: true })
  await navigateTo("/login")
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
      <div class="mx-auto w-full max-w-5xl px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <NuxtLink
            class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :to="isStorageReady ? '/' : '/settings'"
          >
            TankLog
          </NuxtLink>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ActiveTankSelector v-if="isStorageReady" />
            <LanguageSwitcher />

            <div class="flex items-center gap-2">
              <img
                v-if="userPicture"
                :src="userPicture"
                :alt="userLabel ? $t('a11y.googleAccountWithLabel', { label: userLabel }) : $t('a11y.googleAccount')"
                class="size-8 rounded-full border border-border"
                referrerpolicy="no-referrer"
              />
              <span v-if="userEmail" class="text-sm text-muted-foreground">{{ userEmail }}</span>

              <Button type="button" variant="secondary" size="sm" @click="onLogout">{{ $t("actions.logout") }}</Button>
            </div>
          </div>
        </div>

        <nav class="mt-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" aria-label="Primary">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            class="shrink-0 rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :class="item.isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            :to="item.to"
            :aria-current="item.isActive ? 'page' : undefined"
          >
            {{ $t(item.labelKey) }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main" class="mx-auto w-full max-w-5xl px-4 py-6">
      <slot />
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6">
        <small class="text-muted-foreground">{{ $t("footer.tagline") }}</small>
      </div>
    </footer>
  </div>
</template>

