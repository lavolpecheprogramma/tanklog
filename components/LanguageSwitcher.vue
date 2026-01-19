<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next"

const { locale, setLocale } = useI18n()

const options = [
  { code: "it", labelKey: "language.options.it" },
  { code: "en", labelKey: "language.options.en" },
] as const

type LocaleCode = (typeof options)[number]["code"]

function isLocaleCode(value: string): value is LocaleCode {
  return options.some((option) => option.code === value)
}

async function onChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  if (!isLocaleCode(target.value)) return
  if (target.value === locale.value) return
  await setLocale(target.value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="language" class="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
      {{ $t("language.label") }}
    </label>

    <div class="relative w-full sm:w-auto">
      <select
        id="language"
        class="h-9 w-full min-w-[9rem] appearance-none rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        :value="locale"
        @change="onChange"
      >
        <option v-for="option in options" :key="option.code" :value="option.code">
          {{ $t(option.labelKey) }}
        </option>
      </select>

      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
        <ChevronDown class="size-4" aria-hidden="true" />
      </span>
    </div>
  </div>
</template>

