<script setup lang="ts">
import { Select } from "@/components/ui/select"
import { ChevronDown } from "lucide-vue-next"

const { tanks, activeTankId, setActiveTankId } = useActiveTank()
const { status, error } = useTanks()

const isDisabled = computed(() => status.value === "loading" || !tanks.value.length || Boolean(error.value))
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="active-tank" class="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
      {{ $t("tank.activeLabel") }}
    </label>

    <div class="relative w-full sm:w-auto">
      <Select
        id="active-tank"
        class="min-w-[12rem] appearance-none pr-9"
        :model-value="activeTankId"
        :disabled="isDisabled"
        @update:model-value="setActiveTankId"
      >
        <option v-if="status === 'loading'" value="">
          {{ $t("tank.selector.loading") }}
        </option>
        <option v-else-if="error" value="">
          {{ $t("tank.selector.error") }}
        </option>
        <option v-else-if="!tanks.length" value="">
          {{ $t("tank.selector.empty") }}
        </option>
        <option v-else v-for="tank in tanks" :key="tank.id" :value="tank.id">
          {{ tank.name }}
        </option>
      </Select>

      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
        <ChevronDown class="size-4" aria-hidden="true" />
      </span>
    </div>
  </div>
</template>

