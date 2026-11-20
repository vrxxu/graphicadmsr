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

const rangeStart = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-01-01`) : monthStartDayNum(props.year, props.month)
)
const totalDays = computed(() =>
  props.month < 0 ? dayNum(`${props.year}-12-31`) - rangeStart.value + 1 : daysInMonth(props.year, props.month)
)
const rangeEnd = computed(() => rangeStart.value + totalDays.value - 1)
const dw = computed(() => (props.month < 0 ? 5 : 36)) // ширина одного дня
const timelineWidth = computed(() => totalDays.value * dw.value)

const months = computed(() => {
  const list: { label: string, left: number, width: number }[] = []
  const monthsToShow = props.month < 0 ? [...Array(12).keys()] : [props.month]
  for (const m of monthsToShow) {
    const s = monthStartDayNum(props.year, m)
    const n = daysInMonth(props.year, m)
    list.push({
      label: props.month < 0 ? MONTHS_SHORT[m]! : `${MONTHS_NOM[m]} ${props.year}`,
      left: (s - rangeStart.value) * dw.value,
      width: n * dw.value
    })
  }
  return list
})

const days = computed(() => {
  if (props.month >= 0) {
    return Array.from({ length: totalDays.value }, (_, i) => {
      const n = rangeStart.value + i
      return { n, num: i + 1, wd: WEEKDAYS_SHORT[weekdayMon0(n)]!, weekend: isWeekend(n) }
    })
  }
  return []
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

// Выходные — повторяющийся фон: тайл в 7 дней, смещённый на первую субботу диапазона.
const weekendStyle = computed(() => {
  const w = dw.value
  const satIdx = (5 - weekdayMon0(rangeStart.value) + 7) % 7
  return {
    width: `${timelineWidth.value}px`,
    backgroundImage: 'linear-gradient(to right, var(--gantt-weekend) 0, var(--gantt-weekend) 28.5714%, transparent 28.5714%)',
    backgroundSize: `${w * 7}px 100%`,
    backgroundPosition: `${satIdx * w}px 0`,
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

function barTitle(v: Vacation) {
  const n = daysInclusive(v.startDate, v.endDate)
  return `${formatRange(v.startDate, v.endDate)} · ${n} ${plural(n, ['день', 'дня', 'дней'])} · ${STATUS_LABELS[v.status]}`
}
</script>

<template>
  <div class="gantt overflow-auto rounded-lg border border-default bg-default max-h-[68vh]">
    <div :style="{ width: `${LEFT + timelineWidth}px` }" class="relative">
      <!-- шапка -->
      <div class="sticky top-0 z-30 flex bg-elevated border-b border-default">
        <div
          class="sticky left-0 z-40 shrink-0 bg-elevated border-r border-default px-3 flex items-end pb-1 text-xs font-medium text-muted"
          :style="{ width: `${LEFT}px` }"
        >
          Подразделение / сотрудник
        </div>
        <div class="relative" :style="{ width: `${timelineWidth}px`, height: month >= 0 ? '52px' : '30px' }">
          <div
            v-for="m in months"
            :key="m.left"
            class="absolute top-0 h-[26px] border-l border-default px-1 text-xs font-medium leading-[26px] truncate"
            :style="{ left: `${m.left}px`, width: `${m.width}px` }"
          >
            {{ m.label }}
          </div>
          <template v-if="month >= 0">
            <div
              v-for="d in days"
              :key="d.n"
              class="absolute top-[26px] h-[26px] text-center text-[10px] leading-[12px] pt-0.5 border-l border-default/50"
              :class="[d.weekend ? 'text-error' : 'text-muted', d.n === todayNum ? 'bg-primary/20 font-bold !text-primary' : '']"
              :style="{ left: `${(d.n - rangeStart) * dw}px`, width: `${dw}px` }"
            >
              {{ d.num }}<br>{{ d.wd }}
            </div>
          </template>
        </div>
      </div>

      <!-- тело -->
      <div class="relative">
        <!-- вертикальные разделители месяцев и «сегодня» поверх всех строк -->
        <div class="absolute top-0 bottom-0 pointer-events-none z-10" :style="{ left: `${LEFT}px`, width: `${timelineWidth}px` }">
          <div v-for="m in months" :key="m.left" class="absolute top-0 bottom-0 w-px bg-default-line" :style="{ left: `${m.left}px` }" />
          <div
            v-if="filterLeft !== null"
            class="absolute top-0 bottom-0 bg-primary/10 border-x border-primary/40"
            :style="{ left: `${filterLeft}px`, width: `${dw}px` }"
          />
          <div v-if="todayLeft !== null" class="absolute top-0 bottom-0 w-0.5 bg-error" :style="{ left: `${todayLeft}px` }" />
        </div>

        <template v-for="row in rows" :key="row.type === 'group' ? `g${row.id}` : `e${row.employee.id}`">
          <!-- заголовок подразделения -->
          <div v-if="row.type === 'group'" class="flex h-9 bg-elevated/70 border-b border-default">
            <div
              class="sticky left-0 z-20 shrink-0 bg-elevated border-r border-default flex items-center gap-1 pr-2"
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
              <UBadge v-if="row.warning" color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert" class="shrink-0" />
              <UBadge color="neutral" variant="outline" size="sm" class="ml-auto shrink-0">{{ row.count }}</UBadge>
            </div>
            <div class="flex-1 bg-elevated/70" />
          </div>

          <!-- сотрудник -->
          <div v-else class="flex h-9 border-b border-default/60 hover:bg-elevated/40">
            <div
              class="sticky left-0 z-20 shrink-0 bg-default border-r border-default flex flex-col justify-center pr-2 leading-tight"
              :style="{ width: `${LEFT}px`, paddingLeft: `${30 + row.depth * 14}px` }"
            >
              <button class="text-left text-sm truncate hover:text-primary hover:underline" :title="row.employee.fullName" @click="emit('open-employee', row.employee.id)">
                {{ row.employee.fullName }}
              </button>
              <span class="text-[11px] text-muted truncate">{{ row.employee.position }}</span>
            </div>
            <div class="relative gantt-weekend" :style="weekendStyle">
              <template v-for="v in row.vacations" :key="v.id">
                <button
                  v-if="bar(v)"
                  type="button"
                  class="absolute top-1.5 h-6 z-[5] text-[10px] text-white px-1 truncate shadow-sm ring-1 ring-black/10 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary"
                  :class="[
                    STATUS_COLORS[v.status].bar,
                    bar(v)!.cutLeft ? 'rounded-l-none' : 'rounded-l-md',
                    bar(v)!.cutRight ? 'rounded-r-none' : 'rounded-r-md'
                  ]"
                  :style="{ left: `${bar(v)!.left}px`, width: `${bar(v)!.width}px` }"
                  :title="barTitle(v)"
                  @click="emit('select', { vacation: v, employee: row.employee })"
                >
                  <template v-if="bar(v)!.width > 60">{{ formatDate(v.startDate).slice(0, 5) }}–{{ formatDate(v.endDate).slice(0, 5) }}</template>
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
}
.bg-default-line {
  background: var(--ui-border);
}
</style>
