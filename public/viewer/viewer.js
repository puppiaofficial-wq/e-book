/* eBook Studio viewer - dependency free, touch first. */

const BOOK = window.__BOOK__;
const N = BOOK.pageCount;
const PAD4 = (n) => String(n).padStart(4, '0');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAN_HOVER = matchMedia('(hover: hover)').matches;

const ICON = {
  contents: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2M8.5 11h5M11 8.5v5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  download: '<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 15h12v6H6z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  prev: '<path d="M15 5 8 12l7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  first: '<path d="M18 5l-7 7 7 7M6 5v14"/>',
  last: '<path d="m6 5 7 7-7 7M18 5v14"/>',
  external: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2z"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>'
};

const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

const app = document.getElementById('app');
app.innerHTML = `
  <header class="bar bar--top">
    <div class="brand">
      ${BOOK.appearance.logoUrl ? `<img src="${BOOK.appearance.logoUrl}" alt="">` : ''}
      <span class="brand__title" id="docTitle"></span>
    </div>
    <div class="bar__spacer"></div>
    <button class="btn" id="btnContents" title="Contents (C)" aria-label="Contents" aria-pressed="false">${svg(ICON.contents)}</button>
    <button class="btn" id="btnSearch" title="Search (S)" aria-label="Search" aria-pressed="false">${svg(ICON.search)}</button>
    <button class="btn" id="btnThumbs" title="All pages (G)" aria-label="All pages" aria-pressed="false">${svg(ICON.grid)}</button>
    <button class="btn" id="btnZoom" title="Zoom (Z)" aria-label="Zoom">${svg(ICON.zoom)}</button>
    <button class="btn" id="btnPrint" title="Print" aria-label="Print" hidden>${svg(ICON.print)}</button>
    <button class="btn" id="btnDownload" title="Download PDF" aria-label="Download PDF" hidden>${svg(ICON.download)}</button>
    <button class="btn" id="btnShare" title="Share (H)" aria-label="Share" hidden>${svg(ICON.share)}</button>
    <button class="btn" id="btnFull" title="Full screen (F)" aria-label="Full screen">${svg(ICON.expand)}</button>
    <a class="btn" id="btnOpen" title="Open in a new tab" aria-label="Open in a new tab" target="_blank" rel="noopener" hidden>${svg(ICON.external)}</a>
  </header>

  <main class="stage" id="stage">
    <div class="book" id="book">
      <div class="pane pane--left" id="paneLeft"><img alt="" id="imgLeft"><div class="hotspots" id="spotsLeft"></div></div>
      <div class="pane pane--right" id="paneRight"><img alt="" id="imgRight"><div class="hotspots" id="spotsRight"></div></div>
    </div>
    <button class="edge edge--prev" id="edgePrev" aria-label="Previous page">${svg(ICON.prev)}</button>
    <button class="edge edge--next" id="edgeNext" aria-label="Next page">${svg(ICON.next)}</button>
    <div class="loader" id="loader"><div class="loader__spin"></div></div>
  </main>

  <footer class="bar bar--bottom">
    <button class="btn" id="btnFirst" aria-label="First page">${svg(ICON.first)}</button>
    <button class="btn" id="btnPrev" aria-label="Previous page">${svg(ICON.prev)}</button>
    <div class="pager">
      <input class="slider" id="slider" type="range" min="1" max="${N}" value="1" aria-label="Page">
      <span class="pager__label" id="pageLabel"></span>
    </div>
    <button class="btn" id="btnNext" aria-label="Next page">${svg(ICON.next)}</button>
    <button class="btn" id="btnLast" aria-label="Last page">${svg(ICON.last)}</button>
  </footer>

  <aside class="panel" id="panelContents" data-open="false" aria-hidden="true">
    <div class="panel__head">
      <span class="panel__title">Contents</span>
      <button class="btn" data-close="panelContents" aria-label="Close">${svg(ICON.close)}</button>
    </div>
    <div class="panel__body" id="tocBody"></div>
  </aside>

  <aside class="panel" id="panelSearch" data-open="false" aria-hidden="true">
    <div class="panel__head">
      <span class="panel__title">Search</span>
      <button class="btn" data-close="panelSearch" aria-label="Close">${svg(ICON.close)}</button>
    </div>
    <div class="searchbar">
      <input id="searchInput" type="search" placeholder="Search this catalog" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="panel__body" id="searchBody"></div>
  </aside>

  <div class="thumbs" id="thumbs" data-open="false" aria-hidden="true">
    <div class="thumbs__grid" id="thumbsGrid"></div>
  </div>

  <div class="zoom" id="zoom" data-open="false" aria-hidden="true">
    <div class="zoom__canvas" id="zoomCanvas"></div>
    <button class="btn zoom__close" id="zoomClose" aria-label="Close zoom">${svg(ICON.close)}</button>
    <div class="zoom__hint" id="zoomHint">Scroll or pinch to zoom, drag to pan</div>
    <div class="zoom__busy" id="zoomBusy" hidden><span class="zoom__spin"></span>Loading detail</div>
  </div>

  <div class="sheet-backdrop" id="shareBackdrop" data-open="false">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Share this catalog">
      <h2>Share this catalog</h2>
      <p id="shareSub"></p>
      <div class="copyrow">
        <input id="shareUrl" readonly>
        <button class="btn btn--wide btn--accent" id="shareCopy">Copy</button>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:14px">
        <input type="checkbox" id="shareAtPage"> <span id="shareAtPageLabel">Open at the current page</span>
      </label>
      <div class="share-grid" id="shareGrid"></div>
      <div class="qr" id="shareQr" hidden></div>
      <button class="btn btn--wide" id="shareClose" style="width:100%;justify-content:center;margin-top:6px">Close</button>
    </div>
  </div>

  <div class="toast" id="toast" role="status"></div>
  <p class="sr-only" id="live" aria-live="polite"></p>
`;

