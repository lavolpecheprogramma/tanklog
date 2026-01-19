<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const { t, tm } = useI18n()

useHead(() => ({
  title: t("pages.tank.metaTitle"),
}))

const route = useRoute()
const { tanks, activeTankId, setActiveTankId } = useActiveTank()

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const tank = computed(() => tanks.value.find((tankItem) => tankItem.id === tankId.value))

const nextUpBullets = computed(() => {
  const value = tm("pages.tank.sprint1.bullets")
  return Array.isArray(value) ? value : []
})

watchEffect(() => {
  if (!tank.value) return
  if (activeTankId.value !== tank.value.id) setActiveTankId(tank.value.id)
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        <span>{{ $t("pages.tank.title") }}</span>
        <span v-if="tank" class="text-muted-foreground">· {{ tank.name }}</span>
      </h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.tank.description") }}
      </p>
    </div>

    <Card v-if="tank">
      <CardHeader>
        <CardTitle>{{ $t("pages.tank.sprint1.title") }}</CardTitle>
        <CardDescription>
          {{ $t("pages.tank.sprint1.descriptionPrefix") }}
          <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.tank.sprint1.nextUpLabel") }}
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="item in nextUpBullets" :key="item">
            {{ item }}
          </li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/tests">{{ $t("pages.tests.title") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/photos">{{ $t("nav.photos") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/events">{{ $t("nav.events") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>{{ $t("pages.tank.unknown.title") }}</CardTitle>
        <CardDescription>
          {{ $t("pages.tank.unknown.descriptionPrefix") }}
          <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.tank.unknown.body") }}
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/">{{ $t("actions.backToHome") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

