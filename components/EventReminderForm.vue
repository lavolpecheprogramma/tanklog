<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { TANK_EVENT_TYPES, type EventType } from "@/composables/useEvents"
import { toDatetimeLocalValue } from "@/lib/datetime"

type Mode = "event" | "reminder"

type BaseFields = {
  eventType: EventType
  description: string
  quantity: number | null
  unit: string | null
  product: string | null
  note: string | null
}

type EventSubmitPayload = BaseFields & { date: Date }
type ReminderSubmitPayload = BaseFields & { nextDue: string; endDue: string | null; repeatEveryDays: number | null }

type InitialValues = Partial<
  {
    date: string | Date
    nextDue: string | Date
    endDue: string | Date | null
    repeatEveryDays: number | null
  } & {
    eventType: EventType | null
    description: string
    quantity: number | null
    unit: string | null
    product: string | null
    note: string | null
  }
>

const props = defineProps<{
  idBase: string
  mode: Mode
  submitLabel: string
  savingLabel: string
  submitHandler: (payload: EventSubmitPayload | ReminderSubmitPayload) => Promise<void>
  initialValues?: InitialValues
  successMessage?: string
  errorMessageFallback?: string
  resetAfterSubmit?: boolean
  eventTypes?: readonly EventType[]
  showQuantityUnitProductFields?: boolean
}>()

const emit = defineEmits<{
  (event: "success"): void
}>()

const { t } = useI18n()

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toDateOnlyValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

function parseNumberInput(value: string | number): number | null {
  if (typeof value === "number") return value
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.toString().trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed <= 0) return null
  return parsed
}

const dateInput = ref("")
const dateError = ref<string | null>(null)

const nextDueInput = ref("")
const nextDueError = ref<string | null>(null)

const endDueInput = ref("")
const endDueError = ref<string | null>(null)

const repeatEveryDaysInput = ref("")
const repeatEveryDaysError = ref<string | null>(null)

const eventTypeInput = ref<EventType | "">("")
const eventTypeError = ref<string | null>(null)

const descriptionInput = ref("")
const descriptionError = ref<string | null>(null)

const quantityInput = ref("")
const quantityError = ref<string | null>(null)

const unitInput = ref("")
const productInput = ref("")
const noteInput = ref("")

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitStatus = ref<string | null>(null)

const autoReset = computed(() => props.resetAfterSubmit !== false)
const availableEventTypes = computed<readonly EventType[]>(() => (props.eventTypes?.length ? props.eventTypes : TANK_EVENT_TYPES))
const showQuantityUnitProductFields = computed(() => props.showQuantityUnitProductFields !== false)

watch(availableEventTypes, (types) => {
  const current = eventTypeInput.value
  if (!current) return
  if (!types.includes(current as EventType)) {
    eventTypeInput.value = ""
  }
})

watch(showQuantityUnitProductFields, (enabled) => {
  if (enabled) return
  quantityInput.value = ""
  unitInput.value = ""
  productInput.value = ""
  quantityError.value = null
})

