<script setup lang="ts">
import type { Employee, Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'
import type { GanttRow } from '~/components/GanttChart.vue'

const router = useRouter()
const { departments, employees, vacations, tree, deptById, vacationsByEmployee, status } = useSchedule()
const threshold = useThreshold()

// ---------- состояние фильтров ----------
const today = todayIso()
const rootId = computed(() => tree.value[0]?.id ?? null)
const selectedId = ref<number | null>(null)
const activeId = computed(() => selectedId.value ?? rootId.value)

const year = ref(Number(today.slice(0, 4)))
const month = ref(-1) // -1 — весь год
const search = ref('')
const vacFilter = ref<'all' | 'with' | 'without' | 'onDate'>('all')
const filterDate = ref(today)
const collapsed = ref(new Set<number>())

const monthItems = [
  { label: 'Весь год', value: -1 },
  ...MONTHS_NOM.map((label, value) => ({ label, value }))
]
const vacFilterItems = [
  { label: 'Все сотрудники', value: 'all' },
  { label: 'С запланированными отпусками', value: 'with' },
  { label: 'Без запланированных отпусков', value: 'without' },
  { label: 'В отпуске на выбранную дату', value: 'onDate' }
]

function resetFilters() {
  search.value = ''
  vacFilter.value = 'all'
  month.value = -1
  filterDate.value = today
  selectedId.value = null
}

// ---------- дерево подразделений ----------
interface TreeItem { label: string, value: string, defaultExpanded?: boolean, children?: TreeItem[] }
function toItems(nodes: DeptNode[]): TreeItem[] {
  return nodes.map(n => ({
    label: n.name,
    value: String(n.id),
    defaultExpanded: n.depth < 2,
    children: n.children.length ? toItems(n.children) : undefined
  }))
}
const treeItems = computed(() => toItems(tree.value))
function findItem(items: TreeItem[], value: string): TreeItem | undefined {
  for (const i of items) {
    if (i.value === value) return i
    const f = i.children ? findItem(i.children, value) : undefined
    if (f) return f
  }
}
const treeModel = computed({
  get: () => (activeId.value !== null ? findItem(treeItems.value, String(activeId.value)) : undefined),
  set: (item: TreeItem | undefined) => {
    if (item) selectedId.value = Number(item.value)
  }
})

const activeNode = computed(() => (activeId.value !== null ? findNode(tree.value, activeId.value) : null))
const scopeIds = computed(() => new Set(activeNode.value ? subtreeIds(activeNode.value) : []))
const scopeEmployees = computed(() => employees.value.filter(e => scopeIds.value.has(e.departmentId)))

// ---------- границы периодов ----------
const yearFrom = computed(() => dayNum(`${year.value}-01-01`))
const yearTo = computed(() => dayNum(`${year.value}-12-31`))
const periodFrom = computed(() => (month.value < 0 ? yearFrom.value : monthStartDayNum(year.value, month.value)))
const periodTo = computed(() =>
  month.value < 0 ? yearTo.value : periodFrom.value + daysInMonth(year.value, month.value) - 1
)
const filterDay = computed(() => (filterDate.value ? dayNum(filterDate.value) : null))

function hasVacationIn(empId: number, from: number, to: number) {
  return (vacationsByEmployee.value.get(empId) ?? []).some(v => dayNum(v.startDate) <= to && dayNum(v.endDate) >= from)
}

// ---------- отфильтрованные сотрудники (все фильтры работают совместно) ----------
const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  return scopeEmployees.value.filter((e) => {
    if (q && !e.fullName.toLowerCase().includes(q)) return false
    switch (vacFilter.value) {
      case 'with': return hasVacationIn(e.id, periodFrom.value, periodTo.value)
      case 'without': return !hasVacationIn(e.id, periodFrom.value, periodTo.value)
      case 'onDate': return filterDay.value !== null && hasVacationIn(e.id, filterDay.value, filterDay.value)
      default: return true
    }
  })
})