const el = new Proxy({}, { get: (_, key) => document.getElementById(key) });

/* --------------------------------------------------------- state */

const state = {
  page: 1,
  spread: false,
  pw: 0,
  ph: 0,
  busy: false,
  uiHidden: false,
  openPanel: null
};

const aspect = BOOK.aspect || 0.707;
const coverAlone = BOOK.layout.coverAlone !== false;
const rtl = Boolean(BOOK.layout.rtl);

document.documentElement.style.setProperty('--accent', BOOK.appearance.accent || '#e2001a');
if (BOOK.appearance.background) document.documentElement.style.setProperty('--bg', BOOK.appearance.background);
el.docTitle.textContent = BOOK.title;
el.slider.max = String(N);

const urlFor = (kind, page) => BOOK.urls[kind].replace('{n}', PAD4(page));

/* ------------------------------------------------------- pairing */

function useSpread() {
  if (BOOK.layout.mode === 'single') return false;
  if (BOOK.layout.mode === 'spread') return true;
  return window.innerWidth >= 760 && window.innerWidth > window.innerHeight * 1.02;
}

function pairOf(page) {
  if (!state.spread) return { left: page, right: null, single: true };
  if (coverAlone) {
    if (page <= 1) return { left: null, right: 1 };
    if (page >= N && N % 2 === 1) return { left: N, right: null };
    const left = page % 2 === 0 ? page : page - 1;
    return { left, right: left + 1 <= N ? left + 1 : null };
  }
  const left = page % 2 === 1 ? page : page - 1;
  return { left, right: left + 1 <= N ? left + 1 : null };
}

const firstOf = (p) => { const x = pairOf(p); return x.left ?? x.right ?? p; };
const lastOf = (p) => { const x = pairOf(p); return x.right ?? x.left ?? p; };
const canNext = () => lastOf(state.page) < N;
const canPrev = () => firstOf(state.page) > 1;
const nextTarget = () => Math.min(N, lastOf(state.page) + 1);
const prevTarget = () => Math.max(1, firstOf(state.page) - 1);

/** Printed page number, honouring the offset configured by the publisher. */
function printedLabel(page) {
  const offset = Number(BOOK.layout.pageOffset || 0);
  return offset ? page - offset + 1 : page;
}

/* -------------------------------------------------------- layout */

function measure() {
  state.spread = useSpread();
  el.book.classList.toggle('book--spread', state.spread);
  const rect = el.stage.getBoundingClientRect();
  const pad = window.innerWidth <= 720 ? 12 : 40;
  const availW = Math.max(120, rect.width - pad);
  const availH = Math.max(120, rect.height - pad);
  const cols = state.spread ? 2 : 1;
  let ph = availH;
  let pw = ph * aspect;
  if (pw * cols > availW) {
    pw = availW / cols;
    ph = pw / aspect;
  }
  state.pw = Math.floor(pw);
  state.ph = Math.floor(ph);
  for (const pane of [el.paneLeft, el.paneRight]) {
    pane.style.width = `${state.pw}px`;
    pane.style.height = `${state.ph}px`;
  }
  el.paneRight.style.display = state.spread ? '' : 'none';
  document.documentElement.style.setProperty('--aspect', String(aspect));
}

/** Above roughly 1400 device pixels the zoom asset is the sharper choice. */
function bestKind() {
  return state.pw * (window.devicePixelRatio || 1) > 1450 ? 'zoom' : 'page';
}

/* -------------------------------------------------------- render */

function hideLoader() {
  el.loader.hidden = true;
}

function setPane(pane, img, spots, page) {
  if (!page) {
    pane.classList.add('pane--empty');
    img.removeAttribute('src');
    spots.innerHTML = '';
    return;
  }
  pane.classList.remove('pane--empty');
  const src = urlFor(bestKind(), page);
  if (img.getAttribute('src') !== src) {
    img.src = src;
    img.decode?.().then(hideLoader, hideLoader);
  } else if (img.complete) {
    hideLoader();
  }
  img.alt = `Page ${printedLabel(page)}`;
  renderHotspots(spots, page);
}

function renderPanes() {
  const pair = pairOf(state.page);
  setPane(el.paneLeft, el.imgLeft, el.spotsLeft, rtl ? pair.right : pair.left);
  setPane(el.paneRight, el.imgRight, el.spotsRight, rtl ? pair.left : pair.right);
  applyShift(pair);
  syncChrome();
  preload();
}

/** Centre a spread that only has one page, such as the cover. */
function applyShift(pair) {
  if (!state.spread) { el.book.style.transform = ''; return; }
  const left = rtl ? pair.right : pair.left;
  const right = rtl ? pair.left : pair.right;
  const shift = !left ? -state.pw / 2 : (!right ? state.pw / 2 : 0);
  el.book.style.transform = shift ? `translateX(${shift}px)` : 'translateX(0)';
}

