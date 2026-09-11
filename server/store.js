import fs from 'node:fs';
import { LIBRARY_FILE } from './config.js';
import { readJson, writeJsonAtomic, id, nowIso, slugify } from './util.js';

const EMPTY = {
  version: 1,
  admin: null, // { email, hash, salt, createdAt }
  settings: {
    siteTitle: 'Digital Catalogs',
    tagline: 'Browse our latest collections',
    accent: '#e2001a',
    logoUrl: '',
    publicLibrary: true,
    contactEmail: '',
    footerNote: '',
    // Cloudflare Pages credentials, so publishing is one button rather than a
    // download, a dashboard visit and a drag. The token never leaves this file.
    cloudflare: { accountId: '', apiToken: '' }
  },
  collections: [],
  books: [],
  shares: []
};

let db = readJson(LIBRARY_FILE, null) || structuredClone(EMPTY);
// Settings gain keys between versions, so an existing file is filled in rather
// than replaced: a library saved before a setting existed still gets its default.
const base = structuredClone(EMPTY);
db = {
  ...base,
  ...db,
  settings: { ...base.settings, ...(db.settings || {}), cloudflare: { ...base.settings.cloudflare, ...(db.settings?.cloudflare || {}) } }
};

let writing = null;
let queued = false;

/** Coalesced atomic persistence: concurrent saves collapse into one write. */
export async function save() {
  if (writing) {
    queued = true;
    return writing;
  }
  writing = (async () => {
    await writeJsonAtomic(LIBRARY_FILE, db);
    writing = null;
    if (queued) {
      queued = false;
      await save();
    }
  })();
  return writing;
}

export function library() {
  return db;
}

export function settings() {
  return db.settings;
}

export async function updateSettings(patch) {
  Object.assign(db.settings, patch);
  await save();
  return db.settings;
}

export function admin() {
  return db.admin;
}

export async function setAdmin(record) {
  db.admin = record;
  await save();
  return record;
}

/* ---------------------------------------------------------- books */

export function books() {
  return db.books;
}

export function bookById(bookId) {
  return db.books.find((b) => b.id === bookId) || null;
}

export function bookBySlug(slug) {
  const needle = String(slug || '').toLowerCase();
  return db.books.find((b) => b.slug.toLowerCase() === needle) || null;
}

export function uniqueSlug(desired, exceptId = null) {
  const base = slugify(desired);
  let candidate = base;
  let n = 2;
  while (db.books.some((b) => b.slug === candidate && b.id !== exceptId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

export function newBook(fields = {}) {
  const created = nowIso();
  return {
    id: id('bk_'),
    slug: uniqueSlug(fields.title || 'catalog'),
    title: fields.title || 'Untitled catalog',
    subtitle: '',
    description: '',
    collectionId: fields.collectionId || null,
    status: 'draft',
    access: {
      visibility: 'public', // public | unlisted | password
      passwordHash: null,
      startAt: null,
      endAt: null
    },
    source: { filename: fields.filename || '', bytes: 0, importedAt: created },
    pages: { count: 0, width: 0, height: 0, format: 'webp', hasText: false },
    layout: {
      mode: 'auto',      // auto | spread | single
      coverAlone: true,  // cover shown on its own, like a real book
      rtl: false,
      pageOffset: 0      // printed page number of image 1
    },
    appearance: {
      theme: 'dark',
      accent: '',
      background: '',
      logoUrl: '',
      showDownload: false,
      showPrint: false,
      showShare: true,
      autoHideUi: true
    },
    toc: [],
    links: {},
    downloads: { pdf: false, filename: null },
    stats: { views: 0 },
    createdAt: created,
    updatedAt: created,
    publishedAt: null,
    ...(fields.overrides || {})
  };
}

export async function addBook(book) {
  db.books.unshift(book);
  await save();
  return book;
}

export async function updateBook(bookId, patch) {
  const book = bookById(bookId);
  if (!book) return null;
  const { links, ...rest } = patch;
  // Hotspots are keyed by page number, so a merge would resurrect pages the
  // editor just cleared: the link map is always replaced wholesale.
  if (links !== undefined) book.links = links;
  deepMerge(book, rest);
  book.updatedAt = nowIso();
  await save();
  return book;
}

export async function removeBook(bookId) {
  const index = db.books.findIndex((b) => b.id === bookId);
  if (index < 0) return false;
  db.books.splice(index, 1);
  db.shares = db.shares.filter((s) => s.bookId !== bookId);
  await save();
  return true;
}

/* ---------------------------------------------------- collections */

export function collections() {
  return db.collections;
}

export async function addCollection(name) {
  const record = { id: id('col_'), name: String(name).trim() || 'Untitled', createdAt: nowIso() };
  db.collections.push(record);
  await save();
  return record;
}

export async function updateCollection(collectionId, patch) {
  const record = db.collections.find((c) => c.id === collectionId);
  if (!record) return null;
  Object.assign(record, patch);
  await save();
  return record;
}

export async function removeCollection(collectionId) {
  db.collections = db.collections.filter((c) => c.id !== collectionId);
  for (const book of db.books) {
    if (book.collectionId === collectionId) book.collectionId = null;
  }
  await save();
  return true;
}

/* -------------------------------------------------------- shares */

export function shares() {
  return db.shares;
}

export function sharesForBook(bookId) {
  return db.shares.filter((s) => s.bookId === bookId);
}

export function shareByToken(value) {
  return db.shares.find((s) => s.token === value) || null;
}

export async function addShare(record) {
  db.shares.unshift(record);
  await save();
  return record;
}

export async function updateShare(shareToken, patch) {
  const record = shareByToken(shareToken);
  if (!record) return null;
  Object.assign(record, patch);
  await save();
  return record;
}

export async function removeShare(shareToken) {
  db.shares = db.shares.filter((s) => s.token !== shareToken);
  await save();
  return true;
}

/* --------------------------------------------------------- utils */

function deepMerge(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export { deepMerge };

if (!fs.existsSync(LIBRARY_FILE)) await save();
