<script setup lang="ts">
type AlertVariant = "info" | "warning"

const props = withDefaults(
  defineProps<{
    title: string
    variant?: AlertVariant
  }>(),
  {
    variant: "info",
  }
)

const containerClass = computed(() => {
  if (props.variant === "warning") {
    return "border-destructive/40 bg-destructive/10 text-foreground"
  }

  return "border-border bg-muted/30 text-foreground"
})

const titleClass = computed(() => {
  if (props.variant === "warning") return "text-destructive"
  return "text-foreground"
})
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="rounded-md border px-4 py-3"
    :class="containerClass"
  >
    <p class="text-sm font-medium" :class="titleClass">{{ title }}</p>
    <div v-if="$slots.default" class="mt-1 text-sm">
      <slot />
    </div>
  </div>
</template>

