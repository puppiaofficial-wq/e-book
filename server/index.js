import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { PORT, PUBLIC_DIR, DATA_DIR, PUBLIC_BASE_URL } from './config.js';
import * as store from './store.js';
import { hashPassword, currentAdmin } from './auth.js';
import { nowIso } from './util.js';
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

app.use('/viewer', express.static(path.join(PUBLIC_DIR, 'viewer'), { maxAge: '1h' }));
app.use('/admin/assets', express.static(path.join(PUBLIC_DIR, 'admin'), { maxAge: '1h' }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: '7d' }));

app.use('/admin', adminRouter);

/* Admin single-page app shell for every non-API admin route. */
app.get(/^\/admin(\/.*)?$/, (req, res, next) => {
  if (req.path.startsWith('/admin/api')) return next();
  res.type('html').sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
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

app.listen(PORT, () => {
  console.log(`\n  eBook Studio`);
  console.log(`  ------------------------------------------`);
  console.log(`  Viewer / library : http://localhost:${PORT}/`);
  console.log(`  Admin console    : http://localhost:${PORT}/admin`);
  console.log(`  Data directory   : ${DATA_DIR}`);
  if (PUBLIC_BASE_URL) console.log(`  Public base URL  : ${PUBLIC_BASE_URL}`);
  else console.log(`  Public base URL  : (derived from request host - set PUBLIC_BASE_URL in production)`);
  console.log(`  ------------------------------------------\n`);
});
