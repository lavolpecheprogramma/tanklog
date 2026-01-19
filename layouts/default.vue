<script setup lang="ts">
import { Button } from "@/components/ui/button"

const route = useRoute()
const { activeTankId } = useActiveTank()
const auth = useAuth()

const userEmail = computed(() => auth.user.value?.email ?? null)
const userName = computed(() => auth.user.value?.name ?? null)
const userPicture = computed(() => auth.user.value?.picture ?? null)

const userAltText = computed(() => {
  const label = userEmail.value || userName.value
  return label ? `Google account: ${label}` : "Google account"
})

const navItems = computed(() => {
  const tankHref = `/vasques/${activeTankId.value}`

  return [
    { to: "/", label: "Home", isActive: route.path === "/" },
    { to: tankHref, label: "Tank", isActive: route.path.startsWith("/vasques") },
    { to: "/tests", label: "Tests", isActive: route.path.startsWith("/tests") },
    { to: "/photos", label: "Photos", isActive: route.path.startsWith("/photos") },
    { to: "/events", label: "Events", isActive: route.path.startsWith("/events") },
    { to: "/reminders", label: "Reminders", isActive: route.path.startsWith("/reminders") },
    { to: "/settings", label: "Settings", isActive: route.path.startsWith("/settings") },
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
      Skip to content
    </a>

    <header class="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div class="mx-auto w-full max-w-5xl px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <NuxtLink
            class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            to="/"
          >
            TankLog
          </NuxtLink>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ActiveTankSelector />

            <div class="flex items-center gap-2">
              <img
                v-if="userPicture"
                :src="userPicture"
                :alt="userAltText"
                class="size-8 rounded-full border border-border"
                referrerpolicy="no-referrer"
              />
              <span v-if="userEmail" class="text-sm text-muted-foreground">{{ userEmail }}</span>

              <Button type="button" variant="secondary" size="sm" @click="onLogout">Logout</Button>
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
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main" class="mx-auto w-full max-w-5xl px-4 py-6">
      <slot />
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6">
        <small class="text-muted-foreground">TankLog — frontend-only, static, user-controlled data.</small>
      </div>
    </footer>
  </div>
</template>

