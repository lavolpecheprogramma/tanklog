<script setup lang="ts">
  import { Button } from "@/components/ui/button"
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
  import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
  import { Input } from "@/components/ui/input"
  import type { GoogleDriveFile } from "@/composables/useGoogleDrive"
  
  const { t, locale: activeLocale } = useI18n()
  const localePath = useLocalePath()
  
  useHead(() => ({
    title: t("pages.settings.metaTitle"),
  }))
  
  const auth = useAuth()
  
  const isLoggingOut = ref(false)
  
  const userEmail = computed(() => auth.user.value?.email ?? null)
  const userName = computed(() => auth.user.value?.name ?? null)
  const scopes = computed(() => (auth.session.value?.scope ? auth.session.value.scope.split(" ") : []))
  
  const tokenExpiresAt = computed(() => auth.session.value?.expiresAt ?? null)
  const tokenExpiresText = computed(() => {
    if (!tokenExpiresAt.value) return null
    try {
      return new Date(tokenExpiresAt.value).toLocaleString(activeLocale.value)
    } catch {
      return null
    }
  })
  
  const googleClient = useTankLogGoogleClientId()
  googleClient.hydrateFromStorage()

  const configuredGoogleClientId = googleClient.googleClientId
  const hasGoogleClientId = googleClient.hasGoogleClientId
  const googleClientIdInput = ref(configuredGoogleClientId.value ?? "")
  const googleClientIdError = ref<string | null>(null)
  const googleClientIdStatus = ref<string | null>(null)

  watch(
    configuredGoogleClientId,
    (value) => {
      googleClientIdInput.value = value ?? ""
    },
    { immediate: true }
  )

  function onSaveGoogleClientId() {
    googleClientIdError.value = null
    googleClientIdStatus.value = null

    if (!googleClientIdInput.value.trim()) {
      googleClientIdError.value = t("pages.settings.googleClientId.errors.required")
      return
    }

    const normalized = googleClient.setGoogleClientIdFromInput(googleClientIdInput.value)
    if (!normalized) {
      googleClientIdError.value = t("pages.settings.googleClientId.errors.required")
      return
    }

    googleClientIdInput.value = normalized
    googleClientIdStatus.value = t("pages.settings.googleClientId.success.saved")
  }

  function onRemoveGoogleClientId() {
    googleClientIdError.value = null
    googleClientIdStatus.value = null

    googleClient.clearGoogleClientId()
    googleClientIdInput.value = ""
    googleClientIdStatus.value = t("pages.settings.googleClientId.success.removed")
  }

  const storage = useTankLogRootFolderId()
  storage.hydrateFromStorage()
  
  const rootFolderId = storage.rootFolderId
  const folderInput = ref(rootFolderId.value ?? "")
  const folderError = ref<string | null>(null)
  const folderStatus = ref<string | null>(null)
  
  watch(
    rootFolderId,
    (value) => {
      folderInput.value = value ?? ""
    },
    { immediate: true }
  )
  
  const drive = useGoogleDrive()
  const isSearching = ref(false)
  const searchError = ref<string | null>(null)
  const foundTankLogFolders = ref<GoogleDriveFile[]>([])
  
  const isCreating = ref(false)
  const createError = ref<string | null>(null)
  const isCreateDialogOpen = ref(false)
  
  const tankLogFolderUrl = computed(() => {
    if (!rootFolderId.value) return null
    return `https://drive.google.com/drive/folders/${rootFolderId.value}`
  })
  
  const { tanks, status: tanksStatus, error: tanksError, refresh: refreshTanks } = useTanks()
  const { activeTank, setActiveTankId } = useActiveTank()
  
  const isCreateTankDialogOpen = ref(false)
  const isResetDialogOpen = ref(false)
  
  function onSaveTankLogFolder() {
    folderError.value = null
    folderStatus.value = null
  
    const normalized = storage.setRootFolderIdFromInput(folderInput.value)
    if (!normalized) {
      folderError.value = t("pages.settings.storage.errors.invalidFolder")
      return
    }
  
    folderInput.value = normalized
    folderStatus.value = t("pages.settings.storage.success.connected")
  }
  
  function onDisconnectTankLogFolder() {
    folderError.value = null
    folderStatus.value = null
    searchError.value = null
    foundTankLogFolders.value = []
  
    setActiveTankId("")
    storage.clearRootFolderId()
    folderInput.value = ""
    folderStatus.value = t("pages.settings.storage.success.disconnected")
  }
  
  function onResetLocalData() {
    onDisconnectTankLogFolder()
    onRemoveGoogleClientId()
    isResetDialogOpen.value = false
  }
  
  async function onFindTankLogFolders() {
    searchError.value = null
    folderStatus.value = null
  
    isSearching.value = true
    try {
      const result = await drive.listFiles({
        q: "mimeType='application/vnd.google-apps.folder' and name='TankLog' and trashed=false",
        pageSize: 50,
      })
  
      foundTankLogFolders.value = result.files ?? []
      if (!foundTankLogFolders.value.length) {
        searchError.value = t("pages.settings.storage.errors.noFoldersFound")
      }
    } catch (error) {
      searchError.value = error instanceof Error ? error.message : t("pages.settings.storage.errors.searchFailed")
    } finally {
      isSearching.value = false
    }
  }
  
  function onUseFoundFolder(folder: GoogleDriveFile) {
    folderError.value = null
    searchError.value = null
    folderStatus.value = null
  
    storage.setRootFolderId(folder.id)
    folderInput.value = folder.id
    folderStatus.value = t("pages.settings.storage.success.connected")
  }
  
  async function onCreateTankLogFolder() {
    createError.value = null
    folderStatus.value = null
  
    isCreating.value = true
    try {
      const created = await drive.createFolder({ name: "TankLog", parentId: "root" })
      storage.setRootFolderId(created.id)
      folderInput.value = created.id
      folderStatus.value = t("pages.settings.storage.success.created")
      isCreateDialogOpen.value = false
    } catch (error) {
      createError.value = error instanceof Error ? error.message : t("pages.settings.storage.errors.createFailed")
    } finally {
      isCreating.value = false
    }
  }
  
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
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.settings.title") }}</h1>
        <p class="max-w-prose text-muted-foreground">
          {{ $t("pages.settings.description") }}
        </p>
        <div v-if="activeTank" class="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" as-child>
            <NuxtLink :to="localePath(`/dashboard/tank/${activeTank.id}`)">{{ $t("actions.backToTank") }}</NuxtLink>
          </Button>
        </div>
      </div>
  
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.onboarding.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.onboarding.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 text-sm text-muted-foreground">
          <ol class="space-y-4">
            <li class="flex gap-3">
              <div
                class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                1
              </div>
              <div class="min-w-0 space-y-1">
                <div class="font-medium text-foreground">{{ $t("pages.settings.onboarding.steps.storage.title") }}</div>
                <div class="max-w-prose">{{ $t("pages.settings.onboarding.steps.storage.description") }}</div>
  
                <div class="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" as-child>
                    <a href="#settings-storage">{{ $t("pages.settings.onboarding.steps.storage.cta") }}</a>
                  </Button>
                  <Button
                    v-if="!rootFolderId"
                    type="button"
                    size="sm"
                    :disabled="isCreateDialogOpen || isCreating"
                    @click="isCreateDialogOpen = true"
                  >
                    {{ $t("pages.settings.storage.create") }}
                  </Button>
                  <div v-else class="text-xs text-muted-foreground">
                    {{ $t("pages.settings.onboarding.steps.storage.done") }}
                  </div>
                </div>
              </div>
            </li>
  
            <li class="flex gap-3">
              <div
                class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                2
              </div>
              <div class="min-w-0 space-y-1">
                <div class="font-medium text-foreground">{{ $t("pages.settings.onboarding.steps.tanks.title") }}</div>
                <div class="max-w-prose">{{ $t("pages.settings.onboarding.steps.tanks.description") }}</div>
  
                <div class="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" as-child>
                    <a href="#settings-tanks">{{ $t("pages.settings.onboarding.steps.tanks.cta") }}</a>
                  </Button>
                  <Button
                    v-if="rootFolderId"
                    type="button"
                    size="sm"
                    :disabled="isCreateTankDialogOpen"
                    @click="isCreateTankDialogOpen = true"
                  >
                    {{ $t("pages.settings.tanks.add") }}
                  </Button>
                  <div v-else class="text-xs text-muted-foreground">
                    {{ $t("pages.settings.onboarding.steps.tanks.locked") }}
                  </div>
                  <div v-if="tanks.length" class="text-xs text-muted-foreground">
                    {{ $t("pages.settings.onboarding.steps.tanks.done", { count: tanks.length }) }}
                  </div>
                </div>
              </div>
            </li>
  
            <li class="flex gap-3">
              <div
                class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                3
              </div>
              <div class="min-w-0 space-y-1">
                <div class="font-medium text-foreground">{{ $t("pages.settings.onboarding.steps.next.title") }}</div>
                <div class="max-w-prose">{{ $t("pages.settings.onboarding.steps.next.description") }}</div>
  
                <div class="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" as-child>
                    <NuxtLink :to="localePath('/')">{{ $t("pages.settings.onboarding.steps.next.ctaHome") }}</NuxtLink>
                  </Button>
                  <Button v-if="activeTank" size="sm" as-child>
                    <NuxtLink :to="localePath(`dashboard/tank/${activeTank.id}`)">
                      {{ $t("pages.settings.onboarding.steps.next.ctaTank") }}
                    </NuxtLink>
                  </Button>
                  <div v-else-if="tanksStatus === 'loading'" class="text-xs text-muted-foreground">
                    {{ $t("pages.settings.onboarding.steps.next.loadingTanks") }}
                  </div>
                  <div v-else-if="rootFolderId && !tanks.length" class="text-xs text-muted-foreground">
                    {{ $t("pages.settings.onboarding.steps.next.noTanks") }}
                  </div>
                </div>
              </div>
            </li>
          </ol>
  
          <details class="rounded-md border border-border/60 bg-background p-3">
            <summary class="cursor-pointer text-sm font-medium text-foreground">
              {{ $t("pages.settings.onboarding.template.summary") }}
            </summary>
            <div class="mt-2 space-y-2 text-xs text-muted-foreground">
              <p class="max-w-prose">{{ $t("pages.settings.onboarding.template.hint") }}</p>
              <ul class="list-disc space-y-1 pl-5">
                <li><code class="rounded bg-muted px-1 py-0.5">TANK_INFO</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">WATER_TESTS</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">EVENTS</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">REMINDERS</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">PHOTOS</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">PARAMETER_RANGES</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">LIVESTOCK</code></li>
                <li><code class="rounded bg-muted px-1 py-0.5">EQUIPMENT</code></li>
              </ul>
            </div>
          </details>
        </CardContent>
      </Card>
  
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.language.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.language.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <LanguageSwitcher />
        </CardContent>
      </Card>
  
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.account.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.account.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <div class="space-y-3">
            <div>
              <div class="text-foreground">{{ $t("pages.settings.account.googleUserLabel") }}</div>
              <div v-if="userName || userEmail">
                <span v-if="userName">{{ userName }}</span>
                <span v-if="userName && userEmail" class="text-muted-foreground"> · </span>
                <span v-if="userEmail">{{ userEmail }}</span>
              </div>
              <div v-else>{{ $t("pages.settings.account.profileUnavailable") }}</div>
            </div>
  
            <div v-if="tokenExpiresText">
              <div class="text-foreground">{{ $t("pages.settings.account.tokenExpiresLabel") }}</div>
              <div>{{ tokenExpiresText }}</div>
            </div>
  
            <div>
              <div class="text-foreground">{{ $t("pages.settings.account.scopesLabel") }}</div>
              <ul class="mt-1 max-w-full list-inside list-disc space-y-1 overflow-x-auto">
                <li v-for="scope in scopes" :key="scope">
                  <code class="whitespace-nowrap rounded bg-muted px-1 py-0.5">{{ scope }}</code>
                </li>
              </ul>
            </div>
  
            <div class="pt-2">
              <Button type="button" variant="secondary" :disabled="isLoggingOut" @click="onLogout">
                <span v-if="isLoggingOut">{{ $t("actions.loggingOut") }}</span>
                <span v-else>{{ $t("actions.logout") }}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
  
      <Card id="settings-google-client-id">
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.googleClientId.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.googleClientId.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <form class="space-y-4" @submit.prevent="onSaveGoogleClientId">
            <div>
              <div class="text-foreground">{{ $t("pages.settings.googleClientId.statusLabel") }}</div>
              <div>
                <span v-if="hasGoogleClientId">{{ $t("pages.settings.googleClientId.statusConfigured") }}</span>
                <span v-else>{{ $t("pages.settings.googleClientId.statusNotConfigured") }}</span>
              </div>
            </div>

            <div class="space-y-2">
              <label for="settings-google-client-id-input" class="text-foreground">
                {{ $t("pages.settings.googleClientId.label") }}
              </label>
              <Input
                id="settings-google-client-id-input"
                v-model="googleClientIdInput"
                type="text"
                inputmode="text"
                autocomplete="off"
                spellcheck="false"
                :placeholder="$t('pages.settings.googleClientId.placeholder')"
                :aria-invalid="googleClientIdError ? 'true' : 'false'"
                aria-describedby="settings-google-client-id-hint settings-google-client-id-feedback"
              />
              <p id="settings-google-client-id-hint" class="text-xs text-muted-foreground">
                {{ $t("pages.settings.googleClientId.hint") }}
              </p>

              <p v-if="googleClientIdError" id="settings-google-client-id-feedback" class="text-sm text-destructive" role="alert">
                {{ googleClientIdError }}
              </p>
              <p
                v-else-if="googleClientIdStatus"
                id="settings-google-client-id-feedback"
                class="text-sm text-foreground"
                role="status"
              >
                {{ googleClientIdStatus }}
              </p>
              <p v-else id="settings-google-client-id-feedback" class="sr-only"> </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button type="submit">{{ $t("pages.settings.googleClientId.actions.save") }}</Button>
              <Button type="button" variant="secondary" :disabled="!hasGoogleClientId" @click="onRemoveGoogleClientId">
                {{ $t("pages.settings.googleClientId.actions.remove") }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="settings-storage">
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <form class="space-y-4" @submit.prevent="onSaveTankLogFolder">
            <div>
              <div class="text-foreground">{{ $t("pages.settings.storage.statusLabel") }}</div>
              <div>
                <span v-if="rootFolderId">{{ $t("pages.settings.storage.statusConnected") }}</span>
                <span v-else>{{ $t("pages.settings.storage.statusNotConnected") }}</span>
              </div>
              <div v-if="tankLogFolderUrl" class="mt-1 text-xs">
                <a
                  class="underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  :href="tankLogFolderUrl"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {{ $t("pages.settings.storage.openInDrive") }}
                </a>
              </div>
            </div>
  
            <div class="space-y-2">
              <label for="tanklog-folder-id" class="text-foreground">{{ $t("pages.settings.storage.label") }}</label>
              <Input
                id="tanklog-folder-id"
                v-model="folderInput"
                type="text"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                :placeholder="$t('pages.settings.storage.placeholder')"
                :aria-invalid="folderError ? 'true' : 'false'"
                aria-describedby="tanklog-folder-hint tanklog-folder-feedback"
              />
              <p id="tanklog-folder-hint" class="text-xs text-muted-foreground">
                {{ $t("pages.settings.storage.hint") }}
              </p>
  
              <p v-if="folderError" id="tanklog-folder-feedback" class="text-sm text-destructive" role="alert">
                {{ folderError }}
              </p>
              <p v-else-if="folderStatus" id="tanklog-folder-feedback" class="text-sm text-foreground" role="status">
                {{ folderStatus }}
              </p>
              <p v-else id="tanklog-folder-feedback" class="sr-only"> </p>
            </div>
  
            <div class="flex flex-wrap gap-2">
              <Button type="submit">{{ $t("pages.settings.storage.connect") }}</Button>
              <Button type="button" variant="secondary" :disabled="!rootFolderId" @click="onDisconnectTankLogFolder">
                {{ $t("pages.settings.storage.disconnect") }}
              </Button>
  
              <Button type="button" variant="secondary" :disabled="isSearching" @click="onFindTankLogFolders">
                <span v-if="isSearching">{{ $t("pages.settings.storage.searching") }}</span>
                <span v-else>{{ $t("pages.settings.storage.findExisting") }}</span>
              </Button>
  
              <Dialog v-model:open="isCreateDialogOpen">
                <DialogTrigger as-child>
                  <Button type="button" variant="secondary">{{ $t("pages.settings.storage.create") }}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{{ $t("pages.settings.storage.createDialog.title") }}</DialogTitle>
                    <DialogDescription>
                      {{ $t("pages.settings.storage.createDialog.description") }}
                    </DialogDescription>
                  </DialogHeader>
  
                  <p v-if="createError" class="text-sm text-destructive" role="alert">{{ createError }}</p>
  
                  <DialogFooter>
                    <Button type="button" :disabled="isCreating" @click="onCreateTankLogFolder">
                      <span v-if="isCreating">{{ $t("pages.settings.storage.creating") }}</span>
                      <span v-else>{{ $t("pages.settings.storage.createConfirm") }}</span>
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
  
            <div v-if="searchError" class="text-sm text-destructive" role="alert">
              {{ searchError }}
            </div>
  
            <div v-else-if="foundTankLogFolders.length" class="space-y-2">
              <div class="text-foreground">{{ $t("pages.settings.storage.foundLabel") }}</div>
              <ul class="space-y-2">
                <li v-for="folder in foundTankLogFolders" :key="folder.id" class="rounded-md border border-border/60 p-3">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div class="text-sm font-medium text-foreground">{{ folder.name }}</div>
                      <div class="mt-1 text-xs text-muted-foreground">
                        <code class="rounded bg-muted px-1 py-0.5">{{ folder.id }}</code>
                      </div>
                    </div>
                    <Button type="button" size="sm" @click="onUseFoundFolder(folder)">
                      {{ $t("pages.settings.storage.useThisFolder") }}
                    </Button>
                  </div>
                </li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
  
      <Card id="settings-tanks">
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.tanks.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.tanks.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <div v-if="!rootFolderId" class="space-y-2">
            <p>{{ $t("pages.settings.tanks.locked") }}</p>
          </div>
  
          <div v-else class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-foreground">{{ $t("pages.settings.tanks.listTitle") }}</div>
                <div class="text-xs text-muted-foreground">{{ $t("pages.settings.tanks.listHint") }}</div>
              </div>
  
              <div class="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" :disabled="tanksStatus === 'loading'" @click="refreshTanks">
                  {{ $t("pages.settings.tanks.refresh") }}
                </Button>
  
                <Button type="button" size="sm" :disabled="isCreateTankDialogOpen" @click="isCreateTankDialogOpen = true">
                  {{ $t("pages.settings.tanks.add") }}
                </Button>
              </div>
  
              <CreateTankDialog v-model:open="isCreateTankDialogOpen" />
            </div>
  
            <div v-if="tanksError" class="text-sm text-destructive" role="alert">
              {{ tanksError }}
            </div>
  
            <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
              {{ $t("pages.settings.tanks.loading") }}
            </div>
  
            <div v-else-if="!tanks.length" class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ $t("pages.settings.tanks.empty") }}</p>
            </div>
  
            <ul v-else class="space-y-2">
              <li v-for="tank in tanks" :key="tank.id" class="rounded-md border border-border/60 p-3">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="text-sm font-medium text-foreground">{{ tank.name }}</div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
                      <span class="text-muted-foreground"> · </span>
                      <span>{{ tank.type }}</span>
                    </div>
                  </div>
  
                  <Button as-child size="sm">
                    <NuxtLink :to="localePath(`/dashboard/tank/${tank.id}`)">{{ $t("pages.settings.tanks.open") }}</NuxtLink>
                  </Button>
                </div>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
  
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.settings.reset.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.settings.reset.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          <Dialog v-model:open="isResetDialogOpen">
            <DialogTrigger as-child>
              <Button type="button" variant="destructive">{{ $t("pages.settings.reset.action") }}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{{ $t("pages.settings.reset.confirmTitle") }}</DialogTitle>
                <DialogDescription>{{ $t("pages.settings.reset.confirmDescription") }}</DialogDescription>
              </DialogHeader>
              <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <DialogClose as-child>
                  <Button type="button" variant="secondary">{{ $t("actions.cancel") }}</Button>
                </DialogClose>
                <Button type="button" variant="destructive" @click="onResetLocalData">
                  {{ $t("pages.settings.reset.confirmAction") }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </section>
  </template>
  