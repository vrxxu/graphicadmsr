import type { Department, Employee, Vacation } from '#shared/types'

export interface DeptNode {
  id: number
  name: string
  parentId: number | null
  depth: number
  children: DeptNode[]
}

export function buildTree(departments: Department[]): DeptNode[] {
  const nodes = new Map<number, DeptNode>()
  for (const d of departments) nodes.set(d.id, { id: d.id, name: d.name, parentId: d.parentId, depth: 0, children: [] })
  const roots: DeptNode[] = []
  for (const d of departments) {
    const node = nodes.get(d.id)!
    const parent = d.parentId !== null ? nodes.get(d.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const setDepth = (n: DeptNode, depth: number) => {
    n.depth = depth
    n.children.forEach(c => setDepth(c, depth + 1))
  }
  roots.forEach(r => setDepth(r, 0))
  return roots
}

/** Плоский список id подразделения и всех его потомков (произвольная глубина). */
export function subtreeIds(node: DeptNode): number[] {
  return [node.id, ...node.children.flatMap(subtreeIds)]
}

export function findNode(roots: DeptNode[], id: number): DeptNode | null {
  for (const r of roots) {
    if (r.id === id) return r
    const f = findNode(r.children, id)
    if (f) return f
  }
  return null
}

/** Сквозной обход дерева в порядке отображения. */
export function flatten(roots: DeptNode[]): DeptNode[] {
  return roots.flatMap(r => [r, ...flatten(r.children)])
}

/** «Администрация › Департамент › Управление › Отдел» */
export function pathOf(departments: Department[], id: number): string {
  const map = new Map(departments.map(d => [d.id, d]))
  const parts: string[] = []
  let cur = map.get(id)
  while (cur) {
    parts.unshift(cur.name)
    cur = cur.parentId !== null ? map.get(cur.parentId) : undefined
  }
  return parts.join(' › ')
}

// ---------------------------------------------------------------------------
// Анализ пересечений
// ---------------------------------------------------------------------------

export interface OverlapSegment {
  departmentId: number
  /** первый и последний день пересечения (ISO) */
  start: string
  end: string
  count: number
  employeeIds: number[]
  total: number
  free: number
  /** превышен настраиваемый порог одновременного отсутствия */
  warning: boolean
}

interface Interval { employeeId: number, s: number, e: number }

function clippedIntervals(memberIds: Set<number>, vacations: Vacation[], from: number, to: number): Interval[] {
  const out: Interval[] = []
  for (const v of vacations) {
    if (!memberIds.has(v.employeeId)) continue
    const s = Math.max(dayNum(v.startDate), from)
    const e = Math.min(dayNum(v.endDate), to)
    if (s <= e) out.push({ employeeId: v.employeeId, s, e })
  }
  return out
}

/**
 * Пересечения отпусков внутри одного подразделения (с учётом вложенных) за диапазон дней [from, to].
 * Возвращает отрезки, на которых одновременно отсутствуют 2 и более сотрудников.
 */
export function overlapsForDepartment(
  dept: DeptNode,
  employees: Employee[],
  vacations: Vacation[],
  from: number,
  to: number,
  thresholdPercent: number
): OverlapSegment[] {
  const ids = new Set(subtreeIds(dept))
  const members = employees.filter(e => ids.has(e.departmentId))
  const total = members.length
  if (total < 2) return []

  const memberIds = new Set(members.map(m => m.id))
  const intervals = clippedIntervals(memberIds, vacations, from, to)
  if (intervals.length < 2) return []

  const points = [...new Set(intervals.flatMap(i => [i.s, i.e + 1]))].sort((a, b) => a - b)
  const segments: OverlapSegment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]! // полуинтервал [a, b)
    const active = [...new Set(intervals.filter(x => x.s <= a && x.e >= b - 1).map(x => x.employeeId))]
    if (active.length < 2) continue

    const sorted = active.sort((x, y) => x - y)
    const prev = segments[segments.length - 1]
    if (prev && dayNum(prev.end) + 1 === a && prev.employeeIds.join() === sorted.join()) {
      prev.end = isoFromDayNum(b - 1)
      continue
    }
    segments.push({
      departmentId: dept.id,
      start: isoFromDayNum(a),
      end: isoFromDayNum(b - 1),
      count: sorted.length,
      employeeIds: sorted,
      total,
      free: total - sorted.length,
      warning: sorted.length / total >= thresholdPercent / 100
    })
  }
  return segments
}

/** Максимальное число одновременно отсутствующих сотрудников среди заданных. */
export function maxSimultaneous(
  employeeIds: Set<number>,
  vacations: Vacation[],
  from: number,
  to: number
): number {
  const intervals = clippedIntervals(employeeIds, vacations, from, to)
  if (!intervals.length) return 0
  const points = [...new Set(intervals.flatMap(i => [i.s, i.e + 1]))].sort((a, b) => a - b)
  let max = 0
  for (const p of points) {
    const n = new Set(intervals.filter(x => x.s <= p && x.e >= p).map(x => x.employeeId)).size
    if (n > max) max = n
  }
  return max
}

export function isOnVacation(employeeId: number, vacations: Vacation[], day: number): boolean {
  return vacations.some(v => v.employeeId === employeeId && dayNum(v.startDate) <= day && dayNum(v.endDate) >= day)
}
