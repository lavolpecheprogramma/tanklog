<script setup lang="ts">
const props = defineProps<{
  tankId: string
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const items = computed(() => [
  {
    label: t('tanks.nav.overview'),
    to: `/dashboard/tank/${props.tankId}`,
    exact: true
  },
  {
    label: t('tanks.nav.waterTests'),
    to: `/dashboard/tank/${props.tankId}/water-test`,
    exact: true
  },
  {
    label: t('tanks.nav.ranges'),
    to: `/dashboard/tank/${props.tankId}/water-test/ranges`
  },
  {
    label: t('tanks.nav.events'),
    to: `/dashboard/tank/${props.tankId}/events`
  },
  {
    label: t('tanks.nav.reminders'),
    to: `/dashboard/tank/${props.tankId}/reminders`
  },
  {
    label: t('tanks.nav.livestock'),
    to: `/dashboard/tank/${props.tankId}/livestock`
  },
  {
    label: t('tanks.nav.equipment'),
    to: `/dashboard/tank/${props.tankId}/equipment`
  },
  {
    label: t('tanks.nav.photos'),
    to: `/dashboard/tank/${props.tankId}/photos`
  },
  {
    label: t('tanks.nav.configuration'),
    to: `/dashboard/tank/${props.tankId}/configuration`
  }
])

const selectItems = computed(() =>
  items.value.map(item => ({
    label: item.label,
    value: item.to
  }))
)

const configTo = computed(() => `/dashboard/tank/${props.tankId}/configuration`)

function isActive(to: string, exact?: boolean) {
  if (exact) return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}

const currentTo = computed(() => {
  const match = items.value.find(item => isActive(item.to, item.exact))
  return match?.to ?? items.value[0]?.to ?? ''
})

const selectedSection = computed({
  get: () => currentTo.value,
  set: (value: unknown) => {
    const next = typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'value' in value
        ? String((value as { value: unknown }).value)
        : ''
    if (next && next !== route.path) void router.push(next)
  }
})
</script>

<template>
  <nav
    class="-mx-4 mb-6 px-4 sm:mb-8"
    :aria-label="t('tanks.nav.label')"
  >
    <!-- Mobile: section picker + always-visible tank config -->
    <div class="flex items-center gap-2 sm:hidden">
      <USelect
        v-model="selectedSection"
        value-key="value"
        :items="selectItems"
        class="min-w-0 flex-1"
        :aria-label="t('tanks.nav.label')"
      />
      <UButton
        :to="configTo"
        size="sm"
        icon="i-lucide-settings-2"
        :color="isActive(configTo) ? 'primary' : 'neutral'"
        :variant="isActive(configTo) ? 'soft' : 'ghost'"
        :aria-label="t('tanks.nav.configuration')"
        :aria-current="isActive(configTo) ? 'page' : undefined"
      />
    </div>

    <!-- sm+: horizontal pills -->
    <div
      class="hidden gap-2 overflow-x-auto pb-1 sm:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <UButton
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        size="sm"
        class="shrink-0"
        :color="isActive(item.to, item.exact) ? 'primary' : 'neutral'"
        :variant="isActive(item.to, item.exact) ? 'soft' : 'ghost'"
        :aria-current="isActive(item.to, item.exact) ? 'page' : undefined"
      >
        {{ item.label }}
      </UButton>
    </div>
  </nav>
</template>
