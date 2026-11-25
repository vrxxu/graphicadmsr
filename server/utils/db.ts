import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildSeed } from './seed'

let db: DatabaseSync | null = null

export function useDb(): DatabaseSync {
  if (db) return db

  const file = process.env.DB_PATH || resolve(process.cwd(), 'data', 'vacations.sqlite')
  mkdirSync(dirname(file), { recursive: true })
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      position TEXT NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS vacations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS conflicts (
      employee_a INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      employee_b INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      PRIMARY KEY (employee_a, employee_b),
      CHECK (employee_a < employee_b)
    );
    CREATE INDEX IF NOT EXISTS idx_emp_dep ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_vac_emp ON vacations(employee_id);
  `)

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM departments').get() as { n: number }
  if (n === 0) {
    seedDatabase(db)
    db.exec('PRAGMA user_version = 1')
  } else {
    // база создана до появления ограничений — один раз добавляем демо-пары (если сотрудники на месте)
    const { user_version: ver } = db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (ver < 1) {
      const exists = db.prepare('SELECT 1 FROM employees WHERE id = ?')
      const ins = db.prepare('INSERT OR IGNORE INTO conflicts (employee_a, employee_b) VALUES (?, ?)')
      for (const c of buildSeed().conflicts) if (exists.get(c.a) && exists.get(c.b)) ins.run(c.a, c.b)
      db.exec('PRAGMA user_version = 1')
    }
  }

  return db
}

export function seedDatabase(conn: DatabaseSync) {
  const seed = buildSeed()
  conn.exec('BEGIN')
  try {
    const insDep = conn.prepare('INSERT INTO departments (id, name, parent_id, sort) VALUES (?, ?, ?, ?)')
    for (const d of seed.departments) insDep.run(d.id, d.name, d.parentId, d.sort)

    const insEmp = conn.prepare('INSERT INTO employees (id, full_name, position, department_id) VALUES (?, ?, ?, ?)')
    for (const e of seed.employees) insEmp.run(e.id, e.fullName, e.position, e.departmentId)

    const insVac = conn.prepare(
      'INSERT INTO vacations (employee_id, start_date, end_date, status, note) VALUES (?, ?, ?, ?, ?)'
    )
    for (const v of seed.vacations) insVac.run(v.employeeId, v.startDate, v.endDate, v.status, v.note)

    const insConf = conn.prepare('INSERT INTO conflicts (employee_a, employee_b) VALUES (?, ?)')
    for (const c of seed.conflicts) insConf.run(c.a, c.b)
    conn.exec('COMMIT')
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }
}
