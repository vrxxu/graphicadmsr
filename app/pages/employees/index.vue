<script setup lang="ts">
import type { Employee } from '#shared/types'

const router = useRouter()
const toast = useToast()
const { employees, departments, tree, vacationsByEmployee, refresh } = useSchedule()

const search = ref('')
const deptFilter = ref<number | null>(null)

const deptItems = computed(() => [
  { label: 'Все подразделения', value: 0 },
  ...flatten(tree.value).map(n => ({ label: `${'— '.repeat(n.depth)}${n.name}`, value: n.id }))
])
const deptModel = computed({
  get: () => deptFilter.value ?? 0,
  set: (v: number) => { deptFilter.value = v || null }
})

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const ids = deptFilter.value !== null
    ? new Set(subtreeIds(findNode(tree.value, deptFilter.value)!))
    : null
  return employees.value
    .filter(e => (!ids || ids.has(e.departmentId)) && (!q || e.fullName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q)))
    .map(e => ({
      ...e,
      department: departments.value.find(d => d.id === e.departmentId)?.name ?? '—',
      vacationsCount: vacationsByEmployee.value.get(e.id)?.length ?? 0
    }))
})

const columns = [
  { accessorKey: 'fullName', header: 'ФИО' },
  { accessorKey: 'position', header: 'Должность' },
  { accessorKey: 'department', header: 'Подразделение' },
  { accessorKey: 'vacationsCount', header: 'Отпусков' },
  { id: 'actions', header: '' }
]

const formOpen = ref(false)
const editing = ref<Employee | null>(null)
function openForm(e: Employee | null) {
  editing.value = e
  formOpen.value = true
}

const confirmOpen = ref(false)
const toDelete = ref<Employee | null>(null)
async function doDelete() {
  if (!toDelete.value) return
  try {
    await $fetch(`/api/employees/${toDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Сотрудник удалён', color: 'success' })
    confirmOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Не удалось удалить', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <h1 class="text-xl font-semibold mr-auto">Сотрудники</h1>
      <UInput v-model="search" icon="i-lucide-search" placeholder="Поиск по ФИО или должности" class="w-72" />
      <USelectMenu v-model="deptModel" :items="deptItems" value-key="value" class="w-80" />
      <UButton class="fx-rot90" icon="i-lucide-plus" @click="openForm(null)">Добавить</UButton>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable :data="rows" :columns="columns" class="max-h-[70vh]" @select="(_e: Event, row: any) => router.push(`/employees/${row.original.id}`)">
        <template #fullName-cell="{ row }">
          <NuxtLink :to="`/employees/${row.original.id}`" class="font-medium text-primary hover:underline" @click.stop>
            {{ row.original.fullName }}
          </NuxtLink>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1" @click.stop>
            <UButton class="fx-wiggle" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(row.original)" />
            <UButton class="fx-shake" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="toDelete = row.original; confirmOpen = true" />
          </div>
        </template>
        <template #empty>
          <div class="py-8 text-center text-muted">Сотрудники не найдены</div>
        </template>
      </UTable>
    </UCard>

    <EmployeeFormModal v-model:open="formOpen" :employee="editing" @saved="refresh()" />

    <UModal v-model:open="confirmOpen" title="Удалить сотрудника?" :description="toDelete?.fullName">
      <template #body>
        <p class="text-sm text-muted">Вместе с сотрудником будут удалены все его периоды отпусков.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="confirmOpen = false">Отмена</UButton>
          <UButton color="error" @click="doDelete">Удалить</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
