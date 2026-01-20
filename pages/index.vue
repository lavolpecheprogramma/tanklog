<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const { t, tm } = useI18n()

useHead(() => ({
  title: t("pages.home.metaTitle"),
}))

const { activeTank } = useActiveTank()

const sprint1Bullets = computed(() => {
  const value = tm("pages.home.sprint1.bullets")
  return Array.isArray(value) ? value : []
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.home.heroTitle") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.home.heroDescription") }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.home.sprint1.title") }}</CardTitle>
        <CardDescription>
          {{ $t("pages.home.sprint1.description") }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li v-for="item in sprint1Bullets" :key="item">
            {{ item }}
          </li>
        </ul>
      </CardContent>
      <CardFooter class="flex gap-2">
        <Button as-child>
          <NuxtLink :to="activeTank ? `/tanks/${activeTank.id}` : '/tanks'">{{ $t("actions.openActiveTank") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/tests">{{ $t("actions.openWaterTests") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

