// Service Worker for FunStay Hotel Reservations PWA
// Core caching is handled by sw-core; task engine is app-specific.
self.SW_CONFIG = {
  cacheVersion: 'funstay-pwa-v3',
  appShellFiles: [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './config.js',
    './manifest.webmanifest',
    './icons/icon-192.svg',
    './icons/icon-512.svg'
  ],
};
importScripts('/pwa/sw-core.js');

const swLog = {
  ring: [],
  max: 400,
  push(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, message, meta };
    this.ring.push(entry);
    if (this.ring.length > this.max) this.ring.shift();
    const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logger('[SW]', message, meta);
  }
};

const taskEngine = {
  queue: [],
  stack: [],
  active: 0,
  processing: false,
  concurrency: 3,
  batchSize: 5,

  enqueue(task, strategy = 'queue') {
    const item = {
      id: task.id || `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      retries: task.retries || 0,
      ...task
    };
    if (strategy === 'stack') {
      this.stack.unshift(item);
    } else {
      this.queue.push(item);
    }
    swLog.push('info', 'Task enqueued', { id: item.id, kind: item.kind, strategy });
    this.process().catch(error => swLog.push('error', 'Task process error', { error: String(error) }));
  },

  pullBatch() {
    const batch = [];
    while (batch.length < this.batchSize && (this.stack.length || this.queue.length)) {
      const item = this.stack.length ? this.stack.shift() : this.queue.shift();
      batch.push(item);
    }
    return batch;
  },

  async process() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.stack.length || this.queue.length) {
        const workers = [];
        const workerSlots = Math.max(1, this.concurrency - this.active);
        for (let i = 0; i < workerSlots; i += 1) {
          const batch = this.pullBatch();
          if (!batch.length) break;
          workers.push(this.runBatch(batch));
        }
        if (!workers.length) break;
        await Promise.allSettled(workers);
      }
    } finally {
      this.processing = false;
      this.broadcast({ type: 'SW_QUEUE_STATE', payload: this.snapshot() });
    }
  },

  snapshot() {
    return {
      queued: this.queue.length,
      stacked: this.stack.length,
      active: this.active,
      processing: this.processing,
      logs: swLog.ring.slice(-50)
    };
  },

  async runBatch(batch) {
    this.active += 1;
    swLog.push('info', 'Run batch', { size: batch.length, activeWorkers: this.active });
    try {
      const settled = await Promise.allSettled(batch.map(task => this.runTaskPipeline(task)));
      settled.forEach((result, index) => {
        const task = batch[index];
        if (result.status === 'fulfilled') {
          this.broadcast({ type: 'SW_TASK_DONE', payload: { id: task.id, kind: task.kind, result: result.value } });
          swLog.push('info', 'Task done', { id: task.id, kind: task.kind });
        } else {
          const retries = (task.retries || 0) + 1;
          swLog.push('warn', 'Task failed', { id: task.id, kind: task.kind, retries, error: String(result.reason) });
          if (retries < 4) {
            this.enqueue({ ...task, retries }, 'queue');
          } else {
            this.broadcast({ type: 'SW_TASK_FAILED', payload: { id: task.id, kind: task.kind, error: String(result.reason) } });
          }
        }
      });
    } finally {
      this.active -= 1;
    }
  },

  async runTaskPipeline(task) {
    const validated = await this.subprocessValidate(task);
    const prepared = await this.subprocessPrepare(validated);
    return this.subprocessExecute(prepared);
  },

  async subprocessValidate(task) {
    if (!task.kind) throw new Error('Task missing kind');
    return task;
  },

  async subprocessPrepare(task) {
    const clone = structuredClone(task);
    clone.preparedAt = new Date().toISOString();
    clone.traceId = `${task.id}:${Date.now()}`;
    return clone;
  },

  async subprocessExecute(task) {
    if (task.kind === 'fetchJSON') {
      const response = await fetch(task.url, {
        method: task.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(task.headers || {}) },
        body: task.body ? JSON.stringify(task.body) : undefined
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    if (task.kind === 'logOnly') {
      swLog.push('info', 'logOnly task', { message: task.message || '' });
      return { ok: true };
    }

    throw new Error(`Unknown task kind: ${task.kind}`);
  },

  async broadcast(message) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => client.postMessage(message));
  }
};

// ── App-specific: background task engine ─────────────────────────────────

self.addEventListener('message', event => {
  const data = event.data || {};

  if (data.type === 'QUEUE_TASK') {
    taskEngine.enqueue(data.task || {}, data.strategy || 'queue');
    taskEngine.broadcast({ type: 'SW_QUEUE_STATE', payload: taskEngine.snapshot() });
    return;
  }

  if (data.type === 'FLUSH_TASKS') {
    taskEngine.process().catch(error => swLog.push('error', 'Flush error', { error: String(error) }));
    return;
  }

  if (data.type === 'GET_SW_STATUS') {
    event.source?.postMessage({ type: 'SW_QUEUE_STATE', payload: taskEngine.snapshot() });
  }
});
