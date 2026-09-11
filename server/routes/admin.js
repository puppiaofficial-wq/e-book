import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { TMP_DIR, PUBLIC_BASE_URL, EXPORT_DIR, VERSION } from '../config.js';
import * as store from '../store.js';
import { wrap, originOf, id, token, nowIso, rmrf, slugify } from '../util.js';
import {
  hashPassword, verifyPassword, issueSession, endSession, currentAdmin, requireAdmin
} from '../auth.js';
import { bookDir, scheduleState, canRenderHires } from '../access.js';
import { convertPdf, convertImages, pagesRecord } from '../convert.js';
import { exportBook, zipFolder, exportPathsFor } from '../export.js';
import { forgetDocument } from '../hires.js';
import { createJob, enqueue, subscribe, getJob } from '../jobs.js';
import { summarise } from '../analytics.js';
import { invalidateText } from './public.js';

export const router = express.Router();

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024, files: 400 }
});

router.use(express.json({ limit: '4mb' }));

/* ---------------------------------------------------------- session */

router.get('/api/session', (req, res) => {
  const account = store.admin();
  res.json({
    configured: Boolean(account),
    admin: currentAdmin(req),
    settings: account ? store.settings() : null,
    baseUrl: originOf(req, PUBLIC_BASE_URL),
    version: VERSION
  });
});

router.post('/api/setup', wrap(async (req, res) => {
  if (store.admin()) return res.status(409).json({ error: 'Already configured' });
  const { email, password } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'Email and a password of at least 8 characters are required.' });
  }
  const record = { email: String(email).trim().toLowerCase(), ...hashPassword(password), createdAt: nowIso() };
  await store.setAdmin(record);
  issueSession(res, record.email);
  res.json({ ok: true, admin: { email: record.email } });
}));

router.post('/api/login', wrap(async (req, res) => {
  const account = store.admin();
  const { email, password } = req.body || {};
  if (!account || account.email !== String(email || '').trim().toLowerCase() || !verifyPassword(password || '', account)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  issueSession(res, account.email);
  res.json({ ok: true, admin: { email: account.email } });
}));

router.post('/api/logout', (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.post('/api/account', requireAdmin, wrap(async (req, res) => {
  const account = store.admin();
  const { currentPassword, email, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword || '', account)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const next = { ...account };
  if (email) next.email = String(email).trim().toLowerCase();
  if (newPassword) {
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    Object.assign(next, hashPassword(newPassword));
  }
  await store.setAdmin(next);
  issueSession(res, next.email);
  res.json({ ok: true });
}));

router.use('/api', requireAdmin);

/* ------------------------------------------------------------ books */

router.get('/api/books', (req, res) => {
  res.json({
    books: store.books().map(summaryOf),
    collections: store.collections()
  });
});

router.get('/api/books/:id', (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json({
    book: publicSafe(book),
    shares: store.sharesForBook(book.id).map(shareSafe(req)),
    urls: linkSet(req, book),
    quality: qualityReport(book)
  });
});

router.post('/api/books', upload.array('files', 400), wrap(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Upload a PDF or a set of page images.' });

  const pdf = files.find((f) => /pdf$/i.test(f.originalname) || f.mimetype === 'application/pdf');
  const title = (req.body.title || '').trim() ||
    stripExtension(pdf ? pdf.originalname : files[0].originalname);

  const book = store.newBook({ title, filename: pdf?.originalname || '', collectionId: req.body.collectionId || null });
  await store.addBook(book);

  const job = startConversion(book, files, { splitSpreads: req.body.splitSpreads || 'auto' });
  res.status(202).json({ book: summaryOf(book), jobId: job.id });
}));

router.post('/api/books/:id/reimport', upload.array('files', 400), wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Upload a replacement file.' });
  const job = startConversion(book, files, {
    splitSpreads: req.body.splitSpreads || 'auto',
    keepMeta: true
  });
  res.status(202).json({ jobId: job.id });
}));

router.get('/api/jobs/:id/stream', (req, res) => subscribe(req.params.id, res));
router.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json({ id: job.id, state: job.state, progress: job.progress, message: job.message, error: job.error });
});

router.patch('/api/books/:id', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const patch = { ...req.body };

  if (patch.slug) {
    patch.slug = store.uniqueSlug(patch.slug, book.id);
  }
  if (patch.access) {
    const { password, ...rest } = patch.access;
    patch.access = rest;
    if (password === '') patch.access.passwordHash = null;
    else if (typeof password === 'string' && password) patch.access.passwordHash = hashPassword(password);
  }
  if (patch.status === 'published' && book.status !== 'published') {
    patch.publishedAt = nowIso();
  }
  delete patch.id;
  delete patch.pages;
  const updated = await store.updateBook(book.id, patch);
  res.json({ book: publicSafe(updated), urls: linkSet(req, updated) });
}));

router.delete('/api/books/:id', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  await store.removeBook(book.id);
  invalidateText(book.id);
  await rmrf(bookDir(book.id));
  res.json({ ok: true });
}));

