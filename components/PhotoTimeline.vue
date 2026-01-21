<script setup lang="ts">
import type { TankPhoto } from "@/composables/usePhotos"

const props = defineProps<{
  photos: TankPhoto[]
  altFor: (photo: TankPhoto) => string
  formatDate: (value: string) => string
}>()

const emit = defineEmits<{
  (e: "open", photo: TankPhoto): void
}>()

const { t } = useI18n()

const hasPhotos = computed(() => props.photos.length > 0)
</script>

<template>
  <div v-if="!hasPhotos" class="space-y-1">
    <p class="text-sm text-muted-foreground">{{ $t("pages.photos.list.empty") }}</p>
    <p class="text-xs text-muted-foreground">
      <slot name="emptyHint">{{ $t("pages.photos.list.emptyHint") }}</slot>
    </p>
  </div>

  <ul v-else role="list" class="relative space-y-6">
    <div class="absolute left-3 top-0 h-full w-px bg-border" aria-hidden="true" />

    <li v-for="photo in photos" :key="photo.photoId" class="relative pl-8">
      <div
        class="absolute left-3 top-8 size-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"
        aria-hidden="true"
      />

      <div class="overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <button
          type="button"
          class="block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @click="emit('open', photo)"
        >
          <div class="grid gap-3 sm:grid-cols-[200px,1fr]">
            <div class="aspect-[4/3] w-full bg-muted">
              <DrivePhoto :file-id="photo.driveFileId" :alt="altFor(photo)" fit="cover" />
            </div>

            <div class="space-y-2 p-3">
              <div class="text-sm font-medium text-foreground">
                {{ formatDate(photo.date) }}
              </div>
              <p v-if="photo.note" class="text-sm text-muted-foreground">
                {{ photo.note }}
              </p>
            </div>
          </div>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/10 px-3 py-2 text-xs">
          <a class="font-medium text-primary underline underline-offset-4 hover:text-primary/90" :href="photo.driveUrl" target="_blank" rel="noreferrer">
            {{ t("pages.photos.list.labels.openInDrive") }}
          </a>
        </div>
      </div>
    </li>
  </ul>
</template>

