/** In-process conversion queue with server-sent-event progress. */
import { id } from './util.js';

const jobs = new Map();
const listeners = new Map();
let running = false;
const queue = [];

export function createJob(label) {
  const job = {
    id: id('job_'),
    label,
    state: 'queued', // queued | running | done | failed
    progress: 0,
    message: 'Waiting to start',
    result: null,
    error: null,
    startedAt: null,
    finishedAt: null
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function enqueue(job, task) {
  queue.push({ job, task });
  pump();
  return job;
}

async function pump() {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = true;
  const { job, task } = next;
  job.state = 'running';
  job.startedAt = Date.now();
  update(job, { progress: 0.02, message: 'Reading document' });
  try {
    job.result = await task((patch) => update(job, patch));
    update(job, { state: 'done', progress: 1, message: 'Ready' });
  } catch (error) {
    console.error('[job] failed', error);
    update(job, { state: 'failed', message: error.message || 'Conversion failed', error: error.message });
  } finally {
    job.finishedAt = Date.now();
    running = false;
    setTimeout(() => jobs.delete(job.id), 10 * 60 * 1000).unref?.();
    pump();
  }
}

export function update(job, patch) {
  Object.assign(job, patch);
  for (const res of listeners.get(job.id) || []) {
    write(res, job);
  }
}

export function subscribe(jobId, res) {
  const job = jobs.get(jobId);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (!job) {
    res.write(`data: ${JSON.stringify({ state: 'failed', message: 'Unknown job' })}\n\n`);
    return res.end();
  }
  const list = listeners.get(jobId) || [];
  list.push(res);
  listeners.set(jobId, list);
  write(res, job);
  const beat = setInterval(() => res.write(': ping\n\n'), 20000);
  res.on('close', () => {
    clearInterval(beat);
    listeners.set(jobId, (listeners.get(jobId) || []).filter((r) => r !== res));
  });
}

function write(res, job) {
  const payload = {
    id: job.id,
    state: job.state,
    progress: job.progress,
    message: job.message,
    result: job.result,
    error: job.error
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (job.state === 'done' || job.state === 'failed') res.end();
}
