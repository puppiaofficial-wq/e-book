#!/usr/bin/env node
/**
 * Command-line static export. The admin console has a button that does the
 * same thing, so this is for scripted or bulk runs.
 *
 *   npm run export                          every published catalog
 *   npm run export -- 2026fw                one catalog
 *   npm run export -- all --out D:\\upload   somewhere else
 *   npm run export -- 2026fw --zoom 3600    larger zoom images
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import { ROOT } from '../server/config.js';
import * as store from '../server/store.js';
import { exportBook, writeLibraryIndex } from '../server/export.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : fallback;
};
const target = args.find((a) => !a.startsWith('--')) || 'all';
const outRoot = path.resolve(ROOT, flag('out', 'export'));
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
  const result = await exportBook(book, outRoot, {
    zoomWidth,
    onProgress: ({ done, total }) => process.stdout.write(`\r  확대 이미지 ${done}/${total}   `)
  });
  if (zoomWidth) process.stdout.write('\n');
  console.log(
    `${book.slug.padEnd(20)} ${book.pages.count}페이지  ` +
    `확대이미지 ${result.zoomWidth || '?'}px  ${(result.bytes / 1048576).toFixed(1)} MB  ->  ${result.dir}`
  );
}

if (selected.length > 1) await writeLibraryIndex(outRoot, selected);

console.log(`\n완료. ${outRoot} 폴더를 그대로 업로드하세요.`);
process.exit(0);
