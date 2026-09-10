import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function id(prefix = '') {
  return prefix + crypto.randomBytes(9).toString('base64url');
}

export function token(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function slugify(input, fallback = 'book') {
  const base = String(input || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || fallback;
}

export function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write-to-temp + rename so a crash never leaves a half-written library file. */
export async function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2));
  await fsp.rename(tmp, file);
}

export function sign(value, secret) {
  const mac = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${mac}`;
}

export function unsign(signed, secret) {
  if (typeof signed !== 'string') return null;
  const cut = signed.lastIndexOf('.');
  if (cut < 1) return null;
  const value = signed.slice(0, cut);
  const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  const given = signed.slice(cut + 1);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true, sameSite = 'Lax' } = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (httpOnly) bits.push('HttpOnly');
  if (maxAge != null) bits.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  bits.push(`SameSite=${sameSite}`);
  if (sameSite === 'None') bits.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, bits.join('; ')]);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function nowIso() {
  return new Date().toISOString();
}

/** Resolve the externally visible origin, honouring reverse proxies. */
export function originOf(req, configured) {
  if (configured) return configured;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

export async function rmrf(target) {
  await fsp.rm(target, { recursive: true, force: true });
}
