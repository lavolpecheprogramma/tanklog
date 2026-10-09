<script setup lang="ts">
definePageMeta({
  title: 'TankLog'
})

const { t } = useI18n()
const auth = useAuth()
</script>

<template>
  <section class="relative mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-5xl flex-col justify-center px-4 py-10 sm:py-16">
    <h1 class="font-display text-4xl font-semibold tracking-tight text-cyan-300 sm:text-5xl md:text-6xl">
      {{ t('app.name') }}
    </h1>
    <p class="font-display mt-4 max-w-2xl text-xl font-medium tracking-tight text-white sm:text-2xl md:text-3xl">
      {{ t('landing.title') }}
    </p>
    <p class="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
      {{ t('landing.subtitle') }}
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <template v-if="auth.isAuthenticated.value">
        <UButton
          to="/dashboard"
          size="lg"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ t('landing.ctaDashboard') }}
        </UButton>
      </template>
      <template v-else>
        <UButton
          to="/onboarding"
          size="lg"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ t('landing.ctaStart') }}
        </UButton>
        <UButton
          to="/dashboard/login"
          size="lg"
          color="neutral"
          variant="outline"
        >
          {{ t('landing.ctaSignIn') }}
        </UButton>
      </template>
    </div>
    <p class="mt-6 text-sm text-slate-400">
      {{ t('landing.byoHint') }}
      <NuxtLink
        to="/privacy"
        class="text-cyan-400 hover:underline"
      >
        {{ t('nav.privacy') }}
      </NuxtLink>
    </p>
  </section>
</template>