function renderHotspots(container, page) {
  const links = BOOK.links[String(page)] || [];
  if (!links.length) { container.innerHTML = ''; return; }
  container.innerHTML = links
    .map((link, i) => {
      const style = `left:${(link.x * 100).toFixed(3)}%;top:${(link.y * 100).toFixed(3)}%;width:${(link.w * 100).toFixed(3)}%;height:${(link.h * 100).toFixed(3)}%`;
      const label = link.title || (link.type === 'page' ? `Go to page ${link.value}` : link.value);
      return `<button class="hotspot" style="${style}" data-page="${page}" data-i="${i}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"></button>`;
    })
    .join('');
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function syncChrome() {
  const pair = pairOf(state.page);
  const from = printedLabel(pair.left ?? pair.right);
  const to = pair.right && pair.left ? printedLabel(pair.right) : null;
  el.pageLabel.innerHTML = `<b>${to ? `${from}–${to}` : from}</b> / ${printedLabel(N)}`;
  el.slider.value = String(firstOf(state.page));
  el.btnPrev.disabled = el.btnFirst.disabled = el.edgePrev.disabled = !canPrev();
  el.btnNext.disabled = el.btnLast.disabled = el.edgeNext.disabled = !canNext();
  el.live.textContent = `Page ${to ? `${from} to ${to}` : from} of ${printedLabel(N)}`;
  markCurrentToc();
  const hash = `#p=${firstOf(state.page)}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

const preloaded = new Set();
function preload() {
  const kind = bestKind();
  const first = firstOf(state.page);
  for (let p = first - 3; p <= first + 5; p += 1) {
    if (p < 1 || p > N) continue;
    const src = urlFor(kind, p);
    if (preloaded.has(src)) continue;
    preloaded.add(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

/* ---------------------------------------------------- page turning */

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function faceMarkup(kind, page) {
  const src = page ? urlFor(bestKind(), page) : '';
  return `<div class="face face--${kind}">${src ? `<img src="${src}" alt="">` : ''}<div class="face__shade"></div></div>`;
}

/**
 * Builds the turning sheet. The pane that the sheet uncovers is switched to
 * its destination page immediately, so the reader sees the next page appear
 * from under the turning leaf exactly as in print.
 */
function beginTurn(direction) {
  const target = direction === 'next' ? nextTarget() : prevTarget();
  if (target === state.page && !(direction === 'next' ? canNext() : canPrev())) return null;
  const from = pairOf(state.page);
  const to = pairOf(target);

  const sheet = document.createElement('div');
  sheet.className = `turning turning--${direction}`;
  sheet.style.width = `${state.pw}px`;
  sheet.style.height = `${state.ph}px`;
  sheet.style.left = direction === 'next' ? `${state.pw}px` : '0px';
  sheet.style.transform = 'rotateY(0deg)';

  const frontPage = direction === 'next' ? from.right : from.left;
  const backPage = direction === 'next' ? to.left : to.right;
  sheet.innerHTML = faceMarkup('front', frontPage) + faceMarkup('back', backPage);
  el.book.appendChild(sheet);

  if (direction === 'next') setPane(el.paneRight, el.imgRight, el.spotsRight, to.right);
  else setPane(el.paneLeft, el.imgLeft, el.spotsLeft, to.left);
  applyShift(to);

  const shadeFront = sheet.querySelector('.face--front .face__shade');
  const shadeBack = sheet.querySelector('.face--back .face__shade');
  const sign = direction === 'next' ? -1 : 1;
  sheet.getBoundingClientRect(); // flush before any transition is attached

  return {
    target,
    set(progress) {
      const p = Math.max(0, Math.min(1, progress));
      sheet.style.transform = `rotateY(${sign * 180 * p}deg)`;
      shadeFront.style.opacity = String(Math.min(1, p * 1.6) * 0.55);
      shadeBack.style.opacity = String(Math.max(0, 1 - p * 1.2) * 0.55);
    },
    async settle(commit) {
      const duration = REDUCED ? 1 : 420;
      sheet.style.transition = `transform ${duration}ms cubic-bezier(.32,.06,.24,1)`;
      shadeFront.style.transition = shadeBack.style.transition = `opacity ${duration}ms linear`;
      this.set(commit ? 1 : 0);
      await wait(duration + 20);
      sheet.remove();
      if (commit) state.page = target;
      renderPanes();
    }
  };
}

async function slideTo(target, direction) {
  const sign = direction === 'next' ? -1 : 1;
  const distance = REDUCED ? 0 : 26;
  await el.paneLeft.animate(
    [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${sign * distance}%)`, opacity: 0 }],
    { duration: REDUCED ? 1 : 160, easing: 'ease-in' }
  ).finished;
  state.page = target;
  renderPanes();
  await el.paneLeft.animate(
    [{ transform: `translateX(${-sign * distance}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
    { duration: REDUCED ? 1 : 200, easing: 'ease-out' }
  ).finished;
}

async function turn(direction) {
  if (state.busy) return;
  const can = direction === 'next' ? canNext() : canPrev();
  if (!can) return;
  state.busy = true;
  try {
    const target = direction === 'next' ? nextTarget() : prevTarget();
    if (state.spread && !REDUCED) {
      const sheet = beginTurn(direction);
      if (sheet) await sheet.settle(true);
      else { state.page = target; renderPanes(); }
    } else {
      await slideTo(target, direction);
    }
    reportPage();
  } finally {
    state.busy = false;
  }
}

async function goTo(page, { animate = false } = {}) {
  const target = Math.max(1, Math.min(N, Math.round(page)));
  if (target === state.page) return;
  if (animate && Math.abs(target - state.page) <= 2) {
    return turn(target > state.page ? 'next' : 'prev');
  }
  state.page = target;
  renderPanes();
  reportPage();
}

/* ------------------------------------------------------- gestures */

let drag = null;

el.stage.addEventListener('pointerdown', (event) => {
  if (event.button != null && event.button > 0) return;
  if (event.target.closest('.hotspot, .edge, .btn')) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    t: Date.now(),
    started: false,
    sheet: null,
    direction: null,
    moved: 0
  };
});

el.stage.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.abs(dx));

  if (!drag.started) {
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (state.busy) return;
    drag.started = true;
    drag.direction = dx < 0 ? (rtl ? 'prev' : 'next') : (rtl ? 'next' : 'prev');
    el.stage.setPointerCapture?.(event.pointerId);
    if (state.spread && !REDUCED) {
      state.busy = true;
      drag.sheet = beginTurn(drag.direction);
      if (!drag.sheet) { state.busy = false; drag.started = false; }
    }
  }
  if (!drag.started) return;
  const progress = Math.min(1, Math.abs(dx) / (state.pw || 400));
  if (drag.sheet) drag.sheet.set(progress);
  else if (!state.spread) {
    el.paneLeft.style.transform = `translateX(${dx * 0.45}px)`;
    el.paneLeft.style.opacity = String(1 - progress * 0.5);
  }
  event.preventDefault();
}, { passive: false });

async function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  const current = drag;
  drag = null;
  const dx = event ? event.clientX - current.x : 0;
  const elapsed = Date.now() - current.t;

  if (!current.started) {
    if (current.moved < 8 && elapsed < 600 && event) handleTap(event);
    return;
  }

  const progress = Math.abs(dx) / (state.pw || 400);
  const fling = Math.abs(dx) > 60 && elapsed < 280;
  const commit = progress > 0.3 || fling;

  if (current.sheet) {
    await current.sheet.settle(commit);
    state.busy = false;
    if (commit) reportPage();
  } else if (!state.spread) {
    el.paneLeft.style.transform = '';
    el.paneLeft.style.opacity = '';
    if (commit) {
      const can = current.direction === 'next' ? canNext() : canPrev();
      if (can) await turn(current.direction);
    }
  }
}

el.stage.addEventListener('pointerup', endDrag);
el.stage.addEventListener('pointercancel', endDrag);

function handleTap(event) {
  const rect = el.stage.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  if (CAN_HOVER) {
    if (ratio < 0.35) turn('prev');
    else if (ratio > 0.65) turn('next');
    return;
  }
  if (ratio < 0.3) turn(rtl ? 'next' : 'prev');
  else if (ratio > 0.7) turn(rtl ? 'prev' : 'next');
  else toggleUi();
}

el.stage.addEventListener('dblclick', (event) => {
  if (event.target.closest('.hotspot')) return;
  openZoom();
});

el.stage.addEventListener('click', (event) => {
  const spot = event.target.closest('.hotspot');
  if (!spot) return;
  const links = BOOK.links[spot.dataset.page] || [];
  const link = links[Number(spot.dataset.i)];
  if (!link) return;
  if (link.type === 'page') return goTo(Number(link.value));
  const href = normaliseLink(link);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
});

/** Hotspot targets are author-supplied, so only known-safe schemes open. */
function normaliseLink(link) {
  const value = String(link.value || '').trim();
  if (!value) return null;
  if (link.type === 'email') return /^mailto:/i.test(value) ? value : `mailto:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^mailto:/i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return null;
}

/* -------------------------------------------------------- panels */

function openPanel(name) {
  for (const id of ['panelContents', 'panelSearch']) {
    const open = id === name;
    el[id].dataset.open = String(open);
    el[id].setAttribute('aria-hidden', String(!open));
  }
  const thumbsOpen = name === 'thumbs';
  el.thumbs.dataset.open = String(thumbsOpen);
  el.thumbs.setAttribute('aria-hidden', String(!thumbsOpen));
  if (thumbsOpen) buildThumbs();
  state.openPanel = name;
  el.btnContents.setAttribute('aria-pressed', String(name === 'panelContents'));
  el.btnSearch.setAttribute('aria-pressed', String(name === 'panelSearch'));
  el.btnThumbs.setAttribute('aria-pressed', String(thumbsOpen));
  if (name === 'panelSearch') setTimeout(() => el.searchInput.focus(), 60);
  if (name) showUi();
}

function togglePanel(name) {
  openPanel(state.openPanel === name ? null : name);
}

document.addEventListener('click', (event) => {
  const closer = event.target.closest('[data-close]');
  if (closer) openPanel(null);
});

el.btnContents.onclick = () => togglePanel('panelContents');
el.btnSearch.onclick = () => togglePanel('panelSearch');
el.btnThumbs.onclick = () => togglePanel('thumbs');

/* contents ------------------------------------------------------- */

function buildToc() {
  const entries = BOOK.toc || [];
  if (!entries.length) {
    el.btnContents.hidden = true;
    return;
  }
  el.tocBody.innerHTML = entries
    .map(
      (entry, i) => `<button class="toc-item" data-level="${Math.min(2, entry.level || 0)}" data-page="${entry.page}" data-i="${i}">
        <span>${escapeAttr(entry.title)}</span>
        <span class="toc-item__page">${printedLabel(entry.page)}</span>
      </button>`
    )
    .join('');
  el.tocBody.addEventListener('click', (event) => {
    const item = event.target.closest('.toc-item');
    if (!item) return;
    goTo(Number(item.dataset.page));
    if (window.innerWidth < 760) openPanel(null);
  });
}

function markCurrentToc() {
  const entries = BOOK.toc || [];
  if (!entries.length) return;
  let activeIndex = -1;
  entries.forEach((entry, i) => {
    if (entry.page <= lastOf(state.page)) activeIndex = i;
  });
  el.tocBody.querySelectorAll('.toc-item').forEach((node, i) => {
    node.setAttribute('aria-current', String(i === activeIndex));
  });
}

/* search --------------------------------------------------------- */

let searchTimer = null;
let lastQuery = '';

el.searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 240);
});

