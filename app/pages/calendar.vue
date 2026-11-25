<script setup lang="ts">
import type { Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const route = useRoute()
const { employees, deptById, vacationsByEmployee, conflictOverlaps, status } = useSchedule()

const savedEmployee = useCookie<number | null>('calendar-employee', { default: () => null, maxAge: 60 * 60 * 24 * 365 })
const today = todayIso()
const todayNum = dayNum(today)

const employeeId = ref<number | null>(route.query.employee ? Number(route.query.employee) : savedEmployee.value)
watch(employeeId, v => (savedEmployee.value = v))
watch(employees, (list) => {
  if (list.length && (employeeId.value === null || !list.some(e => e.id === employeeId.value))) {
    employeeId.value = list[0]!.id
  }
}, { immediate: true })

const startYear = ref(Number(today.slice(0, 4)))
const startMonth = ref(Number(today.slice(5, 7)) - 1)
const count = ref(6)

const countItems = [
  { label: '1 месяц', value: 1 },
  { label: '3 месяца', value: 3 },
  { label: '6 месяцев', value: 6 },
  { label: '12 месяцев', value: 12 }
]
const monthItems = MONTHS_NOM.map((label, value) => ({ label, value }))

const employeeItems = computed(() =>
  employees.value.map(e => ({ label: `${e.fullName} — ${e.position}`, value: e.id }))
)
const employee = computed(() => employees.value.find(e => e.id === employeeId.value) ?? null)
const myVacations = computed(() =>
  [...(vacationsByEmployee.value.get(employeeId.value ?? -1) ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate))
)

// день → отпуск
const vacationByDay = computed(() => {
  const map = new Map<number, Vacation>()
  for (const v of myVacations.value) {
    for (let n = dayNum(v.startDate); n <= dayNum(v.endDate); n++) map.set(n, v)
  }
  return map
})

// дни, в которые отпуск нарушает ограничение «нельзя одновременно»
const conflictDays = computed(() => {
  const set = new Set<number>()
  for (const c of conflictOverlaps.value) {
    if (c.employeeId !== employeeId.value && c.otherId !== employeeId.value) continue
    for (let n = c.s; n <= c.e; n++) set.add(n)
  }
  return set
})

function shift(dir: -1 | 1) {
  const idx = startYear.value * 12 + startMonth.value + dir * count.value
  startYear.value = Math.floor(idx / 12)
  startMonth.value = idx % 12
}
function goToday() {
  startYear.value = Number(today.slice(0, 4))
  startMonth.value = Number(today.slice(5, 7)) - 1
}

const shownMonths = computed(() =>
  Array.from({ length: count.value }, (_, i) => {
    const idx = startMonth.value + i
    const year = startYear.value + Math.floor(idx / 12)
    const m = idx % 12
    const first = monthStartDayNum(year, m)
    const lead = weekdayMon0(first)
    const n = daysInMonth(year, m)
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, k) => first + k)]
    while (cells.length % 7) cells.push(null)
    return { year, m, first, last: first + n - 1, cells }
  })
)
const periodFrom = computed(() => shownMonths.value[0]!.first)
const periodTo = computed(() => shownMonths.value[shownMonths.value.length - 1]!.last)

const periodLabel = computed(() => {
  const a = shownMonths.value[0]!
  const b = shownMonths.value[shownMonths.value.length - 1]!
  return a.year === b.year && a.m === b.m
    ? `${MONTHS_NOM[a.m]} ${a.year}`
    : `${MONTHS_NOM[a.m]} ${a.year} — ${MONTHS_NOM[b.m]} ${b.year}`
})

const outOfCalendar = computed(() =>
  shownMonths.value.some(m => !PROD_CALENDAR_YEARS.includes(m.year))
)

// праздничные и особые дни в показанном периоде
const specialDays = computed(() => holidaysInRange(periodFrom.value, periodTo.value))

// отпуска, попавшие в период
const vacationsInPeriod = computed(() =>
  myVacations.value.filter(v => dayNum(v.startDate) <= periodTo.value && dayNum(v.endDate) >= periodFrom.value)
)
const periodDays = computed(() =>
  vacationsInPeriod.value.reduce((s, v) => s + daysInclusive(v.startDate, v.endDate), 0)
)
function holidaysInVacation(v: Vacation) {
  return holidaysInRange(dayNum(v.startDate), dayNum(v.endDate)).filter(h => h.info.kind === 'holiday').length
}

