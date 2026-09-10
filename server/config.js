import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DATA_DIR = path.resolve(
  ROOT,
  process.env.EBOOK_DATA_DIR || path.join(ROOT, 'data')
);

export const BOOKS_DIR = path.join(DATA_DIR, 'books');
export const EVENTS_DIR = path.join(DATA_DIR, 'events');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
export const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');

for (const dir of [DATA_DIR, BOOKS_DIR, EVENTS_DIR, TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const PORT = Number(process.env.PORT || 8080);

/** Public origin used for share links, embed snippets and QR codes. */
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

/** Session secret survives restarts so admins are not logged out on deploy. */
export const SESSION_SECRET = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
})();

/** Rendering defaults. Overridable per import. */
export const RENDER = {
  viewWidth: 1400,   // page image used by the viewer
  zoomWidth: 2400,   // high-resolution image used when zooming
  thumbWidth: 280,   // contact sheet / bookshelf cover
  viewQuality: 80,
  zoomQuality: 74,
  thumbQuality: 68
};

export const SESSION_COOKIE = 'eb_session';
export const GRANT_COOKIE = 'eb_grant';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const GRANT_TTL_MS = 1000 * 60 * 60 * 12;
