<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { TankPhoto } from "@/composables/usePhotos"
import { Menu } from "lucide-vue-next"

const route = useRoute()
const localePath = useLocalePath()

const auth = useAuth()

const userEmail = computed(() => auth.user.value?.email ?? null)
const userName = computed(() => auth.user.value?.name ?? null)
const userPicture = computed(() => auth.user.value?.picture ?? null)
const userLabel = computed(() => userEmail.value || userName.value || null)

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const { tanks, activeTankId, setActiveTankId } = useActiveTank()
const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

const tankLabel = computed(() => tank.value?.name ?? (tankId.value ? String(tankId.value) : ""))

const photosApi = usePhotos()
type LoadStatus = "idle" | "loading" | "ready" | "error"
const featuredStatus = ref<LoadStatus>("idle")
const featuredPhoto = ref<TankPhoto | null>(null)

const photoRevision = computed(() => {
  const spreadsheetId = tank.value?.spreadsheetId
  if (!spreadsheetId) return 0
  return photosApi.photoRevisions.value[spreadsheetId] ?? 0
})

async function loadFeaturedPhoto() {
  if (!import.meta.client) return

  if (!tank.value) {
    featuredPhoto.value = null
    featuredStatus.value = "idle"
    return
  }

  featuredStatus.value = "loading"
  try {
    const list = await photosApi.listTankPhotos({ spreadsheetId: tank.value.spreadsheetId })
    featuredPhoto.value = list[0] ?? null
    featuredStatus.value = "ready"
  } catch {
    featuredPhoto.value = null
    featuredStatus.value = "error"
  }
}

watchEffect(() => {
  if (!tankId.value) return
  if (!tank.value) return
  if (activeTankId.value !== tankId.value) setActiveTankId(tankId.value)
})

watch(
  [() => tank.value?.spreadsheetId, photoRevision],
  () => {
    loadFeaturedPhoto()
  },
  { immediate: true }
)

const tankNavItems = computed(() => {
  const id = tankId.value
  if (!id) return []

  const base = `/dashboard/tank/${id}`
  return [
    { to: base, labelKey: "nav.overview", isActive: route.path === base },
    { to: `${base}/water-test`, labelKey: "nav.tests", isActive: route.path.startsWith(`${base}/water-test`) },
    { to: `${base}/photos`, labelKey: "nav.photos", isActive: route.path.startsWith(`${base}/photos`) },
    { to: `${base}/livestock`, labelKey: "nav.livestock", isActive: route.path.startsWith(`${base}/livestock`) },
    { to: `${base}/events`, labelKey: "nav.events", isActive: route.path.startsWith(`${base}/events`) },
    { to: `${base}/reminders`, labelKey: "nav.reminders", isActive: route.path.startsWith(`${base}/reminders`) },
    { to: `${base}/configuration`, labelKey: "nav.configuration", isActive: route.path.startsWith(`${base}/configuration`) },
  ]
})

const isMobileNavOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    isMobileNavOpen.value = false
  }
)

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

    <div class="flex min-h-dvh">
      <aside class="hidden w-72 flex-col border-r border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 md:flex">
        <div class="border-b border-border/60 px-4 py-4">
          <div class="text-xs text-muted-foreground">{{ $t("nav.tank") }}</div>
          <div class="mt-1 truncate text-sm font-medium text-foreground">{{ tankLabel }}</div>
        </div>

        <nav class="grid gap-1 px-2 py-4" aria-label="Tank navigation">
          <NuxtLink
            class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :class="
              route.path === '/dashboard' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            "
            :to="localePath('/dashboard')"
            :aria-current="route.path === '/dashboard' ? 'page' : undefined"
          >
            {{ $t("nav.home") }}
          </NuxtLink>

          <NuxtLink
            v-for="item in tankNavItems"
            :key="item.to"
            class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            :class="item.isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            :to="localePath(item.to)"
            :aria-current="item.isActive ? 'page' : undefined"
          >
            {{ $t(item.labelKey) }}
          </NuxtLink>
        </nav>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
          <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div class="flex min-w-0 items-center gap-2">
              <NuxtLink
                class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                :to="localePath('/dashboard')"
              >
                TankLog
              </NuxtLink>
              <span class="max-lg:hidden text-muted-foreground">/</span>
              <div class="max-lg:hidden flex min-w-0 items-center gap-2">
                <div v-if="featuredPhoto && featuredStatus === 'ready'" class="size-8 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <DrivePhoto
                    :file-id="featuredPhoto.driveFileId"
                    :alt="$t('pages.tank.featuredPhotoAlt', { tank: tankLabel })"
                    fit="cover"
                    :lazy="false"
                  />
                </div>
                <div class="min-w-0 truncate text-sm font-medium text-foreground">{{ tankLabel }}</div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <LanguageSwitcher class="max-lg:hidden" />
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

              <Dialog v-model:open="isMobileNavOpen">
                <DialogTrigger as-child>
                  <Button type="button" variant="secondary" size="icon" class="md:hidden">
                    <Menu class="size-4" aria-hidden="true" />
                    <span class="sr-only">{{ $t("a11y.openNavigation") }}</span>
                  </Button>
                </DialogTrigger>

                <DialogContent class="!left-0 !top-0 !h-dvh !w-[85vw] !max-w-sm !translate-x-0 !translate-y-0 !rounded-none !p-4 md:hidden">
                  <DialogHeader>
                    <DialogTitle>{{ tankLabel || "TankLog" }}</DialogTitle>
                  </DialogHeader>

                  <nav class="mt-3 grid gap-1" aria-label="Tank navigation">
                    <NuxtLink
                      class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      :class="
                        route.path === '/dashboard'
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      "
                      :to="localePath('/dashboard')"
                      :aria-current="route.path === '/dashboard' ? 'page' : undefined"
                    >
                      {{ $t("nav.home") }}
                    </NuxtLink>

                    <NuxtLink
                      v-for="item in tankNavItems"
                      :key="item.to"
                      class="rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      :class="
                        item.isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      "
                      :to="localePath(item.to)"
                      :aria-current="item.isActive ? 'page' : undefined"
                    >
                      {{ $t(item.labelKey) }}
                    </NuxtLink>
                  </nav>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <main id="main" class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <slot />
        </main>

        <footer class="border-t border-border/60">
          <div class="mx-auto w-full max-w-6xl px-4 py-6">
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
    </div>
  </div>
</template>

