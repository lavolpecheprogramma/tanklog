<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useAttrs } from "vue"
import { cn } from "@/lib/utils"

type ModelModifiers = {
  trim?: boolean
}

interface Props {
  modelValue?: string | null
  modelModifiers?: ModelModifiers
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const attrs = useAttrs()

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement | null
  if (!target) return

  let value = target.value
  if (props.modelModifiers?.trim) value = value.trim()
  emit("update:modelValue", value)
}
</script>

<template>
  <textarea
    v-bind="attrs"
    :value="props.modelValue ?? ''"
    :class="
      cn(
        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
    @input="onInput"
  />
</template>