async function runSearch() {
  const query = el.searchInput.value.trim();
  if (query === lastQuery) return;
  lastQuery = query;
  if (query.length < 2) {
    el.searchBody.innerHTML = '<p class="empty-note">Type at least two characters to search the catalog text.</p>';
    return;
  }
  el.searchBody.innerHTML = '<p class="empty-note">Searching…</p>';
  try {
    const data = BOOK.static ? await searchLocally(query) : await searchOnServer(query);
    if (!data.hits.length) {
      el.searchBody.innerHTML = `<p class="empty-note">No results for “${escapeAttr(query)}”.</p>`;
      return;
    }
    el.searchBody.innerHTML = data.hits
      .map(
        (hit, i) => `<button class="hit" data-i="${i}" data-page="${hit.page}">
          <span class="hit__page">Page ${printedLabel(hit.page)}</span>
          <span class="hit__text">${highlight(hit.snippet, query)}</span>
        </button>`
      )
      .join('');
    el.searchBody.dataset.hits = JSON.stringify(data.hits);
  } catch {
    el.searchBody.innerHTML = '<p class="empty-note">Search is unavailable right now.</p>';
  }
}

el.searchBody?.addEventListener('click', (event) => {
  const button = event.target.closest('.hit');
  if (!button) return;
  const hits = JSON.parse(el.searchBody.dataset.hits || '[]');
  const hit = hits[Number(button.dataset.i)];
  goTo(Number(button.dataset.page)).then(() => markHit(hit));
  if (window.innerWidth < 760) openPanel(null);
});

