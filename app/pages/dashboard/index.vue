<script setup lang="ts">
definePageMeta({
  title: 'Dashboard'
})

const { t } = useI18n()
const auth = useAuth()
const toast = useToast()
const tanksApi = useTanks()
const { confirm } = useConfirmDialog()
const createOpen = ref(false)

onMounted(async () => {
  try {
    await tanksApi.refresh()
  } catch {
    // error shown via tanksApi.error
  }
})

async function selectTank(id: string) {
  tanksApi.setActiveTankId(id)
  await navigateTo(`/dashboard/tank/${id}`)
}

async function removeTank(id: string, name: string) {
  const ok = await confirm({
    title: t('common.confirmTitle'),
    description: t('tanks.confirmDelete', { name }),
    confirmLabel: t('common.delete'),
    confirmColor: 'error'
  })
  if (!ok) return
  try {
    await tanksApi.deleteTank(id)
    toast.add({ title: t('common.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
  } catch {
    // surfaced in tanksApi.error
  }
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold text-white sm:text-3xl">
          {{ t('dashboard.title') }}
        </h1>
        <p class="mt-2 text-slate-400">
          {{ t('dashboard.signedInAs', { email: auth.user.value?.email || '—' }) }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="createOpen = true"
      >
        {{ t('tanks.create') }}
      </UButton>
    </div>

    <p
      v-if="tanksApi.error.value"
      class="mt-6 text-sm text-red-400"
      role="alert"
    >
      {{ tanksApi.error.value }}
    </p>

    <div
      v-if="tanksApi.loading.value"
      class="mt-10 text-slate-400"
    >
      {{ t('common.loading') }}
    </div>

    <UEmpty
      v-else-if="!tanksApi.tanks.value.length"
      class="mt-10 rounded-xl border border-dashed border-cyan-500/25 bg-slate-900/40"
      icon="i-lucide-fish"
      :title="t('dashboard.emptyTitle')"
      :description="t('dashboard.emptyBody')"
      :actions="[
        { label: t('tanks.create'), color: 'primary', onClick: () => { createOpen = true } },
        { label: t('dashboard.migrateHint'), color: 'neutral', variant: 'soft', to: '/dashboard/migrate' }
      ]"
    />

    <ul
      v-else
      class="mt-10 grid gap-4 sm:grid-cols-2"
    >
      <li
        v-for="tank in tanksApi.tanks.value"
        :key="tank.id"
      >
        <article
          class="rounded-xl border border-cyan-500/15 bg-slate-900/50 p-5 transition hover:border-cyan-400/35"
          :class="tank.id === tanksApi.activeTankId.value ? 'ring-1 ring-cyan-400/40' : ''"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-display text-xl font-semibold text-white">
                {{ tank.name }}
              </h2>
              <p class="mt-1 text-sm text-slate-400">
                {{ t(`tanks.types.${tank.type}`) }}
                <span v-if="tank.volumeLiters != null"> · {{ tank.volumeLiters }} L</span>
              </p>
            </div>
            <UBadge
              v-if="tank.id === tanksApi.activeTankId.value"
              color="primary"
              variant="subtle"
            >
              {{ t('tanks.active') }}
            </UBadge>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              size="sm"
              color="primary"
              variant="soft"
              @click="selectTank(tank.id)"
            >
              {{ t('tanks.open') }}
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :to="`/dashboard/tank/${tank.id}/water-test`"
            >
              {{ t('tanks.nav.waterTests') }}
            </UButton>
            <UButton
              v-if="tank.id !== tanksApi.activeTankId.value"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="tanksApi.setActiveTankId(tank.id)"
            >
              {{ t('tanks.setActive') }}
            </UButton>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              @click="removeTank(tank.id, tank.name)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
        </article>
      </li>
    </ul>

    <CreateTankDialog
      v-model="createOpen"
      @created="() => undefined"
    />
  </section>
</template>
