import type { Conflict } from '#shared/types'

export default defineEventHandler((): Conflict[] => {
  const rows = useDb()
    .prepare('SELECT employee_a AS employeeId, employee_b AS otherId FROM conflicts ORDER BY employee_a, employee_b')
    .all()
  return rows as unknown as Conflict[]
})
