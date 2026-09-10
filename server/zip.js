/**
 * Minimal streaming ZIP writer.
 *
 * The export bundle only ever needs stored-or-deflated entries under 4 GB, and
 * a hand-rolled writer keeps a moving dependency out of the publish path. Names
 * are written UTF-8 with the language-encoding flag set, which is what every
 * modern unzip and Cloudflare's direct upload expect.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflateRaw = promisify(zlib.deflateRaw);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

/** Zips the contents of `dir` (not the folder itself) into `zipPath`. */
export async function zipDirectory(dir, zipPath) {
  const files = await collect(dir, '');
  files.sort((a, b) => a.name.localeCompare(b.name));

  const out = fs.createWriteStream(zipPath);
  const write = (chunk) =>
    new Promise((resolve, reject) => {
      out.write(chunk, (error) => (error ? reject(error) : resolve()));
    });

  const central = [];
  let offset = 0;

  for (const file of files) {
    const raw = await fsp.readFile(file.abs);
    const stat = await fsp.stat(file.abs);
    const { time, date } = dosStamp(stat.mtime);
    const crc = crc32(raw);

    // Already-compressed payloads (WebP, PDF) gain nothing from deflate.
    const packed = /\.(webp|png|jpe?g|pdf|zip)$/i.test(file.name) ? null : await deflateRaw(raw);
    const useDeflate = packed !== null && packed.length < raw.length;
    const body = useDeflate ? packed : raw;
    const method = useDeflate ? 8 : 0;
    const name = Buffer.from(file.name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    await write(local);
    await write(name);
    await write(body);

    central.push({ name, method, time, date, crc, compressed: body.length, size: raw.length, offset });
    offset += local.length + name.length + body.length;
  }

  const centralStart = offset;
  for (const entry of central) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(entry.method, 10);
    header.writeUInt16LE(entry.time, 12);
    header.writeUInt16LE(entry.date, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.compressed, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    await write(header);
    await write(entry.name);
    offset += header.length + entry.name.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  await write(end);

  await new Promise((resolve, reject) => {
    out.on('close', resolve);
    out.on('error', reject);
    out.end();
  });

  return offset + end.length;
}

async function collect(dir, prefix) {
  const out = [];
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await collect(abs, name)));
    else if (entry.isFile()) out.push({ abs, name });
  }
  return out;
}
