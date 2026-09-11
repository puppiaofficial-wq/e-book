/**
 * PDF -> web page-set converter.
 *
 * Replaces the legacy Windows-only desktop extractor: everything runs on the
 * server with MuPDF (WebAssembly, no native build) plus sharp for encoding.
 * One render per source page is downscaled into three derivatives so a 60-page
 * catalog converts in seconds rather than minutes.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { RENDER } from './config.js';
import { pad } from './util.js';
import { sourceWidthOf } from './pdfinfo.js';

const SPREAD_RATIO = 1.25; // width/height above this looks like a 2-up spread

export async function convertPdf(pdfPath, outDir, options = {}, onProgress = () => {}) {
  const opts = { ...RENDER, splitSpreads: 'auto', ...options };
  const buffer = await fsp.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const sourceCount = doc.countPages();
  if (!sourceCount) throw new Error('The PDF contains no pages.');

  await prepareDirs(outDir);

  // One cheap pass first: page geometry, whether there is a text layer, and how
  // much real resolution the artwork carries. All three change what we render.
  const geometry = [];
  let sourceWidth = 0;
  let anyText = false;
  for (let i = 0; i < sourceCount; i += 1) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    geometry.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    if (!anyText) anyText = hasTextLayer(page);
    const width = sourceWidthOf(page, x1 - x0);
    if (width) sourceWidth = Math.max(sourceWidth, width);
  }
  const splitDecision = decideSplits(geometry, opts.splitSpreads);

  // One output page's width in PostScript points decides how many pixels the
  // derivatives get, so an A4 page and a double-width spread both land at the
  // same physical resolution.
  const outputPointWidth = geometry[0].w / (splitDecision[0] ? 2 : 1);
  const target = {
    zoom: pixelsFor(outputPointWidth, opts.zoomDpi, opts.zoomMin, opts.zoomMax),
    view: pixelsFor(outputPointWidth, opts.viewDpi, opts.viewMin, opts.viewMax),
    thumb: opts.thumbWidth
  };

  // Flattened artwork has no vector text to gain from a bigger render, so the
  // source images set the ceiling. A little headroom absorbs the estimate.
  const nativeWidth = sourceWidth
    ? Math.round((splitDecision[0] ? sourceWidth / 2 : sourceWidth) * 1.15)
    : null;
  if (!anyText && nativeWidth) {
    target.zoom = Math.max(1600, Math.min(target.zoom, nativeWidth));
    target.view = Math.min(target.view, target.zoom);
  }

  const outline = readOutline(doc);
  const pages = [];
  let outputIndex = 0;
  let textFound = false;

  for (let i = 0; i < sourceCount; i += 1) {
    const page = doc.loadPage(i);
    const box = geometry[i];
    const segments = splitDecision[i] ? 2 : 1;
    const scale = target.zoom / (box.w / segments);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    const raw = pixmap.getPixels();
    const fullWidth = pixmap.getWidth();
    const fullHeight = pixmap.getHeight();
    const channels = pixmap.getNumberOfComponents();
    const source = Buffer.from(raw.buffer, raw.byteOffset, raw.length);

    const lines = readLines(page, box);
    const links = readLinks(doc, page, box);

    for (let s = 0; s < segments; s += 1) {
      outputIndex += 1;
      const segWidth = Math.floor(fullWidth / segments);
      const left = s * segWidth;
      const region = { left, top: 0, width: segments === 2 ? segWidth : fullWidth, height: fullHeight };

      const crop = () => sharp(source, { raw: { width: fullWidth, height: fullHeight, channels } }).extract(region);
      const name = `p${pad(outputIndex)}.webp`;
      await Promise.all([
        crop().webp({ quality: opts.zoomQuality, smartSubsample: true, effort: 5 }).toFile(path.join(outDir, 'zoom', name)),
        crop().resize({ width: Math.min(target.view, region.width) })
          .webp({ quality: opts.viewQuality, smartSubsample: true, effort: 5 }).toFile(path.join(outDir, 'pages', name)),
        crop().resize({ width: Math.min(target.thumb, region.width) })
          .webp({ quality: opts.thumbQuality }).toFile(path.join(outDir, 'thumbs', name))
      ]);

      const segLines = sliceLines(lines, s, segments);
      if (segLines.length) textFound = true;

      pages.push({
        index: outputIndex,
        source: i + 1,
        half: segments === 2 ? (s === 0 ? 'left' : 'right') : null,
        width: region.width,
        height: region.height,
        lines: segLines,
        links: sliceLinks(links, s, segments)
      });
    }

    pixmap.destroy?.();
    onProgress({ done: i + 1, total: sourceCount, pages: outputIndex });
  }

  const first = pages[0];
  const manifest = {
    pageCount: pages.length,
    width: first.width,
    height: first.height,
    aspect: Number((first.width / first.height).toFixed(5)),
    format: 'webp',
    hasText: textFound,
    splitApplied: splitDecision.some(Boolean),
    // Lets the viewer ask the server to re-render any region from the source.
    map: pages.map((page) => ({ s: page.source, h: page.half })),
    sizes: { ...target, native: !anyText && nativeWidth ? nativeWidth : null },
    // Physical page size, so the admin can report the effective resolution.
    ptWidth: Number(outputPointWidth.toFixed(2)),
    ptHeight: Number(geometry[0].h.toFixed(2)),
    source: 'pdf',
    createdAt: new Date().toISOString()
  };

  await fsp.writeFile(
    path.join(outDir, 'text.json'),
    JSON.stringify({ pages: pages.map((p) => ({ index: p.index, lines: p.lines })) })
  );
  await fsp.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(manifest, null, 2));

  return {
    manifest,
    toc: remapOutline(outline, splitDecision),
    links: collectLinks(pages, splitDecision),
    title: (doc.getMetaData('info:Title') || '').trim()
  };
}

/** Import a set of ready-made images (the legacy "JPG source" workflow). */
export async function convertImages(files, outDir, options = {}, onProgress = () => {}) {
  const opts = { ...RENDER, ...options };
  await prepareDirs(outDir);
  const pages = [];
  let index = 0;
  for (const file of files) {
    index += 1;
    const image = sharp(file.path, { failOn: 'none' }).rotate();
    const meta = await image.metadata();
    const name = `p${pad(index)}.webp`;
    const buf = await image.toBuffer();
    await Promise.all([
      sharp(buf).resize({ width: Math.min(opts.zoomMax, meta.width), withoutEnlargement: true })
        .webp({ quality: opts.zoomQuality, smartSubsample: true, effort: 5 }).toFile(path.join(outDir, 'zoom', name)),
      sharp(buf).resize({ width: Math.min(opts.viewMax, meta.width), withoutEnlargement: true })
        .webp({ quality: opts.viewQuality, smartSubsample: true, effort: 5 }).toFile(path.join(outDir, 'pages', name)),
      sharp(buf).resize({ width: Math.min(opts.thumbWidth, meta.width), withoutEnlargement: true })
        .webp({ quality: opts.thumbQuality }).toFile(path.join(outDir, 'thumbs', name))
    ]);
    pages.push({ index, width: meta.width, height: meta.height, lines: [], links: [] });
    onProgress({ done: index, total: files.length, pages: index });
  }
  if (!pages.length) throw new Error('No readable images were supplied.');

  const manifest = {
    pageCount: pages.length,
    width: pages[0].width,
    height: pages[0].height,
    aspect: Number((pages[0].width / pages[0].height).toFixed(5)),
    format: 'webp',
    hasText: false,
    splitApplied: false,
    map: null,
    sizes: { view: Math.min(opts.viewMax, pages[0].width), zoom: pages[0].width, thumb: opts.thumbWidth },
    ptWidth: null,
    ptHeight: null,
    source: 'images',
    createdAt: new Date().toISOString()
  };
  await fsp.writeFile(path.join(outDir, 'text.json'), JSON.stringify({ pages: [] }));
  await fsp.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(manifest, null, 2));
  return { manifest, toc: [], links: {}, title: '' };
}

