export interface Department {
  id: number
  name: string
  parentId: number | null
  sort: number
}

export interface Employee {
  id: number
  fullName: string
  position: string
  departmentId: number
}

export type VacationStatus = 'planned' | 'approved' | 'moved'

export interface Vacation {
  id: number
  employeeId: number
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD, включительно
  status: VacationStatus
  note: string
}

export const STATUS_LABELS: Record<VacationStatus, string> = {
  planned: 'Запланирован',
  approved: 'Утверждён',
  moved: 'Перенесён'
}
