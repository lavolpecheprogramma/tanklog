<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { TankEvent } from "@/composables/useEvents"
import { cn } from "@/lib/utils"

type Variant = "muted" | "solid"

const props = withDefaults(
  defineProps<{
    event: TankEvent
    variant?: Variant
    showTarget?: boolean
    targetLabel?: string | null
    showQuantity?: boolean
    showProductAndNote?: boolean
    formatDate?: (value: string) => string
    class?: HTMLAttributes["class"]
  }>(),
  {
    variant: "muted",
    showTarget: false,
    targetLabel: null,
    showQuantity: false,
    showProductAndNote: false,
    formatDate: undefined,
    class: undefined,
  }
)

const { t, locale } = useI18n()

function defaultFormatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    return new Intl.DateTimeFormat(locale.value, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

const dateText = computed(() => (props.formatDate ? props.formatDate(props.event.date) : defaultFormatDate(props.event.date)))

const typeText = computed(() => {
  const key = `pages.events.types.${props.event.eventType}`
  const translated = t(key)
  return translated === key ? props.event.eventType : translated
})

function formatQuantity(value: number): string {
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
  } catch {
    return String(value)
  }
}

const hasQuantity = computed(() => props.event.quantity !== null && props.event.quantity !== undefined && Number.isFinite(props.event.quantity))
const quantityText = computed(() => (hasQuantity.value ? formatQuantity(props.event.quantity as number) : ""))

const containerClass = computed(() =>
  cn(
    props.variant === "solid"
      ? "overflow-hidden rounded-md border border-border bg-background shadow-sm p-3"
      : "rounded-md border border-border bg-muted/20 px-3 py-2",
    props.class
  )
)
</script>

<template>
  <div :class="containerClass">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div v-if="variant === 'solid'" class="min-w-0 space-y-1">
        <div class="text-sm font-medium text-foreground">
          {{ typeText }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ dateText }}
          <template v-if="showTarget && targetLabel">
            <span class="px-1">·</span>
            {{ targetLabel }}
          </template>
        </div>
      </div>

      <template v-else>
        <span class="text-xs text-muted-foreground">{{ typeText }}</span>
        <span class="text-xs text-muted-foreground">
          {{ dateText }}
          <template v-if="showTarget && targetLabel">
            <span class="px-1">·</span>
            {{ targetLabel }}
          </template>
        </span>
      </template>

      <div v-if="(showQuantity && hasQuantity) || $slots.actions" class="flex flex-wrap items-center gap-2">
        <div v-if="showQuantity && hasQuantity" class="text-right text-sm text-foreground">
          {{ quantityText }}
          <span v-if="event.unit" class="text-muted-foreground">{{ event.unit }}</span>
        </div>
        <slot name="actions" />
      </div>
    </div>

    <p class="mt-2 text-sm text-foreground">
      {{ event.description }}
    </p>

    <slot name="details" />

    <p v-if="showProductAndNote && (event.product || event.note)" class="mt-1 text-xs text-muted-foreground">
      <span v-if="event.product">{{ $t("pages.events.list.labels.product") }}: {{ event.product }}</span>
      <span v-if="event.product && event.note"> · </span>
      <span v-if="event.note">{{ $t("pages.events.list.labels.note") }}: {{ event.note }}</span>
    </p>
  </div>
</template>

