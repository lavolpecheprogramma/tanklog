<script setup lang="ts">
import { Select } from "@/components/ui/select"
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

async function onUpdateLocale(value: string) {
  if (!isLocaleCode(value)) return
  if (value === locale.value) return
  await setLocale(value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="language" class="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
      {{ $t("language.label") }}
    </label>

    <div class="relative w-full sm:w-auto">
      <Select
        id="language"
        class="min-w-[9rem] appearance-none pr-9"
        :model-value="locale"
        @update:model-value="onUpdateLocale"
      >
        <option v-for="option in options" :key="option.code" :value="option.code">
          {{ $t(option.labelKey) }}
        </option>
      </Select>

      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
        <ChevronDown class="size-4" aria-hidden="true" />
      </span>
    </div>
  </div>
</template>

