export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const fullName = str(body, 'fullName', 'ФИО', 200)
  const position = str(body, 'position', 'Должность', 200)
  const departmentId = int(body, 'departmentId', 'Подразделение')
  const tabNumber = optStr(body, 'tabNumber', 'Табельный номер', 20)
  const db = useDb()

  if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) {
    fail('Подразделение не найдено', 404)
  }
  const res = db
    .prepare('INSERT INTO employees (full_name, position, department_id, tab_number) VALUES (?, ?, ?, ?)')
    .run(fullName, position, departmentId, tabNumber)

  setResponseStatus(event, 201)
  return { id: Number(res.lastInsertRowid), fullName, position, departmentId, tabNumber }
})
