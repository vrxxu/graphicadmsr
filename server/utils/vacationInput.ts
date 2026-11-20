import type { VacationStatus } from '#shared/types'

const STATUSES: VacationStatus[] = ['planned', 'approved', 'moved']

export function parseVacation(body: Record<string, unknown>) {
  const employeeId = int(body, 'employeeId', 'Сотрудник')
  const startDate = date(body, 'startDate', 'Дата начала')
  const endDate = date(body, 'endDate', 'Дата окончания')
  if (endDate < startDate) fail('Дата окончания не может быть раньше даты начала')

  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1
  if (days > 90) fail('Продолжительность одного периода не может превышать 90 дней')

  const status = body.status
  if (typeof status !== 'string' || !STATUSES.includes(status as VacationStatus)) {
    fail('Недопустимый статус отпуска')
  }
  const note = optStr(body, 'note', 'Примечание', 500)

  const db = useDb()
  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) fail('Сотрудник не найден', 404)

  return { employeeId, startDate, endDate, status: status as VacationStatus, note }
}

/** Периоды одного сотрудника не должны пересекаться между собой. */
export function assertNoSelfOverlap(
  employeeId: number,
  startDate: string,
  endDate: string,
  ignoreId: number | null
) {
  const row = useDb()
    .prepare(
      `SELECT id FROM vacations
       WHERE employee_id = ? AND id != ? AND start_date <= ? AND end_date >= ? LIMIT 1`
    )
    .get(employeeId, ignoreId ?? -1, endDate, startDate)
  if (row) fail('У сотрудника уже есть отпуск, пересекающийся с этим периодом', 409)
}
