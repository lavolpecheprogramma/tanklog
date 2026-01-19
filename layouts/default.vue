<script setup lang="ts">
const route = useRoute()
const { activeTankId } = useActiveTank()

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

          <ActiveTankSelector />
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

