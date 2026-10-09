<script setup lang="ts">
definePageMeta({
  title: 'Privacy'
})

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <h1 class="font-display text-3xl font-semibold text-white">
      {{ t('privacy.title') }}
    </h1>
    <p class="mt-2 text-slate-400">
      {{ t('privacy.subtitle') }}
    </p>

    <div class="mt-8 space-y-6 text-slate-300">
      <section>
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('privacy.byoTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          {{ t('privacy.byoBody') }}
        </p>
      </section>

      <section>
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('privacy.localTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          {{ t('privacy.localBody') }}
        </p>
      </section>

      <section>
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('privacy.googleTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          {{ t('privacy.googleBody') }}
        </p>
      </section>

      <section>
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('privacy.oneSignalTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          {{ t('privacy.oneSignalBody') }}
        </p>
      </section>

      <section>
        <h2 class="font-display text-lg font-semibold text-cyan-100">
          {{ t('privacy.controlTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          {{ t('privacy.controlBody') }}
        </p>
      </section>
    </div>

    <p class="mt-10 text-sm text-slate-400">
      <NuxtLink
        to="/"
        class="text-cyan-400 hover:underline"
      >
        ← {{ t('nav.home') }}
      </NuxtLink>
    </p>
  </section>
</template>
