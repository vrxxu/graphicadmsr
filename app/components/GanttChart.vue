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
}>()

const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'select', payload: { vacation: Vacation, employee: Employee }): void
  (e: 'open-employee', id: number): void
}>()

const LEFT = 272 // ширина левой колонки, px
const ROW_H = 40

const rangeStart = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-01-01`) : monthStartDayNum(props.year, props.month)
)
const totalDays = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-12-31`) - rangeStart.value + 1 : daysInMonth(props.year, props.month)
)
const rangeEnd = computed(() => rangeStart.value + totalDays.value - 1)
const dw = computed(() => (props.month < 0 ? 5 : 36)) // ширина одного дня, px
const timelineWidth = computed(() => totalDays.value * dw.value)

const months = computed(() => {
  const list: { m: number, label: string, left: number, width: number }[] = []
  const monthsToShow = props.month < 0 ? [...Array(12).keys()] : [props.month]
  for (const m of monthsToShow) {
    const s = monthStartDayNum(props.year, m)
    const n = daysInMonth(props.year, m)
    list.push({
      m,
      label: props.month < 0 ? MONTHS_SHORT[m]!.toUpperCase() : `${MONTHS_NOM[m]} ${props.year}`,
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
  const lineSize = yearMode ? w * 7 : w
  const linePos = yearMode ? monIdx * w : 0
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

function barLabel(v: Vacation, width: number) {
  const n = daysInclusive(v.startDate, v.endDate)
  if (width >= 150) return `${formatDate(v.startDate).slice(0, 5)} – ${formatDate(v.endDate).slice(0, 5)} · ${n} дн.`
  if (width >= 96) return `${formatDate(v.startDate).slice(0, 5)} – ${formatDate(v.endDate).slice(0, 5)}`
  if (width >= 36) return `${n} дн.`
  return ''
}

function barTitle(v: Vacation) {
  const n = daysInclusive(v.startDate, v.endDate)
  return `${formatRange(v.startDate, v.endDate)} · ${n} ${plural(n, ['день', 'дня', 'дней'])} · ${STATUS_LABELS[v.status]}`
}
</script>

<template>
  <div class="gantt overflow-auto border border-zinc-400 dark:border-zinc-600 bg-default max-h-[68vh]">
    <div :style="{ width: `${LEFT + timelineWidth}px` }" class="relative">
      <!-- шапка -->
      <div class="sticky top-0 z-30 flex bg-zinc-100 dark:bg-zinc-800 border-b-2 border-zinc-400 dark:border-zinc-600">
        <div
          class="sticky left-0 z-40 shrink-0 bg-zinc-100 dark:bg-zinc-800 border-r-2 border-zinc-400 dark:border-zinc-600 px-3 flex items-end pb-1 text-xs font-semibold uppercase tracking-wide text-muted"
          :style="{ width: `${LEFT}px` }"
        >
          Подразделение / сотрудник
        </div>
        <div class="relative" :style="{ width: `${timelineWidth}px`, height: month >= 0 ? '56px' : '32px' }">
          <div
            v-for="m in months"
            :key="m.m"
            class="absolute top-0 h-7 border-l-2 border-zinc-400 dark:border-zinc-600 px-1.5 text-xs font-semibold leading-7 truncate"
            :class="m.m % 2 ? 'bg-zinc-200/70 dark:bg-zinc-700/50' : ''"
            :style="{ left: `${m.left}px`, width: `${m.width}px` }"
          >
            {{ m.label }}
          </div>
          <template v-if="month >= 0">
            <div
              v-for="d in days"
              :key="d.n"
              class="absolute top-7 h-7 text-center text-[10px] leading-[13px] pt-0.5 border-l border-t border-zinc-300 dark:border-zinc-600"
              :class="[
                d.off ? 'bg-red-600/10 text-red-700 dark:text-red-400' : 'text-muted',
                d.n === todayNum ? '!bg-zinc-900 !text-white dark:!bg-zinc-100 dark:!text-zinc-900 font-bold' : ''
              ]"
              :style="{ left: `${(d.n - rangeStart) * dw}px`, width: `${dw}px` }"
              :title="d.title"
            >
              {{ d.num }}<br>{{ d.wd }}
            </div>
          </template>
        </div>
      </div>

      <!-- тело -->
      <div class="relative">
        <!-- подложка: чередование месяцев, праздничные выходные, «сегодня» -->
        <div class="absolute top-0 bottom-0 pointer-events-none z-10" :style="{ left: `${LEFT}px`, width: `${timelineWidth}px` }">
          <div
            v-for="m in months"
            :key="m.m"
            class="absolute top-0 bottom-0 border-l-2 border-zinc-400 dark:border-zinc-600"
            :class="m.m % 2 ? 'bg-zinc-500/[0.07]' : ''"
            :style="{ left: `${m.left}px`, width: `${m.width}px` }"
          />
          <div
            v-for="n in extraOffDays"
            :key="n"
            class="absolute top-0 bottom-0 bg-red-600/15"
            :style="{ left: `${(n - rangeStart) * dw}px`, width: `${dw}px` }"
          />
          <div
            v-if="filterLeft !== null"
            class="absolute top-0 bottom-0 bg-zinc-900/10 dark:bg-white/10 border-x border-zinc-700 dark:border-zinc-300"
            :style="{ left: `${filterLeft}px`, width: `${dw}px` }"
          />
          <div v-if="todayLeft !== null" class="absolute top-0 bottom-0 w-0.5 bg-red-600" :style="{ left: `${todayLeft}px` }" />
        </div>

        <template v-for="row in rows" :key="row.type === 'group' ? `g${row.id}` : `e${row.employee.id}`">
          <!-- заголовок подразделения -->
          <div
            v-if="row.type === 'group'"
            class="flex bg-zinc-200 dark:bg-zinc-800 border-b border-zinc-400 dark:border-zinc-600"
            :style="{ height: `${ROW_H - 4}px` }"
          >
            <div
              class="sticky left-0 z-20 shrink-0 bg-zinc-200 dark:bg-zinc-800 border-r-2 border-zinc-400 dark:border-zinc-600 flex items-center gap-1 pr-2"
              :style="{ width: `${LEFT}px`, paddingLeft: `${6 + row.depth * 14}px` }"
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
              <span class="text-sm font-semibold truncate" :title="row.name">{{ row.name }}</span>
              <UBadge v-if="row.warning" color="warning" variant="solid" size="sm" icon="i-lucide-triangle-alert" class="shrink-0" title="Превышен порог одновременного отсутствия" />
              <UBadge color="neutral" variant="outline" size="sm" class="ml-auto shrink-0">{{ row.count }}</UBadge>
            </div>
            <div class="flex-1" />
          </div>

          <!-- сотрудник -->
          <div v-else class="flex border-b border-zinc-300 dark:border-zinc-700 hover:bg-zinc-500/5" :style="{ height: `${ROW_H}px` }">
            <div
              class="sticky left-0 z-20 shrink-0 bg-default border-r-2 border-zinc-400 dark:border-zinc-600 flex flex-col justify-center pr-2 leading-tight"
              :style="{ width: `${LEFT}px`, paddingLeft: `${30 + row.depth * 14}px` }"
            >
              <button class="text-left text-sm truncate hover:underline" :title="row.employee.fullName" @click="emit('open-employee', row.employee.id)">
                {{ row.employee.fullName }}
              </button>
              <span class="text-[11px] text-muted truncate">{{ row.employee.position }}</span>
            </div>
            <div class="relative" :style="rowBg">
              <template v-for="v in row.vacations" :key="v.id">
                <button
                  v-if="bar(v)"
                  type="button"
                  class="absolute top-2 h-6 z-[15] text-[10px] font-medium text-white px-1.5 truncate text-left border border-black/40 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 dark:focus-visible:outline-white"
                  :class="[
                    STATUS_COLORS[v.status].bar,
                    bar(v)!.cutLeft ? 'border-l-0' : 'rounded-l-sm shadow-[inset_3px_0_0_rgb(0_0_0/0.35)]',
                    bar(v)!.cutRight ? 'border-r-0' : 'rounded-r-sm'
                  ]"
                  :style="{ left: `${bar(v)!.left}px`, width: `${bar(v)!.width}px` }"
                  :title="barTitle(v)"
                  @click="emit('select', { vacation: v, employee: row.employee })"
                >
                  {{ barLabel(v, bar(v)!.width) }}
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
  --gantt-weekend: color-mix(in oklab, var(--ui-text-muted) 14%, transparent);
  --gantt-line: color-mix(in oklab, var(--ui-text-muted) 28%, transparent);
}
</style>
