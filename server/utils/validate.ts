import type { H3Event } from 'h3'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function fail(message: string, status = 400): never {
  throw createError({ statusCode: status, statusMessage: message, message })
}

export async function readJson(event: H3Event): Promise<Record<string, unknown>> {
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Тело запроса должно быть JSON-объектом')
  return body as Record<string, unknown>
}

export function str(body: Record<string, unknown>, key: string, label: string, max = 200): string {
  const v = body[key]
  if (typeof v !== 'string') fail(`Поле «${label}» обязательно`)
  const t = v.trim()
  if (!t) fail(`Поле «${label}» не может быть пустым`)
  if (t.length > max) fail(`Поле «${label}» слишком длинное (максимум ${max} символов)`)
  return t
}

export function optStr(body: Record<string, unknown>, key: string, label: string, max = 500): string {
  const v = body[key]
  if (v === undefined || v === null || v === '') return ''
  if (typeof v !== 'string') fail(`Поле «${label}» должно быть строкой`)
  if (v.length > max) fail(`Поле «${label}» слишком длинное (максимум ${max} символов)`)
  return v.trim()
}

export function int(body: Record<string, unknown>, key: string, label: string): number {
  const v = body[key]
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) fail(`Поле «${label}» должно быть положительным целым числом`)
  return n
}

export function optInt(body: Record<string, unknown>, key: string, label: string): number | null {
  const v = body[key]
  if (v === undefined || v === null || v === '') return null
  return int(body, key, label)
}

export function date(body: Record<string, unknown>, key: string, label: string): string {
  const v = body[key]
  if (typeof v !== 'string' || !DATE_RE.test(v)) fail(`Поле «${label}» должно быть датой в формате ГГГГ-ММ-ДД`)
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) fail(`Поле «${label}» содержит несуществующую дату`)
  const year = d.getUTCFullYear()
  if (year < 2000 || year > 2100) fail(`Поле «${label}»: год должен быть в диапазоне 2000–2100`)
  return v
}

export function routeId(event: H3Event): number {
  const n = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(n) || n <= 0) fail('Некорректный идентификатор')
  return n
}
