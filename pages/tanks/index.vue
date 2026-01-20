<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const { t } = useI18n()

useHead(() => ({
  title: t("pages.settings.tanks.title"),
}))

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()

const rootFolderId = storage.rootFolderId

const { tanks, status: tanksStatus, error: tanksError, refresh: refreshTanks, createTank } = useTanks()
const { activeTankId, setActiveTankId } = useActiveTank()

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
  let volume: number | null = null
  if (volumeText) {
    const parsedVolume = Number(volumeText)
    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      createTankError.value = t("pages.settings.tanks.errors.invalidVolume")
      return
    }
    volume = parsedVolume
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
    await navigateTo(`/tanks/${created.id}`)
  } catch (error) {
    createTankError.value = error instanceof Error ? error.message : t("pages.settings.tanks.errors.createFailed")
  } finally {
    isCreatingTank.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.settings.tanks.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">{{ $t("pages.settings.tanks.description") }}</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.tanks.listTitle") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.tanks.listHint") }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4 text-sm text-muted-foreground">
        <div v-if="!rootFolderId" class="space-y-2">
          <p>{{ $t("pages.settings.tanks.locked") }}</p>
        </div>

        <div v-else class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
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
                          inputmode="decimal"
                          type="number"
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
            <li
              v-for="tank in tanks"
              :key="tank.id"
              class="rounded-md border border-border/60 p-3"
              :class="tank.id === activeTankId ? 'bg-accent/40' : undefined"
            >
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
                  <NuxtLink :to="`/tanks/${tank.id}`">{{ $t("pages.settings.tanks.open") }}</NuxtLink>
                </Button>
              </div>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

