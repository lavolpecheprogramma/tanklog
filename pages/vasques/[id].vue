<script setup lang="ts">
const route = useRoute()

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

watchEffect(() => {
  if (!process.client) return
  if (!tankId.value) {
    navigateTo("/tanks", { replace: true })
    return
  }
  navigateTo(`/tanks/${tankId.value}`, { replace: true })
})
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </section>
</template>

