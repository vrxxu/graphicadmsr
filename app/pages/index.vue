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
  { label: 'Все', value: 'all' },
  { label: 'С отпуском', value: 'with' },
  { label: 'Без отпуска', value: 'without' },
  { label: 'В отпуске на дату', value: 'onDate' }
]

function resetFilters() {
  search.value = ''
  vacFilter.value = 'all'
  month.value = -1
  filterDate.value = today
  selectedId.value = null
}

// ---------- подразделения ----------
const deptSearch = ref('')

// левая колонка: простые кнопки; ветка раскрывается только вдоль выбранного пути
const deptButtons = computed(() => {
  const q = deptSearch.value.trim().toLowerCase()
  if (q) {
    return flatten(tree.value).filter(n => n.name.toLowerCase().includes(q)).map(node => ({ node, indent: 0 }))
  }
  const root = tree.value[0]
  if (!root) return []
  const path = new Set<number>()
  let cur: number | null = activeId.value
  while (cur !== null) {
    path.add(cur)
    cur = deptById.value.get(cur)?.parentId ?? null
  }
  const out: { node: DeptNode, indent: number }[] = []
  const walk = (n: DeptNode, depth: number) => {
    for (const c of n.children) {
      out.push({ node: c, indent: depth })
      if (path.has(c.id)) walk(c, depth + 1)
    }
  }
  walk(root, 0)
  return out
})
const showMore = ref(false)
const overlapsOpen = ref(false)

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

