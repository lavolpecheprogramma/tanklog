<script setup lang="ts">
import { Button } from "@/components/ui/button"
import {
  LIVESTOCK_CATEGORIES,
  LIVESTOCK_ORIGINS,
  LIVESTOCK_STATUSES,
  LIVESTOCK_TANK_ZONES,
  type LivestockCategory,
  type LivestockOrigin,
  type LivestockStatus,
  type LivestockTankZone,
} from "@/composables/useLivestock"

export type LivestockFormPayload = {
  nameCommon: string
  nameScientific: string | null
  category: LivestockCategory
  subCategory: string | null
  tankZone: LivestockTankZone | null
  origin: LivestockOrigin | null
  dateAdded: string
  dateRemoved: string | null
  status: LivestockStatus
  notes: string | null
}

type InitialValues = Partial<LivestockFormPayload>

const props = defineProps<{
  idBase: string
  submitLabel: string
  savingLabel: string
  submitHandler: (payload: LivestockFormPayload) => Promise<void>
  initialValues?: InitialValues
  successMessage?: string
  errorMessageFallback?: string
  resetAfterSubmit?: boolean
}>()

const emit = defineEmits<{
  (event: "success"): void
}>()

const { t } = useI18n()

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function todayDateOnly(): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const now = new Date()
  const year = now.getFullYear()
  const month = pad(now.getMonth() + 1)
  const day = pad(now.getDate())
  return `${year}-${month}-${day}`
}

const nameCommonInput = ref("")
const nameCommonError = ref<string | null>(null)

const nameScientificInput = ref("")

const categoryInput = ref<LivestockCategory | "">("")
const categoryError = ref<string | null>(null)

const subCategoryInput = ref("")

const tankZoneInput = ref<LivestockTankZone | "">("")

const originInput = ref<LivestockOrigin | "">("")

const dateAddedInput = ref("")
const dateAddedError = ref<string | null>(null)

const dateRemovedInput = ref("")
const dateRemovedError = ref<string | null>(null)

const statusInput = ref<LivestockStatus | "">("")
const statusError = ref<string | null>(null)

const notesInput = ref("")

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

const autoReset = computed(() => props.resetAfterSubmit !== false)

watch(
  () => props.initialValues,
  (values) => {
    if (!values) return
    if (values.nameCommon !== undefined) nameCommonInput.value = values.nameCommon ?? ""
    if (values.nameScientific !== undefined) nameScientificInput.value = values.nameScientific ?? ""
    if (values.category !== undefined) categoryInput.value = values.category ?? ""
    if (values.subCategory !== undefined) subCategoryInput.value = values.subCategory ?? ""
    if (values.tankZone !== undefined) tankZoneInput.value = values.tankZone ?? ""
    if (values.origin !== undefined) originInput.value = values.origin ?? ""
    if (values.dateAdded !== undefined) dateAddedInput.value = values.dateAdded ?? ""
    if (values.dateRemoved !== undefined) dateRemovedInput.value = values.dateRemoved ?? ""
    if (values.status !== undefined) statusInput.value = values.status ?? ""
    if (values.notes !== undefined) notesInput.value = values.notes ?? ""
  },
  { immediate: true }
)

onMounted(() => {
  if (!dateAddedInput.value) dateAddedInput.value = todayDateOnly()
  if (!categoryInput.value) categoryInput.value = "fish"
  if (!statusInput.value) statusInput.value = "active"
})

watch(statusInput, (value) => {
  if (value === "active") {
    dateRemovedInput.value = ""
    return
  }
  if ((value === "removed" || value === "dead") && !dateRemovedInput.value.trim()) {
    dateRemovedInput.value = todayDateOnly()
  }
})

function resetFormErrors() {
  nameCommonError.value = null
  categoryError.value = null
  dateAddedError.value = null
  dateRemovedError.value = null
  statusError.value = null
  submitError.value = null
  submitStatus.value = null
}

function resetAfterSuccess() {
  nameCommonInput.value = ""
  nameScientificInput.value = ""
  categoryInput.value = "fish"
  subCategoryInput.value = ""
  tankZoneInput.value = ""
  originInput.value = ""
  dateAddedInput.value = todayDateOnly()
  dateRemovedInput.value = ""
  statusInput.value = "active"
  notesInput.value = ""
}

