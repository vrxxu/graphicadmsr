export default defineEventHandler(async (event) => {
  const v = parseVacation(await readJson(event))
  assertNoSelfOverlap(v.employeeId, v.startDate, v.endDate, null)

  const res = useDb()
    .prepare('INSERT INTO vacations (employee_id, start_date, end_date, status, note) VALUES (?, ?, ?, ?, ?)')
    .run(v.employeeId, v.startDate, v.endDate, v.status, v.note)

  setResponseStatus(event, 201)
  return { id: Number(res.lastInsertRowid), ...v }
})
