<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-vue-next"

const { t } = useI18n()
const theme = useTheme()

const ariaLabel = computed(() => (theme.isDark.value ? t("a11y.switchToLightMode") : t("a11y.switchToDarkMode")))
</script>

<template>
  <Button type="button" variant="secondary" size="icon-sm" :aria-label="ariaLabel" @click="theme.toggle">
    <Sun v-if="theme.isDark" class="size-4" aria-hidden="true" />
    <Moon v-else class="size-4" aria-hidden="true" />
  </Button>
</template>

