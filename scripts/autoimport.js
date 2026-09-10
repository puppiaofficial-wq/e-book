#!/usr/bin/env node
/**
 * Imports every PDF sitting in ./catalogs that is not in the library yet.
 * Run by the one-click start scripts, so dropping a file in the folder and
 * launching is the whole workflow.
 */
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { ROOT } from '../server/config.js';
import * as store from '../server/store.js';
import { bookDir } from '../server/access.js';
import { convertPdf, pagesRecord } from '../server/convert.js';
import { nowIso } from '../server/util.js';

const inbox = path.join(ROOT, 'catalogs');
await fsp.mkdir(inbox, { recursive: true });

const files = (await fsp.readdir(inbox))
  .filter((name) => /\.pdf$/i.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) {
  console.log('catalogs 폴더에 PDF가 없습니다. 관리자 화면에서 직접 업로드하셔도 됩니다.');
  process.exit(0);
}

let imported = 0;
for (const name of files) {
  const source = path.join(inbox, name);
  const stat = fs.statSync(source);
  const already = store.books().some(
    (book) => book.source.filename === name && book.source.bytes === stat.size
  );
  if (already) {
    console.log(`건너뜀 (이미 등록됨): ${name}`);
    continue;
  }

  const title = name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const book = store.newBook({ title, filename: name });
  await store.addBook(book);

  const dir = bookDir(book.id);
  await fsp.mkdir(dir, { recursive: true });
  const target = path.join(dir, 'source.pdf');
  await fsp.copyFile(source, target);

  console.log(`변환 중: ${name}`);
  const outcome = await convertPdf(target, dir, { splitSpreads: 'auto' }, ({ done, total }) => {
    process.stdout.write(`\r  ${done} / ${total} 페이지   `);
  });
  process.stdout.write('\n');

  await store.updateBook(book.id, {
    pages: pagesRecord(outcome.manifest),
    toc: outcome.toc,
    links: outcome.links,
    source: { filename: name, bytes: stat.size, importedAt: nowIso() },
    status: 'published',
    publishedAt: nowIso()
  });

  imported += 1;
  console.log(`완료: ${outcome.manifest.pageCount}페이지${outcome.manifest.splitApplied ? ' (양면 대지를 자동 분할했습니다)' : ''}`);
  console.log(`주소: /b/${book.slug}\n`);
}

console.log(imported ? `${imported}개 카탈로그를 등록했습니다.` : '새로 등록할 카탈로그가 없습니다.');
process.exit(0);
