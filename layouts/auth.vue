<script setup lang="ts">
useHead({
  titleTemplate: "%s · TankLog",
})
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      href="#main"
    >
      Skip to content
    </a>

    <main id="main" class="mx-auto flex w-full max-w-5xl px-4 py-10">
      <div class="w-full">
        <slot />
      </div>
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6">
        <small class="text-muted-foreground">TankLog — frontend-only, static, user-controlled data.</small>
      </div>
    </footer>
  </div>
</template>

