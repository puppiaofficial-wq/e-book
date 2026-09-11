/**
 * On-demand high-resolution region rendering.
 *
 * The pre-generated zoom image has a fixed resolution, so zooming past it can
 * only upscale. Instead the viewer asks for exactly the region it is showing,
 * rendered from the source PDF at screen resolution, which stays sharp at any
 * magnification without storing huge images.
 */
import fs from 'node:fs';
import * as mupdf from 'mupdf';
import { decideSplits } from './convert.js';
import sharp from 'sharp';

const MAX_EDGE = 3600;      // longest side of a single render
const MAX_PIXELS = 8e6;     // one render stays around half a second
const DOC_CACHE = 4;
const TILE_CACHE = 16;

const documents = new Map();
const tiles = new Map();

function documentFor(bookId, pdfPath) {
  const hit = documents.get(bookId);
  if (hit) {
    documents.delete(bookId);
    documents.set(bookId, hit); // refresh LRU position
    return hit;
  }
  const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), 'application/pdf');
  documents.set(bookId, doc);
  while (documents.size > DOC_CACHE) {
    const oldest = documents.keys().next().value;
    documents.get(oldest)?.destroy?.();
    documents.delete(oldest);
  }
  return doc;
}

export function forgetDocument(bookId) {
  documents.get(bookId)?.destroy?.();
  documents.delete(bookId);
  derivedMaps.delete(bookId);
  for (const key of [...tiles.keys()]) {
    if (key.startsWith(`${bookId}:`)) tiles.delete(key);
  }
}

/**
 * @param rect  fractions of the *output* page: { x, y, w, h }
 * @param half  'left' | 'right' | null - which half of the source page this
 *              output page came from, when a spread was split
 * @param pixels requested width of the rendered region, in device pixels
 */
export async function renderRegion({ bookId, pdfPath, sourcePage, half, rect, pixels, nativeWidth = null, maxEdge = MAX_EDGE, maxPixels = MAX_PIXELS, quality = 88 }) {
  // Asking for more pixels than the source holds only blurs the result.
  if (nativeWidth) pixels = Math.min(pixels, Math.max(256, Math.round(nativeWidth * rect.w)));
  const key = `${bookId}:${sourcePage}:${half}:${rect.x},${rect.y},${rect.w},${rect.h}:${pixels}:${maxEdge}`;
  const cached = tiles.get(key);
  if (cached) return cached;

  const doc = documentFor(bookId, pdfPath);
  const page = doc.loadPage(sourcePage - 1);
  const [x0, y0, x1, y1] = page.getBounds();
  const pageW = x1 - x0;
  const pageH = y1 - y0;

  let fx = rect.x;
  let fw = rect.w;
  if (half === 'left') {
    fx = rect.x / 2;
    fw = rect.w / 2;
  } else if (half === 'right') {
    fx = 0.5 + rect.x / 2;
    fw = rect.w / 2;
  }

  const regionW = fw * pageW;
  const regionH = rect.h * pageH;
  let scale = pixels / regionW;

  // Clamp so a single request can never ask the renderer for an absurd bitmap.
  scale = Math.min(scale, maxEdge / Math.max(regionW, regionH));
  scale = Math.min(scale, Math.sqrt(maxPixels / (regionW * regionH)));

  const outW = Math.max(1, Math.round(regionW * scale));
  const outH = Math.max(1, Math.round(regionH * scale));

  const matrix = mupdf.Matrix.concat(
    mupdf.Matrix.scale(scale, scale),
    mupdf.Matrix.translate(-(x0 + fx * pageW) * scale, -(y0 + rect.y * pageH) * scale)
  );

  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, outW, outH], false);
  pixmap.clear(255);
  const device = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
  try {
    page.run(device, matrix);
  } finally {
    device.close();
  }

  const raw = pixmap.getPixels();
  const buffer = await sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.length), {
    raw: { width: pixmap.getWidth(), height: pixmap.getHeight(), channels: pixmap.getNumberOfComponents() }
  })
    .webp({ quality, smartSubsample: true })
    .toBuffer();
  pixmap.destroy?.();

  tiles.set(key, buffer);
  while (tiles.size > TILE_CACHE) tiles.delete(tiles.keys().next().value);
  return buffer;
}

const derivedMaps = new Map();

/** Output page -> source page, honouring spreads that were split in two. */
export function locatePage(book, outputPage, pdfPath) {
  const map = Array.isArray(book.pages.map) ? book.pages.map : derivedMap(book, pdfPath);
  if (map && map[outputPage - 1]) {
    const entry = map[outputPage - 1];
    return { sourcePage: entry.s, half: entry.h || null };
  }
  if (book.pages.splitApplied) return null;
  return { sourcePage: outputPage, half: null };
}

/**
 * Catalogs imported before the map was stored can still be located: the split
 * decision is a pure function of the page geometry, so it replays exactly.
 */
function derivedMap(book, pdfPath) {
  if (!book.pages.splitApplied || !pdfPath) return null;
  const hit = derivedMaps.get(book.id);
  if (hit) return hit;
  try {
    const doc = documentFor(book.id, pdfPath);
    const geometry = [];
    for (let i = 0; i < doc.countPages(); i += 1) {
      const [x0, y0, x1, y1] = doc.loadPage(i).getBounds();
      geometry.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    const splits = decideSplits(geometry, 'auto');
    const map = [];
    splits.forEach((split, i) => {
      if (split) {
        map.push({ s: i + 1, h: 'left' }, { s: i + 1, h: 'right' });
      } else {
        map.push({ s: i + 1, h: null });
      }
    });
    if (map.length !== book.pages.count) return null;
    derivedMaps.set(book.id, map);
    return map;
  } catch {
    return null;
  }
}
