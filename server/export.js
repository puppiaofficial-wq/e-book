/**
 * Writes a catalog out as a plain folder of files: HTML, CSS, JS and images,
 * with no server behind it. Upload the folder (or the zip of it) to any static
 * host and the viewer works exactly as it does here.
 */
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { PUBLIC_DIR, EXPORT_DIR } from './config.js';
import * as store from './store.js';
import { bookDir } from './access.js';
import { escapeHtml, pad } from './util.js';
import { renderRegion, locatePage } from './hires.js';
import { zipDirectory } from './zip.js';

/**
 * @param onProgress receives { done, total, stage } while zoom images are rebuilt
 * @returns { dir, bytes, zoomWidth }
 */
export async function exportBook(book, outRoot, { zoomWidth = null, onProgress = () => {} } = {}) {
  const dir = path.join(outRoot, book.slug);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });

  for (const kind of ['pages', 'zoom', 'thumbs']) {
    await fsp.cp(path.join(bookDir(book.id), kind), path.join(dir, kind), { recursive: true });
  }
  const rendered = zoomWidth ? await rerenderZoom(book, dir, zoomWidth, onProgress) : null;

  const textFile = path.join(bookDir(book.id), 'text.json');
  if (fs.existsSync(textFile)) await fsp.copyFile(textFile, path.join(dir, 'text.json'));
  if (book.downloads.pdf) {
    const pdf = path.join(bookDir(book.id), 'source.pdf');
    if (fs.existsSync(pdf)) await fsp.copyFile(pdf, path.join(dir, `${book.slug}.pdf`));
  }

  await fsp.copyFile(path.join(PUBLIC_DIR, 'viewer', 'viewer.css'), path.join(dir, 'viewer.css'));
  await fsp.copyFile(path.join(PUBLIC_DIR, 'viewer', 'viewer.js'), path.join(dir, 'viewer.js'));
  await fsp.copyFile(path.join(PUBLIC_DIR, 'assets', 'favicon.svg'), path.join(dir, 'favicon.svg'));
  await fsp.writeFile(path.join(dir, 'index.html'), staticViewer(book, rendered));

  return { dir, bytes: await folderSize(dir), zoomWidth: rendered || book.pages.sizes?.zoom || null };
}

export async function writeLibraryIndex(outRoot, books) {
  await fsp.writeFile(path.join(outRoot, 'index.html'), staticLibrary(books));
}

/** Cloudflare Pages and most static hosts accept a dropped zip directly. */
export function zipFolder(dir, zipPath) {
  return zipDirectory(dir, zipPath);
}

export function exportPathsFor(book) {
  return {
    dir: path.join(EXPORT_DIR, book.slug),
    zip: path.join(EXPORT_DIR, `${book.slug}.zip`)
  };
}

/* ---------------------------------------------------------- output */

/** Re-renders the zoom tier straight from the PDF at a chosen width. */
async function rerenderZoom(book, dir, width, onProgress) {
  const pdfPath = path.join(bookDir(book.id), 'source.pdf');
  if (!fs.existsSync(pdfPath)) return null;

  // Flattened artwork cannot be rendered past its own resolution: doing so
  // bakes an upscale into the bundle and then invites the viewer to magnify
  // into it, which looks worse than leaving the pages at source size.
  const native = book.pages.sizes?.native || null;
  const target = native ? Math.min(width, native) : width;

  for (let page = 1; page <= book.pages.count; page += 1) {
    const where = locatePage(book, page, pdfPath);
    if (!where) return null;
    const buffer = await renderRegion({
      bookId: book.id,
      pdfPath,
      sourcePage: where.sourcePage,
      half: where.half,
      rect: { x: 0, y: 0, w: 1, h: 1 },
      pixels: target,
      nativeWidth: native,
      maxEdge: target * 2,
      maxPixels: 4.5e7,
      quality: 84
    });
    await fsp.writeFile(path.join(dir, 'zoom', `p${pad(page)}.webp`), buffer);
    onProgress({ done: page, total: book.pages.count, stage: 'zoom' });
  }
  return target;
}

