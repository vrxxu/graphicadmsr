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

const counts = computed(() => ({
  total: rows.value.length,
  approved: rows.value.filter(r => r.status === 'approved').length,
  planned: rows.value.filter(r => r.status === 'planned').length,
  moved: rows.value.filter(r => r.status === 'moved').length
}))

function resetFilters() {
  search.value = ''
  year.value = Number(todayIso().slice(0, 4))
  statusFilter.value = 'all'
}

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

onMounted(() => {
  if (route.query.new) {
    openForm(null)
    router.replace({ query: {} })
  }
})

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
    <!-- заголовок -->
    <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold truncate">Управление отпусками</h1>
        <p class="text-sm text-muted truncate">Периоды отпусков всех сотрудников</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton icon="i-lucide-plus" @click="openForm(null)">Добавить отпуск</UButton>
      </div>
    </div>

    <!-- панель фильтров -->
    <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-default bg-default p-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Поиск по фамилии" class="w-full sm:w-56" />
      <USelect v-model="year" :items="yearItems" class="w-36" />
      <UTabs v-model="statusFilter" :items="statusItems" :content="false" size="sm" color="primary" variant="pill" class="w-auto" />
      <UButton class="ml-auto" icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" @click="resetFilters">Сбросить</UButton>
    </div>

    <!-- сводка -->
    <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="text-xs text-muted">Всего периодов</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ counts.total }}</div>
      </div>
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full" :class="STATUS_COLORS.approved.dot" />Утверждены</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ counts.approved }}</div>
      </div>
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full" :class="STATUS_COLORS.planned.dot" />Запланированы</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ counts.planned }}</div>
      </div>
      <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
        <div class="flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full" :class="STATUS_COLORS.moved.dot" />Перенесены</div>
        <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ counts.moved }}</div>
      </div>
    </div>

    <section class="overflow-hidden rounded-2xl border border-default bg-default">
      <UTable :data="rows" :columns="columns" :loading="loadStatus === 'pending'" :ui="{ tr: 'group' }" class="max-h-[72vh]">
        <template #fullName-cell="{ row }">
          <NuxtLink :to="`/employees/${row.original.employeeId}`" class="flex items-center gap-3 font-medium hover:text-primary">
            <PersonAvatar :name="row.original.fullName" />
            {{ row.original.fullName }}
          </NuxtLink>
        </template>
        <template #department-cell="{ row }"><span class="text-muted">{{ row.original.department }}</span></template>
        <template #startDate-cell="{ row }"><span class="tabular-nums">{{ formatDate(row.original.startDate) }}</span></template>
        <template #endDate-cell="{ row }"><span class="tabular-nums">{{ formatDate(row.original.endDate) }}</span></template>
        <template #days-cell="{ row }"><span class="tabular-nums text-muted">{{ row.original.days }}</span></template>
        <template #status-cell="{ row }">
          <UBadge :color="STATUS_COLORS[row.original.status as VacationStatus].badge" variant="subtle">
            {{ STATUS_LABELS[row.original.status as VacationStatus] }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Изменить" @click="openForm(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Удалить" @click="remove(row.original)" />
          </div>
        </template>
        <template #empty>
          <div class="py-10 text-center text-sm text-muted">Отпуска не найдены</div>
        </template>
      </UTable>
    </section>

    <VacationFormModal v-model:open="formOpen" :vacation="editing" @saved="refresh()" />
  </div>
</template>
