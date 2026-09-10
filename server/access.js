import path from 'node:path';
import { BOOKS_DIR } from './config.js';
import * as store from './store.js';
import { currentAdmin, hasGrant, grantShareToken, verifyPassword } from './auth.js';

export function bookDir(bookId) {
  return path.join(BOOKS_DIR, bookId);
}

export function scheduleState(book) {
  const now = Date.now();
  const start = book.access.startAt ? Date.parse(book.access.startAt) : null;
  const end = book.access.endAt ? Date.parse(book.access.endAt) : null;
  if (start && now < start) return 'scheduled';
  if (end && now > end) return 'ended';
  return 'live';
}

/**
 * Decide whether the current request may read a book.
 * Returns { ok, reason, share } - reason drives the gate page shown to readers.
 */
export function checkAccess(req, book) {
  if (!book) return { ok: false, reason: 'not_found' };
  if (currentAdmin(req)) return { ok: true, preview: true, share: null };

  const shareToken = grantShareToken(req, book.id);
  const share = shareToken ? store.shareByToken(shareToken) : null;
  if (share && shareUsable(share).ok) {
    return { ok: true, share };
  }

  if (book.status !== 'published') return { ok: false, reason: 'unpublished' };

  const schedule = scheduleState(book);
  if (schedule === 'scheduled') return { ok: false, reason: 'scheduled' };
  if (schedule === 'ended') return { ok: false, reason: 'ended' };

  if (book.access.visibility === 'password') {
    if (!hasGrant(req, book.id)) return { ok: false, reason: 'password' };
  }
  return { ok: true, share: null };
}

export function shareUsable(share) {
  if (!share) return { ok: false, reason: 'not_found' };
  if (share.revoked) return { ok: false, reason: 'revoked' };
  if (share.expiresAt && Date.now() > Date.parse(share.expiresAt)) return { ok: false, reason: 'expired' };
  if (share.maxViews && share.views >= share.maxViews) return { ok: false, reason: 'exhausted' };
  return { ok: true };
}

export function checkBookPassword(book, plain) {
  if (!book.access.passwordHash) return false;
  return verifyPassword(plain, book.access.passwordHash);
}

/** The JSON the viewer boots from. Never leaks hashes or private settings. */
export function publicManifest(book, { share = null, preview = false } = {}) {
  const version = String(Date.parse(book.updatedAt || book.createdAt) || 0).slice(-8);
  const media = `/media/${book.id}`;
  const allowDownload = Boolean(
    book.downloads.pdf && book.appearance.showDownload && (!share || share.allowDownload !== false)
  );
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    pageCount: book.pages.count,
    aspect: book.pages.aspect || (book.pages.width && book.pages.height ? book.pages.width / book.pages.height : 0.707),
    layout: book.layout,
    appearance: {
      theme: book.appearance.theme,
      accent: book.appearance.accent || store.settings().accent,
      background: book.appearance.background,
      logoUrl: book.appearance.logoUrl || store.settings().logoUrl,
      showShare: book.appearance.showShare !== false,
      showPrint: Boolean(book.appearance.showPrint),
      autoHideUi: book.appearance.autoHideUi !== false
    },
    capabilities: {
      search: Boolean(book.pages.hasText),
      download: allowDownload,
      preview
    },
    toc: book.toc || [],
    links: book.links || {},
    urls: {
      page: `${media}/pages/p{n}.webp?v=${version}`,
      zoom: `${media}/zoom/p{n}.webp?v=${version}`,
      thumb: `${media}/thumbs/p{n}.webp?v=${version}`,
      download: allowDownload ? `${media}/download` : null,
      self: `/b/${book.slug}`
    },
    share: share ? { label: share.label || '', recipient: share.recipient || '' } : null
  };
}

export function listableBooks() {
  return store
    .books()
    .filter((b) => b.status === 'published' && b.access.visibility === 'public' && scheduleState(b) === 'live');
}
