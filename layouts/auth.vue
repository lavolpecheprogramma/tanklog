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
      {{ $t("a11y.skipToContent") }}
    </a>

    <header class="border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div class="mx-auto w-full max-w-5xl px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <NuxtLink
            class="font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            to="/"
          >
            TankLog
          </NuxtLink>

          <div class="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>

    <main id="main" class="mx-auto flex w-full max-w-5xl px-4 py-10">
      <div class="w-full">
        <slot />
      </div>
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6">
        <small class="text-muted-foreground">{{ $t("footer.tagline") }}</small>
      </div>
    </footer>
  </div>
</template>

