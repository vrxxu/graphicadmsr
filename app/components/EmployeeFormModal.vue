<script setup lang="ts">
import type { Employee } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ employee: Employee | null }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const { departments } = useSchedule()
const toast = useToast()
const saving = ref(false)

const form = reactive({ fullName: '', position: '', departmentId: null as number | null, tabNumber: '' })

watch(open, (isOpen) => {
  if (!isOpen) return
  form.fullName = props.employee?.fullName ?? ''
  form.position = props.employee?.position ?? ''
  form.departmentId = props.employee?.departmentId ?? null
  form.tabNumber = props.employee?.tabNumber ?? ''
})

const deptItems = computed(() =>
  flatten(buildTree(departments.value)).map(n => ({
    label: `${'— '.repeat(n.depth)}${n.name}`,
    value: n.id
  }))
)

async function submit() {
  if (!form.fullName.trim() || !form.position.trim() || !form.departmentId) {
    return toast.add({ title: 'Заполните ФИО, должность и подразделение', color: 'error' })
  }
  saving.value = true
  try {
    const url = props.employee ? `/api/employees/${props.employee.id}` : '/api/employees'
    await $fetch(url, { method: props.employee ? 'PUT' : 'POST', body: { ...form } })
    toast.add({ title: props.employee ? 'Сотрудник обновлён' : 'Сотрудник добавлен', color: 'success' })
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
  <UModal v-model:open="open" :title="employee ? 'Редактирование сотрудника' : 'Новый сотрудник'" description="Вымышленные тестовые данные">
    <template #body>
      <UForm :state="form" class="space-y-4" @submit="submit">
        <UFormField label="ФИО" required>
          <UInput v-model="form.fullName" class="w-full" />
        </UFormField>
        <UFormField label="Должность" required>
          <UInput v-model="form.position" class="w-full" />
        </UFormField>
        <UFormField label="Табельный номер" description="Нужен для печатной формы графика отпусков (Т-7)">
          <UInput v-model="form.tabNumber" inputmode="numeric" class="w-full sm:w-48" />
        </UFormField>
        <UFormField label="Подразделение" required>
          <USelectMenu v-model="form.departmentId" :items="deptItems" value-key="value" placeholder="Выберите подразделение" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="open = false">Отмена</UButton>
          <UButton type="submit" :loading="saving">Сохранить</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
