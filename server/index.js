import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { PORT, PUBLIC_DIR, DATA_DIR, PUBLIC_BASE_URL, VERSION, EXPORT_DIR } from './config.js';
import * as store from './store.js';
import { hashPassword, currentAdmin } from './auth.js';
import { nowIso } from './util.js';
import { adminPage } from './pages.js';
import { router as publicRouter } from './routes/public.js';
import { router as adminRouter } from './routes/admin.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

/* Security headers. The embed route stays frameable on purpose - publishing a
   catalog inside someone else's page is a primary use case. */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  const embeddable = req.path.startsWith('/embed/') || req.path.startsWith('/media/');
  if (!embeddable) res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* The viewer and console are the parts that change when the software is
   updated, and a cached copy silently keeps running the old build. They
   revalidate on every load instead: an ETag makes that a 304 of a few bytes. */
const appCode = { etag: true, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
app.use('/viewer', express.static(path.join(PUBLIC_DIR, 'viewer'), appCode));
app.use('/admin/assets', express.static(path.join(PUBLIC_DIR, 'admin'), appCode));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: '7d' }));

/* The exported bundle, served exactly as a static host would. Opening this
   proves whether a publishing problem is in the files or in the hosting. */
app.use('/export-preview', (req, res, next) => {
  if (!currentAdmin(req)) return res.redirect('/admin');
  res.set('Cache-Control', 'no-cache');
  next();
}, express.static(EXPORT_DIR, { index: 'index.html', extensions: false }));

app.use('/admin', adminRouter);

/* Admin single-page app shell for every non-API admin route. */
app.get(/^\/admin(\/.*)?$/, (req, res, next) => {
  if (req.path.startsWith('/admin/api')) return next();
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(adminPage());
});

app.use('/', publicRouter);

app.use((req, res) => {
  res.status(404).type('html').send('<p style="font:15px system-ui;padding:2rem">Not found.</p>');
});

app.use((error, req, res, next) => {
  console.error('[error]', error);
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (req.path.startsWith('/admin/api') || req.path.startsWith('/api/')) {
    return res.status(status).json({ error: error.message || 'Server error' });
  }
  res.status(status).type('html').send('<p style="font:15px system-ui;padding:2rem">Something went wrong.</p>');
});

/* Optional bootstrap so container deployments can start ready to use. */
if (!store.admin() && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  await store.setAdmin({
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    ...hashPassword(process.env.ADMIN_PASSWORD),
    createdAt: nowIso()
  });
  console.log(`[setup] admin account created for ${process.env.ADMIN_EMAIL}`);
}

const server = app.listen(PORT, () => {
  console.log(`\n  eBook Studio  v${VERSION}`);
  console.log(`  ------------------------------------------`);
  console.log(`  Viewer / library : http://localhost:${PORT}/`);
  console.log(`  Admin console    : http://localhost:${PORT}/admin`);
  console.log(`  Data directory   : ${DATA_DIR}`);
  if (PUBLIC_BASE_URL) console.log(`  Public base URL  : ${PUBLIC_BASE_URL}`);
  else console.log(`  Public base URL  : (derived from request host - set PUBLIC_BASE_URL in production)`);
  console.log(`  ------------------------------------------\n`);
});

server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error;
  console.error(`\n  [!] 포트 ${PORT} 을 이미 다른 프로그램이 쓰고 있습니다.`);
  console.error('      예전에 켜 둔 검은 창이 남아 있을 가능성이 높습니다.');
  console.error('      그 창을 모두 닫고 start.bat 을 다시 실행해 주세요.');
  console.error('      (또는 .env 파일에서 PORT 를 8090 등으로 바꾸셔도 됩니다.)\n');
  process.exit(1);
});
