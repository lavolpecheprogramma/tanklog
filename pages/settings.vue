<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { GoogleDriveFile } from "@/composables/useGoogleDrive"

const { t, locale: activeLocale } = useI18n()

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

const { tanks, status: tanksStatus, error: tanksError, refresh: refreshTanks, createTank } = useTanks()
const { setActiveTankId } = useActiveTank()

const isCreateTankDialogOpen = ref(false)
const isCreatingTank = ref(false)
const createTankError = ref<string | null>(null)

const newTankName = ref("")
const newTankType = ref<"freshwater" | "marine" | "reef">("freshwater")
const newTankVolumeLiters = ref<string>("")
const newTankStartDate = ref<string>("")
const newTankNotes = ref<string>("")

function resetNewTankForm() {
  newTankName.value = ""
  newTankType.value = "freshwater"
  newTankVolumeLiters.value = ""
  newTankStartDate.value = ""
  newTankNotes.value = ""
  createTankError.value = null
}

watch(isCreateTankDialogOpen, (open) => {
  if (!open) resetNewTankForm()
})

async function onCreateTank() {
  createTankError.value = null

  if (!rootFolderId.value) {
    createTankError.value = t("pages.settings.tanks.errors.noRootFolder")
    return
  }

  const name = newTankName.value.trim()
  if (!name) {
    createTankError.value = t("pages.settings.tanks.errors.missingName")
    return
  }

  const volumeText = newTankVolumeLiters.value.toString().trim()
  const volume = volumeText ? Number(volumeText) : null
  if (volumeText && (!Number.isFinite(volume) || volume <= 0)) {
    createTankError.value = t("pages.settings.tanks.errors.invalidVolume")
    return
  }

  const startDate = newTankStartDate.value.trim() || null
  const notes = newTankNotes.value.trim() || null

  isCreatingTank.value = true
  try {
    const created = await createTank({
      name,
      type: newTankType.value,
      volumeLiters: volume,
      startDate,
      notes,
    })

    setActiveTankId(created.id)
    isCreateTankDialogOpen.value = false
    resetNewTankForm()
  } catch (error) {
    createTankError.value = error instanceof Error ? error.message : t("pages.settings.tanks.errors.createFailed")
  } finally {
    isCreatingTank.value = false
  }
}

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

  storage.clearRootFolderId()
  folderInput.value = ""
  folderStatus.value = t("pages.settings.storage.success.disconnected")
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
    </div>

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
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li v-for="scope in scopes" :key="scope">
                <code class="rounded bg-muted px-1 py-0.5">{{ scope }}</code>
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

    <Card>
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
            <input
              id="tanklog-folder-id"
              v-model="folderInput"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

    <Card>
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

              <Dialog v-model:open="isCreateTankDialogOpen">
                <DialogTrigger as-child>
                  <Button type="button" size="sm">{{ $t("pages.settings.tanks.add") }}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{{ $t("pages.settings.tanks.createDialog.title") }}</DialogTitle>
                    <DialogDescription>
                      {{ $t("pages.settings.tanks.createDialog.description") }}
                    </DialogDescription>
                  </DialogHeader>

                  <form class="space-y-4" @submit.prevent="onCreateTank">
                    <div class="space-y-2">
                      <label for="new-tank-name" class="text-foreground">{{ $t("pages.settings.tanks.fields.name") }}</label>
                      <input
                        id="new-tank-name"
                        v-model="newTankName"
                        type="text"
                        autocomplete="off"
                        class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        :placeholder="$t('pages.settings.tanks.placeholders.name')"
                        required
                      />
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                      <div class="space-y-2">
                        <label for="new-tank-type" class="text-foreground">{{ $t("pages.settings.tanks.fields.type") }}</label>
                        <select
                          id="new-tank-type"
                          v-model="newTankType"
                          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="freshwater">{{ $t("pages.settings.tanks.types.freshwater") }}</option>
                          <option value="marine">{{ $t("pages.settings.tanks.types.marine") }}</option>
                          <option value="reef">{{ $t("pages.settings.tanks.types.reef") }}</option>
                        </select>
                      </div>

                      <div class="space-y-2">
                        <label for="new-tank-volume" class="text-foreground">{{ $t("pages.settings.tanks.fields.volume") }}</label>
                        <input
                          id="new-tank-volume"
                          v-model="newTankVolumeLiters"
                          type="number"
                          inputmode="decimal"
                          min="0"
                          step="0.1"
                          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          :placeholder="$t('pages.settings.tanks.placeholders.volume')"
                        />
                      </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                      <div class="space-y-2">
                        <label for="new-tank-start-date" class="text-foreground">
                          {{ $t("pages.settings.tanks.fields.startDate") }}
                        </label>
                        <input
                          id="new-tank-start-date"
                          v-model="newTankStartDate"
                          type="date"
                          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      <div class="space-y-2">
                        <label for="new-tank-notes" class="text-foreground">{{ $t("pages.settings.tanks.fields.notes") }}</label>
                        <input
                          id="new-tank-notes"
                          v-model="newTankNotes"
                          type="text"
                          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          :placeholder="$t('pages.settings.tanks.placeholders.notes')"
                        />
                      </div>
                    </div>

                    <p v-if="createTankError" class="text-sm text-destructive" role="alert">{{ createTankError }}</p>

                    <DialogFooter>
                      <Button type="submit" :disabled="isCreatingTank">
                        <span v-if="isCreatingTank">{{ $t("pages.settings.tanks.creating") }}</span>
                        <span v-else>{{ $t("pages.settings.tanks.createConfirm") }}</span>
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
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
                  <NuxtLink :to="`/vasques/${tank.id}`">{{ $t("pages.settings.tanks.open") }}</NuxtLink>
                </Button>
              </div>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

