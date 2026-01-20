<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "tank",
})

const { t } = useI18n()
const localePath = useLocalePath()

const route = useRoute()
const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const { tanks, status: tanksStatus, error: tanksError } = useTanks()
const tank = computed(() => (tankId.value ? tanks.value.find((item) => item.id === tankId.value) ?? null : null))

useHead(() => ({
  title: tank.value?.name || t("pages.tank.metaTitle"),
}))

function tankTypeLabel(type: string) {
  if (type === "freshwater" || type === "marine" || type === "reef") {
    return t(`pages.settings.tanks.types.${type}`)
  }
  return type
}

function formatVolume(volumeLiters: number | null) {
  if (volumeLiters === null) return null
  const rounded = Number.isInteger(volumeLiters) ? volumeLiters.toString() : volumeLiters.toFixed(1)
  return `${rounded} L`
}
</script>

<template>
  <section class="space-y-6">
    <div v-if="tanksError" class="text-sm text-destructive" role="alert">
      {{ tanksError }}
    </div>

    <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
      {{ $t("pages.settings.tanks.loading") }}
    </div>

    <Card v-else-if="!tank">
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
      <CardFooter>
        <Button as-child>
          <NuxtLink :to="localePath('/')">{{ $t("actions.backToHome") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle class="truncate">{{ tank.name }}</CardTitle>
        <CardDescription>
          <span>{{ tankTypeLabel(tank.type) }}</span>
          <span v-if="formatVolume(tank.volumeLiters)" class="text-muted-foreground"> · {{ formatVolume(tank.volumeLiters) }}</span>
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-muted-foreground">ID:</span>
          <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
        </div>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink :to="localePath(`/tank/${tank.id}/tests`)">{{ $t("nav.tests") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath(`/tank/${tank.id}/photos`)">{{ $t("nav.photos") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath(`/tank/${tank.id}/events`)">{{ $t("nav.events") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath(`/tank/${tank.id}/reminders`)">{{ $t("nav.reminders") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

