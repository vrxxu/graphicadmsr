import type { Conflict, Department, Employee, Vacation } from '#shared/types'

/** Единый источник данных для всех страниц. */
export function useSchedule() {
  const { data, refresh, status } = useAsyncData('schedule', async () => {
    const [departments, employees, vacations, conflicts] = await Promise.all([
      $fetch<Department[]>('/api/departments'),
      $fetch<Employee[]>('/api/employees'),
      $fetch<Vacation[]>('/api/vacations'),
      $fetch<Conflict[]>('/api/conflicts')
    ])
    return { departments, employees, vacations, conflicts }
  })

  const departments = computed(() => data.value?.departments ?? [])
  const employees = computed(() => data.value?.employees ?? [])
  const vacations = computed(() => data.value?.vacations ?? [])
  const conflicts = computed(() => data.value?.conflicts ?? [])
  const tree = computed(() => buildTree(departments.value))
  const deptById = computed(() => new Map(departments.value.map(d => [d.id, d])))
  const employeeById = computed(() => new Map(employees.value.map(e => [e.id, e])))

  const vacationsByEmployee = computed(() => {
    const map = new Map<number, Vacation[]>()
    for (const v of vacations.value) {
      const list = map.get(v.employeeId)
      if (list) list.push(v)
      else map.set(v.employeeId, [v])
    }
    return map
  })

  /** сотрудник → с кем ему нельзя отсутствовать одновременно */
  const partnersByEmployee = computed(() => {
    const map = new Map<number, number[]>()
    const add = (a: number, b: number) => {
      const list = map.get(a)
      if (list) list.push(b)
      else map.set(a, [b])
    }
    for (const c of conflicts.value) {
      add(c.employeeId, c.otherId)
      add(c.otherId, c.employeeId)
    }
    return map
  })

  /** фактические нарушения: отпуска пары пересекаются по датам */
  const conflictOverlaps = computed(() => findConflictOverlaps(conflicts.value, vacationsByEmployee.value))
  const conflictRanges = computed(() => conflictRangesByVacation(conflictOverlaps.value))

  return {
    departments, employees, vacations, conflicts, partnersByEmployee, conflictOverlaps, conflictRanges,
    tree, deptById, employeeById, vacationsByEmployee,
    refresh, status
  }
}

/** Порог предупреждения об одновременном отсутствии (% сотрудников подразделения). */
export function useThreshold() {
  const cookie = useCookie<number>('vacation-threshold', { default: () => 50, maxAge: 60 * 60 * 24 * 365 })
  return cookie
}

export function errorMessage(e: unknown): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, statusMessage?: string, message?: string }
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || err?.message || 'Неизвестная ошибка'
}

export const STATUS_COLORS = {
  planned: {
    bar: 'bg-amber-600',
    dot: 'bg-amber-500',
    badge: 'warning',
    pill: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-600 dark:text-white dark:ring-amber-400'
  },
  approved: {
    bar: 'bg-emerald-600',
    dot: 'bg-emerald-500',
    badge: 'success',
    pill: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-700 dark:text-white dark:ring-emerald-500'
  },
  moved: {
    bar: 'bg-sky-500',
    dot: 'bg-sky-400',
    badge: 'info',
    pill: 'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-700 dark:text-white dark:ring-sky-500'
  }
} as const
