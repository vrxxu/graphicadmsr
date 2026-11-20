/** Сброс демонстрационных данных к исходному состоянию. */
export default defineEventHandler(() => {
  const db = useDb()
  db.exec('PRAGMA foreign_keys = OFF; DELETE FROM vacations; DELETE FROM employees; DELETE FROM departments; PRAGMA foreign_keys = ON;')
  seedDatabase(db)
  return { ok: true }
})
