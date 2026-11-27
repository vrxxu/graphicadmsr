<script setup lang="ts">
import type { Employee } from '#shared/types'

const router = useRouter()
const toast = useToast()
const { employees, departments, tree, vacationsByEmployee, refresh } = useSchedule()

const search = ref('')
const deptFilter = ref<number | null>(null)

function resetFilters() {
  search.value = ''
  deptFilter.value = null
}

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
  { accessorKey: 'tabNumber', header: 'Таб. №' },
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
    <!-- заголовок -->
    <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold truncate">Сотрудники</h1>
        <p class="text-sm text-muted truncate">Показано {{ rows.length }} из {{ employees.length }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton icon="i-lucide-plus" @click="openForm(null)">Добавить сотрудника</UButton>
      </div>
    </div>

    <!-- панель фильтров -->
    <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-default bg-default p-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Поиск по ФИО или должности" class="w-full sm:w-72" />
      <USelectMenu v-model="deptModel" :items="deptItems" value-key="value" class="w-full sm:w-80" />
      <UButton class="ml-auto" icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" @click="resetFilters">Сбросить</UButton>
    </div>

    <section class="overflow-hidden rounded-2xl border border-default bg-default">
      <UTable :data="rows" :columns="columns" :ui="{ tr: 'group cursor-pointer' }" class="max-h-[70vh]" @select="(_e: Event, row: any) => router.push(`/employees/${row.original.id}`)">
        <template #fullName-cell="{ row }">
          <NuxtLink :to="`/employees/${row.original.id}`" class="flex items-center gap-3 font-medium hover:text-primary" @click.stop>
            <PersonAvatar :name="row.original.fullName" />
            {{ row.original.fullName }}
          </NuxtLink>
        </template>
        <template #tabNumber-cell="{ row }"><span class="tabular-nums text-muted">{{ row.original.tabNumber || '—' }}</span></template>
        <template #position-cell="{ row }"><span class="text-muted">{{ row.original.position }}</span></template>
        <template #department-cell="{ row }"><span class="text-muted">{{ row.original.department }}</span></template>
        <template #vacationsCount-cell="{ row }">
          <span
            class="inline-grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
            :class="row.original.vacationsCount ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-500/10 text-muted'"
          >{{ row.original.vacationsCount }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100" @click.stop>
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="toDelete = row.original; confirmOpen = true" />
          </div>
        </template>
        <template #empty>
          <div class="py-10 text-center text-sm text-muted">Сотрудники не найдены</div>
        </template>
      </UTable>
    </section>

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
