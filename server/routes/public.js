import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { PUBLIC_BASE_URL } from '../config.js';
import * as store from '../store.js';
import { wrap, originOf, escapeHtml, readJson } from '../util.js';
import { issueGrant, currentAdmin } from '../auth.js';
import {
  bookDir, checkAccess, checkBookPassword, publicManifest, listableBooks, shareUsable
} from '../access.js';
import { viewerPage, gatePage, libraryPage } from '../pages.js';
import { track, visitorHash, deviceOf } from '../analytics.js';

export const router = express.Router();

const textCache = new Map();

/* ------------------------------------------------------------ pages */

router.get('/', (req, res) => {
  const s = store.settings();
  if (!s.publicLibrary) return res.redirect('/admin');
  res.type('html').send(
    libraryPage({ books: listableBooks(), origin: origin(req), collections: store.collections() })
  );
});

router.get('/library', (req, res) => {
  if (!store.settings().publicLibrary && !currentAdmin(req)) return res.status(404).send('Not found');
  res.type('html').send(
    libraryPage({ books: listableBooks(), origin: origin(req), collections: store.collections() })
  );
});

router.get('/b/:slug', wrap(async (req, res) => renderViewer(req, res, { embed: false })));
router.get('/embed/:slug', wrap(async (req, res) => renderViewer(req, res, { embed: true })));

/** Buyer share link: validates, records the open, then redirects to the viewer. */
router.get('/s/:token', wrap(async (req, res) => {
  const share = store.shareByToken(req.params.token);
  const usable = shareUsable(share);
  if (!share) {
    return res.status(404).type('html').send(gatePage({
      title: 'Link not found',
      message: 'This share link does not exist. Please ask the sender for a new one.',
      origin: origin(req), tone: 'error'
    }));
  }
  if (!usable.ok) {
    const messages = {
      revoked: 'This share link has been revoked by the sender.',
      expired: 'This share link has expired.',
      exhausted: 'This share link has reached its view limit.'
    };
    return res.status(410).type('html').send(gatePage({
      title: 'Link no longer available',
      message: messages[usable.reason] || 'This share link is no longer active.',
      origin: origin(req), tone: 'error'
    }));
  }
  const book = store.bookById(share.bookId);
  if (!book) return res.status(404).type('html').send(gatePage({
    title: 'Catalog removed', message: 'The catalog behind this link is no longer available.',
    origin: origin(req), tone: 'error'
  }));

  if (share.passwordHash && req.query.pw === undefined && !req.body?.password) {
    return res.type('html').send(passwordGate(req, {
      title: 'Enter access code',
      message: `This catalog was shared privately${share.recipient ? ` with ${escapeHtml(share.recipient)}` : ''}. Enter the access code you received.`,
      action: `/s/${share.token}`
    }));
  }

  await store.updateShare(share.token, {
    views: (share.views || 0) + 1,
    lastViewedAt: new Date().toISOString()
  });
  issueGrant(res, req, book.id, share.token);
  track({
    type: 'open', book: book.id, share: share.token, v: visitorHash(req),
    ref: refOf(req), device: deviceOf(req.headers['user-agent'])
  });
  res.redirect(`/b/${book.slug}${req.query.p ? `#p=${Number(req.query.p) || 1}` : ''}`);
}));

router.post('/s/:token', express.urlencoded({ extended: false }), wrap(async (req, res) => {
  const share = store.shareByToken(req.params.token);
  if (!share || !shareUsable(share).ok) return res.redirect(`/s/${req.params.token}`);
  const { verifyPassword } = await import('../auth.js');
  if (share.passwordHash && !verifyPassword(req.body.password || '', share.passwordHash)) {
    return res.status(401).type('html').send(passwordGate(req, {
      title: 'Enter access code',
      message: 'That access code did not match. Please try again.',
      action: `/s/${share.token}`, error: true
    }));
  }
  const book = store.bookById(share.bookId);
  await store.updateShare(share.token, {
    views: (share.views || 0) + 1,
    lastViewedAt: new Date().toISOString()
  });
  issueGrant(res, req, book.id, share.token);
  track({
    type: 'open', book: book.id, share: share.token, v: visitorHash(req),
    ref: refOf(req), device: deviceOf(req.headers['user-agent'])
  });
  res.redirect(`/b/${book.slug}`);
}));

/** Password-protected catalog (no share link involved). */
router.post('/b/:slug/unlock', express.urlencoded({ extended: false }), wrap(async (req, res) => {
  const book = store.bookBySlug(req.params.slug);
  if (!book) return res.status(404).send('Not found');
  if (!checkBookPassword(book, req.body.password || '')) {
    return res.status(401).type('html').send(passwordGate(req, {
      title: 'Password required',
      message: 'That password did not match. Please try again.',
      action: `/b/${book.slug}/unlock`, error: true
    }));
  }
  issueGrant(res, req, book.id, null);
  res.redirect(`/b/${book.slug}`);
}));

/* -------------------------------------------------------------- api */

router.get('/api/v1/books/:slug', wrap(async (req, res) => {
  const book = store.bookBySlug(req.params.slug);
  const access = checkAccess(req, book);
  if (!access.ok) return res.status(access.reason === 'not_found' ? 404 : 403).json({ error: access.reason });
  res.json(publicManifest(book, access));
}));

router.get('/api/v1/books/:slug/search', wrap(async (req, res) => {
  const book = store.bookBySlug(req.params.slug);
  const access = checkAccess(req, book);
  if (!access.ok) return res.status(404).json({ error: 'not_found' });
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ query, hits: [] });
  res.json({ query, hits: searchBook(book, query) });
}));

