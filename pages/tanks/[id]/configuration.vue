<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

watchEffect(() => {
  if (!import.meta.client) return
  if (!tankId.value) {
    navigateTo(localePath("/"), { replace: true })
    return
  }
  navigateTo(localePath(`/tank/${tankId.value}/configuration`), { replace: true })
})
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </section>
</template>