function validate(): LivestockFormPayload | null {
  resetFormErrors()

  const nameCommon = nameCommonInput.value.trim()
  if (!nameCommon) {
    nameCommonError.value = t("pages.livestock.form.errors.missingNameCommon")
    return null
  }

  const category = categoryInput.value
  if (!category) {
    categoryError.value = t("pages.livestock.form.errors.missingCategory")
    return null
  }
  if (!LIVESTOCK_CATEGORIES.includes(category)) {
    categoryError.value = t("pages.livestock.form.errors.invalidCategory")
    return null
  }

  const dateAdded = dateAddedInput.value.trim()
  if (!dateAdded) {
    dateAddedError.value = t("pages.livestock.form.errors.missingDateAdded")
    return null
  }
  if (!isDateOnly(dateAdded)) {
    dateAddedError.value = t("pages.livestock.form.errors.invalidDateAdded")
    return null
  }

  const status = statusInput.value
  if (!status) {
    statusError.value = t("pages.livestock.form.errors.missingStatus")
    return null
  }
  if (!LIVESTOCK_STATUSES.includes(status)) {
    statusError.value = t("pages.livestock.form.errors.invalidStatus")
    return null
  }

  const dateRemovedRaw = dateRemovedInput.value.trim()
  const dateRemoved = dateRemovedRaw ? dateRemovedRaw : null
  if (dateRemoved && !isDateOnly(dateRemoved)) {
    dateRemovedError.value = t("pages.livestock.form.errors.invalidDateRemoved")
    return null
  }

  if (status === "active" && dateRemoved) {
    dateRemovedError.value = t("pages.livestock.form.errors.dateRemovedMustBeEmptyForActive")
    return null
  }
  if ((status === "removed" || status === "dead") && !dateRemoved) {
    dateRemovedError.value = t("pages.livestock.form.errors.dateRemovedRequiredForInactive")
    return null
  }

  const tankZoneRaw = tankZoneInput.value
  const tankZone = tankZoneRaw ? tankZoneRaw : null
  if (tankZone !== null && !LIVESTOCK_TANK_ZONES.includes(tankZone)) {
    return null
  }

  const originRaw = originInput.value
  const origin = originRaw ? originRaw : null
  if (origin !== null && !LIVESTOCK_ORIGINS.includes(origin)) {
    return null
  }

  return {
    nameCommon,
    nameScientific: normalizeOptionalText(nameScientificInput.value) ?? null,
    category,
    subCategory: normalizeOptionalText(subCategoryInput.value) ?? null,
    tankZone,
    origin,
    dateAdded,
    dateRemoved,
    status,
    notes: normalizeOptionalText(notesInput.value) ?? null,
  }
}