router.post('/api/books/:id/duplicate', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const copy = structuredClone(book);
  copy.id = id('bk_');
  copy.title = `${book.title} (copy)`;
  copy.slug = store.uniqueSlug(copy.title);
  copy.status = 'draft';
  copy.publishedAt = null;
  copy.createdAt = copy.updatedAt = nowIso();
  await fsp.cp(bookDir(book.id), bookDir(copy.id), { recursive: true });
  await store.addBook(copy);
  res.json({ book: summaryOf(copy) });
}));

/**
 * Re-runs conversion on the PDF already stored, optionally at a chosen zoom
 * width. Contents, links and share links are untouched.
 */
router.post('/api/books/:id/rerender', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const pdfPath = path.join(bookDir(book.id), 'source.pdf');
  if (!fs.existsSync(pdfPath)) {
    return res.status(409).json({ error: 'This catalog was not imported from a PDF, so there is nothing to re-render.' });
  }
  const zoomWidth = req.body?.zoomWidth ? Number(req.body.zoomWidth) : null;
  const job = createJob(`${book.title} (re-render)`);

  enqueue(job, async (report) => {
    const outcome = await convertPdf(
      pdfPath,
      bookDir(book.id),
      { splitSpreads: 'auto', zoomWidth },
      ({ done, total }) => report({
        progress: 0.03 + 0.94 * (done / total),
        message: `Rendering page ${done} of ${total}`
      })
    );
    await store.updateBook(book.id, { pages: pagesRecord(outcome.manifest) });
    invalidateText(book.id);
    forgetDocument(book.id);
    return { width: outcome.manifest.width, native: outcome.manifest.sizes.native };
  });

  res.status(202).json({ jobId: job.id });
}));

/* ----------------------------------------------------------- export */

/**
 * Builds the static bundle and zips it, so publishing to a static host is a
 * download and a drag rather than a terminal session.
 */
router.post('/api/books/:id/export', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  if (!book.pages.count) return res.status(409).json({ error: 'This catalog has no pages yet.' });

  const zoomWidth = req.body?.zoomWidth ? Math.min(6000, Math.max(1200, Number(req.body.zoomWidth))) : null;
  const job = createJob(`${book.title} (export)`);
  const paths = exportPathsFor(book);

  enqueue(job, async (report) => {
    report({ progress: 0.05, message: 'Collecting page images' });
    const result = await exportBook(book, EXPORT_DIR, {
      zoomWidth,
      onProgress: ({ done, total }) => report({
        progress: 0.05 + 0.8 * (done / total),
        message: `Rendering zoom image ${done} of ${total}`
      })
    });
    report({ progress: 0.88, message: 'Packing the download' });
    const zipBytes = await zipFolder(result.dir, paths.zip);
    return {
      bookId: book.id,
      slug: book.slug,
      bytes: result.bytes,
      zipBytes,
      zoomWidth: result.zoomWidth,
      folder: result.dir
    };
  });

  res.status(202).json({ jobId: job.id });
}));

router.get('/api/books/:id/export.zip', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const { zip } = exportPathsFor(book);
  if (!fs.existsSync(zip)) return res.status(404).json({ error: 'Nothing prepared yet.' });
  res.download(zip, `${book.slug}.zip`);
}));

/* ----------------------------------------------------------- shares */

router.post('/api/books/:id/shares', wrap(async (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const { label, recipient, password, expiresInDays, maxViews, allowDownload } = req.body || {};
  const record = {
    token: token(9),
    bookId: book.id,
    label: (label || '').trim(),
    recipient: (recipient || '').trim(),
    passwordHash: password ? hashPassword(password) : null,
    expiresAt: expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString() : null,
    maxViews: maxViews ? Number(maxViews) : null,
    allowDownload: allowDownload !== false,
    views: 0,
    revoked: false,
    createdAt: nowIso(),
    lastViewedAt: null
  };
  await store.addShare(record);
  res.json({ share: shareSafe(req)(record) });
}));

router.patch('/api/shares/:token', wrap(async (req, res) => {
  const patch = { ...req.body };
  if ('password' in patch) {
    patch.passwordHash = patch.password ? hashPassword(patch.password) : null;
    delete patch.password;
  }
  const record = await store.updateShare(req.params.token, patch);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json({ share: shareSafe(req)(record) });
}));

router.delete('/api/shares/:token', wrap(async (req, res) => {
  await store.removeShare(req.params.token);
  res.json({ ok: true });
}));

/* ------------------------------------------------------ collections */

router.post('/api/collections', wrap(async (req, res) => {
  res.json({ collection: await store.addCollection(req.body?.name) });
}));

router.patch('/api/collections/:id', wrap(async (req, res) => {
  const record = await store.updateCollection(req.params.id, { name: req.body?.name });
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json({ collection: record });
}));

router.delete('/api/collections/:id', wrap(async (req, res) => {
  await store.removeCollection(req.params.id);
  res.json({ ok: true });
}));

/* --------------------------------------------------------- settings */

router.patch('/api/settings', wrap(async (req, res) => {
  res.json({ settings: await store.updateSettings(req.body || {}) });
}));

