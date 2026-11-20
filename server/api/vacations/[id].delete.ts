export default defineEventHandler((event) => {
  const id = routeId(event)
  const db = useDb()
  if (!db.prepare('SELECT 1 FROM vacations WHERE id = ?').get(id)) fail('Отпуск не найден', 404)
  db.prepare('DELETE FROM vacations WHERE id = ?').run(id)
  return { ok: true }
})
