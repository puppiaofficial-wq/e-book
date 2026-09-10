#!/usr/bin/env node
/**
 * Writes a catalog out as a plain folder of files: HTML, CSS, JS and images,
 * with no server behind it. Upload the folder to any static host - image
 * hosting, a CDN, a plain web host - and the viewer works as it does here.
 *
 *   npm run export                 every published catalog
 *   npm run export -- 2026fw       one catalog
 *   npm run export -- all --out D:\\upload
 */
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { ROOT, PUBLIC_DIR } from '../server/config.js';
import * as store from '../server/store.js';
import { bookDir } from '../server/access.js';
import { escapeHtml, pad } from '../server/util.js';
import { renderRegion, locatePage } from '../server/hires.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : fallback;
};
const target = args.find((a) => !a.startsWith('--')) || 'all';
const outRoot = path.resolve(ROOT, flag('out', 'export'));
// A static host cannot render regions on demand, so the exported zoom images
// can be re-rendered larger to buy back the magnification range.
const zoomWidth = flag('zoom') ? Math.min(6000, Math.max(1200, Number(flag('zoom')))) : null;

const selected = target === 'all'
  ? store.books().filter((b) => b.status === 'published')
  : store.books().filter((b) => b.slug === target || b.id === target);

if (!selected.length) {
  console.error(target === 'all'
    ? '게시된 카탈로그가 없습니다. 관리자 화면에서 Publish 한 뒤 다시 실행해 주세요.'
    : `카탈로그를 찾을 수 없습니다: ${target}`);
  process.exit(1);
}

await fsp.mkdir(outRoot, { recursive: true });

for (const book of selected) {
  const dir = path.join(outRoot, book.slug);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });

  for (const kind of ['pages', 'zoom', 'thumbs']) {
    await fsp.cp(path.join(bookDir(book.id), kind), path.join(dir, kind), { recursive: true });
  }
  const rendered = zoomWidth ? await rerenderZoom(book, dir, zoomWidth) : null;
  const textFile = path.join(bookDir(book.id), 'text.json');
  if (fs.existsSync(textFile)) await fsp.copyFile(textFile, path.join(dir, 'text.json'));
  if (book.downloads.pdf) {
    const pdf = path.join(bookDir(book.id), 'source.pdf');
    if (fs.existsSync(pdf)) await fsp.copyFile(pdf, path.join(dir, `${book.slug}.pdf`));
  }

  await fsp.copyFile(path.join(PUBLIC_DIR, 'viewer', 'viewer.css'), path.join(dir, 'viewer.css'));
  await fsp.copyFile(path.join(PUBLIC_DIR, 'viewer', 'viewer.js'), path.join(dir, 'viewer.js'));
  await fsp.copyFile(path.join(PUBLIC_DIR, 'assets', 'favicon.svg'), path.join(dir, 'favicon.svg'));
  await fsp.writeFile(path.join(dir, 'index.html'), staticViewer(book));

  const bytes = await folderSize(dir);
  console.log(
    `${book.slug.padEnd(20)} ${book.pages.count}페이지  ` +
    `확대이미지 ${rendered || book.pages.sizes?.zoom || '?'}px  ` +
    `${(bytes / 1048576).toFixed(1)} MB  ->  ${dir}`
  );
}

if (selected.length > 1 || target === 'all') {
  await fsp.writeFile(path.join(outRoot, 'index.html'), staticLibrary(selected));
}

console.log(`\n완료. ${outRoot} 폴더를 그대로 업로드하세요.`);
process.exit(0);

/* ---------------------------------------------------------- output */

/** Re-renders the zoom tier straight from the PDF at a chosen width. */
async function rerenderZoom(book, dir, width) {
  const pdfPath = path.join(bookDir(book.id), 'source.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.log(`  (원본 PDF가 없어 확대 이미지를 다시 만들지 못했습니다: ${book.slug})`);
    return null;
  }
  process.stdout.write(`  확대 이미지 재생성 ${width}px …`);
  for (let page = 1; page <= book.pages.count; page += 1) {
    const where = locatePage(book, page, pdfPath);
    if (!where) return null;
    const buffer = await renderRegion({
      bookId: book.id,
      pdfPath,
      sourcePage: where.sourcePage,
      half: where.half,
      rect: { x: 0, y: 0, w: 1, h: 1 },
      pixels: width,
      maxEdge: width * 2,
      maxPixels: 4.5e7,
      quality: 84
    });
    await fsp.writeFile(path.join(dir, 'zoom', `p${pad(page)}.webp`), buffer);
    if (page % 10 === 0) process.stdout.write(` ${page}`);
  }
  process.stdout.write(' 완료\n');
  return width;
}

function staticManifest(book) {
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
    sizes: { ...(book.pages.sizes || { view: 1500, zoom: 3000, thumb: 320 }), ...(zoomWidth ? { zoom: zoomWidth } : {}) },
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

function staticViewer(book) {
  const manifest = staticManifest(book);
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
<script type="module" src="viewer.js"></script>
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
