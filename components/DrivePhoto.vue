<script setup lang="ts">
import { normalizeImageBlobForBrowser } from "@/lib/images"

type DrivePhotoStatus = "idle" | "loading" | "ready" | "error"

const props = withDefaults(defineProps<{
  fileId: string
  alt: string
  fit?: "cover" | "contain"
  lazy?: boolean
  imgClass?: string
  showErrorDetails?: boolean
  allowRetry?: boolean
}>(), {
  fit: "cover",
  lazy: true,
  imgClass: "",
  showErrorDetails: false,
  allowRetry: true,
})

const { t } = useI18n()
const drive = useGoogleDrive()

const rootEl = ref<HTMLElement | null>(null)
const status = ref<DrivePhotoStatus>("idle")
const src = ref<string | null>(null)
const loadError = ref<string | null>(null)

const generation = ref(0)
let observer: IntersectionObserver | null = null

const normalizedFileId = computed(() => props.fileId?.trim() || "")

const resolvedImgClass = computed(() => {
  const fitClass = props.fit === "contain" ? "object-contain" : "object-cover"
  const base = `h-full w-full ${fitClass}`
  return props.imgClass ? `${base} ${props.imgClass}` : base
})

function safeRevokeObjectUrl(url: string | null) {
  if (!import.meta.client) return
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

function resetState() {
  generation.value += 1
  status.value = "idle"
  loadError.value = null
  safeRevokeObjectUrl(src.value)
  src.value = null
}

function cleanupObserver() {
  if (!import.meta.client) return
  try {
    observer?.disconnect()
  } catch {
    // ignore
  }
  observer = null
}

async function load() {
  if (!import.meta.client) return
  if (!normalizedFileId.value) {
    status.value = "error"
    loadError.value = t("components.drivePhoto.errors.missingFileId")
    return
  }

  if (status.value === "loading" || status.value === "ready") return

  const current = generation.value
  status.value = "loading"
  loadError.value = null

  try {
    const blob = await drive.downloadFile({ fileId: normalizedFileId.value })
    const normalized = await normalizeImageBlobForBrowser(blob)
    const objectUrl = URL.createObjectURL(normalized.blob)

    if (current !== generation.value) {
      safeRevokeObjectUrl(objectUrl)
      return
    }

    safeRevokeObjectUrl(src.value)
    src.value = objectUrl
    status.value = "ready"
  } catch (error) {
    if (current !== generation.value) return
    safeRevokeObjectUrl(src.value)
    src.value = null
    loadError.value = error instanceof Error ? error.message : t("components.drivePhoto.errors.loadFailed")
    status.value = "error"
  }
}

function observeAndLoad() {
  if (!import.meta.client) return
  cleanupObserver()

  if (!props.lazy) {
    void load()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      cleanupObserver()
      void load()
    },
    { rootMargin: "250px" }
  )

  if (rootEl.value) observer.observe(rootEl.value)
}

function retry() {
  resetState()
  observeAndLoad()
}

function onImgError() {
  safeRevokeObjectUrl(src.value)
  src.value = null
  loadError.value = loadError.value || t("components.drivePhoto.errors.loadFailed")
  status.value = "error"
}

watch(normalizedFileId, () => {
  resetState()
  if (!import.meta.client) return
  observeAndLoad()
})

watch(
  () => props.lazy,
  () => {
    if (!import.meta.client) return
    observeAndLoad()
  }
)

onMounted(() => {
  observeAndLoad()
})

onBeforeUnmount(() => {
  cleanupObserver()
  safeRevokeObjectUrl(src.value)
})
</script>

<template>
  <div ref="rootEl" class="relative h-full w-full" :aria-busy="status === 'loading' ? 'true' : undefined">
    <img v-if="status === 'ready' && src" :src="src" :alt="alt" :class="resolvedImgClass" @error="onImgError" />

    <div v-else class="flex h-full w-full items-center justify-center bg-muted p-3 text-center text-xs text-muted-foreground">
      <slot name="placeholder" :status="status" :error="loadError" :retry="retry" :load="load">
        <template v-if="status === 'loading'">
          {{ $t("components.drivePhoto.loading") }}
        </template>
        <template v-else-if="status === 'error'">
          <div class="space-y-2">
            <div class="text-destructive">{{ $t("components.drivePhoto.errors.loadFailed") }}</div>
            <div v-if="showErrorDetails && loadError" class="text-xs text-muted-foreground">({{ loadError }})</div>
            <button
              v-if="allowRetry"
              type="button"
              class="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/40"
              @click.stop="retry"
            >
              {{ $t("components.drivePhoto.actions.retry") }}
            </button>
          </div>
        </template>
        <template v-else>
          <span class="sr-only">{{ $t("components.drivePhoto.idle") }}</span>
        </template>
      </slot>
    </div>
  </div>
</template>