/* ------------------------------------------------------- internals */

async function prepareDirs(outDir) {
  for (const sub of ['pages', 'zoom', 'thumbs']) {
    await fsp.rm(path.join(outDir, sub), { recursive: true, force: true });
    await fsp.mkdir(path.join(outDir, sub), { recursive: true });
  }
}

function hasTextLayer(page) {
  try {
    return page.toStructuredText('preserve-whitespace').asText().trim().length > 0;
  } catch {
    return false;
  }
}

function pixelsFor(pointWidth, dpi, min, max) {
  return Math.round(Math.min(max, Math.max(min, (pointWidth / 72) * dpi)));
}

export function decideSplits(geometry, mode) {
  if (mode === 'never') return geometry.map(() => false);
  if (mode === 'always') return geometry.map((g) => g.w / g.h >= 1.05);
  // auto: split wide pages only when the document is otherwise portrait,
  // and never split a lone wide cover in an all-landscape document.
  const portraitCount = geometry.filter((g) => g.w / g.h < 1).length;
  const wide = geometry.map((g) => g.w / g.h >= SPREAD_RATIO);
  const wideCount = wide.filter(Boolean).length;
  if (!wideCount) return geometry.map(() => false);
  if (portraitCount === 0 && wideCount === geometry.length) return geometry.map(() => false);
  return wide;
}