async function searchOnServer(query) {
  const response = await fetch(`/api/v1/books/${encodeURIComponent(BOOK.slug)}/search?q=${encodeURIComponent(query)}`);
  return response.json();
}

/** Statically exported catalogs carry their text with them. */
let localIndex = null;
async function searchLocally(query) {
  if (!localIndex) {
    const response = await fetch(BOOK.urls.text);
    localIndex = await response.json();
  }
  const needle = query.toLowerCase();
  const hits = [];
  for (const page of localIndex.pages || []) {
    for (const line of page.lines || []) {
      const at = line.text.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      const start = Math.max(0, at - 32);
      hits.push({
        page: page.index,
        snippet: (start ? '…' : '') + line.text.slice(start, at + needle.length + 48).trim() + '…',
        box: { x: line.x, y: line.y, w: line.w, h: line.h }
      });
      if (hits.length >= 120) return { query, hits };
    }
  }
  return { query, hits };
}

function highlight(text, query) {
  const safe = escapeAttr(text);
  const needle = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(needle, 'ig'), (match) => `<mark>${match}</mark>`);
}

function markHit(hit) {
  if (!hit?.box) return;
  const pair = pairOf(state.page);
  const onLeft = (rtl ? pair.right : pair.left) === hit.page;
  const container = onLeft ? el.spotsLeft : el.spotsRight;
  const mark = document.createElement('div');
  mark.className = 'hitmark';
  mark.style.cssText = `left:${hit.box.x * 100}%;top:${hit.box.y * 100}%;width:${hit.box.w * 100}%;height:${hit.box.h * 100}%`;
  container.appendChild(mark);
  setTimeout(() => mark.remove(), 3400);
}

/* thumbnails ----------------------------------------------------- */

let thumbsBuilt = false;
function buildThumbs() {
  if (!thumbsBuilt) {
    const cells = [];
    for (let p = 1; p <= N; p += 1) {
      cells.push(`<button class="thumb" data-page="${p}">
        <img loading="lazy" decoding="async" src="${urlFor('thumb', p)}" alt="Page ${printedLabel(p)}" style="--aspect:${aspect}">
        <span>${printedLabel(p)}</span>
      </button>`);
    }
    el.thumbsGrid.innerHTML = cells.join('');
    el.thumbsGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('.thumb');
      if (!cell) return;
      goTo(Number(cell.dataset.page));
      openPanel(null);
    });
    thumbsBuilt = true;
  }
  const pair = pairOf(state.page);
  el.thumbsGrid.querySelectorAll('.thumb').forEach((cell) => {
    const page = Number(cell.dataset.page);
    cell.setAttribute('aria-current', String(page === pair.left || page === pair.right));
  });
  const active = el.thumbsGrid.querySelector('[aria-current="true"]');
  active?.scrollIntoView({ block: 'center' });
}

/* ---------------------------------------------------------- zoom */

/**
 * The pre-rendered zoom image has a fixed resolution, so magnifying past it can
 * only upscale. Once the reader settles on a view, the server re-renders just
 * that region from the source PDF at screen resolution and it is overlaid on
 * the base image, which keeps small print crisp at any magnification.
 */
const HIRES_GRID = 256;   // quantised request rects reuse the browser cache
const HIRES_MAX_PX = 3600;

