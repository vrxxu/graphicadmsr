<script setup lang="ts">
import type { Employee, Vacation } from '#shared/types'
import { STATUS_LABELS } from '#shared/types'

export type GanttRow =
  | { type: 'group', id: number, name: string, depth: number, count: number, collapsed: boolean, warning: boolean }
  | { type: 'emp', employee: Employee, depth: number, vacations: Vacation[] }

const props = defineProps<{
  rows: GanttRow[]
  year: number
  /** -1 — весь год, 0..11 — один месяц */
  month: number
  today: string
  filterDay: number | null
  /** отпуск (id) → диапазоны дней, нарушающие ограничение «не может отсутствовать одновременно» */
  conflictRanges?: Map<number, { s: number, e: number }[]>
}>()

const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'select', payload: { vacation: Vacation, employee: Employee }): void
  (e: 'open-employee', id: number): void
}>()

const LEFT = 224 // ширина левой колонки, px
const ROW_H = 44
const GROUP_H = 32

const rangeStart = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-01-01`) : monthStartDayNum(props.year, props.month)
)
const totalDays = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-12-31`) - rangeStart.value + 1 : daysInMonth(props.year, props.month)
)
const rangeEnd = computed(() => rangeStart.value + totalDays.value - 1)
const dw = computed(() => (props.month < 0 ? 7 : 34)) // ширина одного дня, px
const timelineWidth = computed(() => totalDays.value * dw.value)

const months = computed(() => {
  const list: { m: number, label: string, left: number, width: number }[] = []
  const monthsToShow = props.month < 0 ? [...Array(12).keys()] : [props.month]
  for (const m of monthsToShow) {
    const s = monthStartDayNum(props.year, m)
    const n = daysInMonth(props.year, m)
    list.push({
      m,
      label: props.month < 0 ? MONTHS_SHORT[m]!.charAt(0).toUpperCase() + MONTHS_SHORT[m]!.slice(1) : `${MONTHS_NOM[m]} ${props.year}`,
      left: (s - rangeStart.value) * dw.value,
      width: n * dw.value
    })
  }
  return list
})

const days = computed(() => {
  if (props.month < 0) return []
  return Array.from({ length: totalDays.value }, (_, i) => {
    const n = rangeStart.value + i
    const info = dayInfo(n)
    return {
      n,
      num: i + 1,
      wd: WEEKDAYS_SHORT[weekdayMon0(n)]!,
      off: isNonWorking(n),
      holiday: isExtraDayOff(n),
      title: info?.label ?? ''
    }
  })
})

/** Праздничные и перенесённые выходные (не суббота/воскресенье) — подсвечиваются колонкой. */
const extraOffDays = computed(() => {
  const list: number[] = []
  for (let n = rangeStart.value; n <= rangeEnd.value; n++) if (isExtraDayOff(n)) list.push(n)
  return list
})

const todayNum = computed(() => dayNum(props.today))
const todayLeft = computed(() =>
  todayNum.value >= rangeStart.value && todayNum.value <= rangeEnd.value
    ? (todayNum.value - rangeStart.value) * dw.value + dw.value / 2
    : null
)
const filterLeft = computed(() =>
  props.filterDay !== null && props.filterDay >= rangeStart.value && props.filterDay <= rangeEnd.value
    ? (props.filterDay - rangeStart.value) * dw.value
    : null
)

// Фон строки: выходные (повторяющийся тайл в 7 дней) + линии сетки.
// В режиме месяца — линия на каждый день, в режиме года — линия в начале каждой недели.
const rowBg = computed(() => {
  const w = dw.value
  const satIdx = (5 - weekdayMon0(rangeStart.value) + 7) % 7
  const monIdx = (7 - weekdayMon0(rangeStart.value)) % 7
  const yearMode = props.month < 0
  // в режиме года сетку рисуют только границы месяцев (подложка), иначе рябит
  if (yearMode) return { width: `${timelineWidth.value}px` }
  const lineSize = w
  const linePos = 0
  void monIdx
  return {
    width: `${timelineWidth.value}px`,
    backgroundImage: [
      'linear-gradient(to right, var(--gantt-weekend) 0, var(--gantt-weekend) 28.5714%, transparent 28.5714%)',
      'linear-gradient(to right, var(--gantt-line) 0, var(--gantt-line) 1px, transparent 1px)'
    ].join(','),
    backgroundSize: `${w * 7}px 100%, ${lineSize}px 100%`,
    backgroundPosition: `${satIdx * w}px 0, ${linePos}px 0`,
    backgroundRepeat: 'repeat-x'
  }
})

