export default defineEventHandler(async (event) => {
  const id = routeId(event)
  const body = await readJson(event)
  const name = str(body, 'name', 'Название', 250)
  const parentId = optInt(body, 'parentId', 'Родительское подразделение')
  const db = useDb()

  const current = db.prepare('SELECT id FROM departments WHERE id = ?').get(id)
  if (!current) fail('Подразделение не найдено', 404)

  if (parentId !== null) {
    if (parentId === id) fail('Подразделение не может быть родителем самого себя')
    if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(parentId)) {
      fail('Родительское подразделение не найдено', 404)
    }
    // защита от циклов: новый родитель не должен находиться внутри поддерева id
    let cursor: number | null = parentId
    while (cursor !== null) {
      if (cursor === id) fail('Нельзя переместить подразделение внутрь собственного поддерева')
      const row = db.prepare('SELECT parent_id AS p FROM departments WHERE id = ?').get(cursor) as { p: number | null } | undefined
      cursor = row?.p ?? null
    }
  }

  db.prepare('UPDATE departments SET name = ?, parent_id = ? WHERE id = ?').run(name, parentId, id)
  return { id, name, parentId }
})
