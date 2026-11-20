export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const body = await readJson(event)
  const fullName = str(body, 'fullName', 'ФИО', 200)
  const position = str(body, 'position', 'Должность', 200)
  const departmentId = int(body, 'departmentId', 'Подразделение')
  const db = useDb()

  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(id)) fail('Сотрудник не найден', 404)
  if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) fail('Подразделение не найдено', 404)

  db.prepare('UPDATE employees SET full_name = ?, position = ?, department_id = ? WHERE id = ?')
    .run(fullName, position, departmentId, id)
  return { id, fullName, position, departmentId }
})
