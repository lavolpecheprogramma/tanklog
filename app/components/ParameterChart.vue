<script setup lang="ts">
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
  CategoryScale
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
)

export type ChartPoint = {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: ChartPoint[]
  label: string
  color?: string
  emptyText?: string
}>(), {
  color: '#22d3ee',
  emptyText: 'No data'
})

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function fillColor(hex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}33`
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1]
    const g = hex[2]
    const b = hex[3]
    return `#${r}${r}${g}${g}${b}${b}33`
  }
  return 'rgba(34, 211, 238, 0.2)'
}

function destroyChart() {
  chart?.destroy()
  chart = null
}

async function syncChart() {
  await nextTick()
  if (!canvas.value) return

  if (!props.points.length) {
    destroyChart()
    return
  }

  const labels = props.points.map(p => p.label)
  const data = props.points.map(p => p.value)
  const border = props.color || '#22d3ee'
  const background = fillColor(border)

  if (chart) {
    chart.data.labels = labels
    const dataset = chart.data.datasets[0]
    if (dataset) {
      dataset.label = props.label
      dataset.data = data
      dataset.borderColor = border
      dataset.backgroundColor = background
    }
    chart.update()
    return
  }

  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: props.label,
        data,
        borderColor: border,
        backgroundColor: background,
        fill: true,
        tension: 0.25,
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 250
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${props.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(148,163,184,0.12)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148,163,184,0.12)' }
        }
      }
    }
  })
}

watch(
  () => ({
    points: props.points,
    label: props.label,
    color: props.color
  }),
  () => {
    void syncChart()
  },
  { deep: true }
)

onMounted(() => {
  void syncChart()
})

onBeforeUnmount(() => {
  destroyChart()
})
</script>

<template>
  <div class="relative h-64 w-full">
    <p
      v-if="!points.length"
      class="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-400"
    >
      {{ emptyText }}
    </p>
    <!-- Keep canvas mounted so Chart.js can resize/update reliably -->
    <canvas
      ref="canvas"
      class="h-full w-full"
      :class="{ 'opacity-0': !points.length }"
      role="img"
      :aria-label="label"
    />
  </div>
</template>
