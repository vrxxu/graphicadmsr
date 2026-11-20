export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const db = useDb()
  if (!db.prepare('SELECT 1 FROM vacations WHERE id = ?').get(id)) fail('Отпуск не найден', 404)

  const v = parseVacation(await readJson(event))
  assertNoSelfOverlap(v.employeeId, v.startDate, v.endDate, id)

  db.prepare('UPDATE vacations SET employee_id = ?, start_date = ?, end_date = ?, status = ?, note = ? WHERE id = ?')
    .run(v.employeeId, v.startDate, v.endDate, v.status, v.note, id)
  return { id, ...v }
})
