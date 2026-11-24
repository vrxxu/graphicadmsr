import type { Department, Employee, Vacation } from '#shared/types'

/** Единый источник данных для всех страниц. */
export function useSchedule() {
  const { data, refresh, status } = useAsyncData('schedule', async () => {
    const [departments, employees, vacations] = await Promise.all([
      $fetch<Department[]>('/api/departments'),
      $fetch<Employee[]>('/api/employees'),
      $fetch<Vacation[]>('/api/vacations')
    ])
    return { departments, employees, vacations }
  })

  const departments = computed(() => data.value?.departments ?? [])
  const employees = computed(() => data.value?.employees ?? [])
  const vacations = computed(() => data.value?.vacations ?? [])
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

  return {
    departments, employees, vacations, tree, deptById, employeeById, vacationsByEmployee,
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
  planned: { bar: 'bg-amber-600', badge: 'warning' },
  approved: { bar: 'bg-emerald-600', badge: 'success' },
  moved: { bar: 'bg-zinc-500', badge: 'neutral' }
} as const
