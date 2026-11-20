export default defineEventHandler((event) => {
  const id = routeId(event)
  const db = useDb()

  if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(id)) fail('Подразделение не найдено', 404)
  if (db.prepare('SELECT 1 FROM departments WHERE parent_id = ?').get(id)) {
    fail('Нельзя удалить подразделение, у которого есть вложенные подразделения', 409)
  }
  if (db.prepare('SELECT 1 FROM employees WHERE department_id = ?').get(id)) {
    fail('Нельзя удалить подразделение, в котором есть сотрудники', 409)
  }
  db.prepare('DELETE FROM departments WHERE id = ?').run(id)
  return { ok: true }
})
