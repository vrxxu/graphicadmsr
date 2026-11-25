/** Заменяет список сотрудников, с которыми данный сотрудник не может отсутствовать одновременно. */
export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const body = await readJson(event)
  const db = useDb()

  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(id)) fail('Сотрудник не найден', 404)

  const raw = body.employeeIds
  if (!Array.isArray(raw)) fail('Поле «employeeIds» должно быть массивом')
  if (raw.length > 200) fail('Слишком много сотрудников в списке')

  const ids = [...new Set(raw.map(Number))]
  for (const other of ids) {
    if (!Number.isInteger(other) || other <= 0) fail('Некорректный идентификатор сотрудника в списке')
    if (other === id) fail('Сотрудник не может быть в списке ограничений сам у себя')
    if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(other)) fail(`Сотрудник ${other} не найден`, 404)
  }

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM conflicts WHERE employee_a = ? OR employee_b = ?').run(id, id)
    const ins = db.prepare('INSERT INTO conflicts (employee_a, employee_b) VALUES (?, ?)')
    for (const other of ids) ins.run(Math.min(id, other), Math.max(id, other))
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { id, employeeIds: ids }
})
