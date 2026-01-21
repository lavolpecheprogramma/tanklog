<script setup lang="ts">
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
    navigateTo(localePath(`/tank/${tankId.value}/water-test`), { replace: true })
    return
  }

  navigateTo(localePath("/"), { replace: true })
})
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </section>
</template>

