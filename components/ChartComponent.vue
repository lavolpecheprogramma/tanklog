<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { Chart as ChartInstance, ChartData, ChartOptions, ChartType } from "chart.js"

type ChartModule = typeof import("chart.js/auto")

const props = withDefaults(
  defineProps<{
    ariaLabel: string
    type?: ChartType
    data: ChartData
    options?: ChartOptions
    containerClass?: string
  }>(),
  {
    type: "line",
    options: undefined,
    containerClass: "h-72",
  }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const chartRef = ref<ChartInstance | null>(null)
const lastType = ref<ChartType>(props.type)

async function loadChartModule(): Promise<ChartModule> {
  return await import("chart.js/auto")
}

async function createChart() {
  if (!import.meta.client) return
  if (!canvasRef.value) return

  const mod = await loadChartModule()
  const ChartCtor = mod.default

  chartRef.value?.destroy()
  chartRef.value = new ChartCtor(canvasRef.value, {
    type: props.type,
    data: props.data,
    options: props.options,
  })
  lastType.value = props.type
}

function updateChart() {
  const chart = chartRef.value
  if (!chart) return

  chart.data = props.data
  chart.options = props.options ?? {}
  chart.update()
}

onMounted(() => {
  createChart()
})

watch(
  () => props.type,
  (nextType) => {
    if (!chartRef.value) {
      createChart()
      return
    }

    if (nextType !== lastType.value) {
      createChart()
      return
    }
  }
)

watch(
  () => [props.data, props.options] as const,
  () => {
    updateChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  chartRef.value?.destroy()
  chartRef.value = null
})
</script>

<template>
  <div :class="['relative w-full', containerClass]">
    <canvas ref="canvasRef" role="img" :aria-label="ariaLabel" class="h-full w-full">
      {{ ariaLabel }}
    </canvas>
  </div>
</template>