/* -------------------------------------------------------- analytics */

router.get('/api/books/:id/analytics', (req, res) => {
  const book = store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  res.json({ days, totals: summarise(book.id, days) });
});

/* -------------------------------------------------------- internals */

function startConversion(book, files, options) {
  const job = createJob(book.title);
  const dir = bookDir(book.id);

  enqueue(job, async (report) => {
    await fsp.mkdir(dir, { recursive: true });
    const pdf = files.find((f) => /pdf$/i.test(f.originalname) || f.mimetype === 'application/pdf');
    let outcome;

    try {
      if (pdf) {
        const target = path.join(dir, 'source.pdf');
        await fsp.copyFile(pdf.path, target);
        const stat = await fsp.stat(target);
        outcome = await convertPdf(target, dir, options, ({ done, total, pages }) => {
          report({
            progress: 0.03 + 0.94 * (done / total),
            message: `Rendering page ${done} of ${total}${pages !== done ? ` (${pages} output pages)` : ''}`
          });
        });
        await store.updateBook(book.id, { source: { filename: pdf.originalname, bytes: stat.size, importedAt: nowIso() } });
      } else {
        const images = [...files].sort((a, b) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true }));
        outcome = await convertImages(images, dir, options, ({ done, total }) => {
          report({ progress: 0.03 + 0.94 * (done / total), message: `Processing image ${done} of ${total}` });
        });
        await store.updateBook(book.id, { source: { filename: `${images.length} images`, bytes: 0, importedAt: nowIso() } });
      }

      report({ progress: 0.97, message: 'Writing catalog data' });
      const current = store.bookById(book.id);
      const patch = { pages: pagesRecord(outcome.manifest) };
      if (!options.keepMeta) {
        patch.toc = outcome.toc;
        patch.links = outcome.links;
        if (outcome.title && (!current.title || current.title === 'Untitled catalog')) patch.title = outcome.title;
      } else if (!current.toc?.length) {
        patch.toc = outcome.toc;
      }
      await store.updateBook(book.id, patch);
      invalidateText(book.id);
      return { bookId: book.id, pageCount: outcome.manifest.pageCount, splitApplied: outcome.manifest.splitApplied };
    } finally {
      for (const file of files) await fsp.rm(file.path, { force: true });
    }
  });

  return job;
}

/** What the operator needs to judge zoom sharpness at a glance. */
function qualityReport(book) {
  const pages = book.pages;
  const dpi = pages.ptWidth ? Math.round(pages.width / (pages.ptWidth / 72)) : null;
  const native = pages.sizes?.native || null;
  return {
    sourceWidth: native,
    sourceDpi: native && pages.ptWidth ? Math.round(native / (pages.ptWidth / 72)) : null,
    limitedBySource: Boolean(native && pages.width <= native + 1),
    source: pages.source || (pages.hasText ? 'pdf' : 'unknown'),
    storedWidth: pages.width || 0,
    storedHeight: pages.height || 0,
    viewWidth: pages.sizes?.view || null,
    dpi,
    mm: pages.ptWidth ? {
      w: Math.round((pages.ptWidth / 72) * 25.4),
      h: Math.round((pages.ptHeight / 72) * 25.4)
    } : null,
    splitApplied: Boolean(pages.splitApplied),
    hires: canRenderHires(book)
  };
}

function stripExtension(name = '') {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled catalog';
}

function summaryOf(book) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    collectionId: book.collectionId,
    status: book.status,
    schedule: scheduleState(book),
    visibility: book.access.visibility,
    pageCount: book.pages.count,
    aspect: book.pages.aspect || 0.707,
    hasText: book.pages.hasText,
    shareCount: store.sharesForBook(book.id).filter((s) => !s.revoked).length,
    updatedAt: book.updatedAt,
    createdAt: book.createdAt
  };
}

function publicSafe(book) {
  const copy = structuredClone(book);
  copy.access = { ...copy.access, hasPassword: Boolean(copy.access.passwordHash) };
  delete copy.access.passwordHash;
  return copy;
}

const shareSafe = (req) => (share) => ({
  token: share.token,
  label: share.label,
  recipient: share.recipient,
  hasPassword: Boolean(share.passwordHash),
  expiresAt: share.expiresAt,
  maxViews: share.maxViews,
  allowDownload: share.allowDownload,
  views: share.views,
  revoked: share.revoked,
  createdAt: share.createdAt,
  lastViewedAt: share.lastViewedAt,
  url: `${originOf(req, PUBLIC_BASE_URL)}/s/${share.token}`
});

function linkSet(req, book) {
  const base = originOf(req, PUBLIC_BASE_URL);
  return {
    base,
    viewer: `${base}/b/${book.slug}`,
    embed: `${base}/embed/${book.slug}`,
    library: `${base}/library`,
    embedSnippet:
      `<iframe src="${base}/embed/${book.slug}" title="${book.title.replace(/"/g, '&quot;')}" ` +
      `style="width:100%;aspect-ratio:16/10;border:0" allowfullscreen loading="lazy"></iframe>`
  };
}
