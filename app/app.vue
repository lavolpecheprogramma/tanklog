<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const auth = useAuth()
const schema = useSchemaHealth()
const site = useSiteMeta()

useHead({
  htmlAttrs: {
    lang: locale
  },
  titleTemplate: (titleChunk) => {
    const name = t('app.name')
    if (!titleChunk || titleChunk === name) return name
    return `${titleChunk} · ${name}`
  },
  link: () =>
    site.siteUrl.value
      ? [{ rel: 'canonical', href: site.absoluteUrl('') }]
      : [],
  script: () => [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: t('app.name'),
        description: t('app.seoDescription'),
        ...(site.siteUrl.value ? { url: site.absoluteUrl('') } : {}),
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        image: site.ogImage.value
      })
    }
  ]
})

useSeoMeta({
  title: () => t('app.name'),
  description: () => t('app.seoDescription'),
  ogTitle: () => t('app.name'),
  ogDescription: () => t('app.seoDescription'),
  ogImage: () => site.ogImage.value,
  ogImageAlt: () => `${t('app.name')} — ${t('app.tagline')}`,
  ogType: 'website',
  ogSiteName: () => t('app.name'),
  ogLocale: () => (locale.value === 'it' ? 'it_IT' : 'en_US'),
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('app.name'),
  twitterDescription: () => t('app.seoDescription'),
  twitterImage: () => site.ogImage.value,
  twitterImageAlt: () => `${t('app.name')} — ${t('app.tagline')}`
})

watch(
  () => auth.isAuthenticated.value,
  (authed) => {
    if (authed) void schema.check()
  },
  { immediate: true }
)

function toggleLocale() {
  void setLocale(locale.value === 'it' ? 'en' : 'it')
}

async function logout() {
  await auth.signOut()
  await navigateTo('/dashboard/login')
}

const accountItems = computed(() => {
  const items: Array<Array<Record<string, unknown>>> = [
    [
      {
        label: t('nav.settings'),
        icon: 'i-lucide-settings',
        to: '/dashboard/settings'
      },
      {
        label: t('nav.setup'),
        icon: 'i-lucide-database',
        to: '/dashboard/setup',
        color: schema.needsSetup.value ? 'warning' : undefined
      }
    ],
    [
      {
        label: t('auth.signOut'),
        icon: 'i-lucide-log-out',
        color: 'error',
        onSelect: () => {
          void logout()
        }
      }
    ]
  ]
  return items
})
</script>

<template>
  <UApp>
    <div class="min-h-dvh flex flex-col">
      <header class="sticky top-0 z-40 border-b border-cyan-500/15 bg-slate-950/80 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:gap-4">
          <NuxtLink
            to="/"
            class="font-display shrink-0 text-lg font-semibold tracking-tight text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded-sm"
          >
            {{ $t('app.name') }}
          </NuxtLink>

          <nav
            class="flex min-w-0 items-center gap-1 sm:gap-2"
            :aria-label="$t('nav.main')"
          >
            <template v-if="auth.isAuthenticated.value">
              <UButton
                to="/dashboard"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-layout-dashboard"
                :aria-label="$t('nav.dashboard')"
              >
                <span class="hidden sm:inline">{{ $t('nav.dashboard') }}</span>
              </UButton>
              <UButton
                to="/dashboard/settings"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-settings"
                :aria-label="$t('nav.settings')"
              >
                <span class="hidden md:inline">{{ $t('nav.settings') }}</span>
              </UButton>
              <UButton
                v-if="schema.needsSetup.value"
                to="/dashboard/setup"
                color="warning"
                variant="soft"
                size="sm"
                icon="i-lucide-triangle-alert"
                :aria-label="$t('nav.setup')"
              >
                <span class="hidden sm:inline">{{ $t('nav.setup') }}</span>
              </UButton>
              <UDropdownMenu
                :items="accountItems"
                :content="{ align: 'end' }"
              >
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-user"
                  :aria-label="auth.user.value?.email || t('nav.settings')"
                />
              </UDropdownMenu>
            </template>
            <UButton
              v-else
              to="/dashboard/login"
              color="primary"
              variant="soft"
              size="sm"
            >
              {{ $t('nav.login') }}
            </UButton>
            <UButton
              :label="locale === 'it' ? 'IT' : 'EN'"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('nav.switchLocale', { locale: locale === 'it' ? 'English' : 'Italiano' })"
              @click="toggleLocale"
            />
          </nav>
        </div>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>

      <footer class="border-t border-cyan-500/10 py-4">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 text-sm text-slate-400">
          <span>{{ $t('app.tagline') }}</span>
          <nav
            class="flex flex-wrap gap-3"
            :aria-label="$t('nav.main')"
          >
            <NuxtLink
              to="/onboarding"
              class="text-slate-400 hover:text-cyan-300"
            >
              {{ $t('nav.onboarding') }}
            </NuxtLink>
            <NuxtLink
              to="/privacy"
              class="text-slate-400 hover:text-cyan-300"
            >
              {{ $t('nav.privacy') }}
            </NuxtLink>
          </nav>
        </div>
      </footer>

      <ConfirmDialogHost />
    </div>
  </UApp>
</template>