function staticManifest(book, renderedZoom) {
  const settings = store.settings();
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    pageCount: book.pages.count,
    aspect: book.pages.aspect || 0.707,
    layout: book.layout,
    appearance: {
      theme: book.appearance.theme,
      accent: book.appearance.accent || settings.accent,
      background: book.appearance.background,
      logoUrl: book.appearance.logoUrl || settings.logoUrl,
      showShare: book.appearance.showShare !== false,
      showPrint: Boolean(book.appearance.showPrint),
      autoHideUi: book.appearance.autoHideUi !== false
    },
    capabilities: {
      search: Boolean(book.pages.hasText),
      download: Boolean(book.downloads.pdf),
      hires: false,       // nothing to render with once the server is gone
      preview: false
    },
    sizes: { ...(book.pages.sizes || { view: 1500, zoom: 3000, thumb: 320 }), ...(renderedZoom ? { zoom: renderedZoom } : {}) },
    toc: book.toc || [],
    links: book.links || {},
    static: true,
    urls: {
      page: 'pages/p{n}.webp',
      zoom: 'zoom/p{n}.webp',
      thumb: 'thumbs/p{n}.webp',
      hires: null,
      text: 'text.json',
      download: book.downloads.pdf ? `${book.slug}.pdf` : null,
      self: ''
    }
  };
}

function staticViewer(book, renderedZoom) {
  const manifest = staticManifest(book, renderedZoom);
  const boot = JSON.stringify(manifest).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(book.appearance.theme || 'dark')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<title>${escapeHtml(book.title)}</title>
<meta name="description" content="${escapeHtml(book.description || book.subtitle || '')}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(book.title)}">
<meta property="og:description" content="${escapeHtml(book.description || book.subtitle || '')}">
<meta property="og:image" content="thumbs/p0001.webp">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg">
<link rel="preload" as="image" href="pages/p0001.webp" fetchpriority="high">
<link rel="stylesheet" href="viewer.css">
</head>
<body>
<div id="app" class="viewer" aria-busy="true"></div>
<noscript><p style="color:#fff;padding:2rem;font:15px system-ui">This catalog viewer needs JavaScript enabled.</p></noscript>
<script>window.__BOOK__ = ${boot};</script>
<script src="viewer.js"></script>
</body>
</html>`;
}

function staticLibrary(books) {
  const s = store.settings();
  const cards = books.map((book) => `<a class="card" href="${escapeHtml(book.slug)}/">
      <img src="${escapeHtml(book.slug)}/thumbs/p0001.webp" alt="" loading="lazy">
      <span>${escapeHtml(book.title)}</span>
      <small>${book.pages.count} pages</small>
    </a>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(s.siteTitle)}</title>
<link rel="icon" href="${escapeHtml(books[0].slug)}/favicon.svg">
<style>
 :root{color-scheme:light dark;--bg:#fff;--fg:#14181c;--muted:#697380;--line:#e6e9ee}
 @media(prefers-color-scheme:dark){:root{--bg:#0d0f11;--fg:#eef1f4;--muted:#98a2ad;--line:#23282e}}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
 header{padding:56px 24px 32px;text-align:center;border-bottom:1px solid var(--line)}
 h1{margin:0 0 8px;font-size:clamp(24px,4vw,34px);letter-spacing:-.02em}
 header p{margin:0;color:var(--muted)}
 main{max-width:1180px;margin:0 auto;padding:36px 20px 80px;display:grid;gap:22px;
      grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
 .card{text-decoration:none;color:inherit;display:grid;gap:6px}
 .card img{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);
           box-shadow:0 10px 24px rgba(0,0,0,.14);transition:transform .18s}
 .card:hover img{transform:translateY(-4px)}
 .card span{font-size:15px;font-weight:600}
 .card small{color:var(--muted);font-size:12.5px}
</style></head>
<body>
<header><h1>${escapeHtml(s.siteTitle)}</h1><p>${escapeHtml(s.tagline)}</p></header>
<main>${cards}</main>
</body></html>`;
}

async function folderSize(dir) {
  let total = 0;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? await folderSize(full) : (await fsp.stat(full)).size;
  }
  return total;
}
