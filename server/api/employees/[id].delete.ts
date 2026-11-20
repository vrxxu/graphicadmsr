export default defineEventHandler((event) => {
  const id = routeId(event)
  const db = useDb()
  if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(id)) fail('Сотрудник не найден', 404)
  // отпуска удаляются каскадом
  db.prepare('DELETE FROM employees WHERE id = ?').run(id)
  return { ok: true }
})