const zoom = {
  scale: 1, x: 0, y: 0, fitH: 0, cols: 1, max: 6,
  pointers: new Map(), pinch: null, timer: null
};

function openZoom() {
  const pair = pairOf(state.page);
  const pages = (rtl ? [pair.right, pair.left] : [pair.left, pair.right]).filter(Boolean);
  if (!pages.length) return;

  zoom.cols = pages.length;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  zoom.fitH = Math.min(vh, vw / (zoom.cols * aspect));
  const pageWidth = zoom.fitH * aspect;

  el.zoomCanvas.innerHTML = pages
    .map((p) => `<div class="zoom__page" data-page="${p}" style="width:${pageWidth}px;height:${zoom.fitH}px">
        <img class="zoom__base" src="${urlFor('zoom', p)}" alt="Page ${printedLabel(p)}" draggable="false">
      </div>`)
    .join('');

  zoom.max = maxScale(pageWidth);
  zoom.scale = 1;
  zoom.x = (vw - zoom.cols * pageWidth) / 2;
  zoom.y = (vh - zoom.fitH) / 2;
  applyZoom();

  el.zoom.dataset.open = 'true';
  el.zoom.setAttribute('aria-hidden', 'false');
  el.zoomHint.style.opacity = '1';
  setTimeout(() => { el.zoomHint.style.opacity = '0'; }, 2600);
}

/**
 * Never magnify past what the artwork holds. For flattened catalog pages that
 * limit is the source image; for vector pages the server can render any size.
 */
function maxScale(pageCssWidth) {
  const ceiling = BOOK.sizes?.native
    || (BOOK.capabilities.hires ? null : BOOK.sizes?.zoom || 2400);
  if (!ceiling) return 8;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  // A modest single upscale past the source still reads well and keeps zoom
  // useful; the renderer itself never goes above the source resolution.
  return Math.max(1.4, Math.min(8, (ceiling * 1.6) / dpr / pageCssWidth));
}

function closeZoom() {
  clearTimeout(zoom.timer);
  hiresPending = 0;
  el.zoomBusy.hidden = true;
  el.zoom.dataset.open = 'false';
  el.zoom.setAttribute('aria-hidden', 'true');
  el.zoomCanvas.innerHTML = '';
}

function applyZoom() {
  el.zoomCanvas.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
  scheduleHires();
}

function zoomAt(clientX, clientY, factor) {
  const next = Math.max(1, Math.min(zoom.max, zoom.scale * factor));
  const ratio = next / zoom.scale;
  zoom.x = clientX - (clientX - zoom.x) * ratio;
  zoom.y = clientY - (clientY - zoom.y) * ratio;
  zoom.scale = next;
  clampZoom();
  applyZoom();
}

function clampZoom() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const contentW = zoom.cols * zoom.fitH * aspect * zoom.scale;
  const contentH = zoom.fitH * zoom.scale;
  const slackX = Math.max(0, contentW - vw);
  const slackY = Math.max(0, contentH - vh);
  zoom.x = slackX ? Math.min(0, Math.max(-slackX, zoom.x)) : (vw - contentW) / 2;
  zoom.y = slackY ? Math.min(0, Math.max(-slackY, zoom.y)) : (vh - contentH) / 2;
}

function scheduleHires() {
  if (!BOOK.capabilities.hires || !BOOK.urls.hires) return;
  clearTimeout(zoom.timer);
  zoom.timer = setTimeout(requestHires, 200);
}

function requestHires() {
  if (el.zoom.dataset.open !== 'true' || zoom.scale <= 1.05) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (const node of el.zoomCanvas.querySelectorAll('.zoom__page')) {
    const box = node.getBoundingClientRect();
    const left = Math.max(0, -box.left);
    const top = Math.max(0, -box.top);
    const right = Math.min(box.width, vw - box.left);
    const bottom = Math.min(box.height, vh - box.top);
    if (right - left < 48 || bottom - top < 48) continue;

    // A margin around the viewport keeps short pans covered without a refetch.
    const padX = (right - left) * 0.08;
    const padY = (bottom - top) * 0.08;
    const rect = quantiseRect({
      x: (left - padX) / box.width,
      y: (top - padY) / box.height,
      w: (right - left + padX * 2) / box.width,
      h: (bottom - top + padY * 2) / box.height
    });

    const ceiling = BOOK.sizes?.native ? Math.round(BOOK.sizes.native * rect.w) : HIRES_MAX_PX;
    const pixels = Math.min(
      HIRES_MAX_PX,
      ceiling,
      Math.max(256, Math.round((rect.w * box.width * dpr) / 128) * 128)
    );
    const url = `${BOOK.urls.hires.replace('{n}', PAD4(node.dataset.page))}` +
      `&x=${rect.x}&y=${rect.y}&w=${rect.w}&h=${rect.h}&px=${pixels}`;
    if (node.dataset.hires === url) continue;
    node.dataset.hires = url;
    loadHires(node, url, rect);
  }
}

function quantiseRect(rect) {
  const snap = (value) => Math.min(1, Math.max(0, Math.round(value * HIRES_GRID) / HIRES_GRID));
  const x = snap(rect.x);
  const y = snap(rect.y);
  return {
    x, y,
    w: Math.max(1 / HIRES_GRID, Math.min(1 - x, snap(rect.w))),
    h: Math.max(1 / HIRES_GRID, Math.min(1 - y, snap(rect.h)))
  };
}