function cellClass(n: number) {
  const v = vacationByDay.value.get(n)
  const info = dayInfo(n)
  const off = isNonWorking(n)
  const classes: string[] = []

  if (v) {
    classes.push(
      conflictDays.value.has(n)
        ? 'bg-[repeating-linear-gradient(-45deg,#dc2626_0_3px,#b91c1c_3px_6px)]'
        : STATUS_COLORS[v.status].bar,
      'text-white'
    )
    // нерабочие дни внутри отпуска — приглушены
    if (off) classes.push('opacity-60')
  } else if (info?.kind === 'holiday' || info?.kind === 'dayoff') {
    classes.push('bg-rose-500/25 text-rose-700 dark:bg-rose-400/30 dark:text-rose-200 font-semibold')
  } else if (off) {
    classes.push('bg-zinc-500/10 text-rose-600 dark:text-rose-300')
  }
  if (info?.kind === 'short') classes.push('underline decoration-dotted underline-offset-2')
  if (n === todayNum) classes.push('ring-2 ring-emerald-500 ring-inset font-bold')
  return classes
}

function cellTitle(n: number) {
  const parts: string[] = [formatDate(isoFromDayNum(n))]
  const info = dayInfo(n)
  if (info) parts.push(info.label)
  else if (isWeekend(n)) parts.push('Выходной день')
  const v = vacationByDay.value.get(n)
  if (v) parts.push(`Отпуск: ${formatRange(v.startDate, v.endDate)} (${STATUS_LABELS[v.status]})`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="space-y-4">
    <!-- заголовок -->
    <div class="flex flex-wrap items-end gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold truncate">Мой календарь</h1>
        <p class="text-sm text-muted truncate">Отпуска сотрудника по месяцам</p>
      </div>
    </div>

    <!-- панель фильтров -->
    <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-default bg-default p-2">
      <USelectMenu v-model="employeeId" :items="employeeItems" value-key="value" placeholder="Выберите сотрудника" class="w-full sm:w-96" />
      <USelect v-model="startMonth" :items="monthItems" class="w-36" aria-label="Месяц начала" />
      <UInput v-model.number="startYear" type="number" min="2000" max="2100" class="w-24" aria-label="Год начала" />
      <USelect v-model="count" :items="countItems" class="w-36" aria-label="Сколько месяцев показать" />

      <div class="flex items-center rounded-lg border border-default">
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" aria-label="Назад" @click="shift(-1)" />
        <UButton color="neutral" variant="ghost" size="sm" @click="goToday">Сегодня</UButton>
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" aria-label="Вперёд" @click="shift(1)" />
      </div>
    </div>

    <div v-if="status === 'pending' && !employees.length" class="py-24 text-center text-muted">Загрузка данных…</div>

    <template v-else-if="employee">
      <!-- сотрудник -->
      <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-default bg-default px-4 py-3">
        <PersonAvatar :name="employee.fullName" />
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">{{ employee.fullName }}</div>
          <div class="truncate text-xs text-muted">{{ employee.position }}, {{ deptById.get(employee.departmentId)?.name }}</div>
        </div>
        <span class="ml-auto text-sm font-medium tabular-nums">{{ periodLabel }}</span>
      </div>

      <!-- сводка -->
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Всего периодов</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ myVacations.length }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Отпусков в периоде</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ vacationsInPeriod.length }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Дней в этих отпусках</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ periodDays }}</div>
        </div>
        <div class="rounded-xl border border-default bg-default px-3.5 py-2.5">
          <div class="text-xs text-muted">Особых дней в периоде</div>
          <div class="mt-0.5 text-xl font-semibold tabular-nums">{{ specialDays.length }}</div>
        </div>
      </div>

      <UAlert
        v-if="outOfCalendar"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="Производственный календарь заполнен на 2026–2027 годы"
        description="Для остальных лет нерабочими отмечены только суббота и воскресенье."
      />

      <!-- легенда (как на главной) -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="h-3 w-5 rounded-[4px]" :class="STATUS_COLORS.approved.pill" />Утверждён</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-5 rounded-[4px]" :class="STATUS_COLORS.planned.pill" />Запланирован</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-5 rounded-[4px]" :class="STATUS_COLORS.moved.pill" />Перенесён</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background: repeating-linear-gradient(-45deg, #dc2626 0 3px, #b91c1c 3px 6px)" />Нельзя одновременно</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-400/40" />Выходные</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-rose-500/40" />Праздники</span>
        <span class="flex items-center gap-1.5"><span class="underline decoration-dotted">12</span>Сокращённый день</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm ring-2 ring-inset ring-emerald-500" />Сегодня</span>
      </div>

      <!-- месяцы -->
      <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <div
          v-for="mo in shownMonths"
          :key="`${mo.year}-${mo.m}`"
          class="overflow-hidden rounded-2xl border border-default bg-default"
        >
          <div class="border-b border-default px-4 py-2.5 text-sm font-semibold">
            {{ MONTHS_NOM[mo.m] }} {{ mo.year }}
          </div>
          <div class="grid grid-cols-7 border-b border-default bg-elevated/40 text-center text-[11px] font-medium text-muted">
            <div v-for="(w, i) in WEEKDAYS_SHORT" :key="w" class="py-1.5" :class="i >= 5 ? 'text-rose-600 dark:text-rose-300' : ''">{{ w }}</div>
          </div>
          <div class="grid grid-cols-7">
            <template v-for="(n, i) in mo.cells" :key="i">
              <div v-if="n === null" class="h-9 border-b border-r border-default/60" />
              <div
                v-else
                class="flex h-9 cursor-default items-center justify-center border-b border-r border-default/60 text-[13px] tabular-nums"
                :class="cellClass(n)"
                :title="cellTitle(n)"
              >
                {{ n - mo.first + 1 }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <section class="overflow-hidden rounded-2xl border border-default bg-default">
          <div class="border-b border-default px-4 py-3">
            <h2 class="text-sm font-semibold">Отпуска в этом периоде</h2>
          </div>
          <p v-if="!vacationsInPeriod.length" class="px-4 py-8 text-center text-sm text-muted">В показанном периоде отпусков нет.</p>
          <ul v-else class="divide-y divide-default">
            <li v-for="v in vacationsInPeriod" :key="v.id" class="space-y-0.5 px-4 py-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium tabular-nums">{{ formatRange(v.startDate, v.endDate) }}</span>
                <UBadge :color="STATUS_COLORS[v.status].badge" variant="subtle" size="sm">{{ STATUS_LABELS[v.status] }}</UBadge>
              </div>
              <div class="text-xs text-muted">
                Календарных дней: {{ daysInclusive(v.startDate, v.endDate) }}
                <template v-if="holidaysInVacation(v)">
                  · праздничных нерабочих дней внутри: {{ holidaysInVacation(v) }}
                </template>
              </div>
            </li>
          </ul>
          <p class="border-t border-default px-4 py-2.5 text-xs text-muted">
            Праздничные нерабочие дни, попадающие в период отпуска, обычно не засчитываются в число дней отпуска (ст. 120 ТК РФ) — уточняйте в отделе кадров.
          </p>
        </section>

        <section class="overflow-hidden rounded-2xl border border-default bg-default">
          <div class="border-b border-default px-4 py-3">
            <h2 class="text-sm font-semibold">Праздники и особые дни периода</h2>
          </div>
          <p v-if="!specialDays.length" class="px-4 py-8 text-center text-sm text-muted">Особых дней нет.</p>
          <ul v-else class="divide-y divide-default text-sm">
            <li v-for="d in specialDays" :key="d.n" class="flex gap-3 px-4 py-2">
              <span class="w-24 shrink-0 font-medium tabular-nums">{{ formatDate(isoFromDayNum(d.n)).slice(0, 5) }}, {{ WEEKDAYS_SHORT[weekdayMon0(d.n)] }}</span>
              <span :class="d.info.kind === 'short' || d.info.kind === 'workday' ? 'text-muted' : ''">{{ d.info.label }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
