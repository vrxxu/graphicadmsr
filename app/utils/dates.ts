const DAY_MS = 86_400_000

/** ISO-дата (ГГГГ-ММ-ДД) → номер дня от эпохи (UTC, без влияния часовых поясов). */
export function dayNum(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
}

export function isoFromDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** День недели: 0 — понедельник … 6 — воскресенье. */
export function weekdayMon0(n: number): number {
  return (new Date(n * DAY_MS).getUTCDay() + 6) % 7
}

export function isWeekend(n: number): boolean {
  return weekdayMon0(n) >= 5
}

export function daysInclusive(startIso: string, endIso: string): number {
  return dayNum(endIso) - dayNum(startIso) + 1
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function formatRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} — ${formatDate(endIso)}`
}

export const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

export function monthStartDayNum(year: number, month0: number): number {
  return dayNum(`${year}-${String(month0 + 1).padStart(2, '0')}-01`)
}

/** Склонение по числу: plural(5, ['день','дня','дней']) → «дней» */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
