<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const props = withDefaults(
  defineProps<{
    open?: boolean
  }>(),
  {
    open: false,
  }
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
})

const { t } = useI18n()
const localePath = useLocalePath()

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const rootFolderId = storage.rootFolderId

const { createTank } = useTanks()
const { setActiveTankId } = useActiveTank()

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

watch(isOpen, (open) => {
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
    isOpen.value = false
    resetNewTankForm()
    await navigateTo(localePath(`/dashboard/tank/${created.id}`))
  } catch (error) {
    createTankError.value = error instanceof Error ? error.message : t("pages.settings.tanks.errors.createFailed")
  } finally {
    isCreatingTank.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
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
</template>

