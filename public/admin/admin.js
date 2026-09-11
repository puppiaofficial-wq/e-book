/* eBook Studio - admin console. No framework, no build step. */

const root = document.getElementById('root');

const state = {
  session: null,
  books: [],
  collections: [],
  book: null,
  shares: [],
  urls: null,
  quality: null,
  analytics: null,
  jobs: new Map()
};

/* ---------------------------------------------------------- utils */

async function api(path, options = {}) {
  const init = { credentials: 'same-origin', ...options };
  if (init.body && !(init.body instanceof FormData)) {
    init.headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch(`/admin${path}`, init);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.dataset.open = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.dataset.open = 'false'; }, 2400);
}

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    toast('Press Ctrl+C to copy');
  }
}

function modal(html) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.dataset.open = 'true';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', (event) => { if (event.target === back) back.remove(); });
  document.body.appendChild(back);
  back.querySelector('input, select, textarea, button')?.focus();
  return back;
}

/* --------------------------------------------------------- router */

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  return { name: parts[0] || 'library', id: parts[1], tab: parts[2] };
}

window.addEventListener('hashchange', render);

/* ----------------------------------------------------------- auth */

function renderAuth({ configured, error }) {
  root.className = 'auth';
  root.innerHTML = `
    <form class="auth__card" id="authForm">
      <h1>${configured ? 'Sign in' : 'Create your admin account'}</h1>
      <p>${configured
        ? 'Manage catalogs, share links and publishing for your digital catalogs.'
        : 'This is a fresh installation. Choose the credentials you will use to manage your catalogs.'}</p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required autocomplete="username">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required minlength="8"
               autocomplete="${configured ? 'current-password' : 'new-password'}">
        ${configured ? '' : '<span class="hint">At least 8 characters.</span>'}
      </div>
      <button class="btn btn--primary" style="width:100%;justify-content:center" type="submit">
        ${configured ? 'Sign in' : 'Create account'}
      </button>
    </form>`;

  document.getElementById('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      await api(configured ? '/api/login' : '/api/setup', { method: 'POST', body: { email, password } });
      state.session = await api('/api/session');
      location.hash = '#/';
      render();
    } catch (error) {
      renderAuth({ configured, error: error.message });
    }
  });
}

/* ---------------------------------------------------------- shell */

function shell(body) {
  const current = route().name;
  const nav = [
    ['library', 'Catalogs'],
    ['settings', 'Settings']
  ];
  root.className = 'shell';
  root.innerHTML = `
    <nav class="side">
      <div class="side__brand"><img src="/assets/favicon.svg" alt=""> eBook Studio</div>
      ${nav.map(([key, label]) => `<a class="nav" href="#/${key === 'library' ? '' : key}" aria-current="${current === key}">${label}</a>`).join('')}
      <a class="nav" href="/library" target="_blank" rel="noopener">Public library ↗</a>
      <div class="side__foot">
        <span>${esc(state.session?.admin?.email || '')}</span>
        <span>버전 ${esc(state.session?.version || '?')}</span>
        <button class="btn btn--ghost btn--sm" id="signOut" style="justify-content:center">Sign out</button>
      </div>
    </nav>
    <main class="main">${body}</main>`;
  document.getElementById('signOut')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    state.session = await api('/api/session');
    location.hash = '#/';
    render();
  });
}

/* -------------------------------------------------------- library */

