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
export const EXPORT_DIR = path.join(DATA_DIR, 'exports');
export const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');

for (const dir of [DATA_DIR, BOOKS_DIR, EVENTS_DIR, TMP_DIR, EXPORT_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const PORT = Number(process.env.PORT || 8080);

/** Shown in the console so an operator can tell which build they are running. */
export const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0';
  } catch {
    return '0';
  }
})();

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

/**
 * Rendering defaults.
 *
 * Sizes are derived from the page's physical dimensions rather than fixed
 * pixel widths: a fixed width silently starves a large or double-width page
 * of resolution, which is exactly what makes a zoomed catalog look soft.
 */
export const RENDER = {
  zoomDpi: 320,      // high-resolution image used when zooming
  zoomMin: 3000,
  zoomMax: 4600,
  viewDpi: 170,      // page image used by the viewer at reading size
  viewMin: 1500,
  viewMax: 2400,
  thumbWidth: 320,   // contact sheet / bookshelf cover
  /* Catalog artwork is usually placed at print resolution and then resampled
     for the screen, which softens edges. A light unsharp mask puts the
     definition back without the halos a heavy setting would add. */
  sharpen: { sigma: 0.8, m1: 0.4, m2: 1.6 },
  viewQuality: 82,
  zoomQuality: 82,
  thumbQuality: 70
};

export const SESSION_COOKIE = 'eb_session';
export const GRANT_COOKIE = 'eb_grant';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const GRANT_TTL_MS = 1000 * 60 * 60 * 12;
