<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useAttrs } from "vue"
import { cn } from "@/lib/utils"

interface Props {
  modelValue?: string | number | null
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const attrs = useAttrs()

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  emit("update:modelValue", target.value)
}
</script>

<template>
  <select
    v-bind="attrs"
    :value="props.modelValue ?? ''"
    :class="
      cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
    @change="onChange"
  >
    <slot />
  </select>
</template>

