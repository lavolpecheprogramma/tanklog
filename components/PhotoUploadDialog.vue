<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

type UploadKind = "tank" | "livestock"

const props = withDefaults(defineProps<{
  kind: UploadKind
  tank: { spreadsheetId: string; folderId: string } | null
  livestockId?: string | null
  triggerLabel?: string
  title?: string
  description?: string
}>(), {
  livestockId: null,
  triggerLabel: "",
  title: "",
  description: "",
})

const emit = defineEmits<{
  (e: "uploaded"): void
}>()

const { t } = useI18n()
const photosApi = usePhotos()

const isOpen = ref(false)

const dateInput = ref("")
const dateError = ref<string | null>(null)

const noteInput = ref("")

const fileInputEl = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref<string | null>(null)

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

const resolvedTitle = computed(() => props.title || t("pages.photos.form.title"))
const resolvedDescription = computed(() => {
  if (props.description) return props.description
  return props.kind === "livestock" ? t("pages.livestock.photos.uploadDescription") : t("pages.photos.form.description")
})
const resolvedTriggerLabel = computed(() => props.triggerLabel || t("pages.photos.form.title"))

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function resetFormErrors() {
  dateError.value = null
  fileError.value = null
  submitError.value = null
  submitStatus.value = null
}

function resetForm() {
  dateInput.value = toDatetimeLocalValue(new Date())
  noteInput.value = ""
  selectedFile.value = null
  if (fileInputEl.value) fileInputEl.value.value = ""
  resetFormErrors()
}

watch(isOpen, (open) => {
  if (!open) return
  if (!dateInput.value) dateInput.value = toDatetimeLocalValue(new Date())
  submitError.value = null
  submitStatus.value = null
})

function onFileChange(event: Event) {
  fileError.value = null
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  selectedFile.value = file
}

function validate() {
  resetFormErrors()

  const tank = props.tank
  if (!tank?.spreadsheetId || !tank.folderId) {
    submitError.value = t("pages.photos.form.errors.noTank")
    return null
  }

  if (props.kind === "livestock") {
    const livestockId = props.livestockId?.trim()
    if (!livestockId) {
      submitError.value = t("pages.livestock.detail.notFound")
      return null
    }
  }

  if (!dateInput.value) {
    dateError.value = t("pages.photos.form.errors.missingDate")
    return null
  }

  const date = new Date(dateInput.value)
  if (Number.isNaN(date.getTime())) {
    dateError.value = t("pages.photos.form.errors.invalidDate")
    return null
  }

  const file = selectedFile.value
  if (!file) {
    fileError.value = t("pages.photos.form.errors.missingFile")
    return null
  }

  if (!file.type || !file.type.startsWith("image/")) {
    fileError.value = t("pages.photos.form.errors.invalidFile")
    return null
  }

  return { tank, date, file, note: noteInput.value }
}

async function onSubmit() {
  submitError.value = null
  submitStatus.value = null

  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    if (props.kind === "tank") {
      await photosApi.uploadTankPhoto({
        spreadsheetId: validated.tank.spreadsheetId,
        tankFolderId: validated.tank.folderId,
        file: validated.file,
        date: validated.date,
        note: validated.note,
      })
    } else {
      await photosApi.uploadLivestockPhoto({
        spreadsheetId: validated.tank.spreadsheetId,
        tankFolderId: validated.tank.folderId,
        livestockId: props.livestockId!.trim(),
        file: validated.file,
        date: validated.date,
        note: validated.note,
      })
    }

    emit("uploaded")
    submitStatus.value = t("pages.photos.form.success.saved")
    resetForm()
    isOpen.value = false
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : t("pages.photos.form.errors.saveFailed")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button type="button" size="sm">
        {{ resolvedTriggerLabel }}
      </Button>
    </DialogTrigger>

    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ resolvedTitle }}</DialogTitle>
        <DialogDescription>{{ resolvedDescription }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-5 text-sm text-muted-foreground" @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label for="upload-photo-date" class="text-foreground">{{ $t("pages.photos.form.fields.date") }}</label>
            <input
              id="upload-photo-date"
              v-model="dateInput"
              type="datetime-local"
              autocomplete="off"
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              :aria-invalid="dateError ? 'true' : 'false'"
              aria-describedby="upload-photo-date-hint upload-photo-date-feedback"
              required
            />
            <p id="upload-photo-date-hint" class="text-xs text-muted-foreground">{{ $t("pages.photos.form.hints.date") }}</p>
            <p v-if="dateError" id="upload-photo-date-feedback" class="text-sm text-destructive" role="alert">
              {{ dateError }}
            </p>
            <p v-else id="upload-photo-date-feedback" class="sr-only"> </p>
          </div>

          <div class="space-y-2">
            <label for="upload-photo-file" class="text-foreground">{{ $t("pages.photos.form.fields.file") }}</label>
            <input
              id="upload-photo-file"
              ref="fileInputEl"
              type="file"
              accept="image/*"
              class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring"
              :aria-invalid="fileError ? 'true' : 'false'"
              aria-describedby="upload-photo-file-hint upload-photo-file-feedback"
              @change="onFileChange"
              required
            />
            <p id="upload-photo-file-hint" class="text-xs text-muted-foreground">{{ $t("pages.photos.form.hints.file") }}</p>
            <p v-if="fileError" id="upload-photo-file-feedback" class="text-sm text-destructive" role="alert">
              {{ fileError }}
            </p>
            <p v-else id="upload-photo-file-feedback" class="sr-only"> </p>
          </div>
        </div>

        <div class="space-y-2">
          <label for="upload-photo-note" class="text-foreground">{{ $t("pages.photos.form.fields.note") }}</label>
          <input
            id="upload-photo-note"
            v-model="noteInput"
            type="text"
            autocomplete="off"
            class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            :placeholder="$t('pages.photos.form.placeholders.note')"
          />
        </div>

        <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
        <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

        <div class="flex flex-wrap gap-2">
          <Button type="submit" :disabled="isSubmitting">
            <span v-if="isSubmitting">{{ $t("pages.photos.form.saving") }}</span>
            <span v-else>{{ $t("pages.photos.form.save") }}</span>
          </Button>
          <Button variant="secondary" type="button" :disabled="isSubmitting" @click="isOpen = false">
            {{ $t("actions.cancel") }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

