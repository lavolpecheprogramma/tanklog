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
let createToken = 0

async function loadChartModule(): Promise<ChartModule> {
  return await import("chart.js/auto")
}

function destroyChart() {
  chartRef.value?.destroy()
  chartRef.value = null
}

function cloneDeepForChart<T>(value: T, seen = new Map<any, any>()): T {
  if (value === null || value === undefined) return value

  const valueType = typeof value
  if (valueType !== "object") return value
  if (valueType === "function") return value

  if (seen.has(value)) return seen.get(value)

  if (value instanceof Date) return new Date(value.getTime()) as any as T

  if (Array.isArray(value)) {
    const out: unknown[] = []
    seen.set(value, out)
    for (const item of value) out.push(cloneDeepForChart(item as any, seen))
    return out as any as T
  }

  const out: Record<string, unknown> = {}
  seen.set(value, out)
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = cloneDeepForChart(nested as any, seen)
  }
  return out as any as T
}

async function recreateChart() {
  if (!import.meta.client) return
  const canvas = canvasRef.value
  if (!canvas) return

  const token = ++createToken

  const mod = await loadChartModule()
  if (token !== createToken) return
  const ChartCtor = mod.default

  destroyChart()
  chartRef.value = new ChartCtor(canvas, {
    type: props.type,
    data: cloneDeepForChart(props.data),
    options: props.options ? cloneDeepForChart(props.options) : undefined,
  })
}

watch(
  () => [props.type, props.data, props.options] as const,
  () => {
    void recreateChart()
  },
  { flush: "post" }
)

onMounted(() => {
  void recreateChart()
})

onBeforeUnmount(() => {
  createToken++
  destroyChart()
})
</script>

<template>
  <div :class="['relative w-full', containerClass]">
    <canvas ref="canvasRef" role="img" :aria-label="ariaLabel" class="h-full w-full">
      {{ ariaLabel }}
    </canvas>
  </div>
</template>