watch(
  () => props.initialValues,
  (values) => {
    if (!values) return

    if (values.eventType !== undefined) {
      eventTypeInput.value = values.eventType ?? ""
    }
    if (values.description !== undefined) descriptionInput.value = values.description ?? ""
    if (values.quantity !== undefined) quantityInput.value = values.quantity === null ? "" : String(values.quantity)
    if (values.unit !== undefined) unitInput.value = values.unit ?? ""
    if (values.product !== undefined) productInput.value = values.product ?? ""
    if (values.note !== undefined) noteInput.value = values.note ?? ""

    if (props.mode === "event" && values.date !== undefined) {
      const date = values.date instanceof Date ? values.date : new Date(values.date)
      dateInput.value = Number.isNaN(date.getTime()) ? "" : toDatetimeLocalValue(date)
    }

    if (props.mode === "reminder") {
      if (values.nextDue !== undefined) {
        const date = values.nextDue instanceof Date ? values.nextDue : new Date(values.nextDue)
        nextDueInput.value = Number.isNaN(date.getTime()) ? "" : toDatetimeLocalValue(date)
      }
      if (values.endDue !== undefined) {
        const value = values.endDue
        if (!value) {
          endDueInput.value = ""
        } else if (value instanceof Date) {
          endDueInput.value = Number.isNaN(value.getTime()) ? "" : toDateOnlyValue(value)
        } else {
          const trimmed = value.trim()
          if (!trimmed) {
            endDueInput.value = ""
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            endDueInput.value = trimmed
          } else {
            const date = new Date(trimmed)
            endDueInput.value = Number.isNaN(date.getTime()) ? "" : toDateOnlyValue(date)
          }
        }
      }
      if (values.repeatEveryDays !== undefined) {
        repeatEveryDaysInput.value = values.repeatEveryDays === null ? "" : String(values.repeatEveryDays)
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (props.mode === "event" && !dateInput.value) {
    dateInput.value = toDatetimeLocalValue(new Date())
  }
  if (props.mode === "reminder" && !nextDueInput.value) {
    nextDueInput.value = toDatetimeLocalValue(new Date())
  }
})

watch(eventTypeInput, (value) => {
  if (!showQuantityUnitProductFields.value) return
  if (value === "water_change" && !unitInput.value.trim()) unitInput.value = "L"
  if (value === "dosing" && !unitInput.value.trim()) unitInput.value = "ml"
})

function resetFormErrors() {
  dateError.value = null
  nextDueError.value = null
  endDueError.value = null
  repeatEveryDaysError.value = null
  eventTypeError.value = null
  descriptionError.value = null
  quantityError.value = null
  submitError.value = null
  submitStatus.value = null
}

function validate(): EventSubmitPayload | ReminderSubmitPayload | null {
  resetFormErrors()

  if (props.mode === "event") {
    if (!dateInput.value) {
      dateError.value = t("pages.events.form.errors.missingDate")
      return null
    }

    const date = new Date(dateInput.value)
    if (Number.isNaN(date.getTime())) {
      dateError.value = t("pages.events.form.errors.invalidDate")
      return null
    }

    const eventType = eventTypeInput.value
    if (!eventType) {
      eventTypeError.value = t("pages.events.form.errors.missingType")
      return null
    }
    if (!availableEventTypes.value.includes(eventType as EventType)) {
      eventTypeError.value = t("pages.events.form.errors.missingType")
      return null
    }

    const description = descriptionInput.value.trim()
    if (!description) {
      descriptionError.value = t("pages.events.form.errors.missingDescription")
      return null
    }

    const quantity = showQuantityUnitProductFields.value ? parseNumberInput(quantityInput.value) : null
    if (showQuantityUnitProductFields.value) {
      if (quantity !== null && quantity < 0) {
        quantityError.value = t("pages.events.form.errors.invalidQuantity")
        return null
      }
    }

    return {
      date,
      eventType,
      description,
      quantity,
      unit: showQuantityUnitProductFields.value ? normalizeOptionalText(unitInput.value) : null,
      product: showQuantityUnitProductFields.value ? normalizeOptionalText(productInput.value) : null,
      note: normalizeOptionalText(noteInput.value),
    }
  }

  if (!nextDueInput.value) {
    nextDueError.value = t("pages.reminders.form.errors.missingNextDue")
    return null
  }

  const dueDate = new Date(nextDueInput.value)
  if (Number.isNaN(dueDate.getTime())) {
    nextDueError.value = t("pages.reminders.form.errors.invalidNextDue")
    return null
  }

  const endRaw = endDueInput.value.trim()
  if (endRaw) {
    const parsed = parseDateOnly(endRaw)
    if (!parsed) {
      endDueError.value = t("pages.reminders.form.errors.invalidEndDue")
      return null
    }
    const endDate = new Date(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999)
    if (Number.isNaN(endDate.getTime())) {
      endDueError.value = t("pages.reminders.form.errors.invalidEndDue")
      return null
    }
    if (endDate.getTime() < dueDate.getTime()) {
      endDueError.value = t("pages.reminders.form.errors.endDueBeforeNextDue")
      return null
    }
  }

  const repeatRaw = String(repeatEveryDaysInput.value ?? "").trim()
  const repeatEveryDays = repeatRaw ? parsePositiveInteger(repeatRaw) : null
  if (repeatRaw && repeatEveryDays === null) {
    repeatEveryDaysError.value = t("pages.reminders.form.errors.invalidRepeatEveryDays")
    return null
  }

  const eventType = eventTypeInput.value
  if (!eventType) {
    eventTypeError.value = t("pages.events.form.errors.missingType")
    return null
  }
  if (!availableEventTypes.value.includes(eventType as EventType)) {
    eventTypeError.value = t("pages.events.form.errors.missingType")
    return null
  }

  const description = descriptionInput.value.trim()
  if (!description) {
    descriptionError.value = t("pages.events.form.errors.missingDescription")
    return null
  }

  const quantity = showQuantityUnitProductFields.value ? parseNumberInput(quantityInput.value) : null
  if (showQuantityUnitProductFields.value) {
    if (quantity !== null && quantity < 0) {
      quantityError.value = t("pages.events.form.errors.invalidQuantity")
      return null
    }
  }

  return {
    nextDue: dueDate.toISOString(),
    endDue: endRaw ? endRaw : null,
    repeatEveryDays,
    eventType,
    description,
    quantity,
    unit: showQuantityUnitProductFields.value ? normalizeOptionalText(unitInput.value) : null,
    product: showQuantityUnitProductFields.value ? normalizeOptionalText(productInput.value) : null,
    note: normalizeOptionalText(noteInput.value),
  }
}

function resetAfterSuccess() {
  eventTypeInput.value = ""
  descriptionInput.value = ""
  quantityInput.value = ""
  unitInput.value = ""
  productInput.value = ""
  noteInput.value = ""

  if (props.mode === "reminder") {
    repeatEveryDaysInput.value = ""
    endDueInput.value = ""
  }
}

async function onSubmit() {
  submitError.value = null
  submitStatus.value = null

  const validated = validate()
  if (!validated) return

  isSubmitting.value = true
  try {
    await props.submitHandler(validated)
    submitStatus.value = props.successMessage ?? (props.mode === "event" ? t("pages.events.form.success.saved") : t("pages.reminders.form.success.saved"))
    emit("success")
    if (autoReset.value) resetAfterSuccess()
  } catch (error) {
    const fallback = props.errorMessageFallback ?? (props.mode === "event" ? t("pages.events.form.errors.saveFailed") : t("pages.reminders.form.errors.saveFailed"))
    submitError.value = error instanceof Error ? error.message : fallback
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <div v-if="mode === 'event'" class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label :for="`${idBase}-date`" class="text-foreground">{{ $t("pages.events.form.fields.date") }}</label>
        <Input
          :id="`${idBase}-date`"
          v-model="dateInput"
          type="datetime-local"
          autocomplete="off"
          :aria-invalid="dateError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-date-hint ${idBase}-date-feedback`"
          required
        />
        <p :id="`${idBase}-date-hint`" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.date") }}</p>
        <p v-if="dateError" :id="`${idBase}-date-feedback`" class="text-sm text-destructive" role="alert">
          {{ dateError }}
        </p>
        <p v-else :id="`${idBase}-date-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-type`" class="text-foreground">{{ $t("pages.events.form.fields.type") }}</label>
        <Select
          :id="`${idBase}-type`"
          v-model="eventTypeInput"
          :aria-invalid="eventTypeError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-type-hint ${idBase}-type-feedback`"
          required
        >
          <option value="">{{ $t("pages.events.form.placeholders.type") }}</option>
          <option v-for="type in availableEventTypes" :key="type" :value="type">
            {{ $t(`pages.events.types.${type}`) }}
          </option>
        </Select>
        <p :id="`${idBase}-type-hint`" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.type") }}</p>
        <p v-if="eventTypeError" :id="`${idBase}-type-feedback`" class="text-sm text-destructive" role="alert">
          {{ eventTypeError }}
        </p>
        <p v-else :id="`${idBase}-type-feedback`" class="sr-only"> </p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label :for="`${idBase}-next-due`" class="text-foreground">{{ $t("pages.reminders.form.fields.nextDue") }}</label>
        <Input
          :id="`${idBase}-next-due`"
          v-model="nextDueInput"
          type="datetime-local"
          autocomplete="off"
          :aria-invalid="nextDueError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-next-due-hint ${idBase}-next-due-feedback`"
          required
        />
        <p :id="`${idBase}-next-due-hint`" class="text-xs text-muted-foreground">{{ $t("pages.reminders.form.hints.nextDue") }}</p>
        <p v-if="nextDueError" :id="`${idBase}-next-due-feedback`" class="text-sm text-destructive" role="alert">
          {{ nextDueError }}
        </p>
        <p v-else :id="`${idBase}-next-due-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-repeat`" class="text-foreground">{{ $t("pages.reminders.form.fields.repeatEveryDays") }}</label>
        <Input
          :id="`${idBase}-repeat`"
          v-model.trim="repeatEveryDaysInput"
          type="number"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('pages.reminders.form.placeholders.repeatEveryDays')"
          :aria-invalid="repeatEveryDaysError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-repeat-hint ${idBase}-repeat-feedback`"
        />
        <p :id="`${idBase}-repeat-hint`" class="text-xs text-muted-foreground">{{ $t("pages.reminders.form.hints.repeatEveryDays") }}</p>
        <p v-if="repeatEveryDaysError" :id="`${idBase}-repeat-feedback`" class="text-sm text-destructive" role="alert">
          {{ repeatEveryDaysError }}
        </p>
        <p v-else :id="`${idBase}-repeat-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-end-due`" class="text-foreground">{{ $t("pages.reminders.form.fields.endDue") }}</label>
        <Input
          :id="`${idBase}-end-due`"
          v-model="endDueInput"
          type="date"
          autocomplete="off"
          :aria-invalid="endDueError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-end-due-hint ${idBase}-end-due-feedback`"
        />
        <p :id="`${idBase}-end-due-hint`" class="text-xs text-muted-foreground">{{ $t("pages.reminders.form.hints.endDue") }}</p>
        <p v-if="endDueError" :id="`${idBase}-end-due-feedback`" class="text-sm text-destructive" role="alert">
          {{ endDueError }}
        </p>
        <p v-else :id="`${idBase}-end-due-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-type`" class="text-foreground">{{ $t("pages.events.form.fields.type") }}</label>
        <Select
          :id="`${idBase}-type`"
          v-model="eventTypeInput"
          :aria-invalid="eventTypeError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-type-hint ${idBase}-type-feedback`"
          required
        >
          <option value="">{{ $t("pages.events.form.placeholders.type") }}</option>
          <option v-for="type in availableEventTypes" :key="type" :value="type">
            {{ $t(`pages.events.types.${type}`) }}
          </option>
        </Select>
        <p :id="`${idBase}-type-hint`" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.type") }}</p>
        <p v-if="eventTypeError" :id="`${idBase}-type-feedback`" class="text-sm text-destructive" role="alert">
          {{ eventTypeError }}
        </p>
        <p v-else :id="`${idBase}-type-feedback`" class="sr-only"> </p>
      </div>
    </div>

    <div class="space-y-2">
      <label :for="`${idBase}-description`" class="text-foreground">{{ $t("pages.events.form.fields.description") }}</label>
      <Input
        :id="`${idBase}-description`"
        v-model.trim="descriptionInput"
        type="text"
        autocomplete="off"
        :placeholder="$t('pages.events.form.placeholders.description')"
        :aria-invalid="descriptionError ? 'true' : 'false'"
        :aria-describedby="`${idBase}-description-hint ${idBase}-description-feedback`"
        required
      />
      <p :id="`${idBase}-description-hint`" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.description") }}</p>
      <p v-if="descriptionError" :id="`${idBase}-description-feedback`" class="text-sm text-destructive" role="alert">
        {{ descriptionError }}
      </p>
      <p v-else :id="`${idBase}-description-feedback`" class="sr-only"> </p>
    </div>

    <div v-if="showQuantityUnitProductFields" class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label :for="`${idBase}-quantity`" class="text-foreground">{{ $t("pages.events.form.fields.quantity") }}</label>
        <Input
          :id="`${idBase}-quantity`"
          v-model.trim="quantityInput"
          type="number"
          inputmode="decimal"
          autocomplete="off"
          :placeholder="$t('pages.events.form.placeholders.quantity')"
          :aria-invalid="quantityError ? 'true' : 'false'"
          :aria-describedby="`${idBase}-quantity-hint ${idBase}-quantity-feedback`"
        />
        <p :id="`${idBase}-quantity-hint`" class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.quantity") }}</p>
        <p v-if="quantityError" :id="`${idBase}-quantity-feedback`" class="text-sm text-destructive" role="alert">
          {{ quantityError }}
        </p>
        <p v-else :id="`${idBase}-quantity-feedback`" class="sr-only"> </p>
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-unit`" class="text-foreground">{{ $t("pages.events.form.fields.unit") }}</label>
        <Input
          :id="`${idBase}-unit`"
          v-model.trim="unitInput"
          type="text"
          autocomplete="off"
          :placeholder="$t('pages.events.form.placeholders.unit')"
        />
        <p class="text-xs text-muted-foreground">{{ $t("pages.events.form.hints.unit") }}</p>
      </div>
    </div>

    <div v-if="showQuantityUnitProductFields" class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label :for="`${idBase}-product`" class="text-foreground">{{ $t("pages.events.form.fields.product") }}</label>
        <Input
          :id="`${idBase}-product`"
          v-model.trim="productInput"
          type="text"
          autocomplete="off"
          :placeholder="$t('pages.events.form.placeholders.product')"
        />
      </div>

      <div class="space-y-2">
        <label :for="`${idBase}-note`" class="text-foreground">{{ $t("pages.events.form.fields.note") }}</label>
        <Input
          :id="`${idBase}-note`"
          v-model.trim="noteInput"
          type="text"
          autocomplete="off"
          :placeholder="$t('pages.events.form.placeholders.note')"
        />
      </div>
    </div>

    <div v-else class="space-y-2">
      <label :for="`${idBase}-note`" class="text-foreground">{{ $t("pages.events.form.fields.note") }}</label>
      <Input
        :id="`${idBase}-note`"
        v-model.trim="noteInput"
        type="text"
        autocomplete="off"
        :placeholder="$t('pages.events.form.placeholders.note')"
      />
    </div>

    <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
    <p v-else-if="submitStatus" class="text-sm text-foreground" role="status">{{ submitStatus }}</p>

    <div class="flex flex-wrap gap-2">
      <Button type="submit" :disabled="isSubmitting">
        <span v-if="isSubmitting">{{ savingLabel }}</span>
        <span v-else>{{ submitLabel }}</span>
      </Button>
      <slot name="actions" />
    </div>
  </form>
</template>

