<script setup lang="ts">
const props = withDefaults(defineProps<{
  storagePath: string
  alt: string
  eager?: boolean
  /** `cover` for grid thumbs; `contain` for fullscreen/compare detail */
  fit?: 'cover' | 'contain'
}>(), {
  fit: 'cover'
})

const photosApi = usePhotos()
const src = ref<string | null>(null)
const failed = ref(false)
const loading = ref(true)

async function load() {
  loading.value = true
  failed.value = false
  try {
    src.value = await photosApi.getSignedUrl(props.storagePath)
  } catch {
    failed.value = true
    src.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => props.storagePath,
  () => {
    void load()
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg bg-slate-950/80"
    :class="fit === 'contain' ? 'aspect-auto min-h-48' : 'aspect-square'"
  >
    <div
      v-if="loading"
      class="absolute inset-0 animate-pulse bg-slate-800/60"
      aria-hidden="true"
    />
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      class="h-full w-full"
      :class="fit === 'contain' ? 'max-h-[70vh] object-contain' : 'object-cover'"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
    >
    <div
      v-else-if="failed"
      class="flex h-full min-h-24 items-center justify-center px-2 text-center text-xs text-slate-400"
    >
      —
    </div>
  </div>
</template>
