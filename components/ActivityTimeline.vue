<script setup lang="ts">
import type { TankEvent } from "@/composables/useEvents"
import type { TankPhoto } from "@/composables/usePhotos"

type ActivityTimelineItem =
  | { kind: "photo"; id: string; date: string; photo: TankPhoto }
  | { kind: "event"; id: string; date: string; event: TankEvent }

const props = defineProps<{
  items: ActivityTimelineItem[]
  formatDate: (value: string) => string
  altForPhoto: (photo: TankPhoto) => string
}>()

const emit = defineEmits<{
  (e: "openPhoto", photo: TankPhoto): void
}>()

const { t } = useI18n()

const hasItems = computed(() => props.items.length > 0)

function eventTypeLabel(value: string): string {
  const key = `pages.events.types.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}
</script>

<template>
  <div v-if="!hasItems" class="space-y-1">
    <p class="text-sm text-muted-foreground">{{ $t("pages.livestock.timeline.empty") }}</p>
    <p class="text-xs text-muted-foreground">
      <slot name="emptyHint">{{ $t("pages.livestock.timeline.emptyHint") }}</slot>
    </p>
  </div>

  <ul v-else role="list" class="relative space-y-6">
    <div class="absolute left-3 top-0 h-full w-px bg-border" aria-hidden="true" />

    <li v-for="item in items" :key="`${item.kind}-${item.id}`" class="relative pl-8">
      <div
        class="absolute left-3 top-8 size-3 -translate-x-1/2 rounded-full ring-4 ring-background"
        :class="item.kind === 'event' ? 'bg-emerald-500' : 'bg-primary'"
        aria-hidden="true"
      />

      <div class="overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <template v-if="item.kind === 'photo'">
          <button
            type="button"
            class="block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @click="emit('openPhoto', item.photo)"
          >
            <div class="grid gap-3 sm:grid-cols-[200px,1fr]">
              <div class="aspect-[4/3] w-full bg-muted">
                <DrivePhoto :file-id="item.photo.driveFileId" :alt="altForPhoto(item.photo)" fit="cover" />
              </div>

              <div class="space-y-2 p-3">
                <div class="text-sm font-medium text-foreground">
                  {{ formatDate(item.photo.date) }}
                </div>
                <p v-if="item.photo.note" class="text-sm text-muted-foreground">
                  {{ item.photo.note }}
                </p>
              </div>
            </div>
          </button>

          <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/10 px-3 py-2 text-xs">
            <a
              class="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
              :href="item.photo.driveUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ t("pages.photos.list.labels.openInDrive") }}
            </a>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2 p-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <div class="text-sm font-medium text-foreground">
                  {{ eventTypeLabel(item.event.eventType) }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ formatDate(item.event.date) }}
                </div>
              </div>
            </div>

            <p class="text-sm text-foreground">
              {{ item.event.description }}
            </p>

            <p v-if="item.event.note" class="text-xs text-muted-foreground">
              {{ item.event.note }}
            </p>
          </div>
        </template>
      </div>
    </li>
  </ul>
</template>

