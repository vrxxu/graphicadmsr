<script setup lang="ts">
import type { Vacation, VacationStatus } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { vacations, employeeById, deptById, refresh, status: loadStatus } = useSchedule()

const year = ref<number | 0>(Number(todayIso().slice(0, 4)))
const statusFilter = ref<VacationStatus | 'all'>('all')
const search = ref('')

const statusItems = [
  { label: 'Все статусы', value: 'all' },
  ...(Object.keys(STATUS_LABELS) as VacationStatus[]).map(value => ({ label: STATUS_LABELS[value], value }))
]
const yearItems = computed(() => {
  const set = new Set(vacations.value.flatMap(v => [Number(v.startDate.slice(0, 4)), Number(v.endDate.slice(0, 4))]))
  return [{ label: 'Все годы', value: 0 }, ...[...set].sort().map(y => ({ label: String(y), value: y }))]
})

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return vacations.value
    .map((v) => {
      const e = employeeById.value.get(v.employeeId)
      return {
        ...v,
        fullName: e?.fullName ?? '—',
        department: e ? (deptById.value.get(e.departmentId)?.name ?? '—') : '—',
        days: daysInclusive(v.startDate, v.endDate)
      }
    })
    .filter((r) => {
      if (year.value && !(r.startDate.startsWith(String(year.value)) || r.endDate.startsWith(String(year.value)))) return false
      if (statusFilter.value !== 'all' && r.status !== statusFilter.value) return false
      return !q || r.fullName.toLowerCase().includes(q)
    })
})

const columns = [
  { accessorKey: 'fullName', header: 'Сотрудник' },
  { accessorKey: 'department', header: 'Подразделение' },
  { accessorKey: 'startDate', header: 'Начало' },
  { accessorKey: 'endDate', header: 'Окончание' },
  { accessorKey: 'days', header: 'Дней' },
  { accessorKey: 'status', header: 'Статус' },
  { id: 'actions', header: '' }
]

const formOpen = ref(false)
const editing = ref<Vacation | null>(null)
function openForm(v: Vacation | null) {
  editing.value = v
  formOpen.value = true
}

// переход из диаграммы: /vacations?edit=ID
watch(
  [() => route.query.edit, vacations],
  ([edit]) => {
    if (!edit || !vacations.value.length) return
    const v = vacations.value.find(x => x.id === Number(edit))
    if (v) {
      year.value = 0
      openForm(v)
      router.replace({ query: {} })
    }
  },
  { immediate: true }
)

async function remove(v: Vacation) {
  try {
    await $fetch(`/api/vacations/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Период удалён', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Не удалось удалить', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <h1 class="text-xl font-semibold mr-auto">Управление отпусками</h1>
      <UInput v-model="search" icon="i-lucide-search" placeholder="Поиск по ФИО" class="w-64" />
      <USelect v-model="year" :items="yearItems" class="w-36" />
      <USelect v-model="statusFilter" :items="statusItems" class="w-48" />
      <UButton class="fx-rot90" icon="i-lucide-plus" @click="openForm(null)">Добавить период</UButton>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable :data="rows" :columns="columns" :loading="loadStatus === 'pending'" class="max-h-[72vh]">
        <template #startDate-cell="{ row }">{{ formatDate(row.original.startDate) }}</template>
        <template #endDate-cell="{ row }">{{ formatDate(row.original.endDate) }}</template>
        <template #status-cell="{ row }">
          <UBadge :color="STATUS_COLORS[row.original.status as VacationStatus].badge" variant="subtle">
            {{ STATUS_LABELS[row.original.status as VacationStatus] }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton class="fx-wiggle" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(row.original)" />
            <UButton class="fx-shake" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="remove(row.original)" />
          </div>
        </template>
        <template #empty>
          <div class="py-8 text-center text-muted">Отпуска не найдены</div>
        </template>
      </UTable>
    </UCard>

    <VacationFormModal v-model:open="formOpen" :vacation="editing" @saved="refresh()" />
  </div>
</template>