// ---------- пересечения: отображение ----------
const showAllOverlaps = ref(false)
const warnCount = computed(() => allOverlaps.value.filter(o => o.warning).length)
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
  <div class="space-y-4">
    <div v-if="status === 'pending' && !employees.length" class="py-24 text-center text-muted">Загрузка данных…</div>

    <template v-else>
      <!-- заголовок -->
      <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ activeNode?.name }}</h1>
          <p class="text-sm text-muted truncate">{{ breadcrumb }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <UButton icon="i-lucide-plus" to="/vacations?new=1">Добавить отпуск</UButton>
        </div>
      </div>

      <!-- панель фильтров -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-default bg-default p-2">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Поиск по фамилии" class="w-full sm:w-56" />

        <div class="flex items-center rounded-lg border border-default">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" aria-label="Предыдущий год" @click="year--" />
          <span class="w-12 text-center text-sm font-medium tabular-nums">{{ year }}</span>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" aria-label="Следующий год" @click="year++" />
        </div>

        <USelect v-model="month" :items="monthItems" class="w-36" />

        <UTabs v-model="vacFilter" :items="vacFilterItems" :content="false" size="sm" color="primary" variant="pill" class="w-auto" />

        <UInput v-model="filterDate" type="date" class="w-40" title="Дата для сводки и фильтра «в отпуске на дату»" />

        <UButton class="ml-auto" icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" @click="resetFilters">Сбросить</UButton>
      </div>

      <!-- сводка -->
      <div class="flex flex-wrap items-center gap-x-8 gap-y-2 px-1">
        <div class="flex items-baseline gap-2"><span class="text-2xl font-semibold tabular-nums">{{ summary.total }}</span><span class="text-sm text-muted">сотрудников</span></div>
        <div class="flex items-baseline gap-2"><span class="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-500">{{ summary.onVacation }}</span><span class="text-sm text-muted">в отпуске {{ filterDate ? formatDate(filterDate).slice(0, 5) : '' }}</span></div>
        <div class="flex items-baseline gap-2"><span class="text-2xl font-semibold tabular-nums text-primary">{{ summary.notOnVacation }}</span><span class="text-sm text-muted">на работе</span></div>
        <template v-if="showMore">
          <div class="flex items-baseline gap-2"><span class="text-2xl font-semibold tabular-nums">{{ summary.withoutYear }}</span><span class="text-sm text-muted">без отпуска в {{ year }}</span></div>
          <div class="flex items-baseline gap-2"><span class="text-2xl font-semibold tabular-nums">{{ summary.maxSimultaneous }}</span><span class="text-sm text-muted">пик одновременно</span></div>
        </template>
        <UButton size="xs" color="neutral" variant="link" @click="showMore = !showMore">{{ showMore ? 'Меньше' : 'Ещё' }}</UButton>
      </div>

      <div class="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] items-start">
        <!-- подразделения -->
        <aside class="space-y-1.5 lg:sticky lg:top-4">
          <UInput v-model="deptSearch" icon="i-lucide-search" placeholder="Найти подразделение" class="w-full">
            <template v-if="deptSearch" #trailing>
              <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" aria-label="Очистить" @click="deptSearch = ''" />
            </template>
          </UInput>
          <div class="max-h-[70vh] space-y-0.5 overflow-auto">
            <UButton
              block
              class="justify-start"
              icon="i-lucide-building-2"
              :color="activeId === rootId ? 'primary' : 'neutral'"
              :variant="activeId === rootId ? 'soft' : 'ghost'"
              @click="selectedId = null; deptSearch = ''"
            >
              Вся администрация
            </UButton>
            <UButton
              v-for="b in deptButtons"
              :key="b.node.id"
              block
              class="h-auto justify-start whitespace-normal py-1.5 text-left"
              :style="{ marginLeft: `${b.indent * 14}px`, width: `calc(100% - ${b.indent * 14}px)` }"
              :color="activeId === b.node.id ? 'primary' : 'neutral'"
              :variant="activeId === b.node.id ? 'soft' : 'ghost'"
              @click="selectedId = b.node.id"
            >
              {{ b.node.name }}
            </UButton>
            <p v-if="!deptButtons.length" class="px-2 py-6 text-center text-sm text-muted">Ничего не найдено</p>
          </div>
        </aside>

        <div class="space-y-4 min-w-0">
          <!-- диаграмма -->
          <div>
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevrons-down-up" @click="setAllCollapsed(true)">Свернуть</UButton>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevrons-up-down" @click="setAllCollapsed(false)">Развернуть</UButton>
              <div class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-emerald-600" />Утверждён</span>
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-amber-600" />Запланирован</span>
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-500" />Перенесён</span>
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-400/40" />Выходные</span>
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-red-500/30" />Праздники</span>
                <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 bg-red-500" />Сегодня</span>
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
          <section class="rounded-xl border border-default bg-default">
            <button type="button" class="flex w-full items-center gap-2.5 px-4 py-3 text-left" @click="overlapsOpen = !overlapsOpen">
              <UIcon :name="overlapsOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 text-muted" />
              <span class="text-sm font-semibold">Пересечения отпусков</span>
              <UBadge color="neutral" variant="subtle" size="sm">{{ allOverlaps.length }}</UBadge>
              <UBadge v-if="warnCount" color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert">{{ warnCount }} выше порога</UBadge>
            </button>
            <div v-if="overlapsOpen" class="flex items-center gap-2 border-t border-default px-4 py-2 text-xs text-muted">
              <span>Предупреждать, если в отпуске от</span>
              <UInputNumber v-model="threshold" :min="10" :max="100" :step="5" size="sm" class="w-28" />
              <span>% подразделения</span>
            </div>

            <div v-if="overlapsOpen && !allOverlaps.length" class="border-t border-default py-10 text-center text-sm text-muted">Пересечений нет</div>
            <ul v-else-if="overlapsOpen" class="divide-y divide-default border-t border-default">
              <li
                v-for="(o, i) in overlapView"
                :key="`${o.departmentId}-${o.start}-${i}`"
                class="relative flex flex-wrap items-center gap-x-5 gap-y-1 py-3 pl-5 pr-4"
              >
                <span class="absolute inset-y-2 left-2 w-0.5 rounded-full" :class="o.warning ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'" />
                <div class="w-44 shrink-0">
                  <div class="text-sm font-medium tabular-nums">{{ formatRange(o.start, o.end) }}</div>
                  <div class="text-xs text-muted truncate" :title="deptById.get(o.departmentId)?.name">{{ deptById.get(o.departmentId)?.name }}</div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div v-if="o.total <= 24" class="flex gap-0.5" :title="`${o.count} из ${o.total} в отпуске`">
                    <span v-for="k in o.total" :key="k" class="size-2 rounded-full" :class="k <= o.count ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'" />
                  </div>
                  <span class="text-sm tabular-nums"><b>{{ o.count }}</b> из {{ o.total }}</span>
                  <UBadge v-if="o.warning" color="warning" variant="subtle" size="sm">Выше порога</UBadge>
                </div>
                <div class="min-w-0 flex-1 basis-64 text-sm text-muted">{{ o.employeeIds.map(shortName).join(', ') }}</div>
              </li>
            </ul>
            <div v-if="overlapsOpen && allOverlaps.length > 12" class="border-t border-default px-4 py-2">
              <UButton size="sm" variant="link" color="neutral" @click="showAllOverlaps = !showAllOverlaps">
                {{ showAllOverlaps ? 'Показать меньше' : `Показать все (${allOverlaps.length})` }}
              </UButton>
            </div>
          </section>
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
            <dd class="tabular-nums">{{ formatRange(details.vacation.startDate, details.vacation.endDate) }}</dd>
            <dt class="text-muted">Длительность</dt>
            <dd>{{ detailsDays }} {{ plural(detailsDays, ['день', 'дня', 'дней']) }}</dd>
            <dt class="text-muted">Статус</dt>
            <dd><UBadge :color="STATUS_COLORS[details.vacation.status].badge" variant="subtle">{{ STATUS_LABELS[details.vacation.status] }}</UBadge></dd>
            <dt class="text-muted">Примечание</dt>
            <dd>{{ details.vacation.note || '—' }}</dd>
            <dt class="text-muted">Одновременно в отпуске</dt>
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
          <UButton :to="`/vacations?edit=${details.vacation.id}`" icon="i-lucide-pencil">Редактировать</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
