<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { SheetsCellValue } from "@/composables/useGoogleSheets"
import type { TankType } from "@/composables/useTanks"

definePageMeta({
  layout: "tank",
})

const { t } = useI18n()
const localePath = useLocalePath()

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const isStorageReady = computed(() => storage.hasRootFolderId.value)

const tanksApi = useTanks()
const { tanks, status: tanksStatus, error: tanksError } = tanksApi

const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

useHead(() => ({
  title: tank.value?.name ? `${tank.value.name} · ${t("pages.tankConfiguration.metaTitle")}` : t("pages.tankConfiguration.metaTitle"),
}))

const sheets = useGoogleSheets()

type LoadStatus = "idle" | "loading" | "ready" | "error"

const infoStatus = ref<LoadStatus>("idle")
const infoError = ref<string | null>(null)

const nameInput = ref("")
const typeInput = ref<TankType>("freshwater")
const volumeInput = ref("")
const startDateInput = ref("")
const notesInput = ref("")

function normalizeTankType(value: unknown): TankType | null {
  const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
  if (trimmed === "freshwater" || trimmed === "planted" || trimmed === "marine" || trimmed === "reef") return trimmed
  return null
}

function parseVolumeCell(value: SheetsCellValue | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toVolumeInputValue(value: number | null): string {
  if (value === null) return ""
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

async function loadTankInfo() {
  if (!import.meta.client) return

  infoError.value = null
  const current = tank.value

  if (!current) {
    infoStatus.value = "idle"
    nameInput.value = ""
    typeInput.value = "freshwater"
    volumeInput.value = ""
    startDateInput.value = ""
    notesInput.value = ""
    return
  }

  nameInput.value = current.name
  typeInput.value = current.type
  volumeInput.value = toVolumeInputValue(current.volumeLiters ?? null)
  startDateInput.value = ""
  notesInput.value = ""

  infoStatus.value = "loading"

  try {
    const response = await sheets.getValues({
      spreadsheetId: current.spreadsheetId,
      range: "TANK_INFO!A1:F2",
    })

    const row = response.values?.[1] ?? []

    const sheetName = row[1]
    const sheetType = row[2]
    const sheetVolume = row[3]
    const sheetStartDate = row[4]
    const sheetNotes = row[5]

    const name = sheetName === null || sheetName === undefined ? "" : String(sheetName).trim()
    const type = normalizeTankType(sheetType) ?? current.type
    const volume = parseVolumeCell(sheetVolume as SheetsCellValue | undefined)
    const startDate = sheetStartDate === null || sheetStartDate === undefined ? "" : String(sheetStartDate).trim()
    const notes = sheetNotes === null || sheetNotes === undefined ? "" : String(sheetNotes).trim()

    nameInput.value = name || current.name
    typeInput.value = type
    volumeInput.value = toVolumeInputValue(volume ?? current.volumeLiters ?? null)
    startDateInput.value = startDate
    notesInput.value = notes

    infoStatus.value = "ready"
  } catch (error) {
    infoError.value = error instanceof Error ? error.message : t("pages.tankConfiguration.form.errors.loadFailed")
    infoStatus.value = "error"
  }
}

watch(
  () => tank.value?.spreadsheetId,
  () => {
    loadTankInfo()
  },
  { immediate: true }
)

const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveStatus = ref<string | null>(null)

function parseVolumeInputValue(value: string): number | null | "invalid" {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(parsed) || parsed <= 0) return "invalid"
  return parsed
}

function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function onSave() {
  if (!import.meta.client) return

  saveError.value = null
  saveStatus.value = null

  const current = tank.value
  if (!current) {
    saveError.value = t("pages.tests.form.errors.noTank")
    return
  }

  const name = nameInput.value.trim()
  if (!name) {
    saveError.value = t("pages.tankConfiguration.form.errors.missingName")
    return
  }

  const type = normalizeTankType(typeInput.value) ?? null
  if (!type) {
    saveError.value = t("pages.tankConfiguration.form.errors.invalidType")
    return
  }

  const volumeParsed = parseVolumeInputValue(volumeInput.value)
  if (volumeParsed === "invalid") {
    saveError.value = t("pages.tankConfiguration.form.errors.invalidVolume")
    return
  }

  const startDate = startDateInput.value.trim() || null
  if (startDate && !isValidDateOnly(startDate)) {
    saveError.value = t("pages.tankConfiguration.form.errors.invalidStartDate")
    return
  }

  const notes = notesInput.value.trim() || null

  isSaving.value = true
  try {
    await sheets.updateValues({
      spreadsheetId: current.spreadsheetId,
      range: "TANK_INFO!A1:F2",
      values: [
        ["id", "name", "type", "volume_liters", "start_date", "notes"],
        [current.id, name, type, volumeParsed ?? null, startDate, notes],
      ],
    })

    await tanksApi.refresh()
    await loadTankInfo()
    saveStatus.value = t("pages.tankConfiguration.form.success.saved")
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : t("pages.tankConfiguration.form.errors.saveFailed")
  } finally {
    isSaving.value = false
  }
}

const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

const { setActiveTankId } = useActiveTank()

async function onDeleteTank() {
  if (!import.meta.client) return

  deleteError.value = null
  const current = tank.value
  if (!current) {
    deleteError.value = t("pages.tests.form.errors.noTank")
    return
  }

  isDeleting.value = true
  try {
    await tanksApi.deleteTank({ tankId: current.id })
    setActiveTankId("")
    isDeleteDialogOpen.value = false
    await navigateTo(localePath("/"), { replace: true })
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : t("pages.tankConfiguration.danger.errors.deleteFailed")
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.tankConfiguration.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">{{ $t("pages.tankConfiguration.description") }}</p>
    </div>

    <Card v-if="!isStorageReady">
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button as-child>
          <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <template v-else>
      <div v-if="tanksError" class="text-sm text-destructive" role="alert">
        {{ tanksError }}
      </div>

      <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
        {{ $t("pages.settings.tanks.loading") }}
      </div>

      <Card v-else-if="!tank">
        <CardHeader>
          <CardTitle>{{ $t("pages.tank.unknown.title") }}</CardTitle>
          <CardDescription>
            {{ $t("pages.tank.unknown.descriptionPrefix") }}
            <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
          </CardDescription>
        </CardHeader>
        <CardContent class="text-sm text-muted-foreground">
          {{ $t("pages.tank.unknown.body") }}
        </CardContent>
        <CardFooter>
          <Button as-child>
            <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.tankConfiguration.form.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.tankConfiguration.form.description") }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 text-sm text-muted-foreground">
            <p v-if="infoStatus === 'loading'" class="text-sm text-muted-foreground">{{ $t("pages.tankConfiguration.form.loading") }}</p>
            <p v-else-if="infoStatus === 'error'" class="text-sm text-destructive" role="alert">
              {{ infoError }}
            </p>

            <form class="space-y-5" @submit.prevent="onSave">
              <div class="space-y-2">
                <label for="tank-config-name" class="text-foreground">{{ $t("pages.settings.tanks.fields.name") }}</label>
                <input
                  id="tank-config-name"
                  v-model="nameInput"
                  type="text"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :placeholder="$t('pages.settings.tanks.placeholders.name')"
                  required
                />
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <label for="tank-config-type" class="text-foreground">{{ $t("pages.settings.tanks.fields.type") }}</label>
                  <select
                    id="tank-config-type"
                    v-model="typeInput"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="freshwater">{{ $t("pages.settings.tanks.types.freshwater") }}</option>
                    <option value="planted">{{ $t("pages.settings.tanks.types.planted") }}</option>
                    <option value="marine">{{ $t("pages.settings.tanks.types.marine") }}</option>
                    <option value="reef">{{ $t("pages.settings.tanks.types.reef") }}</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label for="tank-config-volume" class="text-foreground">{{ $t("pages.settings.tanks.fields.volume") }}</label>
                  <input
                    id="tank-config-volume"
                    v-model="volumeInput"
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
                  <label for="tank-config-start-date" class="text-foreground">
                    {{ $t("pages.settings.tanks.fields.startDate") }}
                  </label>
                  <input
                    id="tank-config-start-date"
                    v-model="startDateInput"
                    type="date"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div class="space-y-2">
                  <label for="tank-config-notes" class="text-foreground">{{ $t("pages.settings.tanks.fields.notes") }}</label>
                  <input
                    id="tank-config-notes"
                    v-model="notesInput"
                    type="text"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :placeholder="$t('pages.settings.tanks.placeholders.notes')"
                  />
                </div>
              </div>

              <p v-if="saveError" class="text-sm text-destructive" role="alert">{{ saveError }}</p>
              <p v-else-if="saveStatus" class="text-sm text-foreground" role="status">{{ saveStatus }}</p>

              <div class="flex flex-wrap gap-2">
                <Button type="submit" :disabled="isSaving">
                  <span v-if="isSaving">{{ $t("pages.tankConfiguration.form.saving") }}</span>
                  <span v-else>{{ $t("pages.tankConfiguration.form.save") }}</span>
                </Button>
                <Button type="button" variant="secondary" :disabled="isSaving || infoStatus === 'loading'" @click="loadTankInfo">
                  {{ $t("pages.tankConfiguration.form.reload") }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{{ $t("pages.tankConfiguration.danger.title") }}</CardTitle>
            <CardDescription>{{ $t("pages.tankConfiguration.danger.description") }}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Dialog v-model:open="isDeleteDialogOpen">
              <DialogTrigger as-child>
                <Button type="button" variant="destructive">
                  {{ $t("pages.tankConfiguration.danger.deleteAction") }}
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{{ $t("pages.tankConfiguration.danger.confirmTitle") }}</DialogTitle>
                  <DialogDescription>{{ $t("pages.tankConfiguration.danger.confirmDescription") }}</DialogDescription>
                </DialogHeader>

                <p v-if="deleteError" class="text-sm text-destructive" role="alert">{{ deleteError }}</p>

                <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <DialogClose as-child>
                    <Button type="button" variant="secondary" :disabled="isDeleting">
                      {{ $t("actions.cancel") }}
                    </Button>
                  </DialogClose>
                  <Button type="button" variant="destructive" :disabled="isDeleting" @click="onDeleteTank">
                    <span v-if="isDeleting">{{ $t("pages.tankConfiguration.danger.deleting") }}</span>
                    <span v-else>{{ $t("pages.tankConfiguration.danger.deleteConfirm") }}</span>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </template>
    </template>
  </section>
</template>

