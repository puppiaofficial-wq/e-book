import { escapeHtml } from './util.js';
import { VERSION } from './config.js';
import * as store from './store.js';

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export function viewerPage({ book, manifest, origin, embed = false, shareToken = null }) {
  const cover = `${origin}/media/${book.id}/thumbs/p0001.webp`;
  const canonical = `${origin}/b/${book.slug}`;
  const title = escapeHtml(book.title);
  const description = escapeHtml(book.description || book.subtitle || store.settings().tagline || '');
  const boot = JSON.stringify({ ...manifest, embed, shareToken, origin }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(book.appearance.theme || 'dark')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${cover}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${escapeHtml(manifest.appearance.background || '#111315')}">
<link rel="icon" href="/assets/favicon.svg">
<link rel="preload" as="image" href="/media/${book.id}/pages/p0001.webp" fetchpriority="high">
<link rel="stylesheet" href="/viewer/viewer.css?v=${VERSION}">
</head>
<body class="${embed ? 'is-embed' : ''}">
<div id="app" class="viewer" aria-busy="true"></div>
<noscript><p style="color:#fff;font-family:${FONT_STACK};padding:2rem">This catalog viewer needs JavaScript enabled.</p></noscript>
<script>window.__BOOK__ = ${boot};</script>
<script src="/viewer/viewer.js?v=${VERSION}"></script>
</body>
</html>`;
}

/** The console shell, stamped so a browser can never serve yesterday's build. */
export function adminPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>eBook Studio</title>
<meta name="robots" content="noindex">
<meta name="app-version" content="${VERSION}">
<link rel="icon" href="/assets/favicon.svg">
<link rel="stylesheet" href="/admin/assets/admin.css?v=${VERSION}">
</head>
<body>
<div id="root" class="boot"><div class="spinner"></div></div>
<script type="module" src="/admin/assets/admin.js?v=${VERSION}"></script>
</body>
</html>`;
}

export function gatePage({ title, message, origin, form = null, tone = 'info' }) {
  const accent = store.settings().accent || '#e2001a';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/assets/favicon.svg">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
         background:#0d0f11; color:#e9ecef; font-family:${FONT_STACK}; }
  .card { width:min(420px,100%); background:#16191d; border:1px solid #23282e; border-radius:16px;
          padding:32px; text-align:center; box-shadow:0 24px 60px rgba(0,0,0,.45); }
  h1 { font-size:19px; margin:0 0 10px; letter-spacing:-.01em; }
  p { margin:0 0 20px; color:#98a2ad; font-size:14px; line-height:1.6; }
  .mark { width:44px;height:44px;margin:0 auto 18px;border-radius:12px;display:grid;place-items:center;
          background:${tone === 'error' ? '#3a1d1f' : '#1d2937'}; font-size:20px; }
  form { display:grid; gap:10px; }
  input { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #2c333a;
          background:#0f1215; color:#fff; font-size:15px; }
  input:focus { outline:2px solid ${accent}; outline-offset:1px; border-color:transparent; }
  button { padding:12px 14px; border:0; border-radius:10px; background:${accent}; color:#fff;
           font-size:15px; font-weight:600; cursor:pointer; }
  button:hover { filter:brightness(1.08); }
  .err { color:#ff8b8b; font-size:13px; margin:0 0 12px; }
  a { color:#9fb4c9; font-size:13px; }
</style>
</head>
<body>
<div class="card">
  <div class="mark">${tone === 'error' ? '&#9888;' : '&#128274;'}</div>
  <h1>${escapeHtml(title)}</h1>
  <p>${message}</p>
  ${form || ''}
  <a href="${origin}/">Back to the library</a>
</div>
</body>
</html>`;
}

export function libraryPage({ books, origin, collections }) {
  const s = store.settings();
  const accent = s.accent || '#e2001a';
  const groups = new Map();
  for (const book of books) {
    const key = book.collectionId || '_';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
  }
  const nameOf = (key) =>
    key === '_' ? '' : collections.find((c) => c.id === key)?.name || '';

  const sections = [...groups.entries()]
    .map(([key, list]) => {
      const heading = nameOf(key);
      const cards = list
        .map(
          (book) => `<a class="card" href="${origin}/b/${escapeHtml(book.slug)}">
        <div class="cover"><img src="/media/${book.id}/thumbs/p0001.webp" alt="" loading="lazy" width="280" height="${Math.round(280 / (book.pages.aspect || 0.707))}"></div>
        <div class="meta">
          <span class="title">${escapeHtml(book.title)}</span>
          ${book.subtitle ? `<span class="sub">${escapeHtml(book.subtitle)}</span>` : ''}
          <span class="pages">${book.pages.count} pages</span>
        </div>
      </a>`
        )
        .join('\n');
      return `<section>${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}<div class="grid">${cards}</div></section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(s.siteTitle)}</title>
<meta name="description" content="${escapeHtml(s.tagline)}">
<meta property="og:title" content="${escapeHtml(s.siteTitle)}">
<meta property="og:description" content="${escapeHtml(s.tagline)}">
<link rel="icon" href="/assets/favicon.svg">
<style>
  :root { color-scheme: light dark; --accent:${accent}; --bg:#ffffff; --fg:#14181c; --muted:#697380; --line:#e6e9ee; --card:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d0f11; --fg:#eef1f4; --muted:#98a2ad; --line:#23282e; --card:#15181c; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:${FONT_STACK}; }
  header { padding:56px 24px 32px; text-align:center; border-bottom:1px solid var(--line); }
  header img { max-height:44px; margin-bottom:18px; }
  h1 { margin:0 0 8px; font-size:clamp(24px,4vw,34px); letter-spacing:-.02em; }
  header p { margin:0; color:var(--muted); font-size:15px; }
  main { max-width:1180px; margin:0 auto; padding:36px 20px 80px; }
  section { margin-bottom:44px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 16px; }
  .grid { display:grid; gap:22px; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); }
  .card { text-decoration:none; color:inherit; display:block; }
  .cover { border-radius:10px; overflow:hidden; background:var(--card); border:1px solid var(--line);
           box-shadow:0 10px 24px rgba(0,0,0,.14); transition:transform .18s ease, box-shadow .18s ease; }
  .card:hover .cover { transform:translateY(-4px); box-shadow:0 18px 36px rgba(0,0,0,.22); }
  .cover img { display:block; width:100%; height:auto; }
  .meta { padding:12px 2px; display:grid; gap:3px; }
  .title { font-size:15px; font-weight:600; letter-spacing:-.01em; }
  .sub, .pages { font-size:12.5px; color:var(--muted); }
  footer { text-align:center; padding:0 20px 60px; color:var(--muted); font-size:13px; }
  .empty { text-align:center; color:var(--muted); padding:80px 0; }
</style>
</head>
<body>
<header>
  ${s.logoUrl ? `<img src="${escapeHtml(s.logoUrl)}" alt="${escapeHtml(s.siteTitle)}">` : ''}
  <h1>${escapeHtml(s.siteTitle)}</h1>
  <p>${escapeHtml(s.tagline)}</p>
</header>
<main>
  ${books.length ? sections : '<p class="empty">No catalogs published yet.</p>'}
</main>
<footer>${escapeHtml(s.footerNote || '')}${s.contactEmail ? ` &middot; <a href="mailto:${escapeHtml(s.contactEmail)}" style="color:inherit">${escapeHtml(s.contactEmail)}</a>` : ''}</footer>
</body>
</html>`;
}
