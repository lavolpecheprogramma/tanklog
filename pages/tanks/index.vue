<script setup lang="ts">
const localePath = useLocalePath()

watchEffect(() => {
  if (!import.meta.client) return
  navigateTo(localePath("/"), { replace: true })
})
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </section>
</template>

