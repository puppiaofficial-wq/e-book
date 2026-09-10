#!/usr/bin/env node
/**
 * Command-line import, for bulk or scripted conversion:
 *   npm run import -- ./catalogs/2026fw.pdf --title "2026 F/W" --publish
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import * as store from '../server/store.js';
import { bookDir } from '../server/access.js';
import { convertPdf } from '../server/convert.js';
import { nowIso } from '../server/util.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run import -- <file.pdf> [--title "Name"] [--collection "Name"] [--publish] [--split auto|never|always]');
  process.exit(1);
}
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1]?.startsWith('--') ? true : args[at + 1]) : fallback;
};

const source = path.resolve(file);
if (!fs.existsSync(source)) {
  console.error(`File not found: ${source}`);
  process.exit(1);
}

const title = flag('title') || path.basename(source).replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
let collectionId = null;
const collectionName = flag('collection');
if (collectionName) {
  const existing = store.collections().find((c) => c.name === collectionName);
  collectionId = existing ? existing.id : (await store.addCollection(collectionName)).id;
}

const book = store.newBook({ title, filename: path.basename(source), collectionId });
await store.addBook(book);

const dir = bookDir(book.id);
await fsp.mkdir(dir, { recursive: true });
const target = path.join(dir, 'source.pdf');
await fsp.copyFile(source, target);

console.log(`Converting "${title}" …`);
const outcome = await convertPdf(target, dir, { splitSpreads: flag('split', 'auto') }, ({ done, total }) => {
  process.stdout.write(`\r  page ${done}/${total}   `);
});
process.stdout.write('\n');

const stat = await fsp.stat(target);
await store.updateBook(book.id, {
  pages: {
    count: outcome.manifest.pageCount,
    width: outcome.manifest.width,
    height: outcome.manifest.height,
    aspect: outcome.manifest.aspect,
    format: outcome.manifest.format,
    hasText: outcome.manifest.hasText,
    splitApplied: outcome.manifest.splitApplied
  },
  toc: outcome.toc,
  links: outcome.links,
  source: { filename: path.basename(source), bytes: stat.size, importedAt: nowIso() },
  ...(flag('publish') ? { status: 'published', publishedAt: nowIso() } : {})
});

console.log(`Done: ${outcome.manifest.pageCount} pages, slug "${book.slug}"`);
console.log(`Open /b/${book.slug} once the server is running.`);
process.exit(0);
