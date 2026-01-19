<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next"

const { tanks, activeTankId, setActiveTankId } = useActiveTank()

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  setActiveTankId(target.value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="active-tank" class="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
      Active tank
    </label>

    <div class="relative w-full sm:w-auto">
      <select
        id="active-tank"
        class="h-9 w-full min-w-[12rem] appearance-none rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        :value="activeTankId"
        @change="onChange"
      >
        <option v-for="tank in tanks" :key="tank.id" :value="tank.id">
          {{ tank.name }}
        </option>
      </select>

      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
        <ChevronDown class="size-4" aria-hidden="true" />
      </span>
    </div>
  </div>
</template>

