<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string, clearable?: boolean }>()

const open = ref(false)

const calendarValue = computed({
  get: () => {
    if (!model.value) return undefined
    const [y, m, d] = model.value.split('-').map(Number)
    return new CalendarDate(y!, m!, d!)
  },
  set: (v) => {
    model.value = v ? v.toString() : ''
    open.value = false
  }
})

function setToday() {
  model.value = todayIso()
  open.value = false
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      class="w-full justify-start font-normal"
      :class="model ? '' : 'text-muted'"
    >
      {{ model ? formatDate(model) : (placeholder ?? 'Выберите дату') }}
    </UButton>

    <template #content>
      <div class="p-2">
        <UCalendar v-model="calendarValue" />
        <div class="mt-1 flex items-center justify-between border-t border-default pt-2">
          <UButton size="xs" color="neutral" variant="ghost" @click="setToday">Сегодня</UButton>
          <UButton v-if="clearable && model" size="xs" color="neutral" variant="ghost" @click="model = ''; open = false">Очистить</UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