function readLines(page, box) {
  const out = [];
  try {
    const json = JSON.parse(page.toStructuredText('preserve-whitespace').asJSON());
    for (const block of json.blocks || []) {
      if (block.type !== 'text') continue;
      for (const line of block.lines || []) {
        const text = (line.text || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        out.push({
          text,
          x: (line.bbox.x - box.x) / box.w,
          y: (line.bbox.y - box.y) / box.h,
          w: line.bbox.w / box.w,
          h: line.bbox.h / box.h
        });
      }
    }
  } catch {
    /* pages without a text layer simply have no lines */
  }
  return out;
}

function readLinks(doc, page, box) {
  const out = [];
  let links = [];
  try {
    links = page.getLinks() || [];
  } catch {
    return out;
  }
  for (const link of links) {
    let uri = '';
    try {
      uri = link.getURI() || '';
    } catch {
      continue;
    }
    const [x0, y0, x1, y1] = link.getBounds();
    const rect = {
      x: (x0 - box.x) / box.w,
      y: (y0 - box.y) / box.h,
      w: (x1 - x0) / box.w,
      h: (y1 - y0) / box.h
    };
    const internal = /^#page=(\d+)/i.exec(uri);
    if (internal) {
      out.push({ ...rect, type: 'page', value: Number(internal[1]), title: '' });
    } else if (/^https?:|^mailto:/i.test(uri)) {
      out.push({ ...rect, type: 'url', value: uri, title: '' });
    }
  }
  return out;
}

function sliceLines(lines, segment, segments) {
  if (segments === 1) return lines;
  const lo = segment / segments;
  const hi = (segment + 1) / segments;
  return lines
    .filter((l) => l.x + l.w / 2 >= lo && l.x + l.w / 2 < hi)
    .map((l) => clampRect({ ...l, x: (l.x - lo) * segments, w: l.w * segments }));
}

function sliceLinks(links, segment, segments) {
  if (segments === 1) return links;
  const lo = segment / segments;
  const hi = (segment + 1) / segments;
  return links
    .filter((l) => l.x + l.w / 2 >= lo && l.x + l.w / 2 < hi)
    .map((l) => clampRect({ ...l, x: (l.x - lo) * segments, w: l.w * segments }));
}

/** Keep a box that straddled the gutter inside its half. */
function clampRect(rect) {
  const x = Math.max(0, Math.min(1, rect.x));
  const y = Math.max(0, Math.min(1, rect.y));
  return { ...rect, x, y, w: Math.min(1 - x, rect.w), h: Math.min(1 - y, rect.h) };
}

function readOutline(doc) {
  const flat = [];
  const walk = (nodes, level) => {
    for (const node of nodes || []) {
      const title = String(node.title || '').replace(/\s+/g, ' ').trim();
      if (title) flat.push({ title, page: (node.page ?? 0) + 1, level });
      if (node.down) walk(node.down, level + 1);
    }
  };
  try {
    walk(doc.loadOutline(), 0);
  } catch {
    /* no outline */
  }
  return flat;
}

/** Outline + link targets refer to source pages; shift them past any splits. */
function remapOutline(outline, splitDecision) {
  const map = buildPageMap(splitDecision);
  return outline
    .map((entry) => ({ ...entry, page: map[entry.page] || entry.page, level: Math.min(entry.level, 2) }))
    .filter((entry) => entry.page >= 1);
}

function buildPageMap(splitDecision) {
  const map = {};
  let out = 0;
  splitDecision.forEach((split, i) => {
    out += 1;
    map[i + 1] = out;
    if (split) out += 1;
  });
  return map;
}

function collectLinks(pages, splitDecision) {
  const map = buildPageMap(splitDecision);
  const out = {};
  for (const page of pages) {
    if (!page.links.length) continue;
    out[page.index] = page.links.map((link) =>
      link.type === 'page' ? { ...link, value: String(map[link.value] || link.value) } : { ...link, value: String(link.value) }
    );
  }
  return out;
}

/** The `pages` block stored on a book record, derived from a conversion. */
export function pagesRecord(manifest) {
  return {
    count: manifest.pageCount,
    width: manifest.width,
    height: manifest.height,
    aspect: manifest.aspect,
    format: manifest.format,
    hasText: manifest.hasText,
    splitApplied: manifest.splitApplied,
    map: manifest.map,
    sizes: manifest.sizes,
    ptWidth: manifest.ptWidth,
    ptHeight: manifest.ptHeight,
    source: manifest.source
  };
}

export function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}
