import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  COMPANY_ADDRESS,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_WEBSITE,
  INITIAL_SHEET_DATA,
} from '../src/data.ts';
import type { CompanySettings, Employee } from '../src/types.ts';

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  telegram: string;
  whatsapp: string;
  max_messenger: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'cards.db');

function resolveDbPath(): string {
  const configured = process.env.DB_PATH?.trim();
  if (!configured) return DEFAULT_DB_PATH;
  return path.resolve(configured);
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id            TEXT PRIMARY KEY,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    title         TEXT NOT NULL,
    department    TEXT NOT NULL DEFAULT 'Продажи',
    phone         TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    website       TEXT NOT NULL DEFAULT 'www.sdmaf.ru',
    address       TEXT NOT NULL DEFAULT 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    telegram      TEXT NOT NULL DEFAULT '',
    whatsapp      TEXT NOT NULL DEFAULT '',
    max_messenger INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_employees_active_sort
    ON employees (is_active, sort_order, last_name);

  CREATE TABLE IF NOT EXISTS company_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

function mapRowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    title: row.title,
    department: row.department,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    telegram: row.telegram || '',
    whatsapp: row.whatsapp || undefined,
    maxMessenger: Boolean(row.max_messenger),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Seed initial settings and employees if empty
function seedDatabaseIfEmpty(): void {
  const upsertSetting = db.prepare(
    `INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`
  );

  const seedSettings = db.transaction(() => {
    upsertSetting.run('company_name', COMPANY_NAME);
    upsertSetting.run('company_phone', COMPANY_PHONE);
    upsertSetting.run('company_website', COMPANY_WEBSITE);
    upsertSetting.run('company_address', COMPANY_ADDRESS);
  });
  seedSettings();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
  if (countRow.count === 0) {
    const insertEmp = db.prepare(`
      INSERT INTO employees (
        id, first_name, last_name, title, department,
        phone, email, website, address, telegram, whatsapp,
        max_messenger, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const seedEmployees = db.transaction(() => {
      INITIAL_SHEET_DATA.forEach((emp, idx) => {
        insertEmp.run(
          emp.id,
          emp.firstName,
          emp.lastName,
          emp.title,
          emp.department,
          emp.phone || '',
          emp.email || '',
          emp.website || COMPANY_WEBSITE,
          emp.address || COMPANY_ADDRESS,
          emp.telegram || '',
          emp.whatsapp || '',
          emp.maxMessenger ? 1 : 0,
          idx + 1
        );
      });
    });
    seedEmployees();
  }
}

seedDatabaseIfEmpty();

export function transliterateToSlug(text: string): string {
  const rus = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  const eng = [
    'a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'y',
    'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f',
    'kh', 'ts', 'ch', 'sh', 'shch', '', 'y', '', 'e', 'yu', 'ya',
  ];
  return text
    .toLowerCase()
    .split('')
    .map((ch) => {
      const idx = rus.indexOf(ch);
      return idx !== -1 ? eng[idx] : ch;
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function generateUniqueEmployeeId(firstName: string, lastName: string, requestedId?: string): string {
  const base =
    (requestedId ? transliterateToSlug(requestedId) : '') ||
    transliterateToSlug(`${firstName}-${lastName}`) ||
    'employee';

  const checkStmt = db.prepare('SELECT 1 FROM employees WHERE id = ?');
  if (!checkStmt.get(base)) {
    return base;
  }
  let suffix = 2;
  while (checkStmt.get(`${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

export function listEmployees(includeArchived = true): Employee[] {
  const sql = includeArchived
    ? 'SELECT * FROM employees ORDER BY is_active DESC, sort_order ASC, last_name ASC'
    : 'SELECT * FROM employees WHERE is_active = 1 ORDER BY sort_order ASC, last_name ASC';
  const rows = db.prepare(sql).all() as EmployeeRow[];
  return rows.map(mapRowToEmployee);
}

export function getEmployeeById(id: string, onlyActive = false): Employee | null {
  const sql = onlyActive
    ? 'SELECT * FROM employees WHERE id = ? AND is_active = 1'
    : 'SELECT * FROM employees WHERE id = ?';
  const row = db.prepare(sql).get(id) as EmployeeRow | undefined;
  return row ? mapRowToEmployee(row) : null;
}

export interface UpsertEmployeeInput {
  id?: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  telegram: string;
  whatsapp: string;
  maxMessenger: boolean;
  isActive?: boolean;
}

export function createEmployee(input: UpsertEmployeeInput): Employee {
  const id = generateUniqueEmployeeId(input.firstName, input.lastName, input.id);
  const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM employees').get() as {
    maxOrder: number;
  };
  const nextOrder = maxOrderRow.maxOrder + 1;
  const whatsappClean = input.whatsapp.trim() || input.phone.replace(/[^0-9]/g, '');

  db.prepare(`
    INSERT INTO employees (
      id, first_name, last_name, title, department,
      phone, email, website, address, telegram, whatsapp,
      max_messenger, is_active, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    input.firstName.trim(),
    input.lastName.trim(),
    input.title.trim(),
    input.department.trim() || 'Продажи',
    input.phone.trim(),
    input.email.trim(),
    input.website.trim() || COMPANY_WEBSITE,
    input.address.trim() || COMPANY_ADDRESS,
    input.telegram.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\/$/, ''),
    whatsappClean,
    input.maxMessenger ? 1 : 0,
    input.isActive === false ? 0 : 1,
    nextOrder
  );

  return getEmployeeById(id)!;
}

export function updateEmployee(id: string, input: UpsertEmployeeInput): Employee | null {
  const existing = getEmployeeById(id);
  if (!existing) return null;

  const whatsappClean =
    input.whatsapp.trim() || input.phone.replace(/[^0-9]/g, '');

  db.prepare(`
    UPDATE employees
    SET first_name = ?,
        last_name = ?,
        title = ?,
        department = ?,
        phone = ?,
        email = ?,
        website = ?,
        address = ?,
        telegram = ?,
        whatsapp = ?,
        max_messenger = ?,
        is_active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    input.firstName.trim(),
    input.lastName.trim(),
    input.title.trim(),
    input.department.trim() || 'Продажи',
    input.phone.trim(),
    input.email.trim(),
    input.website.trim() || COMPANY_WEBSITE,
    input.address.trim() || COMPANY_ADDRESS,
    input.telegram.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\/$/, ''),
    whatsappClean,
    input.maxMessenger ? 1 : 0,
    input.isActive === undefined ? (existing.isActive ? 1 : 0) : input.isActive ? 1 : 0,
    id
  );

  return getEmployeeById(id);
}

export function setEmployeeActive(id: string, isActive: boolean): Employee | null {
  const result = db
    .prepare(`UPDATE employees SET is_active = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(isActive ? 1 : 0, id);
  if (result.changes === 0) return null;
  return getEmployeeById(id);
}

export function deleteEmployee(id: string): boolean {
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderEmployees(orderList: Array<{ id: string; sortOrder: number }>): void {
  const stmt = db.prepare(`UPDATE employees SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`);
  const tx = db.transaction((items: Array<{ id: string; sortOrder: number }>) => {
    for (const item of items) {
      stmt.run(item.sortOrder, item.id);
    }
  });
  tx(orderList);
}

export function importEmployeesBatch(inputs: UpsertEmployeeInput[], replaceAll = false): { created: number; updated: number } {
  let created = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    if (replaceAll) {
      db.prepare('DELETE FROM employees').run();
    }
    for (const item of inputs) {
      const candidateId = item.id ? transliterateToSlug(item.id) : transliterateToSlug(`${item.firstName}-${item.lastName}`);
      const existing = candidateId ? getEmployeeById(candidateId) : null;
      if (existing && !replaceAll) {
        updateEmployee(existing.id, item);
        updated++;
      } else {
        createEmployee({ ...item, id: candidateId || undefined });
        created++;
      }
    }
  });
  tx();

  return { created, updated };
}

export function getCompanySettings(): CompanySettings {
  const rows = db
    .prepare(
      `SELECT key, value FROM company_settings WHERE key IN ('company_name', 'company_phone', 'company_website', 'company_address')`
    )
    .all() as Array<{ key: string; value: string }>;

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    companyName: map.get('company_name') || COMPANY_NAME,
    companyPhone: map.get('company_phone') || COMPANY_PHONE,
    companyWebsite: map.get('company_website') || COMPANY_WEBSITE,
    companyAddress: map.get('company_address') || COMPANY_ADDRESS,
  };
}

export function updateCompanySettings(settings: CompanySettings): CompanySettings {
  const stmt = db.prepare(`
    INSERT INTO company_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const tx = db.transaction(() => {
    stmt.run('company_name', settings.companyName.trim());
    stmt.run('company_phone', settings.companyPhone.trim());
    stmt.run('company_website', settings.companyWebsite.trim());
    stmt.run('company_address', settings.companyAddress.trim());
  });
  tx();
  return getCompanySettings();
}

export function getSettingValue(key: string): string | null {
  const row = db.prepare('SELECT value FROM company_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function getDatabasePath(): string {
  return dbPath;
}