function bar(v: Vacation) {
  const s = Math.max(dayNum(v.startDate), rangeStart.value)
  const e = Math.min(dayNum(v.endDate), rangeEnd.value)
  if (s > e) return null
  return {
    left: (s - rangeStart.value) * dw.value,
    width: (e - s + 1) * dw.value,
    cutLeft: dayNum(v.startDate) < rangeStart.value,
    cutRight: dayNum(v.endDate) > rangeEnd.value
  }
}

/** Красные фрагменты полосы: координаты внутри самой полосы. */
function conflictSegs(v: Vacation) {
  const ranges = props.conflictRanges?.get(v.id)
  if (!ranges?.length || !bar(v)) return []
  const barStart = Math.max(dayNum(v.startDate), rangeStart.value)
  const out: { left: number, width: number }[] = []
  for (const r of ranges) {
    const s = Math.max(r.s, barStart)
    const e = Math.min(r.e, rangeEnd.value)
    if (s <= e) out.push({ left: (s - barStart) * dw.value, width: (e - s + 1) * dw.value })
  }
  return out
}

function barLabel(v: Vacation, width: number) {
  const n = daysInclusive(v.startDate, v.endDate)
  const range = `${formatDate(v.startDate).slice(0, 5)} – ${formatDate(v.endDate).slice(0, 5)}`
  if (width >= 140) return `${range} · ${n} дн.`
  if (width >= 40) return `${n} дн.`
  return ''
}

/** «Иванов Иван Петрович» → «Иванов И. П.» */
function shortName(full: string) {
  const [last, first, patr] = full.split(' ')
  return `${last}${first ? ` ${first[0]}.` : ''}${patr ? ` ${patr[0]}.` : ''}`
}

function barTitle(v: Vacation) {
  const n = daysInclusive(v.startDate, v.endDate)
  const warn = props.conflictRanges?.has(v.id) ? ' · ⚠ пересекается с сотрудником, с которым нельзя уходить одновременно' : ''
  return `${formatRange(v.startDate, v.endDate)} · ${n} ${plural(n, ['день', 'дня', 'дней'])} · ${STATUS_LABELS[v.status]}${warn}`
}
</script>

