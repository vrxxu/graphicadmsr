<script setup lang="ts">
import type { Vacation, VacationStatus } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  vacation: Vacation | null
  /** предзаполненный сотрудник при создании */
  employeeId?: number | null
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const { employees, departments } = useSchedule()
const toast = useToast()
const saving = ref(false)

const form = reactive({
  employeeId: null as number | null,
  startDate: '',
  endDate: '',
  status: 'planned' as VacationStatus,
  note: ''
})

watch(open, (isOpen) => {
  if (!isOpen) return
  const v = props.vacation
  form.employeeId = v?.employeeId ?? props.employeeId ?? null
  form.startDate = v?.startDate ?? ''
  form.endDate = v?.endDate ?? ''
  form.status = v?.status ?? 'planned'
  form.note = v?.note ?? ''
})

const employeeItems = computed(() => {
  const deptName = new Map(departments.value.map(d => [d.id, d.name]))
  return employees.value.map(e => ({ label: `${e.fullName} — ${deptName.get(e.departmentId) ?? ''}`, value: e.id }))
})
const statusItems = (Object.keys(STATUS_LABELS) as VacationStatus[]).map(value => ({ label: STATUS_LABELS[value], value }))

async function submit() {
  if (!form.employeeId) return toast.add({ title: 'Выберите сотрудника', color: 'error' })
  if (!form.startDate || !form.endDate) return toast.add({ title: 'Укажите даты начала и окончания', color: 'error' })
  if (form.endDate < form.startDate) return toast.add({ title: 'Дата окончания раньше даты начала', color: 'error' })

  saving.value = true
  try {
    const url = props.vacation ? `/api/vacations/${props.vacation.id}` : '/api/vacations'
    await $fetch(url, { method: props.vacation ? 'PUT' : 'POST', body: { ...form } })
    toast.add({ title: props.vacation ? 'Отпуск обновлён' : 'Отпуск добавлен', color: 'success' })
    open.value = false
    emit('saved')
  } catch (e) {
    toast.add({ title: 'Не удалось сохранить', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="vacation ? 'Редактирование отпуска' : 'Новый период отпуска'">
    <template #body>
      <UForm :state="form" class="space-y-4" @submit="submit">
        <UFormField label="Сотрудник" required>
          <USelectMenu v-model="form.employeeId" :items="employeeItems" value-key="value" placeholder="Выберите сотрудника" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Дата начала" required>
            <UInput v-model="form.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Дата окончания" required>
            <UInput v-model="form.endDate" type="date" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Статус">
          <USelect v-model="form.status" :items="statusItems" class="w-full" />
        </UFormField>
        <UFormField label="Примечание">
          <UTextarea v-model="form.note" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="open = false">Отмена</UButton>
          <UButton type="submit" :loading="saving">Сохранить</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
