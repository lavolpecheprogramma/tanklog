<script setup lang="ts">
const props = defineProps<{
  parameter: string
}>()

const { t } = useI18n()
const timers = useParameterTimers()

const open = ref(false)
const customMinutes = ref('10')
const busy = ref(false)
const error = ref<string | null>(null)

const presets = [5, 10, 15, 20]

const remaining = computed(() => timers.remainingLabel(props.parameter))
const running = computed(() => timers.isRunning(props.parameter))

function openModal() {
  error.value = null
  open.value = true
}

async function start(minutes: number) {
  busy.value = true
  error.value = null
  try {
    await timers.start(props.parameter, minutes)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function startCustom() {
  const n = Number(customMinutes.value)
  if (!Number.isFinite(n) || n <= 0) {
    error.value = t('waterTests.timer.invalidDuration')
    return
  }
  await start(n)
}

async function stop() {
  busy.value = true
  try {
    await timers.stop(props.parameter)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span
      v-if="running && remaining"
      class="font-mono text-xs tabular-nums text-cyan-300"
      aria-live="polite"
    >
      {{ remaining }}
    </span>
    <UButton
      v-if="running"
      type="button"
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-square"
      :aria-label="t('waterTests.timer.cancelAria', { parameter })"
      :loading="busy"
      @click="stop"
    />
    <UButton
      v-else
      type="button"
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-timer"
      :aria-label="t('waterTests.timer.openAria', { parameter })"
      @click="openModal"
    />

    <UModal
      v-if="open"
      :open="open"
      :title="t('waterTests.timer.title', { parameter })"
      :ui="{ content: 'sm:max-w-sm' }"
      @update:open="(v: boolean) => { open = v }"
    >
      <template #body>
        <p class="text-sm text-slate-400">
          {{ t('waterTests.timer.body') }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            v-for="mins in presets"
            :key="mins"
            type="button"
            size="sm"
            color="neutral"
            variant="soft"
            :loading="busy"
            @click="start(mins)"
          >
            {{ t('waterTests.timer.preset', { n: mins }) }}
          </UButton>
        </div>
        <div class="mt-4 flex flex-wrap items-end gap-2">
          <UFormField
            :label="t('waterTests.timer.custom')"
            class="min-w-28 flex-1"
          >
            <UInput
              v-model="customMinutes"
              type="number"
              min="1"
              step="1"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="button"
            color="primary"
            :loading="busy"
            @click="startCustom"
          >
            {{ t('waterTests.timer.start') }}
          </UButton>
        </div>
        <p
          v-if="error"
          class="mt-3 text-sm text-red-400"
          role="alert"
        >
          {{ error }}
        </p>
        <div class="mt-4">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            @click="open = false"
          >
            {{ t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </span>
</template>