router.post('/api/v1/track', express.json({ limit: '4kb' }), (req, res) => {
  const { slug, type, page } = req.body || {};
  const book = store.bookBySlug(slug);
  if (!book || !['open', 'page', 'download', 'share'].includes(type)) return res.status(204).end();
  const access = checkAccess(req, book);
  if (!access.ok) return res.status(204).end();
  track({
    type, book: book.id, page: Number(page) || undefined,
    share: access.share?.token, v: visitorHash(req),
    ref: refOf(req), device: deviceOf(req.headers['user-agent'])
  });
  res.status(204).end();
});

router.get('/api/v1/qr', wrap(async (req, res) => {
  const data = String(req.query.data || '').slice(0, 800);
  if (!data) return res.status(400).json({ error: 'data required' });
  const svg = await QRCode.toString(data, {
    type: 'svg', margin: 1, width: 320,
    color: { dark: '#111315', light: '#ffffff' }
  });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
}));

/* ------------------------------------------------------------ media */

router.get('/media/:bookId/download', wrap(async (req, res) => {
  const book = store.bookById(req.params.bookId);
  const access = checkAccess(req, book);
  if (!access.ok || !book.downloads.pdf) return res.status(404).send('Not found');
  const file = path.join(bookDir(book.id), 'source.pdf');
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  track({ type: 'download', book: book.id, share: access.share?.token, v: visitorHash(req) });
  res.download(file, `${book.slug}.pdf`);
}));

router.get('/media/:bookId/:kind/:file', wrap(async (req, res) => {
  const { bookId, kind, file } = req.params;
  if (!['pages', 'zoom', 'thumbs'].includes(kind)) return res.status(404).end();
  if (!/^p\d{4}\.webp$/.test(file)) return res.status(404).end();
  const book = store.bookById(bookId);
  if (!book) return res.status(404).end();

  // Cover thumbnails power the public bookshelf, so they stay readable for any
  // published catalog; page and zoom images follow the full access check.
  const coverOnly = kind === 'thumbs' && file === 'p0001.webp'
    && book.status === 'published' && book.access.visibility === 'public';
  if (!coverOnly) {
    const access = checkAccess(req, book);
    if (!access.ok) return res.status(403).end();
  }
  const abs = path.join(bookDir(bookId), kind, file);
  if (!fs.existsSync(abs)) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('image/webp').sendFile(abs);
}));

/* -------------------------------------------------------- internals */

async function renderViewer(req, res, { embed }) {
  const book = store.bookBySlug(req.params.slug);
  const access = checkAccess(req, book);
  const site = origin(req);

  if (!access.ok) {
    if (access.reason === 'password') {
      return res.status(401).type('html').send(passwordGate(req, {
        title: 'Password required',
        message: 'This catalog is protected. Enter the password to continue.',
        action: `/b/${book.slug}/unlock`
      }));
    }
    const map = {
      not_found: ['Catalog not found', 'The catalog you are looking for does not exist or has been removed.'],
      unpublished: ['Not published yet', 'This catalog has not been published. Ask the sender for a share link.'],
      scheduled: ['Coming soon', 'This catalog is not open for viewing yet. Please check back later.'],
      ended: ['No longer available', 'The viewing period for this catalog has ended.']
    };
    const [title, message] = map[access.reason] || map.not_found;
    return res.status(access.reason === 'not_found' ? 404 : 403).type('html').send(
      gatePage({ title, message, origin: site, tone: 'error' })
    );
  }

  if (!book.pages.count) {
    return res.status(409).type('html').send(gatePage({
      title: 'Still processing',
      message: 'This catalog has no pages yet. It is either converting or the import failed.',
      origin: site, tone: 'error'
    }));
  }

  track({
    type: 'open', book: book.id, share: access.share?.token, v: visitorHash(req),
    ref: refOf(req), device: deviceOf(req.headers['user-agent'])
  });
  res.type('html').send(viewerPage({
    book,
    manifest: publicManifest(book, access),
    origin: site,
    embed,
    shareToken: access.share?.token || null
  }));
}

function passwordGate(req, { title, message, action, error = false }) {
  return gatePage({
    title, message, origin: origin(req), tone: error ? 'error' : 'info',
    form: `<form method="post" action="${action}">
      <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
      <button type="submit">Open catalog</button>
    </form>`
  });
}

function searchBook(book, query) {
  const data = loadText(book.id);
  if (!data) return [];
  const needle = query.toLowerCase();
  const hits = [];
  for (const page of data.pages || []) {
    for (const line of page.lines || []) {
      const lower = line.text.toLowerCase();
      let at = lower.indexOf(needle);
      if (at < 0) continue;
      const start = Math.max(0, at - 32);
      hits.push({
        page: page.index,
        snippet: (start ? '…' : '') + line.text.slice(start, at + needle.length + 48).trim() + '…',
        box: { x: line.x, y: line.y, w: line.w, h: line.h }
      });
      if (hits.length >= 120) return hits;
    }
  }
  return hits;
}

function loadText(bookId) {
  const cached = textCache.get(bookId);
  if (cached) return cached;
  const data = readJson(path.join(bookDir(bookId), 'text.json'), null);
  if (data) {
    textCache.set(bookId, data);
    if (textCache.size > 12) textCache.delete(textCache.keys().next().value);
  }
  return data;
}

export function invalidateText(bookId) {
  textCache.delete(bookId);
}

function refOf(req) {
  const raw = req.headers.referer || req.headers.referrer || '';
  try {
    return raw ? new URL(raw).host : '';
  } catch {
    return '';
  }
}

function origin(req) {
  return originOf(req, PUBLIC_BASE_URL);
}
