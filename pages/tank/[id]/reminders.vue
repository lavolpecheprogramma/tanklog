<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "tank",
})

const { t, tm } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.reminders.metaTitle"),
}))

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const plannedBullets = computed(() => {
  const value = tm("pages.reminders.plannedBullets")
  return Array.isArray(value) ? value : []
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.reminders.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.reminders.description") }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.reminders.comingTitle") }}</CardTitle>
        <CardDescription>{{ $t("pages.reminders.comingDescription") }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.reminders.plannedLabel") }}
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="item in plannedBullets" :key="item">
            {{ item }}
          </li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink :to="localePath(`/tank/${tankId}/events`)">{{ $t("actions.goToEvents") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath('/settings')">{{ $t("actions.goToSettings") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

