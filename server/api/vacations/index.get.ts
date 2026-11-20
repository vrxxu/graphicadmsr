import type { Vacation } from '#shared/types'

export default defineEventHandler((): Vacation[] => {
  const rows = useDb()
    .prepare(
      `SELECT id, employee_id AS employeeId, start_date AS startDate, end_date AS endDate, status, note
       FROM vacations ORDER BY start_date, id`
    )
    .all()
  return rows as unknown as Vacation[]
})
