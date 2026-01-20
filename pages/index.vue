<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const { t } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.home.metaTitle"),
}))

const storage = useTankLogRootFolderId()
storage.hydrateFromStorage()
const isStorageReady = computed(() => storage.hasRootFolderId.value)

const { tanks, status: tanksStatus, error: tanksError, refresh: refreshTanks } = useTanks()
const isCreateTankDialogOpen = ref(false)

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
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.home.heroTitle") }}</h1>
      <p class="max-w-prose text-muted-foreground">{{ $t("pages.home.heroDescription") }}</p>
    </div>

    <Card v-if="!isStorageReady">
      <CardHeader>
        <CardTitle>{{ $t("pages.settings.storage.title") }}</CardTitle>
        <CardDescription>{{ $t("pages.settings.storage.description") }}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button as-child>
          <NuxtLink to="/settings">{{ $t("actions.goToSettings") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-sm font-medium text-foreground">{{ $t("pages.settings.tanks.listTitle") }}</div>
          <div class="text-xs text-muted-foreground">{{ $t("pages.settings.tanks.listHint") }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" :disabled="tanksStatus === 'loading'" @click="refreshTanks">
            {{ $t("pages.settings.tanks.refresh") }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :disabled="isCreateTankDialogOpen"
            @click="isCreateTankDialogOpen = true"
          >
            {{ $t("pages.settings.tanks.add") }}
          </Button>
        </div>
      </div>

      <CreateTankDialog v-model:open="isCreateTankDialogOpen" />

      <div v-if="tanksError" class="text-sm text-destructive" role="alert">
        {{ tanksError }}
      </div>

      <div v-else-if="tanksStatus === 'loading'" class="text-sm text-muted-foreground">
        {{ $t("pages.settings.tanks.loading") }}
      </div>

      <div v-else-if="!tanks.length" class="space-y-2">
        <p class="text-sm text-muted-foreground">{{ $t("pages.settings.tanks.empty") }}</p>
        <Button type="button" :disabled="isCreateTankDialogOpen" @click="isCreateTankDialogOpen = true">
          {{ $t("pages.settings.tanks.add") }}
        </Button>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="tank in tanks" :key="tank.id" class="flex flex-col">
          <CardHeader>
            <CardTitle class="truncate">{{ tank.name }}</CardTitle>
            <CardDescription>
              <span>{{ tankTypeLabel(tank.type) }}</span>
              <span v-if="formatVolume(tank.volumeLiters)" class="text-muted-foreground"> · {{ formatVolume(tank.volumeLiters) }}</span>
            </CardDescription>
          </CardHeader>
          <CardContent class="text-xs text-muted-foreground">
            <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
          </CardContent>
          <CardFooter class="mt-auto">
            <Button as-child class="w-full">
              <NuxtLink :to="localePath(`/tank/${tank.id}`)">{{ $t("pages.settings.tanks.open") }}</NuxtLink>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </section>
</template>

