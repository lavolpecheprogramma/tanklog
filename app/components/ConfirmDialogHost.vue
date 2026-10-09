<script setup lang="ts">
import type { ConfirmDialogOptions } from '~/composables/useConfirmDialog'

const { t } = useI18n()

const open = ref(false)
const title = ref('')
const description = ref<string | undefined>()
const confirmLabel = ref<string | undefined>()
const cancelLabel = ref<string | undefined>()
const confirmColor = ref<ConfirmDialogOptions['confirmColor']>('error')

let resolvePending: ((value: boolean) => void) | null = null

function settle(value: boolean) {
  const resolve = resolvePending
  resolvePending = null
  open.value = false
  resolve?.(value)
}

function askConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  if (resolvePending) settle(false)

  return new Promise((resolve) => {
    resolvePending = resolve
    title.value = options.title
    description.value = options.description
    confirmLabel.value = options.confirmLabel
    cancelLabel.value = options.cancelLabel
    confirmColor.value = options.confirmColor ?? 'error'
    open.value = true
  })
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    settle(false)
  }
}

let unregisterConfirm: (() => void) | null = null

onMounted(() => {
  unregisterConfirm = registerConfirmDialog(askConfirm)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  unregisterConfirm?.()
  unregisterConfirm = null
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-hidden="true"
        @click="settle(false)"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="'confirm-dialog-title'"
        :aria-describedby="description ? 'confirm-dialog-desc' : undefined"
        class="relative w-full max-w-md rounded-xl border border-cyan-500/20 bg-slate-900 p-5 shadow-xl"
      >
        <h2
          id="confirm-dialog-title"
          class="font-display text-lg font-semibold text-white"
        >
          {{ title }}
        </h2>
        <p
          v-if="description"
          id="confirm-dialog-desc"
          class="mt-2 text-sm text-slate-300"
        >
          {{ description }}
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            @click="settle(false)"
          >
            {{ cancelLabel || t('common.cancel') }}
          </UButton>
          <UButton
            type="button"
            :color="confirmColor || 'error'"
            @click="settle(true)"
          >
            {{ confirmLabel || t('common.delete') }}
          </UButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