// ---------- пересечения ----------
const allOverlaps = computed(() => {
  if (!activeNode.value) return []
  return flatten([activeNode.value]).flatMap(n =>
    overlapsForDepartment(n, employees.value, vacations.value, yearFrom.value, yearTo.value, threshold.value)
  )
})
const warningDepts = computed(() => new Set(allOverlaps.value.filter(o => o.warning).map(o => o.departmentId)))

// ---------- строки диаграммы ----------
const rows = computed<GanttRow[]>(() => {
  if (!activeNode.value) return []
  const byDept = new Map<number, Employee[]>()
  for (const e of filteredEmployees.value) {
    const list = byDept.get(e.departmentId)
    if (list) list.push(e)
    else byDept.set(e.departmentId, [e])
  }

  const walk = (node: DeptNode, depth: number): { rows: GanttRow[], count: number } => {
    const own = byDept.get(node.id) ?? []
    const isCollapsed = collapsed.value.has(node.id)
    const childResults = node.children.map(c => walk(c, depth + 1))
    const count = own.length + childResults.reduce((s, c) => s + c.count, 0)
    if (count === 0) return { rows: [], count: 0 }

    const out: GanttRow[] = [{
      type: 'group', id: node.id, name: node.name, depth, count, collapsed: isCollapsed,
      warning: warningDepts.value.has(node.id)
    }]
    if (!isCollapsed) {
      for (const e of own) {
        out.push({ type: 'emp', employee: e, depth, vacations: vacationsByEmployee.value.get(e.id) ?? [] })
      }
      for (const c of childResults) out.push(...c.rows)
    }
    return { rows: out, count }
  }
  return walk(activeNode.value, 0).rows
})

function toggleGroup(id: number) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}
function setAllCollapsed(value: boolean) {
  collapsed.value = value && activeNode.value
    ? new Set(flatten([activeNode.value]).map(n => n.id))
    : new Set()
}

// ---------- сводка ----------
const summary = computed(() => {
  const list = scopeEmployees.value
  const ids = new Set(list.map(e => e.id))
  const onVacation = filterDay.value === null
    ? 0
    : list.filter(e => hasVacationIn(e.id, filterDay.value!, filterDay.value!)).length
  const withoutYear = list.filter(e => !hasVacationIn(e.id, yearFrom.value, yearTo.value)).length
  return {
    total: list.length,
    onVacation,
    notOnVacation: list.length - onVacation,
    withoutYear,
    maxSimultaneous: maxSimultaneous(ids, vacations.value, yearFrom.value, yearTo.value)
  }
})

const kpis = computed(() => [
  { label: 'Всего сотрудников', value: summary.value.total, icon: 'i-lucide-users', tone: '' },
  { label: `В отпуске на ${filterDate.value ? formatDate(filterDate.value) : '—'}`, value: summary.value.onVacation, icon: 'i-lucide-plane', tone: 'gold' },
  { label: 'Не в отпуске', value: summary.value.notOnVacation, icon: 'i-lucide-briefcase', tone: 'green' },
  { label: `Без отпусков в ${year.value} г.`, value: summary.value.withoutYear, icon: 'i-lucide-calendar-x', tone: '' },
  { label: 'Макс. одновременно в отпуске', value: summary.value.maxSimultaneous, icon: 'i-lucide-flame', tone: 'accent' }
])

// ---------- пересечения: отображение ----------
const showAllOverlaps = ref(false)
const overlapView = computed(() => {
  const sorted = [...allOverlaps.value].sort((a, b) =>
    Number(b.warning) - Number(a.warning) || b.count - a.count || a.start.localeCompare(b.start)
  )
  return showAllOverlaps.value ? sorted : sorted.slice(0, 12)
})
const employeeMap = computed(() => new Map(employees.value.map(e => [e.id, e])))
function shortName(id: number) {
  const e = employeeMap.value.get(id)
  if (!e) return '—'
  const [last, first, patr] = e.fullName.split(' ')
  return `${last} ${first?.[0] ?? ''}.${patr?.[0] ?? ''}.`
}

