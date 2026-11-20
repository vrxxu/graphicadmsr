import type { Department } from '#shared/types'

export default defineEventHandler((): Department[] => {
  const rows = useDb()
    .prepare('SELECT id, name, parent_id AS parentId, sort FROM departments ORDER BY sort, id')
    .all()
  return rows as unknown as Department[]
})
