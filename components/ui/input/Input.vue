<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useAttrs } from "vue"
import { cn } from "@/lib/utils"

type ModelModifiers = {
  trim?: boolean
  number?: boolean
}

interface Props {
  modelValue?: string | number | null
  modelModifiers?: ModelModifiers
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void
}>()

const attrs = useAttrs()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return

  let value = target.value

  if (props.modelModifiers?.trim) value = value.trim()

  if (props.modelModifiers?.number) {
    const parsed = Number(value)
    emit("update:modelValue", Number.isNaN(parsed) ? value : parsed)
    return
  }

  emit("update:modelValue", value)
}
</script>

<template>
  <input
    v-bind="attrs"
    :value="props.modelValue ?? ''"
    :class="
      cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
    @input="onInput"
  />
</template>

