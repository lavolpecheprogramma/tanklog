<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-vue-next"

const props = defineProps<{
  parameter: string
}>()

const { t } = useI18n()

const startTimeMs = ref<number | null>(null)
const elapsedMs = ref(0)
const isRunning = ref(false)

let intervalId: ReturnType<typeof setInterval> | null = null

const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000))

const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
})

const ariaLabel = computed(() => {
  if (isRunning.value) return t("a11y.stopTimerForParameter", { parameter: props.parameter })
  return t("a11y.startTimerForParameter", { parameter: props.parameter })
})

function refreshElapsed() {
  if (!isRunning.value) return
  if (startTimeMs.value === null) return
  elapsedMs.value = Math.max(0, Date.now() - startTimeMs.value)
}

function stopTimer() {
  refreshElapsed()
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  isRunning.value = false
  startTimeMs.value = null
}

function startTimer() {
  if (intervalId) return
  isRunning.value = true

  intervalId = setInterval(() => {
    refreshElapsed()
  }, 1000)
}

function onToggle() {
  if (isRunning.value) {
    stopTimer()
    return
  }

  elapsedMs.value = 0
  startTimeMs.value = Date.now()
  refreshElapsed()
  startTimer()
}

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="xs"
    class="font-mono tabular-nums"
    :aria-label="ariaLabel"
    :title="ariaLabel"
    @click="onToggle"
  >
    <Clock class="size-4" aria-hidden="true" />
    <span v-if="isRunning || elapsedSeconds > 0">{{ formattedTime }}</span>
  </Button>
</template>

