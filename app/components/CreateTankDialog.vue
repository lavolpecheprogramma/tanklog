<script setup lang="ts">
import type { TankType } from '~/types/tank'

const open = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  created: []
}>()

const { t } = useI18n()
const tanks = useTanks()

const name = ref('')
const type = ref<TankType>('freshwater')
const volumeLiters = ref<number | undefined>(undefined)
const startDate = ref('')
const notes = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const typeItems = computed(() => ([
  { label: t('tanks.types.freshwater'), value: 'freshwater' },
  { label: t('tanks.types.planted'), value: 'planted' },
  { label: t('tanks.types.marine'), value: 'marine' },
  { label: t('tanks.types.reef'), value: 'reef' }
]))

function reset() {
  name.value = ''
  type.value = 'freshwater'
  volumeLiters.value = undefined
  startDate.value = ''
  notes.value = ''
  error.value = null
}

watch(open, (value) => {
  if (value) reset()
})

async function submit() {
  busy.value = true
  error.value = null
  try {
    await tanks.createTank({
      name: name.value,
      type: type.value,
      volumeLiters: volumeLiters.value ?? null,
      startDate: startDate.value || null,
      notes: notes.value || null
    })
    open.value = false
    emit('created')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('tanks.createTitle')"
  >
    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          :label="t('tanks.name')"
          required
        >
          <UInput
            v-model="name"
            required
            class="w-full"
            autocomplete="off"
          />
        </UFormField>

        <UFormField :label="t('tanks.type')">
          <USelect
            v-model="type"
            :items="typeItems"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('tanks.volume')">
          <UInput
            v-model.number="volumeLiters"
            type="number"
            min="0"
            step="1"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('tanks.startDate')">
          <UInput
            v-model="startDate"
            type="date"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('tanks.notes')">
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <p
          v-if="error"
          class="text-sm text-red-400"
          role="alert"
        >
          {{ error }}
        </p>
      </form>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="close()"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="busy"
          @click="submit"
        >
          {{ t('tanks.create') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
