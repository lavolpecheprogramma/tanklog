<script setup lang="ts">
import { Button } from "@/components/ui/button"

definePageMeta({
  layout: "tank",
})

const route = useRoute()
const localePath = useLocalePath()

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

watchEffect(() => {
  if (!import.meta.client) return

  if (tankId.value) {
    navigateTo(localePath(`/dashboard/tank/${tankId.value}/water-test`), { replace: true })
    return
  }

  navigateTo(localePath("/dashboard"), { replace: true })
})
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
    <p class="text-sm text-muted-foreground">Redirecting…</p>
    <div v-if="tankId" class="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" as-child>
        <NuxtLink :to="localePath(`/dashboard/tank/${tankId}`)">{{ $t("actions.backToTank") }}</NuxtLink>
      </Button>
    </div>
  </section>
</template>

