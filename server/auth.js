import crypto from 'node:crypto';
import { SESSION_SECRET, SESSION_COOKIE, SESSION_TTL_MS, GRANT_COOKIE, GRANT_TTL_MS } from './config.js';
import { sign, unsign, parseCookies, setCookie, clearCookie } from './util.js';
import * as store from './store.js';

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(plain, record) {
  if (!record?.salt || !record?.hash) return false;
  const candidate = crypto.scryptSync(String(plain), record.salt, 64);
  const known = Buffer.from(record.hash, 'hex');
  return candidate.length === known.length && crypto.timingSafeEqual(candidate, known);
}

/* --------------------------------------------------- admin session */

export function issueSession(res, email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  setCookie(res, SESSION_COOKIE, sign(payload, SESSION_SECRET), { maxAge: SESSION_TTL_MS });
}

export function endSession(res) {
  clearCookie(res, SESSION_COOKIE);
}

export function currentAdmin(req) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  const value = unsign(raw, SESSION_SECRET);
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    const account = store.admin();
    if (!account || account.email !== payload.email) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function requireAdmin(req, res, next) {
  const account = currentAdmin(req);
  if (!account) return res.status(401).json({ error: 'Sign in required' });
  req.admin = account;
  next();
}

/* ------------------------------------------- reader access grants */

/** A grant proves a reader cleared a password or opened a valid share link. */
export function issueGrant(res, req, bookId, shareToken = null) {
  const grants = readGrants(req);
  grants[bookId] = { exp: Date.now() + GRANT_TTL_MS, share: shareToken };
  const payload = Buffer.from(JSON.stringify(grants)).toString('base64url');
  // Grants must survive the viewer being embedded in someone else's page, which
  // needs SameSite=None - but that requires HTTPS, so plain HTTP falls back.
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
  setCookie(res, GRANT_COOKIE, sign(payload, SESSION_SECRET), {
    maxAge: GRANT_TTL_MS,
    sameSite: secure ? 'None' : 'Lax'
  });
}

export function readGrants(req) {
  const raw = parseCookies(req)[GRANT_COOKIE];
  const value = unsign(raw, SESSION_SECRET);
  if (!value) return {};
  try {
    const grants = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    for (const [key, entry] of Object.entries(grants)) {
      if (!entry?.exp || entry.exp < Date.now()) delete grants[key];
    }
    return grants;
  } catch {
    return {};
  }
}

export function hasGrant(req, bookId) {
  return Boolean(readGrants(req)[bookId]);
}

export function grantShareToken(req, bookId) {
  return readGrants(req)[bookId]?.share || null;
}