let hiresPending = 0;
function setBusy(delta) {
  hiresPending = Math.max(0, hiresPending + delta);
  el.zoomBusy.hidden = hiresPending === 0;
}

/** Decode first, then swap, so the reader never sees a half-painted overlay. */
function loadHires(node, url, rect) {
  const probe = new Image();
  probe.decoding = 'async';
  setBusy(1);
  probe.onload = () => {
    setBusy(-1);
    if (node.dataset.hires !== url || el.zoom.dataset.open !== 'true') return;
    const layer = document.createElement('img');
    layer.className = 'zoom__hi';
    layer.src = url;
    layer.style.cssText =
      `left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.w * 100}%;height:${rect.h * 100}%`;
    node.querySelectorAll('.zoom__hi').forEach((old) => old.remove());
    node.appendChild(layer);
  };
  probe.onerror = () => {
    setBusy(-1);
    node.dataset.hires = '';
  };
  probe.src = url;
}

el.zoom.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.16 : 1 / 1.16);
}, { passive: false });

el.zoom.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.btn')) return;
  el.zoom.setPointerCapture(event.pointerId);
  zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  el.zoom.classList.add('is-panning');
  if (zoom.pointers.size === 2) {
    const [a, b] = [...zoom.pointers.values()];
    zoom.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
});

el.zoom.addEventListener('pointermove', (event) => {
  const previous = zoom.pointers.get(event.pointerId);
  if (!previous) return;
  const point = { x: event.clientX, y: event.clientY };
  zoom.pointers.set(event.pointerId, point);

  if (zoom.pointers.size === 2 && zoom.pinch) {
    const [a, b] = [...zoom.pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / (zoom.pinch.distance || distance));
    zoom.pinch.distance = distance;
    return;
  }
  zoom.x += point.x - previous.x;
  zoom.y += point.y - previous.y;
  clampZoom();
  applyZoom();
});

function releaseZoomPointer(event) {
  zoom.pointers.delete(event.pointerId);
  if (zoom.pointers.size < 2) zoom.pinch = null;
  if (!zoom.pointers.size) el.zoom.classList.remove('is-panning');
  scheduleHires();
}
el.zoom.addEventListener('pointerup', releaseZoomPointer);
el.zoom.addEventListener('pointercancel', releaseZoomPointer);
el.zoom.addEventListener('dblclick', (event) => {
  if (zoom.scale > 1.05) {
    zoom.scale = 1;
    clampZoom();
    applyZoom();
  } else {
    zoomAt(event.clientX, event.clientY, Math.min(2.4, zoom.max));
  }
});
el.zoomClose.onclick = closeZoom;
el.btnZoom.onclick = openZoom;

/* --------------------------------------------------------- share */

const SHARE_TARGETS = [
  { key: 'email', label: 'Email', icon: ICON.mail, url: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n\n${u}`)}` },
  { key: 'whatsapp', label: 'WhatsApp', icon: ICON.link, url: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'linkedin', label: 'LinkedIn', icon: ICON.link, url: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { key: 'qr', label: 'QR code', icon: ICON.qr, url: null }
];

function shareUrl() {
  const base = BOOK.static
    ? `${location.origin}${location.pathname}`
    : `${BOOK.origin || location.origin}${BOOK.urls.self}`;
  return el.shareAtPage.checked ? `${base}#p=${firstOf(state.page)}` : base;
}

function openShare() {
  el.shareSub.textContent = `Anyone with this link can read “${BOOK.title}”.`;
  el.shareAtPageLabel.textContent = `Open at page ${printedLabel(firstOf(state.page))}`;
  el.shareUrl.value = shareUrl();
  el.shareQr.hidden = true;
  el.shareGrid.innerHTML = SHARE_TARGETS
    .map((target) => `<button class="share-btn" data-key="${target.key}">${svg(target.icon)}<span>${target.label}</span></button>`)
    .join('');
  el.shareBackdrop.dataset.open = 'true';
  beacon('share');
}

el.shareGrid.addEventListener('click', (event) => {
  const button = event.target.closest('.share-btn');
  if (!button) return;
  const target = SHARE_TARGETS.find((t) => t.key === button.dataset.key);
  if (!target) return;
  if (target.key === 'qr') {
    if (BOOK.static) {
      toast('QR codes are available in the admin console');
      return;
    }
    el.shareQr.hidden = false;
    el.shareQr.innerHTML = `<img src="/api/v1/qr?data=${encodeURIComponent(shareUrl())}" alt="QR code for this catalog">`;
    return;
  }
  window.open(target.url(shareUrl(), BOOK.title), '_blank', 'noopener');
});

el.shareAtPage.addEventListener('change', () => { el.shareUrl.value = shareUrl(); });
el.shareClose.onclick = () => { el.shareBackdrop.dataset.open = 'false'; };
el.shareBackdrop.addEventListener('click', (event) => {
  if (event.target === el.shareBackdrop) el.shareBackdrop.dataset.open = 'false';
});
el.shareCopy.onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl());
    toast('Link copied to clipboard');
  } catch {
    el.shareUrl.select();
    document.execCommand?.('copy');
    toast('Link copied');
  }
};

el.btnShare.onclick = async () => {
  if (navigator.share && !CAN_HOVER) {
    try {
      await navigator.share({ title: BOOK.title, url: shareUrl() });
      beacon('share');
      return;
    } catch { /* fall through to the sheet */ }
  }
  openShare();
};

/* ------------------------------------------------- print & download */

el.btnDownload.onclick = () => {
  beacon('download');
  window.location.href = BOOK.urls.download;
};