<template>
  <div class="gantt overflow-auto rounded-2xl border border-default bg-default shadow-sm max-h-[72vh]">
    <div :style="{ width: `${LEFT + timelineWidth}px` }" class="relative">
      <!-- шапка -->
      <div class="sticky top-0 z-30 flex border-b border-default bg-zinc-100 dark:bg-zinc-900">
        <div
          class="sticky left-0 z-40 flex shrink-0 items-center border-r border-default bg-zinc-100 px-4 text-xs font-semibold dark:bg-zinc-900"
          :style="{ width: `${LEFT}px` }"
        >
          Сотрудник
        </div>
        <div class="relative" :style="{ width: `${timelineWidth}px`, height: month >= 0 ? '56px' : '40px' }">
          <div
            v-for="m in months"
            :key="m.m"
            class="absolute top-0 truncate border-l border-default text-xs font-semibold"
            :class="month < 0 ? 'flex h-full items-center justify-center' : 'h-8 px-3 leading-8'"
            :style="{ left: `${m.left}px`, width: `${m.width}px` }"
          >
            {{ m.label }}
          </div>
          <template v-if="month >= 0">
            <div
              v-for="d in days"
              :key="d.n"
              class="absolute top-8 flex h-[24px] flex-col items-center justify-center text-[10px] leading-[12px]"
              :class="d.off ? 'text-muted/70' : 'text-muted'"
              :style="{ left: `${(d.n - rangeStart) * dw}px`, width: `${dw}px` }"
              :title="d.title"
            >
              <span
                class="grid min-w-[18px] place-items-center rounded-full px-0.5 text-[11px] font-medium"
                :class="d.n === todayNum ? 'bg-emerald-600 text-white' : d.holiday ? 'bg-rose-500/20 text-rose-600 dark:bg-rose-400/25 dark:text-rose-300' : d.off ? '' : 'text-default'"
              >{{ d.num }}</span>
              <span>{{ d.wd }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- тело -->
      <div class="relative">
        <!-- подложка: границы месяцев, праздники, выбранная дата, сегодня -->
        <div class="pointer-events-none absolute bottom-0 top-0 z-10" :style="{ left: `${LEFT}px`, width: `${timelineWidth}px` }">
          <div
            v-for="m in months"
            :key="m.m"
            class="absolute bottom-0 top-0 border-l border-default"
            :style="{ left: `${m.left}px` }"
          />
          <div
            v-for="n in extraOffDays"
            :key="n"
            class="absolute bottom-0 top-0 bg-rose-500/20 dark:bg-rose-400/25"
            :style="{ left: `${(n - rangeStart) * dw}px`, width: `${dw}px` }"
          />
          <div
            v-if="filterLeft !== null"
            class="absolute bottom-0 top-0 bg-emerald-500/10"
            :style="{ left: `${filterLeft}px`, width: `${dw}px` }"
          />
          <div v-if="todayLeft !== null" class="absolute bottom-0 top-0 w-px bg-emerald-500" :style="{ left: `${todayLeft}px` }">
            <span class="absolute -left-[3px] -top-px size-[7px] rounded-full bg-emerald-500" />
          </div>
        </div>

        <template v-for="row in rows" :key="row.type === 'group' ? `g${row.id}` : `e${row.employee.id}`">
          <!-- подразделение -->
          <div v-if="row.type === 'group'" class="flex" :style="{ height: `${GROUP_H}px` }">
            <div
              class="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-default bg-zinc-50 pr-4 dark:bg-zinc-900"
              :style="{ width: `${LEFT}px`, paddingLeft: `${10 + row.depth * 14}px` }"
            >
              <UButton
                :icon="row.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                color="neutral"
                variant="ghost"
                size="xs"
                square
                :aria-label="row.collapsed ? 'Развернуть' : 'Свернуть'"
                @click="emit('toggle', row.id)"
              />
              <span class="truncate text-[13px] font-semibold" :title="row.name">{{ row.name }}</span>
              <UIcon v-if="row.warning" name="i-lucide-triangle-alert" class="size-4 shrink-0 text-amber-500" title="Превышен порог одновременного отсутствия" />
              <span class="ml-auto shrink-0 text-xs tabular-nums text-muted">{{ row.count }}</span>
            </div>
            <div class="flex-1 border-b border-default bg-zinc-50 dark:bg-zinc-900" />
          </div>

          <!-- сотрудник -->
          <div v-else class="group/row flex" :style="{ height: `${ROW_H}px` }">
            <div
              class="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-b border-r border-default bg-default pr-3 transition-colors group-hover/row:bg-zinc-50 dark:group-hover/row:bg-zinc-900"
              :style="{ width: `${LEFT}px`, paddingLeft: `${16 + row.depth * 10}px` }"
            >
              <PersonAvatar :name="row.employee.fullName" />
              <button
                class="min-w-0 truncate text-left text-[13px] font-medium hover:text-primary"
                :title="`${row.employee.fullName} — ${row.employee.position}`"
                @click="emit('open-employee', row.employee.id)"
              >
                {{ shortName(row.employee.fullName) }}
              </button>
            </div>
            <div class="relative border-b border-default transition-colors group-hover/row:bg-zinc-500/[0.04]" :style="rowBg">
              <template v-for="v in row.vacations" :key="v.id">
                <button
                  v-if="bar(v)"
                  type="button"
                  class="absolute top-[8px] z-[15] h-7 overflow-hidden px-2.5 text-left text-[11px] font-medium transition duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
                  :class="[
                    STATUS_COLORS[v.status].pill,
                    bar(v)!.cutLeft ? 'rounded-l-none' : 'rounded-l-lg',
                    bar(v)!.cutRight ? 'rounded-r-none' : 'rounded-r-lg'
                  ]"
                  :style="{ left: `${bar(v)!.left}px`, width: `${bar(v)!.width}px` }"
                  :title="barTitle(v)"
                  @click="emit('select', { vacation: v, employee: row.employee })"
                >
                  <span
                    v-for="(c, i) in conflictSegs(v)"
                    :key="i"
                    class="conflict-stripes absolute inset-y-0"
                    :style="{ left: `${c.left}px`, width: `${c.width}px` }"
                  />
                  <span class="relative block truncate leading-7">{{ barLabel(v, bar(v)!.width) }}</span>
                </button>
              </template>
            </div>
          </div>
        </template>

        <div v-if="!rows.length" class="py-16 text-center text-muted">
          По выбранным фильтрам сотрудников не найдено
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gantt {
  --gantt-weekend: color-mix(in oklab, var(--ui-text-muted) 12%, transparent);
  --gantt-line: color-mix(in oklab, var(--ui-text-muted) 18%, transparent);
}
.conflict-stripes {
  background: repeating-linear-gradient(-45deg, rgb(239 68 68 / 0.6) 0 5px, rgb(239 68 68 / 0.32) 5px 10px);
  box-shadow: inset 0 0 0 1px rgb(220 38 38 / 0.75);
}
</style>
