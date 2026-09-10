/**
 * Deliberately tiny analytics: append-only JSONL per month, aggregated on
 * demand. No cookies beyond a rotating day-salted visitor hash, no third party.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EVENTS_DIR } from './config.js';

const streams = new Map();
const cache = new Map();

function monthFile(date = new Date()) {
  const name = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}.jsonl`;
  return path.join(EVENTS_DIR, name);
}

function streamFor(file) {
  if (!streams.has(file)) {
    streams.set(file, fs.createWriteStream(file, { flags: 'a' }));
  }
  return streams.get(file);
}

export function visitorHash(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const agent = req.headers['user-agent'] || '';
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${ip}|${agent}|${day}`).digest('hex').slice(0, 16);
}

export function track(event) {
  const record = { t: Date.now(), ...event };
  if (!record.book) return;
  streamFor(monthFile()).write(`${JSON.stringify(record)}\n`);
  cache.clear();
}

export function summarise(bookId, days = 30) {
  const key = `${bookId}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.value;

  const since = Date.now() - days * 86400000;
  const totals = {
    opens: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    downloads: 0,
    byDay: {},
    byPage: {},
    byShare: {},
    byReferrer: {},
    byDevice: { desktop: 0, mobile: 0, tablet: 0 }
  };
  const visitors = new Set();

  for (const file of filesInRange(days)) {
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.book !== bookId || record.t < since) continue;
      const day = new Date(record.t).toISOString().slice(0, 10);
      if (record.type === 'open') {
        totals.opens += 1;
        totals.byDay[day] = (totals.byDay[day] || 0) + 1;
        if (record.v) visitors.add(record.v);
        if (record.share) totals.byShare[record.share] = (totals.byShare[record.share] || 0) + 1;
        if (record.ref) totals.byReferrer[record.ref] = (totals.byReferrer[record.ref] || 0) + 1;
        if (record.device && totals.byDevice[record.device] != null) totals.byDevice[record.device] += 1;
      } else if (record.type === 'page') {
        totals.pageViews += 1;
        totals.byPage[record.page] = (totals.byPage[record.page] || 0) + 1;
      } else if (record.type === 'download') {
        totals.downloads += 1;
      }
    }
  }
  totals.uniqueVisitors = visitors.size;
  const value = totals;
  cache.set(key, { at: Date.now(), value });
  return value;
}

function filesInRange(days) {
  const out = [];
  const cursor = new Date();
  const months = Math.max(1, Math.ceil(days / 28) + 1);
  for (let i = 0; i < months; i += 1) {
    out.push(monthFile(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return out;
}

export function deviceOf(userAgent = '') {
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