// ---------- карточка отпуска ----------
const detailsOpen = ref(false)
const details = ref<{ vacation: Vacation, employee: Employee } | null>(null)
function openDetails(payload: { vacation: Vacation, employee: Employee }) {
  details.value = payload
  detailsOpen.value = true
}
const detailsDays = computed(() => (details.value ? daysInclusive(details.value.vacation.startDate, details.value.vacation.endDate) : 0))
const coworkersOnVacation = computed(() => {
  const d = details.value
  if (!d) return []
  const s = dayNum(d.vacation.startDate)
  const e = dayNum(d.vacation.endDate)
  return employees.value.filter(x =>
    x.id !== d.employee.id && x.departmentId === d.employee.departmentId && hasVacationIn(x.id, s, e)
  )
})

const breadcrumb = computed(() => (activeId.value !== null ? pathOf(departments.value, activeId.value) : ''))
</script>

<template>
  <div class="space-y-5">
    <div v-if="status === 'pending' && !employees.length" class="py-20 text-center text-muted">Загрузка данных…</div>

    <template v-else>
      <!-- фильтры -->
      <UCard :ui="{ body: 'p-3 sm:p-4' }">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 items-end">
          <UFormField label="Поиск по фамилии" class="xl:col-span-1">
            <UInput v-model="search" icon="i-lucide-search" placeholder="Например, Орлова" class="w-full" />
          </UFormField>

          <UFormField label="Год">
            <div class="flex items-center gap-1">
              <UButton class="fx-nudge-l" icon="i-lucide-chevron-left" color="neutral" variant="outline" aria-label="Предыдущий год" @click="year--" />
              <UInput v-model.number="year" type="number" min="2000" max="2100" class="w-24" :ui="{ base: 'text-center' }" />
              <UButton class="fx-nudge-r" icon="i-lucide-chevron-right" color="neutral" variant="outline" aria-label="Следующий год" @click="year++" />
            </div>
          </UFormField>

          <UFormField label="Период">
            <USelect v-model="month" :items="monthItems" class="w-full" />
          </UFormField>

          <UFormField label="Показать">
            <USelect v-model="vacFilter" :items="vacFilterItems" class="w-full" />
          </UFormField>

          <UFormField label="Выбранная дата" description="Для «в отпуске на дату» и сводки">
            <UInput v-model="filterDate" type="date" class="w-full" />
          </UFormField>

          <div class="flex gap-2">
            <UButton class="fx-spin" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetFilters">Сбросить</UButton>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 lg:grid-cols-[18rem_1fr] items-start">
        <!-- дерево -->
        <UCard :ui="{ body: 'p-2 sm:p-3' }" class="lg:sticky lg:top-24">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold">Структура</span>
              <UButton class="fx-pop" size="xs" color="neutral" variant="soft" icon="i-lucide-building-2" @click="selectedId = null">
                Вся администрация
              </UButton>
            </div>
          </template>
          <div class="max-h-[60vh] overflow-auto">
            <UTree v-model="treeModel" :items="treeItems" color="primary" size="sm" />
          </div>
        </UCard>

        <div class="space-y-4 min-w-0">
          <!-- сводка -->
          <div>
            <div class="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-map-pin" />
              <span class="font-medium text-highlighted">{{ breadcrumb }}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <div v-for="k in kpis" :key="k.label" class="kpi" :data-tone="k.tone">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-medium text-muted leading-snug">{{ k.label }}</span>
                  <span class="kpi-icon"><UIcon :name="k.icon" class="size-4" /></span>
                </div>
                <div class="kpi-value">{{ k.value }}</div>
              </div>
            </div>
          </div>

          <!-- диаграмма -->
          <div>
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <UButton class="fx-squeeze" size="xs" color="neutral" variant="outline" icon="i-lucide-chevrons-down-up" @click="setAllCollapsed(true)">Свернуть все</UButton>
              <UButton class="fx-stretch" size="xs" color="neutral" variant="outline" icon="i-lucide-chevrons-up-down" @click="setAllCollapsed(false)">Развернуть все</UButton>
              <div class="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted">
                <span class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-emerald-500" /> Утверждён</span>
                <span class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-amber-400" /> Запланирован</span>
                <span class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-neutral-500" /> Перенесён</span>
                <span class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-stone-300/60 dark:bg-stone-600/60" /> Выходные</span>
                <span class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-rose-500/25" /> Праздничные</span>
                <span class="flex items-center gap-1"><span class="inline-block h-3 w-px bg-orange-500" /> Сегодня</span>
              </div>
            </div>
            <GanttChart
              :rows="rows"
              :year="year"
              :month="month"
              :today="today"
              :filter-day="vacFilter === 'onDate' ? filterDay : null"
              @toggle="toggleGroup"
              @select="openDetails"
              @open-employee="(id: number) => router.push(`/employees/${id}`)"
            />
          </div>

          <!-- пересечения -->
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center gap-3">
                <div>
                  <h2 class="font-semibold">Пересечения отпусков в {{ year }} г.</h2>
                  <p class="text-xs text-muted">Одновременное отсутствие двух и более сотрудников одного подразделения</p>
                </div>
                <UFormField label="Порог предупреждения, % отсутствующих" class="ml-auto" orientation="horizontal">
                  <UInputNumber v-model="threshold" :min="10" :max="100" :step="5" class="w-32" />
                </UFormField>
              </div>
            </template>

            <div v-if="!allOverlaps.length" class="py-6 text-center text-muted">Пересечений не найдено</div>
            <ul v-else class="divide-y divide-default">
              <li v-for="(o, i) in overlapView" :key="`${o.departmentId}-${o.start}-${i}`" class="py-3 flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge v-if="o.warning" color="warning" icon="i-lucide-triangle-alert">Превышен порог</UBadge>
                  <UBadge v-else color="neutral" variant="subtle">Пересечение</UBadge>
                  <span class="font-medium">{{ formatRange(o.start, o.end) }}</span>
                  <span class="text-sm text-muted">· {{ deptById.get(o.departmentId)?.name }}</span>
                </div>
                <div class="text-sm">
                  Одновременно в отпуске: <b>{{ o.count }}</b> из {{ o.total }},
                  работает: <b>{{ o.free }}</b>
                </div>
                <div class="text-sm text-muted">{{ o.employeeIds.map(shortName).join(', ') }}</div>
              </li>
            </ul>
            <div v-if="allOverlaps.length > 12" class="pt-3">
              <UButton variant="link" color="neutral" @click="showAllOverlaps = !showAllOverlaps">
                {{ showAllOverlaps ? 'Показать меньше' : `Показать все (${allOverlaps.length})` }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </template>

    <!-- подробности отпуска -->
    <UModal v-model:open="detailsOpen" title="Отпуск сотрудника" :description="details?.employee.position">
      <template #body>
        <div v-if="details" class="space-y-3 text-sm">
          <div class="text-base font-semibold">{{ details.employee.fullName }}</div>
          <div class="text-muted">{{ pathOf(departments, details.employee.departmentId) }}</div>
          <dl class="grid grid-cols-[8rem_1fr] gap-y-2">
            <dt class="text-muted">Период</dt>
            <dd>{{ formatRange(details.vacation.startDate, details.vacation.endDate) }}</dd>
            <dt class="text-muted">Длительность</dt>
            <dd>{{ detailsDays }} {{ plural(detailsDays, ['день', 'дня', 'дней']) }}</dd>
            <dt class="text-muted">Статус</dt>
            <dd><UBadge :color="STATUS_COLORS[details.vacation.status].badge" variant="subtle">{{ STATUS_LABELS[details.vacation.status] }}</UBadge></dd>
            <dt class="text-muted">Примечание</dt>
            <dd>{{ details.vacation.note || '—' }}</dd>
            <dt class="text-muted">В отпуске в этот период</dt>
            <dd>
              <span v-if="!coworkersOnVacation.length">Коллег из отдела нет</span>
              <span v-else>{{ coworkersOnVacation.map(c => shortName(c.id)).join(', ') }}</span>
            </dd>
          </dl>
        </div>
      </template>
      <template #footer>
        <div v-if="details" class="flex gap-2 w-full justify-end">
          <UButton color="neutral" variant="outline" :to="`/employees/${details.employee.id}`">Карточка сотрудника</UButton>
          <UButton class="fx-wiggle" :to="`/vacations?edit=${details.vacation.id}`" icon="i-lucide-pencil">Редактировать</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