function libraryView() {
  const grouped = new Map([['_', []]]);
  for (const collection of state.collections) grouped.set(collection.id, []);
  for (const book of state.books) {
    const key = grouped.has(book.collectionId) ? book.collectionId : '_';
    grouped.get(key).push(book);
  }

  const sections = [...grouped.entries()]
    .filter(([, list]) => list.length)
    .map(([key, list]) => {
      const collection = state.collections.find((c) => c.id === key);
      return `
        <section style="margin-bottom:30px">
          ${collection ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 12px">${esc(collection.name)}</h2>` : ''}
          <div class="books">${list.map(bookCard).join('')}</div>
        </section>`;
    })
    .join('');

  shell(`
    <div class="page-head">
      <div>
        <h1>Catalogs</h1>
        <p>${state.books.length} catalog${state.books.length === 1 ? '' : 's'} in this library.</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" id="newCollection">New collection</button>
        <button class="btn btn--primary" id="pickFile">Upload a PDF</button>
      </div>
    </div>

    <div class="dropzone" id="dropzone">
      <h3>Drop a PDF here to build a catalog</h3>
      <p>Pages, contents, links and searchable text are extracted automatically. Page images (JPG or PNG) work too.</p>
    </div>
    <input type="file" id="fileInput" accept="application/pdf,image/*" multiple hidden>

    <div id="jobList"></div>
    ${state.books.length ? sections : '<p style="color:var(--muted)">No catalogs yet. Upload your first PDF above.</p>'}
  `);

  wireUpload();
  document.getElementById('newCollection').addEventListener('click', () => {
    const back = modal(`
      <h2>New collection</h2>
      <p class="sub">Collections group catalogs on the public library page, for example by season.</p>
      <div class="field"><label for="cname">Name</label><input id="cname" type="text" placeholder="2026 F/W"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" data-x>Cancel</button>
        <button class="btn btn--primary" id="cgo">Create</button>
      </div>`);
    back.querySelector('[data-x]').onclick = () => back.remove();
    back.querySelector('#cgo').onclick = async () => {
      const name = back.querySelector('#cname').value.trim();
      if (!name) return;
      await api('/api/collections', { method: 'POST', body: { name } });
      back.remove();
      await loadLibrary();
      render();
    };
  });
  renderJobs();
}

function bookCard(book) {
  const badge = book.status === 'published'
    ? (book.schedule === 'live' ? '<span class="pill pill--live">Live</span>' : `<span class="pill pill--warn">${book.schedule === 'scheduled' ? 'Scheduled' : 'Ended'}</span>`)
    : '<span class="pill pill--draft">Draft</span>';
  return `
    <a class="book-card" href="#/b/${book.id}">
      <div class="book-card__cover">
        ${book.pageCount ? `<img src="/media/${book.id}/thumbs/p0001.webp" alt="" loading="lazy">` : '<span style="color:var(--muted);font-size:12px">Processing…</span>'}
      </div>
      <div class="book-card__body">
        <span class="book-card__title">${esc(book.title)}</span>
        <span class="book-card__meta">${badge} ${book.pageCount} pages</span>
        <span class="book-card__meta">${book.shareCount ? `${book.shareCount} share link${book.shareCount === 1 ? '' : 's'} · ` : ''}${fmtDate(book.updatedAt)}</span>
      </div>
    </a>`;
}

/* --------------------------------------------------------- upload */

function wireUpload() {
  const zone = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  if (!zone) return;
  document.getElementById('pickFile').onclick = () => input.click();
  zone.onclick = () => input.click();
  input.onchange = () => {
    if (input.files.length) startUpload([...input.files]);
    input.value = '';
  };
  ['dragenter', 'dragover'].forEach((type) =>
    zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add('is-over'); })
  );
  ['dragleave', 'drop'].forEach((type) =>
    zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove('is-over'); })
  );
  zone.addEventListener('drop', (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) startUpload(files);
  });
}

async function startUpload(files) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const entry = { id: `up_${Date.now()}`, title: files[0].name, progress: 0, message: 'Uploading…', state: 'running' };
  state.jobs.set(entry.id, entry);
  renderJobs();

  try {
    const response = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', '/admin/api/books');
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        entry.progress = (event.loaded / event.total) * 0.35;
        entry.message = `Uploading ${Math.round((event.loaded / event.total) * 100)}%`;
        renderJobs();
      };
      request.onload = () => {
        try {
          const data = JSON.parse(request.responseText);
          request.status >= 400 ? reject(new Error(data.error || 'Upload failed')) : resolve(data);
        } catch { reject(new Error('Upload failed')); }
      };
      request.onerror = () => reject(new Error('Network error during upload'));
      request.send(form);
    });

    entry.title = response.book.title;
    entry.bookId = response.book.id;
    entry.message = 'Converting…';
    renderJobs();
    followJob(response.jobId, entry);
  } catch (error) {
    entry.state = 'failed';
    entry.message = error.message;
    renderJobs();
  }
}

function followJob(jobId, entry) {
  const source = new EventSource(`/admin/api/jobs/${jobId}/stream`);
  source.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    entry.progress = 0.35 + (data.progress || 0) * 0.65;
    entry.message = data.message;
    entry.state = data.state;
    renderJobs();
    if (data.state === 'done') {
      source.close();
      await loadLibrary();
      toast(`“${entry.title}” is ready${data.result?.splitApplied ? ' (double-page spreads were split automatically)' : ''}`);
      state.jobs.delete(entry.id);
      if (route().name === 'library') render();
      else renderJobs();
    } else if (data.state === 'failed') {
      source.close();
    }
  };
  source.onerror = () => source.close();
}

function renderJobs() {
  const host = document.getElementById('jobList');
  if (!host) return;
  const jobs = [...state.jobs.values()];
  host.innerHTML = jobs.length
    ? `<div class="card" style="margin-bottom:22px">${jobs.map((job) => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
            <b>${esc(job.title)}</b>
            <span style="color:${job.state === 'failed' ? '#d63a2f' : 'var(--muted)'}">${esc(job.message)}</span>
          </div>
          <div class="progress"><span style="width:${Math.round((job.progress || 0) * 100)}%"></span></div>
        </div>`).join('')}</div>`
    : '';
}

/* ------------------------------------------------------ book view */

const TABS = [
  ['overview', 'Overview'],
  ['publish', 'Publish & access'],
  ['contents', 'Contents'],
  ['links', 'Page links'],
  ['design', 'Design'],
  ['share', 'Share with buyers'],
  ['embed', 'Embed on your site'],
  ['insights', 'Insights']
];

async function saveBook(patch, { quiet = false } = {}) {
  const data = await api(`/api/books/${state.book.id}`, { method: 'PATCH', body: patch });
  state.book = data.book;
  state.urls = data.urls;
  if (!quiet) toast('Saved');
  return data.book;
}

function bookView(tab = 'overview') {
  const book = state.book;
  const active = TABS.some(([key]) => key === tab) ? tab : 'overview';
  const badge = book.status === 'published'
    ? '<span class="pill pill--live">Published</span>'
    : '<span class="pill pill--draft">Draft</span>';

  shell(`
    <div class="page-head">
      <div>
        <a class="btn btn--ghost btn--sm" href="#/" style="margin-bottom:8px">← All catalogs</a>
        <h1>${esc(book.title)}</h1>
        <p>${badge} &nbsp;${book.pages.count} pages &nbsp;·&nbsp; updated ${fmtDate(book.updatedAt)}</p>
      </div>
      <div class="page-head__actions">
        <a class="btn" href="${state.urls.viewer}" target="_blank" rel="noopener">Preview ↗</a>
        <button class="btn btn--primary" id="togglePublish">${book.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${TABS.map(([key, label]) => `<button class="tab" role="tab" aria-selected="${key === active}" data-tab="${key}">${label}</button>`).join('')}
    </div>
    <div id="tabBody"></div>
  `);

  document.querySelectorAll('.tab').forEach((node) => {
    node.onclick = () => { location.hash = `#/b/${book.id}/${node.dataset.tab}`; };
  });
  document.getElementById('togglePublish').onclick = async () => {
    await saveBook({ status: book.status === 'published' ? 'draft' : 'published' });
    render();
  };

  const body = document.getElementById('tabBody');
  ({
    overview: overviewTab,
    publish: publishTab,
    contents: contentsTab,
    links: linksTab,
    design: designTab,
    share: shareTab,
    embed: embedTab,
    insights: insightsTab
  })[active](body);
}

/* overview -------------------------------------------------------- */

function overviewTab(host) {
  const book = state.book;
  const q = state.quality || { source: 'unknown', storedWidth: 0, storedHeight: 0, hires: false, splitApplied: false };
  host.innerHTML = `
    <div class="card">
      <h2>Catalog details</h2>
      <p class="card__hint">The title and description are shown on the public library page and in link previews when you share the catalog.</p>
      <div class="field"><label for="f-title">Title</label><input id="f-title" type="text" value="${esc(book.title)}"></div>
      <div class="grid2">
        <div class="field"><label for="f-sub">Subtitle</label><input id="f-sub" type="text" value="${esc(book.subtitle)}"></div>
        <div class="field">
          <label for="f-col">Collection</label>
          <select id="f-col">
            <option value="">No collection</option>
            ${state.collections.map((c) => `<option value="${c.id}" ${c.id === book.collectionId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label for="f-desc">Description</label><textarea id="f-desc">${esc(book.description)}</textarea></div>
      <div class="field">
        <label for="f-slug">Web address</label>
        <input id="f-slug" type="text" value="${esc(book.slug)}">
        <span class="hint">${esc(state.urls.base)}/b/<b>${esc(book.slug)}</b> — keep this stable once you have shared it.</span>
      </div>
      <button class="btn btn--primary" id="saveDetails">Save changes</button>
    </div>

    <div class="card">
      <h2>Image quality</h2>
      <p class="card__hint">If a zoomed page looks soft, this is where to look first.</p>
      <table>
        <tbody>
          <tr><td>Imported from</td><td><b>${q.source === 'pdf' ? 'PDF' : 'Page images'}</b></td></tr>
          <tr><td>Stored page size</td><td><b>${q.storedWidth} × ${q.storedHeight} px</b>${q.dpi ? ` &nbsp;·&nbsp; about ${q.dpi} DPI` : ''}</td></tr>
          ${q.mm ? `<tr><td>Physical page</td><td>${q.mm.w} × ${q.mm.h} mm</td></tr>` : ''}
          <tr><td>Artwork in the PDF</td><td>${q.sourceWidth
            ? `<b>${q.sourceWidth} px</b> wide${q.sourceDpi ? ` &nbsp;·&nbsp; about ${q.sourceDpi} DPI` : ''} — flattened images`
            : 'vector — can be rendered at any size'}</td></tr>
          <tr><td>Double-page spreads</td><td>${q.splitApplied ? 'split into single pages' : 'not detected'}</td></tr>
          <tr><td>Zoom detail</td><td>${q.sourceWidth
            ? '<span class="pill pill--warn">Source limited</span> zoom stops where the PDF runs out of detail'
            : q.hires
              ? '<span class="pill pill--live">On demand</span> re-rendered from the PDF, sharp at any magnification'
              : '<span class="pill pill--warn">Stored only</span> magnification stops at the stored resolution'}</td></tr>
        </tbody>
      </table>
      ${q.sourceWidth ? `<p class="card__hint" style="margin:16px 0 0">
        This PDF holds flattened artwork, so ${q.sourceWidth} px is all the detail that exists.
        Rendering larger would only invent pixels, so the viewer stops magnifying there.
        To go sharper, export the PDF with live text or higher-resolution images.
      </p>` : ''}
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:18px">
        <div class="field" style="margin:0;min-width:230px">
          <label for="rr-zoom">Page image width</label>
          <select id="rr-zoom">
            <option value="">Measured from the PDF — recommended</option>
            <option value="2400">2400 px</option>
            <option value="3000">3000 px</option>
            <option value="3600">3600 px</option>
            <option value="4400">4400 px</option>
          </select>
        </div>
        <button class="btn" id="rr-go">Re-render pages</button>
      </div>
      <p class="card__hint" style="margin:8px 0 0">
        Contents, page links and share links are kept. Choosing a width above the
        measured one will not add detail; it only makes the files bigger.
      </p>
      <div id="rr-status" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <h2>Source file</h2>
      <p class="card__hint">
        ${esc(book.source.filename || 'Imported images')} · ${book.pages.count} pages ·
        ${book.pages.hasText ? 'searchable text found' : 'no text layer (search is disabled)'}
        ${book.pages.splitApplied ? ' · double-page spreads were split automatically' : ''}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="replaceFile">Replace source file</button>
        <button class="btn" id="dupBook">Duplicate catalog</button>
        <button class="btn btn--danger" id="delBook">Delete catalog</button>
      </div>
      <input type="file" id="replaceInput" accept="application/pdf,image/*" multiple hidden>
      <div id="replaceJob" style="margin-top:14px"></div>
    </div>`;

  document.getElementById('saveDetails').onclick = async () => {
    await saveBook({
      title: document.getElementById('f-title').value.trim(),
      subtitle: document.getElementById('f-sub').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      collectionId: document.getElementById('f-col').value || null,
      slug: document.getElementById('f-slug').value.trim()
    });
    await loadLibrary();
    render();
  };

  const rrStatus = document.getElementById('rr-status');
  document.getElementById('rr-go').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    rrStatus.innerHTML = '<div class="progress"><span style="width:4%"></span></div>';
    try {
      const zoomWidth = document.getElementById('rr-zoom').value || null;
      const { jobId } = await api(`/api/books/${state.book.id}/rerender`, { method: 'POST', body: { zoomWidth } });
      const source = new EventSource(`/admin/api/jobs/${jobId}/stream`);
      source.onmessage = async (message) => {
        const job = JSON.parse(message.data);
        rrStatus.innerHTML =
          `<p class="card__hint" style="margin:0 0 6px">${esc(job.message)}</p>` +
          `<div class="progress"><span style="width:${Math.round((job.progress || 0) * 100)}%"></span></div>`;
        if (job.state === 'done') {
          source.close();
          await loadBook(state.book.id);
          toast('Pages re-rendered');
          render();
        }
        if (job.state === 'failed') {
          source.close();
          button.disabled = false;
          rrStatus.innerHTML = `<p class="card__hint" style="margin:0;color:#d63a2f">${esc(job.message)}</p>`;
        }
      };
      source.onerror = () => { source.close(); button.disabled = false; };
    } catch (error) {
      button.disabled = false;
      rrStatus.innerHTML = `<p class="card__hint" style="margin:0;color:#d63a2f">${esc(error.message)}</p>`;
    }
  };

  const input = document.getElementById('replaceInput');
  document.getElementById('replaceFile').onclick = () => input.click();
  input.onchange = async () => {
    if (!input.files.length) return;
    const form = new FormData();
    for (const file of input.files) form.append('files', file);
    const host2 = document.getElementById('replaceJob');
    host2.innerHTML = '<div class="progress"><span style="width:10%"></span></div>';
    const response = await fetch(`/admin/api/books/${state.book.id}/reimport`, { method: 'POST', body: form });
    const data = await response.json();
    const source = new EventSource(`/admin/api/jobs/${data.jobId}/stream`);
    source.onmessage = async (event) => {
      const job = JSON.parse(event.data);
      host2.innerHTML = `<p class="card__hint" style="margin:0 0 6px">${esc(job.message)}</p><div class="progress"><span style="width:${Math.round((job.progress || 0) * 100)}%"></span></div>`;
      if (job.state === 'done') {
        source.close();
        await loadBook(state.book.id);
        toast('Source file replaced');
        render();
      }
      if (job.state === 'failed') source.close();
    };
  };

  document.getElementById('dupBook').onclick = async () => {
    const data = await api(`/api/books/${state.book.id}/duplicate`, { method: 'POST' });
    await loadLibrary();
    location.hash = `#/b/${data.book.id}`;
  };

  document.getElementById('delBook').onclick = () => {
    const back = modal(`
      <h2>Delete this catalog?</h2>
      <p class="sub">All page images, share links and statistics for “${esc(state.book.title)}” are removed permanently. Links already sent to buyers will stop working.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" data-x>Cancel</button>
        <button class="btn btn--danger" id="delGo">Delete permanently</button>
      </div>`);
    back.querySelector('[data-x]').onclick = () => back.remove();
    back.querySelector('#delGo').onclick = async () => {
      await api(`/api/books/${state.book.id}`, { method: 'DELETE' });
      back.remove();
      await loadLibrary();
      location.hash = '#/';
    };
  };
}

/* publish --------------------------------------------------------- */

function publishTab(host) {
  const book = state.book;
  host.innerHTML = `
    <div class="card">
      <h2>Visibility</h2>
      <p class="card__hint">Share links keep working even while a catalog is unpublished, so you can send a preview to a buyer before it goes live.</p>
      <div class="field">
        <label for="f-vis">Who can open the catalog URL</label>
        <select id="f-vis">
          <option value="public" ${book.access.visibility === 'public' ? 'selected' : ''}>Public — listed in the library, open to anyone</option>
          <option value="unlisted" ${book.access.visibility === 'unlisted' ? 'selected' : ''}>Unlisted — anyone with the link, hidden from the library</option>
          <option value="password" ${book.access.visibility === 'password' ? 'selected' : ''}>Password — a shared password is required</option>
        </select>
      </div>
      <div class="field" id="pwField" ${book.access.visibility === 'password' ? '' : 'hidden'}>
        <label for="f-pw">Password</label>
        <input id="f-pw" type="text" placeholder="${book.access.hasPassword ? 'Password is set — type to replace' : 'Choose a password'}">
        <span class="hint">Leave empty to keep the current password. Clear it with the button below.</span>
        ${book.access.hasPassword ? '<button class="btn btn--sm btn--danger" id="clearPw" style="justify-self:start;margin-top:6px">Remove password</button>' : ''}
      </div>
      <div class="grid2">
        <div class="field"><label for="f-start">Available from</label><input id="f-start" type="date" value="${dateInput(book.access.startAt)}"></div>
        <div class="field"><label for="f-end">Available until</label><input id="f-end" type="date" value="${dateInput(book.access.endAt)}"></div>
      </div>
      <button class="btn btn--primary" id="saveAccess">Save access settings</button>
    </div>

    <div class="card">
      <h2>PDF download</h2>
      <p class="card__hint">Offer the original PDF to readers. You can still turn it off for individual share links.</p>
      <label class="check">
        <input type="checkbox" id="f-dl" ${book.downloads.pdf ? 'checked' : ''}>
        <span>Allow readers to download the source PDF
          <small>The download button appears in the viewer toolbar. Requires the download control to be enabled under Design.</small></span>
      </label>
    </div>`;

  document.getElementById('f-vis').onchange = (event) => {
    document.getElementById('pwField').hidden = event.target.value !== 'password';
  };
  document.getElementById('clearPw')?.addEventListener('click', async () => {
    await saveBook({ access: { password: '' } });
    render();
  });
  document.getElementById('saveAccess').onclick = async () => {
    const password = document.getElementById('f-pw')?.value || undefined;
    await saveBook({
      access: {
        visibility: document.getElementById('f-vis').value,
        startAt: document.getElementById('f-start').value || null,
        endAt: document.getElementById('f-end').value || null,
        ...(password ? { password } : {})
      }
    });
    render();
  };
  document.getElementById('f-dl').onchange = (event) =>
    saveBook({ downloads: { pdf: event.target.checked }, appearance: { showDownload: event.target.checked } });
}

/* contents -------------------------------------------------------- */

function contentsTab(host) {
  const book = state.book;
  const rows = (entries) => entries.map((entry, i) => `
    <div class="tocrow" data-i="${i}">
      <input type="number" min="1" max="${book.pages.count}" value="${entry.page}" data-k="page">
      <input type="text" value="${esc(entry.title)}" data-k="title" placeholder="Section title">
      <select data-k="level">
        <option value="0" ${(entry.level || 0) === 0 ? 'selected' : ''}>Level 1</option>
        <option value="1" ${entry.level === 1 ? 'selected' : ''}>Level 2</option>
        <option value="2" ${entry.level === 2 ? 'selected' : ''}>Level 3</option>
      </select>
      <button class="btn btn--ghost btn--sm" data-del="${i}" title="Remove">✕</button>
    </div>`).join('');

  host.innerHTML = `
    <div class="card">
      <h2>Table of contents</h2>
      <p class="card__hint">Imported automatically from the PDF bookmarks. Readers open this from the Contents button in the viewer.</p>
      <div class="toclist" id="tocList">
        <div class="tocrow" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">
          <span>Page</span><span>Title</span><span>Level</span><span></span>
        </div>
        ${book.toc.length ? rows(book.toc) : '<p class="card__hint" style="margin:0">No entries yet. Add the first one below.</p>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn" id="addToc">Add entry</button>
        <button class="btn btn--primary" id="saveToc">Save contents</button>
      </div>
    </div>`;

  const collect = () => [...document.querySelectorAll('#tocList .tocrow[data-i]')]
    .map((row) => ({
      page: Math.max(1, Math.min(book.pages.count, Number(row.querySelector('[data-k=page]').value) || 1)),
      title: row.querySelector('[data-k=title]').value.trim(),
      level: Number(row.querySelector('[data-k=level]').value)
    }))
    .filter((entry) => entry.title);

  document.getElementById('addToc').onclick = () => {
    const entries = collect();
    entries.push({ page: 1, title: '', level: 0 });
    state.book.toc = entries;
    contentsTab(host);
  };
  document.getElementById('tocList').addEventListener('click', (event) => {
    const index = event.target.dataset?.del;
    if (index == null) return;
    const entries = collect();
    entries.splice(Number(index), 1);
    state.book.toc = entries;
    contentsTab(host);
  });
  document.getElementById('saveToc').onclick = async () => {
    const entries = collect().sort((a, b) => a.page - b.page);
    await saveBook({ toc: entries });
    render();
  };
}

/* links ----------------------------------------------------------- */

let linkPage = 1;

function linksTab(host) {
  const book = state.book;
  linkPage = Math.min(Math.max(1, linkPage), book.pages.count);
  const links = (book.links[String(linkPage)] || []).map((link) => ({ ...link }));

  host.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h2>Page links</h2>
      <p class="card__hint">Drag a rectangle on the page to create a clickable area. Links can jump to another page or open a website, an email address or a video.</p>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn--sm" id="lp-prev">←</button>
        <input type="number" id="lp-num" min="1" max="${book.pages.count}" value="${linkPage}" style="width:90px">
        <span class="card__hint" style="margin:0">of ${book.pages.count}</span>
        <button class="btn btn--sm" id="lp-next">→</button>
        <button class="btn btn--primary btn--sm" id="lp-save" style="margin-left:auto">Save links on this page</button>
      </div>
    </div>
    <div class="linkedit">
      <div class="linkedit__canvas" id="lp-canvas">
        <img src="/media/${book.id}/pages/p${String(linkPage).padStart(4, '0')}.webp" alt="Page ${linkPage}" draggable="false">
      </div>
      <div>
        <div class="card" id="lp-list"></div>
      </div>
    </div>`;

  const canvas = document.getElementById('lp-canvas');
  const list = document.getElementById('lp-list');

  function drawBoxes() {
    canvas.querySelectorAll('.linkedit__box').forEach((node) => node.remove());
    links.forEach((link, i) => {
      const box = document.createElement('div');
      box.className = 'linkedit__box';
      box.dataset.i = String(i);
      box.style.cssText = `left:${link.x * 100}%;top:${link.y * 100}%;width:${link.w * 100}%;height:${link.h * 100}%`;
      canvas.appendChild(box);
    });
  }

  function drawList() {
    list.innerHTML = links.length
      ? links.map((link, i) => `
        <div style="border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:12px" data-row="${i}">
          <div class="field" style="margin-bottom:8px">
            <label>Link ${i + 1}</label>
            <select data-k="type">
              <option value="page" ${link.type === 'page' ? 'selected' : ''}>Go to page</option>
              <option value="url" ${link.type === 'url' ? 'selected' : ''}>Open a website</option>
              <option value="email" ${link.type === 'email' ? 'selected' : ''}>Send an email</option>
              <option value="video" ${link.type === 'video' ? 'selected' : ''}>Open a video</option>
            </select>
          </div>
          <div class="field" style="margin-bottom:8px">
            <input type="text" data-k="value" value="${esc(link.value)}" placeholder="${link.type === 'page' ? 'Page number' : 'https://…'}">
          </div>
          <div class="field" style="margin-bottom:8px">
            <input type="text" data-k="title" value="${esc(link.title || '')}" placeholder="Description (used for accessibility)">
          </div>
          <button class="btn btn--ghost btn--sm" data-del="${i}">Remove link</button>
        </div>`).join('')
      : '<p class="card__hint" style="margin:0">No links on this page yet. Drag a rectangle on the page image to add one.</p>';
  }

  function syncFromList() {
    list.querySelectorAll('[data-row]').forEach((row) => {
      const i = Number(row.dataset.row);
      links[i].type = row.querySelector('[data-k=type]').value;
      links[i].value = row.querySelector('[data-k=value]').value.trim();
      links[i].title = row.querySelector('[data-k=title]').value.trim();
    });
  }

  list.addEventListener('change', syncFromList);
  list.addEventListener('click', (event) => {
    const index = event.target.dataset?.del;
    if (index == null) return;
    syncFromList();
    links.splice(Number(index), 1);
    drawBoxes();
    drawList();
  });

  let drawing = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.target.classList.contains('linkedit__box')) return;
    const rect = canvas.getBoundingClientRect();
    drawing = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, node: null };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (!drawing.node) {
      drawing.node = document.createElement('div');
      drawing.node.className = 'linkedit__draw';
      canvas.appendChild(drawing.node);
    }
    const left = Math.min(drawing.x, x);
    const top = Math.min(drawing.y, y);
    drawing.node.style.cssText = `left:${left * 100}%;top:${top * 100}%;width:${Math.abs(x - drawing.x) * 100}%;height:${Math.abs(y - drawing.y) * 100}%`;
    drawing.rect = { x: left, y: top, w: Math.abs(x - drawing.x), h: Math.abs(y - drawing.y) };
  });
  canvas.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing.node?.remove();
    const rect = drawing.rect;
    drawing = null;
    if (!rect || rect.w < 0.015 || rect.h < 0.01) return;
    syncFromList();
    links.push({ ...rect, type: 'page', value: '', title: '' });
    drawBoxes();
    drawList();
    list.querySelector(`[data-row="${links.length - 1}"] [data-k=value]`)?.focus();
  });

  const goPage = (page) => { linkPage = page; linksTab(host); };
  document.getElementById('lp-prev').onclick = () => goPage(Math.max(1, linkPage - 1));
  document.getElementById('lp-next').onclick = () => goPage(Math.min(book.pages.count, linkPage + 1));
  document.getElementById('lp-num').onchange = (event) => goPage(Number(event.target.value) || 1);
  document.getElementById('lp-save').onclick = async () => {
    syncFromList();
    const next = { ...state.book.links };
    const clean = links.filter((link) => link.value);
    if (clean.length) next[String(linkPage)] = clean;
    else delete next[String(linkPage)];
    await saveBook({ links: next });
    render();
  };

  drawBoxes();
  drawList();
}

/* design ---------------------------------------------------------- */

function designTab(host) {
  const book = state.book;
  const a = book.appearance;
  host.innerHTML = `
    <div class="card">
      <h2>Reading layout</h2>
      <p class="card__hint">Two-page spreads suit landscape screens; the viewer falls back to single pages on phones automatically.</p>
      <div class="grid2">
        <div class="field">
          <label for="d-mode">Page layout</label>
          <select id="d-mode">
            <option value="auto" ${book.layout.mode === 'auto' ? 'selected' : ''}>Automatic (recommended)</option>
            <option value="spread" ${book.layout.mode === 'spread' ? 'selected' : ''}>Always two pages</option>
            <option value="single" ${book.layout.mode === 'single' ? 'selected' : ''}>Always one page</option>
          </select>
        </div>
        <div class="field">
          <label for="d-offset">First image is printed page</label>
          <input id="d-offset" type="number" min="0" value="${Number(book.layout.pageOffset || 0)}">
          <span class="hint">Set to 0 unless your printed numbering starts later than image 1.</span>
        </div>
      </div>
      <label class="check"><input type="checkbox" id="d-cover" ${book.layout.coverAlone ? 'checked' : ''}>
        <span>Show the cover on its own<small>Matches a real book: cover alone, then facing pages 2–3.</small></span></label>
      <label class="check"><input type="checkbox" id="d-rtl" ${book.layout.rtl ? 'checked' : ''}>
        <span>Right-to-left reading order<small>For catalogs that open from the right.</small></span></label>
    </div>

    <div class="card">
      <h2>Appearance</h2>
      <div class="grid2">
        <div class="field">
          <label for="d-theme">Theme</label>
          <select id="d-theme">
            <option value="dark" ${a.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${a.theme === 'light' ? 'selected' : ''}>Light</option>
          </select>
        </div>
        <div class="field"><label for="d-accent">Accent colour</label><input id="d-accent" type="text" placeholder="#e2001a" value="${esc(a.accent)}"></div>
        <div class="field"><label for="d-bg">Background colour</label><input id="d-bg" type="text" placeholder="Theme default" value="${esc(a.background)}"></div>
        <div class="field"><label for="d-logo">Logo image URL</label><input id="d-logo" type="text" placeholder="https://…/logo.svg" value="${esc(a.logoUrl)}"></div>
      </div>
    </div>

    <div class="card">
      <h2>Viewer controls</h2>
      <label class="check"><input type="checkbox" id="d-share" ${a.showShare !== false ? 'checked' : ''}>
        <span>Show the share button<small>Lets readers copy the link, send it by email or show a QR code.</small></span></label>
      <label class="check"><input type="checkbox" id="d-download" ${a.showDownload ? 'checked' : ''}>
        <span>Show the PDF download button<small>Only works when the PDF download is enabled under Publish &amp; access.</small></span></label>
      <label class="check"><input type="checkbox" id="d-print" ${a.showPrint ? 'checked' : ''}>
        <span>Show the print button</span></label>
      <label class="check"><input type="checkbox" id="d-autohide" ${a.autoHideUi !== false ? 'checked' : ''}>
        <span>Hide the toolbars while reading<small>They reappear on any tap or mouse movement.</small></span></label>
      <button class="btn btn--primary" id="d-save" style="margin-top:14px">Save design</button>
    </div>`;

  document.getElementById('d-save').onclick = async () => {
    await saveBook({
      layout: {
        mode: document.getElementById('d-mode').value,
        coverAlone: document.getElementById('d-cover').checked,
        rtl: document.getElementById('d-rtl').checked,
        pageOffset: Number(document.getElementById('d-offset').value) || 0
      },
      appearance: {
        theme: document.getElementById('d-theme').value,
        accent: document.getElementById('d-accent').value.trim(),
        background: document.getElementById('d-bg').value.trim(),
        logoUrl: document.getElementById('d-logo').value.trim(),
        showShare: document.getElementById('d-share').checked,
        showDownload: document.getElementById('d-download').checked,
        showPrint: document.getElementById('d-print').checked,
        autoHideUi: document.getElementById('d-autohide').checked
      }
    });
    render();
  };
}

/* share ----------------------------------------------------------- */

function shareTab(host) {
  const rows = state.shares.map((share) => {
    const status = share.revoked
      ? '<span class="pill pill--draft">Revoked</span>'
      : share.expiresAt && Date.parse(share.expiresAt) < Date.now()
        ? '<span class="pill pill--warn">Expired</span>'
        : '<span class="pill pill--live">Active</span>';
    return `
      <tr data-token="${share.token}">
        <td>
          <b>${esc(share.label || 'Untitled link')}</b>
          ${share.recipient ? `<div style="color:var(--muted);font-size:12.5px">${esc(share.recipient)}</div>` : ''}
          <div class="mono" style="color:var(--muted);margin-top:4px">${esc(share.url)}</div>
        </td>
        <td>${status}${share.hasPassword ? '<div style="color:var(--muted);font-size:12px;margin-top:4px">Access code</div>' : ''}</td>
        <td class="num">${share.views}${share.maxViews ? ` / ${share.maxViews}` : ''}</td>
        <td class="num">${share.expiresAt ? fmtDate(share.expiresAt) : 'Never'}</td>
        <td class="num">${share.lastViewedAt ? fmtDateTime(share.lastViewedAt) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn--sm" data-copy="${esc(share.url)}">Copy</button>
          <button class="btn btn--sm" data-qr="${esc(share.url)}">QR</button>
          <button class="btn btn--sm btn--ghost" data-revoke="${share.token}">${share.revoked ? 'Restore' : 'Revoke'}</button>
          <button class="btn btn--sm btn--ghost" data-del="${share.token}">Delete</button>
        </td>
      </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <h2>New share link</h2>
      <p class="card__hint">Each buyer gets their own link, so you can see who opened the catalog and revoke one link without affecting the rest. Share links work even while the catalog is unpublished.</p>
      <div class="grid2">
        <div class="field"><label for="s-label">Label</label><input id="s-label" type="text" placeholder="Spring order — Hamburg"></div>
        <div class="field"><label for="s-to">Recipient</label><input id="s-to" type="text" placeholder="Buyer name or company"></div>
        <div class="field"><label for="s-pw">Access code (optional)</label><input id="s-pw" type="text" placeholder="Leave empty for no code"></div>
        <div class="field"><label for="s-exp">Expires after (days)</label><input id="s-exp" type="number" min="1" placeholder="Never"></div>
        <div class="field"><label for="s-max">Maximum opens</label><input id="s-max" type="number" min="1" placeholder="Unlimited"></div>
      </div>
      <label class="check"><input type="checkbox" id="s-dl" checked>
        <span>Allow the PDF download through this link<small>Only applies when the PDF download is enabled for the catalog.</small></span></label>
      <button class="btn btn--primary" id="s-create" style="margin-top:10px">Create share link</button>
    </div>

    <div class="card">
      <h2>Active links</h2>
      ${state.shares.length
        ? `<div style="overflow-x:auto"><table>
            <thead><tr><th>Link</th><th>Status</th><th>Opens</th><th>Expires</th><th>Last opened</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>`
        : '<p class="card__hint" style="margin:0">No share links yet.</p>'}
    </div>`;

  document.getElementById('s-create').onclick = async () => {
    await api(`/api/books/${state.book.id}/shares`, {
      method: 'POST',
      body: {
        label: document.getElementById('s-label').value,
        recipient: document.getElementById('s-to').value,
        password: document.getElementById('s-pw').value,
        expiresInDays: Number(document.getElementById('s-exp').value) || null,
        maxViews: Number(document.getElementById('s-max').value) || null,
        allowDownload: document.getElementById('s-dl').checked
      }
    });
    await loadBook(state.book.id);
    toast('Share link created');
    render();
  };

  host.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.dataset.copy) return copy(target.dataset.copy);
    if (target.dataset.qr) {
      modal(`<h2>QR code</h2><p class="sub">Point a phone camera at this code to open the catalog.</p>
        <div style="background:#fff;padding:16px;border-radius:12px;display:grid;place-items:center">
          <img src="/api/v1/qr?data=${encodeURIComponent(target.dataset.qr)}" alt="QR code" style="width:230px;height:230px">
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" onclick="this.closest('.modal-back').remove()">Close</button></div>`);
      return;
    }
    if (target.dataset.revoke) {
      const share = state.shares.find((s) => s.token === target.dataset.revoke);
      await api(`/api/shares/${target.dataset.revoke}`, { method: 'PATCH', body: { revoked: !share.revoked } });
      await loadBook(state.book.id);
      render();
      return;
    }
    if (target.dataset.del) {
      await api(`/api/shares/${target.dataset.del}`, { method: 'DELETE' });
      await loadBook(state.book.id);
      toast('Share link deleted');
      render();
    }
  });
}

/* embed ----------------------------------------------------------- */

function embedTab(host) {
  const urls = state.urls;
  const book = state.book;
  host.innerHTML = `
    <div class="card">
      <h2>Direct link</h2>
      <p class="card__hint">The address to put in a newsletter, a message or a button on your website.</p>
      <div class="copybox"><input type="text" readonly value="${esc(urls.viewer)}"><button class="btn" data-copy="${esc(urls.viewer)}">Copy</button></div>
      <p class="card__hint" style="margin:14px 0 6px">Open at a specific page by adding <code>#p=12</code> to the address.</p>
    </div>

    <div class="card">
      <h2>Embed in a web page</h2>
      <p class="card__hint">Paste this snippet into your website. The viewer resizes with the page and works on phones.</p>
      <div class="copybox"><input type="text" readonly value="${esc(urls.embedSnippet)}"><button class="btn" data-copy="${esc(urls.embedSnippet)}">Copy</button></div>
      <div style="margin-top:18px;border:1px solid var(--line);border-radius:12px;overflow:hidden">
        <iframe src="${esc(urls.embed)}" style="width:100%;aspect-ratio:16/10;border:0;display:block" title="Preview"></iframe>
      </div>
    </div>

    <div class="card">
      <h2>Link from a button or image</h2>
      <p class="card__hint">Use this HTML if you would rather open the catalog in a new tab from your own design.</p>
      <div class="copybox">
        <input type="text" readonly value='<a href="${esc(urls.viewer)}" target="_blank" rel="noopener">${esc(book.title)}</a>'>
        <button class="btn" data-copy='<a href="${esc(urls.viewer)}" target="_blank" rel="noopener">${esc(book.title)}</a>'>Copy</button>
      </div>
    </div>

    <div class="card">
      <h2>Publish without a server</h2>
      <p class="card__hint">
        Builds this catalog into a single .zip you can drop onto Cloudflare Pages,
        or unzip and upload by FTP. Everything works inside it: page turning,
        contents, search, links and thumbnails. No terminal needed.
      </p>
      <div class="grid2">
        <div class="field">
          <label for="ex-zoom">Zoom image quality</label>
          <select id="ex-zoom">
            <option value="">Use the stored images — fastest</option>
            <option value="3000">3000 px — good</option>
            <option value="3600" selected>3600 px — sharper, recommended</option>
            <option value="4400">4400 px — sharpest, slow to build</option>
          </select>
          <span class="hint">A static host cannot re-render on demand, so the zoom limit is set here.</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--primary" id="ex-build">Prepare download</button>
        <a class="btn" id="ex-get" href="/admin/api/books/${state.book.id}/export.zip" hidden>Download .zip</a>
      </div>
      <div id="ex-status" style="margin-top:14px"></div>
    </div>

    <div class="card">
      <h2>QR code</h2>
      <p class="card__hint">For trade-show signage, hang tags or printed line sheets.</p>
      <div style="background:#fff;padding:16px;border-radius:12px;width:max-content">
        <img src="/api/v1/qr?data=${encodeURIComponent(urls.viewer)}" alt="QR code" style="width:200px;height:200px;display:block">
      </div>
      <a class="btn btn--sm" style="margin-top:12px" href="/api/v1/qr?data=${encodeURIComponent(urls.viewer)}" download="${esc(book.slug)}-qr.svg">Download SVG</a>
    </div>`;

  host.addEventListener('click', (event) => {
    if (event.target.dataset.copy) copy(event.target.dataset.copy);
  });

  const status = document.getElementById('ex-status');
  const link = document.getElementById('ex-get');
  document.getElementById('ex-build').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    link.hidden = true;
    status.innerHTML = '<div class="progress"><span style="width:4%"></span></div>';
    try {
      const zoomWidth = document.getElementById('ex-zoom').value || null;
      const { jobId } = await api(`/api/books/${state.book.id}/export`, {
        method: 'POST',
        body: { zoomWidth }
      });
      const source = new EventSource(`/admin/api/jobs/${jobId}/stream`);
      source.onmessage = (message) => {
        const job = JSON.parse(message.data);
        status.innerHTML =
          `<p class="card__hint" style="margin:0 0 6px">${esc(job.message)}</p>` +
          `<div class="progress"><span style="width:${Math.round((job.progress || 0) * 100)}%"></span></div>`;
        if (job.state === 'done') {
          source.close();
          button.disabled = false;
          link.hidden = false;
          const mb = (job.result.zipBytes / 1048576).toFixed(1);
          status.innerHTML =
            `<p class="card__hint" style="margin:0">Ready: <b>${esc(job.result.slug)}.zip</b>, ${mb} MB, ` +
            `zoom images ${job.result.zoomWidth} px.</p>`;
        }
        if (job.state === 'failed') {
          source.close();
          button.disabled = false;
          status.innerHTML = `<p class="card__hint" style="margin:0;color:#d63a2f">${esc(job.message)}</p>`;
        }
      };
      source.onerror = () => {
        source.close();
        button.disabled = false;
      };
    } catch (error) {
      button.disabled = false;
      status.innerHTML = `<p class="card__hint" style="margin:0;color:#d63a2f">${esc(error.message)}</p>`;
    }
  };
}

/* insights -------------------------------------------------------- */

async function insightsTab(host) {
  host.innerHTML = '<div class="card"><p class="card__hint" style="margin:0">Loading…</p></div>';
  const { totals, days } = await api(`/api/books/${state.book.id}/analytics?days=30`);
  const pages = Object.entries(totals.byPage).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxPage = pages[0]?.[1] || 1;
  const shares = Object.entries(totals.byShare).sort((a, b) => b[1] - a[1]);
  const referrers = Object.entries(totals.byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 8);

  host.innerHTML = `
    <div class="grid2" style="margin-bottom:16px">
      <div class="stat"><b>${totals.opens}</b><span>Opens (${days} days)</span></div>
      <div class="stat"><b>${totals.uniqueVisitors}</b><span>Unique readers</span></div>
      <div class="stat"><b>${totals.pageViews}</b><span>Pages read</span></div>
      <div class="stat"><b>${totals.downloads}</b><span>PDF downloads</span></div>
    </div>

    <div class="card">
      <h2>Most-read pages</h2>
      ${pages.length ? `<div class="bars">${pages.map(([page, count]) => `
        <div class="bars__row">
          <span>Page ${page}</span>
          <span class="bars__track"><span class="bars__fill" style="width:${(count / maxPage) * 100}%"></span></span>
          <span class="num">${count}</span>
        </div>`).join('')}</div>` : '<p class="card__hint" style="margin:0">No page views recorded yet.</p>'}
    </div>

    <div class="card">
      <h2>Share links</h2>
      ${shares.length ? `<table><thead><tr><th>Link</th><th>Opens</th></tr></thead><tbody>${shares.map(([token, count]) => {
        const share = state.shares.find((s) => s.token === token);
        return `<tr><td>${esc(share?.label || share?.recipient || token)}</td><td class="num">${count}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="card__hint" style="margin:0">No opens through share links yet.</p>'}
    </div>

    <div class="card">
      <h2>Where readers came from</h2>
      ${referrers.length
        ? `<table><thead><tr><th>Source</th><th>Opens</th></tr></thead><tbody>${referrers.map(([host2, count]) => `<tr><td>${esc(host2 || 'Direct')}</td><td class="num">${count}</td></tr>`).join('')}</tbody></table>`
        : '<p class="card__hint" style="margin:0">No referrers recorded yet.</p>'}
      <p class="card__hint" style="margin:16px 0 0">
        Devices: ${totals.byDevice.desktop} desktop · ${totals.byDevice.mobile} mobile · ${totals.byDevice.tablet} tablet
      </p>
    </div>`;
}

/* -------------------------------------------------------- settings */

function settingsView() {
  const s = state.session.settings;
  shell(`
    <div class="page-head"><div><h1>Settings</h1><p>Branding for the public library page and your account.</p></div></div>

    <div class="card">
      <h2>Public library</h2>
      <p class="card__hint">The page at <code>${esc(state.session.baseUrl)}/library</code> lists every published, public catalog.</p>
      <div class="field"><label for="st-title">Library title</label><input id="st-title" type="text" value="${esc(s.siteTitle)}"></div>
      <div class="field"><label for="st-tag">Tagline</label><input id="st-tag" type="text" value="${esc(s.tagline)}"></div>
      <div class="grid2">
        <div class="field"><label for="st-accent">Accent colour</label><input id="st-accent" type="text" value="${esc(s.accent)}"></div>
        <div class="field"><label for="st-logo">Logo image URL</label><input id="st-logo" type="text" value="${esc(s.logoUrl)}"></div>
        <div class="field"><label for="st-mail">Contact email</label><input id="st-mail" type="email" value="${esc(s.contactEmail)}"></div>
        <div class="field"><label for="st-foot">Footer note</label><input id="st-foot" type="text" value="${esc(s.footerNote)}"></div>
      </div>
      <label class="check"><input type="checkbox" id="st-public" ${s.publicLibrary ? 'checked' : ''}>
        <span>Publish the library page<small>Turn this off to serve individual catalog links only.</small></span></label>
      <button class="btn btn--primary" id="st-save" style="margin-top:12px">Save settings</button>
    </div>

    <div class="card">
      <h2>Collections</h2>
      <p class="card__hint">Collections group catalogs on the library page.</p>
      ${state.collections.length ? `<table><tbody>${state.collections.map((c) => `
        <tr><td><input type="text" value="${esc(c.name)}" data-cid="${c.id}"></td>
        <td style="width:1%"><button class="btn btn--sm btn--ghost" data-cdel="${c.id}">Delete</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="card__hint" style="margin:0">No collections yet.</p>'}
    </div>

    <div class="card">
      <h2>Admin account</h2>
      <div class="grid2">
        <div class="field"><label for="ac-cur">Current password</label><input id="ac-cur" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="ac-mail">Email</label><input id="ac-mail" type="email" value="${esc(state.session.admin.email)}"></div>
        <div class="field"><label for="ac-new">New password</label><input id="ac-new" type="password" autocomplete="new-password" placeholder="Leave empty to keep"></div>
      </div>
      <button class="btn" id="ac-save">Update account</button>
    </div>`);

  document.getElementById('st-save').onclick = async () => {
    await api('/api/settings', {
      method: 'PATCH',
      body: {
        siteTitle: document.getElementById('st-title').value,
        tagline: document.getElementById('st-tag').value,
        accent: document.getElementById('st-accent').value,
        logoUrl: document.getElementById('st-logo').value,
        contactEmail: document.getElementById('st-mail').value,
        footerNote: document.getElementById('st-foot').value,
        publicLibrary: document.getElementById('st-public').checked
      }
    });
    state.session = await api('/api/session');
    toast('Settings saved');
  };

  document.querySelectorAll('[data-cid]').forEach((input) => {
    input.onchange = () => api(`/api/collections/${input.dataset.cid}`, { method: 'PATCH', body: { name: input.value } })
      .then(loadLibrary).then(() => toast('Collection renamed'));
  });
  document.querySelectorAll('[data-cdel]').forEach((button) => {
    button.onclick = async () => {
      await api(`/api/collections/${button.dataset.cdel}`, { method: 'DELETE' });
      await loadLibrary();
      render();
    };
  });
  document.getElementById('ac-save').onclick = async () => {
    try {
      await api('/api/account', {
        method: 'POST',
        body: {
          currentPassword: document.getElementById('ac-cur').value,
          email: document.getElementById('ac-mail').value,
          newPassword: document.getElementById('ac-new').value
        }
      });
      state.session = await api('/api/session');
      toast('Account updated');
      render();
    } catch (error) {
      toast(error.message);
    }
  };
}

/* ------------------------------------------------------------ boot */

async function loadLibrary() {
  const data = await api('/api/books');
  state.books = data.books;
  state.collections = data.collections;
}

async function loadBook(bookId) {
  const data = await api(`/api/books/${bookId}`);
  state.book = data.book;
  state.shares = data.shares;
  state.urls = data.urls;
  state.quality = data.quality;
}

async function render() {
  if (!state.session) state.session = await api('/api/session');
  if (!state.session.configured) return renderAuth({ configured: false });
  if (!state.session.admin) return renderAuth({ configured: true });

  const current = route();
  try {
    if (current.name === 'settings') {
      await loadLibrary();
      return settingsView();
    }
    if (current.name === 'b' && current.id) {
      if (!state.book || state.book.id !== current.id) await loadBook(current.id);
      if (!state.collections.length) await loadLibrary();
      return bookView(current.tab);
    }
    state.book = null;
    await loadLibrary();
    libraryView();
  } catch (error) {
    if (/Sign in required/i.test(error.message)) {
      state.session = await api('/api/session');
      return renderAuth({ configured: true });
    }
    root.className = 'main';
    root.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="card__hint">${esc(error.message)}</p>
      <button class="btn" onclick="location.reload()">Reload</button></div>`;
  }
}

render();
