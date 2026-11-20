export default defineEventHandler(async (event) => {
  const body = await readJson(event)
  const name = str(body, 'name', 'Название', 250)
  const parentId = optInt(body, 'parentId', 'Родительское подразделение')
  const db = useDb()

  if (parentId !== null && !db.prepare('SELECT 1 FROM departments WHERE id = ?').get(parentId)) {
    fail('Родительское подразделение не найдено', 404)
  }
  const { m } = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM departments').get() as { m: number }
  const res = db
    .prepare('INSERT INTO departments (name, parent_id, sort) VALUES (?, ?, ?)')
    .run(name, parentId, m + 1)

  setResponseStatus(event, 201)
  return { id: Number(res.lastInsertRowid), name, parentId, sort: m + 1 }
})
