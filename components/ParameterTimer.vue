<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-vue-next"

const props = defineProps<{
  parameter: string
}>()

const { t } = useI18n()

const elapsedSeconds = ref(0)
const isRunning = ref(false)

let intervalId: ReturnType<typeof setInterval> | null = null

const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
})

const ariaLabel = computed(() => {
  if (isRunning.value) return t("a11y.stopTimerForParameter", { parameter: props.parameter })
  return t("a11y.startTimerForParameter", { parameter: props.parameter })
})

function stopTimer() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
  isRunning.value = false
}

function startTimer() {
  if (intervalId) return
  isRunning.value = true

  intervalId = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
}

function onToggle() {
  if (isRunning.value) {
    stopTimer()
    return
  }

  elapsedSeconds.value = 0
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

