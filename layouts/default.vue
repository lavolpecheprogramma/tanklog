<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Menu } from "lucide-vue-next"

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

  return [
    { to: "/", labelKey: "nav.home", isActive: route.path === "/" },
    { to: "/tanks", labelKey: "nav.tanks", isActive: route.path.startsWith("/tanks") },
    { to: "/tests", labelKey: "nav.tests", isActive: route.path.startsWith("/tests") },
    { to: "/photos", labelKey: "nav.photos", isActive: route.path.startsWith("/photos") },
    { to: "/events", labelKey: "nav.events", isActive: route.path.startsWith("/events") },
    { to: "/reminders", labelKey: "nav.reminders", isActive: route.path.startsWith("/reminders") },
    { to: "/settings", labelKey: "nav.settings", isActive: route.path.startsWith("/settings") },
  ]
})

const activeTankHref = computed(() => (activeTankId.value ? `/tanks/${activeTankId.value}` : "/tanks"))

const isMobileNavOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    isMobileNavOpen.value = false
  }
)

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

    <div class="flex min-h-dvh">
      <aside class="hidden w-72 flex-col border-r border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 md:flex">
        <div class="px-4 py-4">
          <NuxtLink
            class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :to="isStorageReady ? '/' : '/settings'"
          >
            TankLog
          </NuxtLink>
        </div>

        <div class="space-y-3 px-4 pb-4">
          <ActiveTankSelector v-if="isStorageReady" />
          <Button v-if="isStorageReady" variant="secondary" size="sm" class="w-full" as-child>
            <NuxtLink :to="activeTankHref">{{ $t("actions.openActiveTank") }}</NuxtLink>
          </Button>

          <LanguageSwitcher />
        </div>

        <nav class="grid gap-1 px-2" aria-label="Primary">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :class="item.isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            :to="item.to"
            :aria-current="item.isActive ? 'page' : undefined"
          >
            {{ $t(item.labelKey) }}
          </NuxtLink>
        </nav>

        <div class="mt-auto border-t border-border/60 px-4 py-4">
          <div class="flex items-center gap-2">
            <img
              v-if="userPicture"
              :src="userPicture"
              :alt="userLabel ? $t('a11y.googleAccountWithLabel', { label: userLabel }) : $t('a11y.googleAccount')"
              class="size-9 rounded-full border border-border"
              referrerpolicy="no-referrer"
            />
            <div class="min-w-0">
              <div v-if="userLabel" class="truncate text-sm text-foreground">{{ userLabel }}</div>
            </div>
          </div>

          <Button type="button" variant="secondary" class="mt-3 w-full" @click="onLogout">{{ $t("actions.logout") }}</Button>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 md:hidden">
          <div class="flex items-center justify-between px-4 py-3">
            <NuxtLink
              class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              :to="isStorageReady ? '/' : '/settings'"
            >
              TankLog
            </NuxtLink>

            <div class="flex items-center gap-2">
              <LanguageSwitcher />

              <Dialog v-model:open="isMobileNavOpen">
                <DialogTrigger as-child>
                  <Button type="button" variant="secondary" size="icon">
                    <Menu class="size-4" aria-hidden="true" />
                    <span class="sr-only">{{ $t("a11y.openNavigation") }}</span>
                  </Button>
                </DialogTrigger>

                <DialogContent
                  class="!left-0 !top-0 !h-dvh !w-[85vw] !max-w-sm !translate-x-0 !translate-y-0 !rounded-none !p-4"
                >
                  <DialogHeader>
                    <DialogTitle>TankLog</DialogTitle>
                  </DialogHeader>

                  <div class="flex h-full flex-col gap-4 overflow-y-auto pb-2">
                    <Button v-if="isStorageReady" variant="secondary" class="w-full" as-child>
                      <NuxtLink :to="activeTankHref">{{ $t("actions.openActiveTank") }}</NuxtLink>
                    </Button>

                    <nav class="grid gap-1" aria-label="Primary">
                      <NuxtLink
                        v-for="item in navItems"
                        :key="item.to"
                        class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        :class="
                          item.isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        "
                        :to="item.to"
                        :aria-current="item.isActive ? 'page' : undefined"
                      >
                        {{ $t(item.labelKey) }}
                      </NuxtLink>
                    </nav>

                    <div class="mt-auto space-y-3 border-t border-border/60 pt-4">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="userPicture"
                          :src="userPicture"
                          :alt="userLabel ? $t('a11y.googleAccountWithLabel', { label: userLabel }) : $t('a11y.googleAccount')"
                          class="size-9 rounded-full border border-border"
                          referrerpolicy="no-referrer"
                        />
                        <div class="min-w-0">
                          <div v-if="userLabel" class="truncate text-sm text-foreground">{{ userLabel }}</div>
                        </div>
                      </div>

                      <Button type="button" variant="secondary" class="w-full" @click="onLogout">{{ $t("actions.logout") }}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div v-if="isStorageReady" class="px-4 pb-3">
            <ActiveTankSelector />
          </div>
        </header>

        <main id="main" class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <slot />
        </main>

        <footer class="border-t border-border/60">
          <div class="mx-auto w-full max-w-5xl px-4 py-6">
            <small class="text-muted-foreground">{{ $t("footer.tagline") }}</small>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

