import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, getSettingValue } from './db.ts';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ADMIN_HASH_KEY = 'admin_password_hash';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyScryptHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, keyBuf.length);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

function safeComparePlain(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export function getAuthConfigState(): { needsSetup: boolean; source: 'env' | 'db' | 'none' } {
  const envHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const envPlain = process.env.ADMIN_PASSWORD?.trim();
  if (envHash || envPlain) {
    return { needsSetup: false, source: 'env' };
  }
  const dbHash = getSettingValue(ADMIN_HASH_KEY);
  if (dbHash) {
    return { needsSetup: false, source: 'db' };
  }
  return { needsSetup: true, source: 'none' };
}

export function verifyAdminPassword(password: string): boolean {
  const envHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (envHash) {
    return verifyScryptHash(password, envHash);
  }
  const envPlain = process.env.ADMIN_PASSWORD?.trim();
  if (envPlain) {
    return safeComparePlain(password, envPlain);
  }
  const dbHash = getSettingValue(ADMIN_HASH_KEY);
  if (dbHash) {
    return verifyScryptHash(password, dbHash);
  }
  return false;
}

export function claimFirstAdminPassword(password: string): { ok: boolean; error?: string } {
  const state = getAuthConfigState();
  if (!state.needsSetup) {
    return { ok: false, error: 'Пароль администратора уже настроен.' };
  }
  const hashed = hashPassword(password);
  const tx = db.transaction(() => {
    const existing = getSettingValue(ADMIN_HASH_KEY);
    if (existing) {
      return false;
    }
    db.prepare(
      `INSERT INTO company_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    ).run(ADMIN_HASH_KEY, hashed);
    return true;
  });

  const claimed = tx();
  if (!claimed) {
    return { ok: false, error: 'Пароль администратора уже настроен.' };
  }
  return { ok: true };
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createSessionToken(): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Clean expired sessions opportunistically
  db.prepare(`DELETE FROM admin_sessions WHERE expires_at <= datetime('now')`).run();
  db.prepare(
    `INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, datetime('now'), ?)`
  ).run(tokenHash, expiresAt);

  return { token, expiresAt };
}

export function revokeSessionToken(token: string): void {
  const tokenHash = sha256Hex(token);
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length >= 32 ? token : null;
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const tokenHash = sha256Hex(token);
  const row = db
    .prepare(`SELECT expires_at FROM admin_sessions WHERE token_hash = ?`)
    .get(tokenHash) as { expires_at: string } | undefined;
  if (!row) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    return false;
  }
  return true;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!isTokenValid(token)) {
    res.status(401).json({ error: 'Требуется авторизация администратора.' });
    return;
  }
  next();
}
