import type { Employee } from '#shared/types'

export default defineEventHandler((): Employee[] => {
  const rows = useDb()
    .prepare('SELECT id, full_name AS fullName, position, department_id AS departmentId, tab_number AS tabNumber FROM employees ORDER BY full_name')
    .all()
  return rows as unknown as Employee[]
})
