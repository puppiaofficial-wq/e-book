#!/usr/bin/env node
/** Recover access when the admin password is lost: npm run reset-admin -- you@example.com newpassword */
import * as store from '../server/store.js';
import { hashPassword } from '../server/auth.js';
import { nowIso } from '../server/util.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run reset-admin -- <email> <password (8+ characters)>');
  process.exit(1);
}
await store.setAdmin({ email: email.trim().toLowerCase(), ...hashPassword(password), createdAt: nowIso() });
console.log(`Admin account reset for ${email}`);
process.exit(0);