el.btnPrint.onclick = () => {
  const pair = pairOf(state.page);
  const pages = [pair.left, pair.right].filter(Boolean);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<title>${escapeAttr(BOOK.title)}</title><style>body{margin:0;display:flex;gap:0}img{width:${100 / pages.length}%;height:auto}</style>` +
    pages.map((p) => `<img src="${location.origin}${urlFor('zoom', p)}">`).join('')
  );
  win.document.close();
  win.addEventListener('load', () => { win.focus(); win.print(); });
};

/* ---------------------------------------------------- fullscreen */

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  el.btnFull.innerHTML = svg(document.fullscreenElement ? ICON.collapse : ICON.expand);
});
el.btnFull.onclick = toggleFullscreen;

/* -------------------------------------------------------- chrome */

let idleTimer = null;
function showUi() {
  state.uiHidden = false;
  app.classList.remove('ui-hidden');
  clearTimeout(idleTimer);
  if (!BOOK.appearance.autoHideUi || state.openPanel) return;
  idleTimer = setTimeout(() => {
    if (state.openPanel || el.shareBackdrop.dataset.open === 'true') return;
    state.uiHidden = true;
    app.classList.add('ui-hidden');
  }, 4000);
}
function toggleUi() {
  if (state.uiHidden) showUi();
  else { state.uiHidden = true; app.classList.add('ui-hidden'); clearTimeout(idleTimer); }
}
['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach((type) => {
  window.addEventListener(type, showUi, { passive: true });
});

function toast(message) {
  el.toast.textContent = message;
  el.toast.dataset.open = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.toast.dataset.open = 'false'; }, 2200);
}

/* ------------------------------------------------------ controls */

el.btnPrev.onclick = () => turn('prev');
el.btnNext.onclick = () => turn('next');
el.edgePrev.onclick = () => turn(rtl ? 'next' : 'prev');
el.edgeNext.onclick = () => turn(rtl ? 'prev' : 'next');
el.btnFirst.onclick = () => goTo(1);
el.btnLast.onclick = () => goTo(N);
el.slider.addEventListener('input', () => goTo(Number(el.slider.value)));

window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) {
    if (event.key === 'Escape') event.target.blur();
    return;
  }
  const key = event.key;
  if (key === 'ArrowRight' || key === 'PageDown' || key === ' ') { event.preventDefault(); turn(rtl ? 'prev' : 'next'); }
  else if (key === 'ArrowLeft' || key === 'PageUp') { event.preventDefault(); turn(rtl ? 'next' : 'prev'); }
  else if (key === 'Home') goTo(1);
  else if (key === 'End') goTo(N);
  else if (key === 'f' || key === 'F') toggleFullscreen();
  else if (key === 'c' || key === 'C') togglePanel('panelContents');
  else if (key === 's' || key === 'S') togglePanel('panelSearch');
  else if (key === 'g' || key === 'G') togglePanel('thumbs');
  else if (key === 'z' || key === 'Z') (el.zoom.dataset.open === 'true' ? closeZoom() : openZoom());
  else if (key === 'h' || key === 'H') el.btnShare.click();
  else if (key === 'Escape') {
    if (el.zoom.dataset.open === 'true') closeZoom();
    else if (el.shareBackdrop.dataset.open === 'true') el.shareBackdrop.dataset.open = 'false';
    else openPanel(null);
  }
});

/* ------------------------------------------------------ analytics */

let lastReported = 0;
function beacon(type, page) {
  if (BOOK.static) return;
  try {
    const body = JSON.stringify({ slug: BOOK.slug, type, page });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/v1/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/v1/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    }
  } catch { /* analytics must never break reading */ }
}

let reportTimer = null;
function reportPage() {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => {
    const page = firstOf(state.page);
    if (page === lastReported) return;
    lastReported = page;
    beacon('page', page);
  }, 1200);
}

/* ----------------------------------------------------------- init */

function applyCapabilities() {
  el.btnSearch.hidden = !BOOK.capabilities.search;
  el.btnDownload.hidden = !BOOK.capabilities.download;
  el.btnPrint.hidden = !BOOK.appearance.showPrint;
  el.btnShare.hidden = !BOOK.appearance.showShare;
  if (BOOK.embed) {
    document.body.classList.add('is-embed');
    el.btnOpen.hidden = false;
    el.btnOpen.href = `${BOOK.origin || ''}${BOOK.urls.self}`;
    el.btnFull.hidden = false;
  }
  if (BOOK.capabilities.preview) {
    toast('Preview mode - this catalog is not public yet');
  }
}

function pageFromHash() {
  const match = /[#&]p=(\d+)/.exec(location.hash);
  return match ? Math.max(1, Math.min(N, Number(match[1]))) : 1;
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const wasSpread = state.spread;
    measure();
    if (wasSpread !== state.spread) state.page = firstOf(state.page);
    renderPanes();
    if (el.zoom.dataset.open === 'true') openZoom();
  }, 120);
});

window.addEventListener('hashchange', () => {
  const page = pageFromHash();
  if (page !== firstOf(state.page)) goTo(page);
});

function start() {
  applyCapabilities();
  buildToc();
  state.page = pageFromHash();
  measure();
  renderPanes();
  showUi();
  setTimeout(hideLoader, 3000); // never leave a reader staring at a spinner
  app.setAttribute('aria-busy', 'false');
  beacon('page', firstOf(state.page));
  lastReported = firstOf(state.page);
}

start();
