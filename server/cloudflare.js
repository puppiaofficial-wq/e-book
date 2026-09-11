/**
 * One-button publishing to Cloudflare Pages.
 *
 * The exported folder is uploaded straight from here, so the operator never
 * downloads a zip, opens the Cloudflare dashboard, or drags anything. This
 * speaks the same Direct Upload protocol the official CLI uses: hash every
 * file, ask which ones Cloudflare is missing, send only those, then post a
 * manifest that turns the uploaded set into a deployment.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import blake3 from 'blake3-wasm';

const API = 'https://api.cloudflare.com/client/v4';

/** Cloudflare refuses any single asset above this. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** How much to put in one upload request, and how many to run at once. */
const BUCKET_BYTES = 40 * 1024 * 1024;
const BUCKET_FILES = 1000;
const CONCURRENCY = 3;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2',
  '.avif': 'image/avif', '.webmanifest': 'application/manifest+json'
};

const mimeOf = (name) => MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';

/** Project names may only hold lowercase letters, digits and dashes. */
export function projectNameFor(slug) {
  return String(slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 58) || 'catalog';
}

/**
 * Cloudflare answers with a JSON envelope whose `errors` array carries the
 * reason. Surfacing that text is the difference between "deploy failed" and
 * "your token is missing the Pages permission".
 */
async function call(url, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* an error page rather than an envelope */
  }

  if (!payload || payload.success === false) {
    const first = payload?.errors?.[0];
    const detail = first ? `${first.message}${first.code ? ` (${first.code})` : ''}` : `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    error.code = first?.code;
    throw error;
  }
  return payload.result;
}

/** Same hash the Pages API expects: blake3 over the base64 body plus extension. */
function hashFile(file) {
  const base64 = fs.readFileSync(file).toString('base64');
  const extension = path.extname(file).slice(1);
  return blake3.hash(base64 + extension).toString('hex').slice(0, 32);
}

async function collect(dir) {
  const files = new Map();
  const walk = async (current) => {
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const name = path.relative(dir, full).split(path.sep).join('/');
      const { size } = await fsp.stat(full);
      files.set(name, { path: full, size, contentType: mimeOf(name), hash: hashFile(full) });
    }
  };
  await walk(dir);
  return files;
}

/** Pack files into upload batches that stay inside the request size limit. */
function bucketize(files) {
  const buckets = [];
  for (const file of [...files].sort((a, b) => b.size - a.size)) {
    let placed = buckets.find((b) => b.bytes + file.size <= BUCKET_BYTES && b.files.length < BUCKET_FILES);
    if (!placed) {
      placed = { files: [], bytes: 0 };
      buckets.push(placed);
    }
    placed.files.push(file);
    placed.bytes += file.size;
  }
  return buckets;
}

async function inParallel(tasks, limit, onEach) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const mine = tasks[next++];
      await onEach(mine);
    }
  });
  await Promise.all(workers);
}

/** Creates the project on first deploy, so the operator never visits the dashboard. */
async function ensureProject(accountId, token, name) {
  try {
    return await call(`${API}/accounts/${accountId}/pages/projects/${name}`, { token });
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  return call(`${API}/accounts/${accountId}/pages/projects`, {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, production_branch: 'main' })
  });
}

/**
 * @param onProgress receives { done, total, stage }
 * @returns { url, projectName, uploaded, reused, deploymentId }
 */
export async function deployFolder({
  accountId, apiToken, projectName, dir, branch = 'main', onProgress = () => {}
}) {
  if (!accountId || !apiToken) throw new Error('Cloudflare account ID and API token are both required.');
  if (!fs.existsSync(dir)) throw new Error('Nothing has been prepared for this catalog yet.');

  const name = projectNameFor(projectName);
  onProgress({ stage: 'Checking the Cloudflare project', done: 0, total: 1 });
  const project = await ensureProject(accountId, apiToken, name);

  onProgress({ stage: 'Listing the files to upload', done: 0, total: 1 });
  const files = await collect(dir);
  if (!files.size) throw new Error('The prepared folder is empty.');

  const tooBig = [...files].filter(([, f]) => f.size > MAX_ASSET_BYTES);
  if (tooBig.length) {
    const list = tooBig.map(([n, f]) => `${n} (${(f.size / 1048576).toFixed(0)} MB)`).join(', ');
    throw new Error(`Cloudflare accepts files up to 25 MB. Too large: ${list}`);
  }

  const { jwt } = await call(`${API}/accounts/${accountId}/pages/projects/${name}/upload-token`, { token: apiToken });
  const all = [...files.values()];
  const hashes = all.map((f) => f.hash);

  // Anything Cloudflare already holds from an earlier deploy is not re-sent,
  // which is why a second publish of the same catalog takes seconds.
  const missing = new Set(await call(`${API}/pages/assets/check-missing`, {
    token: jwt,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes })
  }));

  const pending = all.filter((f) => missing.has(f.hash));
  const total = pending.length;
  let done = 0;
  onProgress({ stage: 'Uploading', done, total });

  await inParallel(bucketize(pending), CONCURRENCY, async (bucket) => {
    const payload = await Promise.all(bucket.files.map(async (file) => ({
      key: file.hash,
      value: (await fsp.readFile(file.path)).toString('base64'),
      metadata: { contentType: file.contentType },
      base64: true
    })));
    await call(`${API}/pages/assets/upload`, {
      token: jwt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    done += bucket.files.length;
    onProgress({ stage: 'Uploading', done, total });
  });

  // Best effort: it only decides whether the next deploy can skip these files.
  try {
    await call(`${API}/pages/assets/upsert-hashes`, {
      token: jwt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashes })
    });
  } catch {
    /* the deployment below still succeeds */
  }

  onProgress({ stage: 'Publishing', done: total, total });
  const form = new FormData();
  form.append('manifest', JSON.stringify(Object.fromEntries([...files].map(([n, f]) => [`/${n}`, f.hash]))));
  form.append('branch', branch);

  const deployment = await call(`${API}/accounts/${accountId}/pages/projects/${name}/deployments`, {
    token: apiToken,
    method: 'POST',
    body: form
  });

  return {
    url: deployment.url || `https://${project.subdomain || `${name}.pages.dev`}`,
    liveUrl: `https://${project.subdomain || `${name}.pages.dev`}`,
    projectName: name,
    deploymentId: deployment.id,
    uploaded: total,
    reused: all.length - total
  };
}

/** Confirms the token works and can see Pages, without deploying anything. */
export async function verify({ accountId, apiToken }) {
  const projects = await call(`${API}/accounts/${accountId}/pages/projects?per_page=1`, { token: apiToken });
  return { ok: true, projects: Array.isArray(projects) ? projects.length : 0 };
}