async function onSubmit() {
  if (isSubmitting.value) return
  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    await props.submitHandler(validated)
    submitStatus.value = props.successMessage ?? t("pages.livestock.form.success.saved")
    emit("success")
    if (autoReset.value) resetAfterSuccess()
  } catch (error) {
    const fallback = props.errorMessageFallback ?? t("pages.livestock.form.errors.saveFailed")
    submitError.value = error instanceof Error ? error.message : fallback
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label :for="`${idBase}-name-common`" class="text-foreground">{{ $t("pages.livestock.form.fields.nameCommon") }}</label>
        <input
          :id="`${idBase}-name-common`"
          v-model="nameCommonInput"
          type="text"
          autocomplete="off"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="$t('pages.livestock.form.placeholders.nameCommon')"
          :aria-invalid="nameCommonError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-name-common-feedback`"
          required
        />
        <p v-if="nameCommonError" :id="`${idBase}-name-common-feedback`" class="text-sm text-destructive" role="alert">
          {{ nameCommonError }}
        </p>
        <p v-else :id="`${idBase}-name-common-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-name-scientific`" class="text-foreground">{{ $t("pages.livestock.form.fields.nameScientific") }}</label>
        <input
          :id="`${idBase}-name-scientific`"
          v-model="nameScientificInput"
          type="text"
          autocomplete="off"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="$t('pages.livestock.form.placeholders.nameScientific')"
        />
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-category`" class="text-foreground">{{ $t("pages.livestock.form.fields.category") }}</label>
        <select
          :id="`${idBase}-category`"
          v-model="categoryInput"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-invalid="categoryError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-category-feedback`"
          required
        >
          <option value="">{{ $t("pages.livestock.form.placeholders.category") }}</option>
          <option v-for="category in LIVESTOCK_CATEGORIES" :key="category" :value="category">
            {{ $t(`pages.livestock.options.category.${category}`) }}
          </option>
        </select>
        <p v-if="categoryError" :id="`${idBase}-category-feedback`" class="text-sm text-destructive" role="alert">
          {{ categoryError }}
        </p>
        <p v-else :id="`${idBase}-category-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-sub-category`" class="text-foreground">{{ $t("pages.livestock.form.fields.subCategory") }}</label>
        <input
          :id="`${idBase}-sub-category`"
          v-model="subCategoryInput"
          type="text"
          autocomplete="off"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="$t('pages.livestock.form.placeholders.subCategory')"
        />
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-status`" class="text-foreground">{{ $t("pages.livestock.form.fields.status") }}</label>
        <select
          :id="`${idBase}-status`"
          v-model="statusInput"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-invalid="statusError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-status-feedback`"
          required
        >
          <option value="">{{ $t("pages.livestock.form.placeholders.status") }}</option>
          <option v-for="status in LIVESTOCK_STATUSES" :key="status" :value="status">
            {{ $t(`pages.livestock.options.status.${status}`) }}
          </option>
        </select>
        <p v-if="statusError" :id="`${idBase}-status-feedback`" class="text-sm text-destructive" role="alert">
          {{ statusError }}
        </p>
        <p v-else :id="`${idBase}-status-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-origin`" class="text-foreground">{{ $t("pages.livestock.form.fields.origin") }}</label>
        <select
          :id="`${idBase}-origin`"
          v-model="originInput"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{{ $t("pages.livestock.form.placeholders.origin") }}</option>
          <option v-for="origin in LIVESTOCK_ORIGINS" :key="origin" :value="origin">
            {{ $t(`pages.livestock.options.origin.${origin}`) }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-tank-zone`" class="text-foreground">{{ $t("pages.livestock.form.fields.tankZone") }}</label>
        <select
          :id="`${idBase}-tank-zone`"
          v-model="tankZoneInput"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{{ $t("pages.livestock.form.placeholders.tankZone") }}</option>
          <option v-for="zone in LIVESTOCK_TANK_ZONES" :key="zone" :value="zone">
            {{ $t(`pages.livestock.options.tankZone.${zone}`) }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-date-added`" class="text-foreground">{{ $t("pages.livestock.form.fields.dateAdded") }}</label>
        <input
          :id="`${idBase}-date-added`"
          v-model="dateAddedInput"
          type="date"
          autocomplete="off"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-invalid="dateAddedError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-date-added-feedback`"
          required
        />
        <p v-if="dateAddedError" :id="`${idBase}-date-added-feedback`" class="text-sm text-destructive" role="alert">
          {{ dateAddedError }}
        </p>
        <p v-else :id="`${idBase}-date-added-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-date-removed`" class="text-foreground">{{ $t("pages.livestock.form.fields.dateRemoved") }}</label>
        <input
          :id="`${idBase}-date-removed`"
          v-model="dateRemovedInput"
          type="date"
          autocomplete="off"
          class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-invalid="dateRemovedError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-date-removed-feedback`"
        />
        <p v-if="dateRemovedError" :id="`${idBase}-date-removed-feedback`" class="text-sm text-destructive" role="alert">
          {{ dateRemovedError }}
        </p>
        <p v-else :id="`${idBase}-date-removed-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label :for="`${idBase}-notes`" class="text-foreground">{{ $t("pages.livestock.form.fields.notes") }}</label>
        <textarea
          :id="`${idBase}-notes`"
          v-model="notesInput"
          rows="4"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="$t('pages.livestock.form.placeholders.notes')"
        />
      </div>
    </div>

    <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
    <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
      <Button type="submit" :disabled="isSubmitting">
        <span v-if="isSubmitting">{{ savingLabel }}</span>
        <span v-else>{{ submitLabel }}</span>
      </Button>
    </div>
  </form>
</template>

