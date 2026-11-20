<script setup lang="ts">
import type { Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

const route = useRoute()
const { employees, deptById, vacationsByEmployee, status } = useSchedule()

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
function holidaysInVacation(v: Vacation) {
  return holidaysInRange(dayNum(v.startDate), dayNum(v.endDate)).filter(h => h.info.kind === 'holiday').length
}

function cellClass(n: number) {
  const v = vacationByDay.value.get(n)
  const info = dayInfo(n)
  const off = isNonWorking(n)
  const classes: string[] = []

  if (v) {
    classes.push(STATUS_COLORS[v.status].bar, 'text-white')
    // нерабочие дни внутри отпуска — приглушены
    if (off) classes.push('opacity-60')
  } else if (info?.kind === 'holiday' || info?.kind === 'dayoff') {
    classes.push('bg-red-600/15 text-red-700 dark:text-red-400 font-semibold')
  } else if (off) {
    classes.push('bg-zinc-500/10 text-red-700 dark:text-red-400')
  }
  if (info?.kind === 'short') classes.push('underline decoration-dotted underline-offset-2')
  if (n === todayNum) classes.push('ring-2 ring-zinc-900 dark:ring-white ring-inset font-bold')
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
    <div class="flex flex-wrap items-end gap-3">
      <h1 class="text-xl font-semibold mr-auto">Мой календарь</h1>
    </div>

    <UCard :ui="{ body: 'p-3 sm:p-4' }">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_auto] items-end">
        <UFormField label="Сотрудник">
          <USelectMenu v-model="employeeId" :items="employeeItems" value-key="value" placeholder="Выберите сотрудника" class="w-full" />
        </UFormField>
        <UFormField label="Начало периода">
          <div class="flex gap-1">
            <USelect v-model="startMonth" :items="monthItems" class="w-36" />
            <UInput v-model.number="startYear" type="number" min="2000" max="2100" class="w-24" />
          </div>
        </UFormField>
        <UFormField label="Показать">
          <USelect v-model="count" :items="countItems" class="w-36" />
        </UFormField>
        <div class="flex gap-1 md:col-span-2 xl:col-span-1">
          <UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" aria-label="Назад" @click="shift(-1)" />
          <UButton color="neutral" variant="outline" @click="goToday">Сегодня</UButton>
          <UButton icon="i-lucide-chevron-right" color="neutral" variant="outline" aria-label="Вперёд" @click="shift(1)" />
        </div>
      </div>
    </UCard>

    <div v-if="status === 'pending' && !employees.length" class="py-16 text-center text-muted">Загрузка данных…</div>

    <template v-else-if="employee">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="text-lg font-semibold">{{ employee.fullName }}</span>
        <span class="text-muted">{{ employee.position }}, {{ deptById.get(employee.departmentId)?.name }}</span>
        <span class="ml-auto text-sm font-medium">{{ periodLabel }}</span>
      </div>

      <UAlert
        v-if="outOfCalendar"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="Производственный календарь заполнен на 2026–2027 годы"
        description="Для остальных лет нерабочими отмечены только суббота и воскресенье."
      />

      <!-- легенда -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 bg-emerald-700" /> Отпуск утверждён</span>
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 bg-amber-600" /> Отпуск запланирован</span>
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 bg-zinc-500" /> Отпуск перенесён</span>
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 bg-zinc-500/20" /> Суббота, воскресенье</span>
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 bg-red-600/25" /> Праздничный / перенесённый выходной</span>
        <span class="flex items-center gap-1.5"><span class="underline decoration-dotted">12</span> Сокращённый день</span>
        <span class="flex items-center gap-1.5"><span class="inline-block size-3.5 ring-2 ring-inset ring-zinc-900 dark:ring-white" /> Сегодня</span>
      </div>

      <!-- месяцы -->
      <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <div
          v-for="mo in shownMonths"
          :key="`${mo.year}-${mo.m}`"
          class="border border-zinc-400 dark:border-zinc-600 bg-default"
        >
          <div class="px-3 py-1.5 font-semibold bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-400 dark:border-zinc-600">
            {{ MONTHS_NOM[mo.m] }} {{ mo.year }}
          </div>
          <div class="grid grid-cols-7 text-center text-[11px] font-medium text-muted border-b border-zinc-300 dark:border-zinc-700">
            <div v-for="(w, i) in WEEKDAYS_SHORT" :key="w" class="py-1" :class="i >= 5 ? 'text-red-700 dark:text-red-400' : ''">{{ w }}</div>
          </div>
          <div class="grid grid-cols-7">
            <template v-for="(n, i) in mo.cells" :key="i">
              <div v-if="n === null" class="h-9 border-b border-r border-zinc-200 dark:border-zinc-700/60" />
              <div
                v-else
                class="h-9 border-b border-r border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-sm cursor-default"
                :class="cellClass(n)"
                :title="cellTitle(n)"
              >
                {{ n - mo.first + 1 }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <UCard>
          <template #header><h2 class="font-semibold">Отпуска в этом периоде</h2></template>
          <p v-if="!vacationsInPeriod.length" class="text-sm text-muted">В показанном периоде отпусков нет.</p>
          <ul v-else class="divide-y divide-default">
            <li v-for="v in vacationsInPeriod" :key="v.id" class="py-2.5 space-y-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ formatRange(v.startDate, v.endDate) }}</span>
                <UBadge :color="STATUS_COLORS[v.status].badge" variant="subtle">{{ STATUS_LABELS[v.status] }}</UBadge>
              </div>
              <div class="text-sm text-muted">
                Календарных дней: {{ daysInclusive(v.startDate, v.endDate) }}
                <template v-if="holidaysInVacation(v)">
                  · праздничных нерабочих дней внутри: {{ holidaysInVacation(v) }}
                </template>
              </div>
            </li>
          </ul>
          <p class="mt-3 text-xs text-muted">
            Праздничные нерабочие дни, попадающие в период отпуска, обычно не засчитываются в число дней отпуска (ст. 120 ТК РФ) — уточняйте в отделе кадров.
          </p>
        </UCard>

        <UCard>
          <template #header><h2 class="font-semibold">Праздники и особые дни периода</h2></template>
          <p v-if="!specialDays.length" class="text-sm text-muted">Особых дней нет.</p>
          <ul v-else class="divide-y divide-default text-sm">
            <li v-for="d in specialDays" :key="d.n" class="py-1.5 flex gap-3">
              <span class="w-24 shrink-0 font-medium">{{ formatDate(isoFromDayNum(d.n)).slice(0, 5) }}, {{ WEEKDAYS_SHORT[weekdayMon0(d.n)] }}</span>
              <span :class="d.info.kind === 'short' || d.info.kind === 'workday' ? 'text-muted' : ''">{{ d.info.label }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </div>
</template>
