export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const fullName = str(body, 'fullName', 'ФИО', 200)
  const position = str(body, 'position', 'Должность', 200)
  const departmentId = int(body, 'departmentId', 'Подразделение')
  const db = useDb()

  if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) {
    fail('Подразделение не найдено', 404)
  }
  const res = db
    .prepare('INSERT INTO employees (full_name, position, department_id) VALUES (?, ?, ?)')
    .run(fullName, position, departmentId)

  setResponseStatus(event, 201)
  return { id: Number(res.lastInsertRowid), fullName, position, departmentId }
})
