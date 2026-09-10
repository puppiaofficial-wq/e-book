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
export async function renderRegion({ bookId, pdfPath, sourcePage, half, rect, pixels }) {
  const key = `${bookId}:${sourcePage}:${half}:${rect.x},${rect.y},${rect.w},${rect.h}:${pixels}`;
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
  scale = Math.min(scale, MAX_EDGE / Math.max(regionW, regionH));
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (regionW * regionH)));

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
    .webp({ quality: 86 })
    .toBuffer();
  pixmap.destroy?.();

  tiles.set(key, buffer);
  while (tiles.size > TILE_CACHE) tiles.delete(tiles.keys().next().value);
  return buffer;
}

/** Output page -> source page, honouring spreads that were split in two. */
export function locatePage(book, outputPage) {
  const map = book.pages.map;
  if (Array.isArray(map) && map[outputPage - 1]) {
    const entry = map[outputPage - 1];
    return { sourcePage: entry.s, half: entry.h || null };
  }
  if (book.pages.splitApplied) return null; // pre-dates the map: fall back
  return { sourcePage: outputPage, half: null };
}
