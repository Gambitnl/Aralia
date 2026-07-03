// tools/agora/server.mjs
// Agora coordination daemon — the thin HTTP layer over store.mjs.
//
// Pure Node.js ESM, zero npm dependencies (node:http / node:fs / node:path / node:url).
// Holds NO state of its own beyond the store instance + the live SSE subscriber set;
// every state change delegates to the store. Serves the live dashboard's static files.
//
// Auth: `register` is open; all other MUTATING endpoints require
// `Authorization: Bearer <token>` resolved via store.getAgentByToken(token) (401 otherwise).
// Every authenticated request also refreshes presence via store.touch(agent.id).
// GET read endpoints (/agents,/locks,/tasks,/messages,/health,/events,/) are open so the
// dashboard works token-free; /messages may take an optional token to resolve `to=me`.
//
// SSE resume: the store does not expose arbitrary event history, so on connect we send a
// single `event: hello` carrying lastSeq + a full snapshot of {agents,locks,tasks} for the
// client to re-sync, then stream live events. `?since=`/`Last-Event-ID` are accepted and
// surfaced in the hello payload (clientSince) for diagnostics, but cannot replay the gap.
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { attachActivityMirror } from './activityMirror.mjs';
import { renderDocPage } from './mdRender.mjs';
import { indexGaps } from './gapIndex.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = '0.2.0';
const DEFAULT_PORT = 4319;
// Repo root is two levels up from tools/agora/server.mjs.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.agent', 'agora');
const DASHBOARD_DIR = path.join(__dirname, 'dashboard');

const SWEEP_INTERVAL_MS = 30000;
const SSE_PING_INTERVAL_MS = 20000;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// Tiny router: register (method, pattern) -> handler. Pattern segments starting
// with ':' are params, captured into `params`.
// ---------------------------------------------------------------------------
function makeRouter() {
  const routes = [];
  function add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean);
    routes.push({ method, segments, handler });
  }
  function match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    for (const route of routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(':')) {
          params[seg.slice(1)] = decodeURIComponent(parts[i]);
        } else if (seg !== parts[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }
  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    delete: (p, h) => add('DELETE', p, h),
    match,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Factory: build the server + store WITHOUT starting the listener or hooking
// signals (so tests can boot on an ephemeral port). Call returned .listen()/.close().
// ---------------------------------------------------------------------------
export function createAgoraServer({ dir = DEFAULT_DIR, storeFactory, activityFile } = {}) {
  // Lazy import keeps the factory synchronous for the common path while still
  // allowing tests to inject a store. Default uses the real store.mjs.
  // (storeFactory is primarily a seam for tests; production uses the default.)
  if (!storeFactory) {
    // eslint-disable-next-line no-param-reassign -- intentional default
    storeFactory = defaultStoreFactory;
  }
  const store = storeFactory({ dir });
  const startedAt = Date.now();

  // Optional cockpit bridge: mirror coordination events into the operator
  // dashboard's activity feed. Off unless an activityFile is provided (tests
  // never pass one, so they stay side-effect-free); the daemon bootstrap below
  // turns it on by default. detachMirror is called on close().
  let detachMirror = null;
  if (activityFile) {
    try {
      detachMirror = attachActivityMirror({ store, file: activityFile });
    } catch {
      detachMirror = null; // bridge is best-effort; never block startup
    }
  }

  const router = makeRouter();
  // Track live SSE responses so we can end them on shutdown.
  const sseClients = new Set();
  // Bounded recent-event ring (WF-G6): lets a reconnecting SSE client replay
  // the gap (seq > its Last-Event-ID) instead of only resyncing from the
  // hello snapshot. 300 events comfortably covers reconnect windows.
  const EVENT_RING_MAX = 300;
  const eventRing = [];
  store.subscribe((ev) => {
    eventRing.push(ev);
    if (eventRing.length > EVENT_RING_MAX) eventRing.shift();
  });

  // --- auth wrapper: resolves bearer -> agent, 401 if missing/invalid, touches presence ---
  function withAuth(handler) {
    return async (req, res, ctx) => {
      const token = bearerToken(req);
      const agent = token ? store.getAgentByToken(token) : null;
      if (!agent) {
        sendJson(res, 401, { error: 'unauthorized: missing or invalid bearer token' });
        return;
      }
      store.touch(agent.id);
      ctx.agent = agent;
      return handler(req, res, ctx);
    };
  }

  // ============================== Presence ==============================
  router.post('/agents/register', async (req, res) => {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
    if (!body.handle || typeof body.handle !== 'string') {
      return sendJson(res, 400, { error: 'handle (string) is required' });
    }
    const agent = store.registerAgent({ handle: body.handle, note: body.note });
    sendJson(res, 201, { agentId: agent.id, token: agent.token, handle: agent.handle });
  });

  router.post(
    '/agents/heartbeat',
    withAuth(async (_req, res) => {
      // touch() already happened in withAuth.
      sendJson(res, 200, { ok: true });
    }),
  );

  router.get('/agents', async (_req, res) => {
    sendJson(res, 200, { agents: store.listAgents() });
  });

  // ============================== Locks ==============================
  router.post(
    '/locks',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.acquireLock({
        agentId: ctx.agent.id,
        paths: Array.isArray(body.paths) ? body.paths : [],
        globs: Array.isArray(body.globs) ? body.globs : [],
        reason: body.reason,
        ttlMs: typeof body.ttlMs === 'number' ? body.ttlMs : undefined,
      });
      if (result.ok) return sendJson(res, 201, { lock: result.lock });
      if (result.conflict) return sendJson(res, 409, { conflict: result.conflict });
      return sendJson(res, 400, { error: result.error || 'bad lock request' });
    }),
  );

  router.get('/locks', async (_req, res) => {
    sendJson(res, 200, { locks: store.listLocks() });
  });

  router.delete(
    '/locks/:id',
    withAuth(async (_req, res, ctx) => {
      // ?force=1 lets a non-holder release a STALE/GONE holder's lock (the
      // store refuses force against an online holder → 409).
      const force = ctx.query.get('force') === '1' || ctx.query.get('force') === 'true';
      const result = store.releaseLock({ lockId: ctx.params.id, agentId: ctx.agent.id, force });
      if (result.ok) return sendJson(res, 200, { ok: true });
      if (result.error === 'lock not found') return sendJson(res, 404, { error: result.error });
      if (/online/.test(result.error || '')) return sendJson(res, 409, { error: result.error });
      return sendJson(res, 403, { error: result.error || 'forbidden' });
    }),
  );

  // ============================== Tasks ==============================
  router.post(
    '/tasks',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      if (!body.title || typeof body.title !== 'string') {
        return sendJson(res, 400, { error: 'title (string) is required' });
      }
      let task;
      try {
        task = store.createTask({
          agentId: ctx.agent.id,
          title: body.title,
          body: body.body,
          category: typeof body.category === 'string' ? body.category : undefined,
          deps: Array.isArray(body.deps) ? body.deps : [],
          priority: typeof body.priority === 'number' ? body.priority : undefined,
          refs: Array.isArray(body.refs) ? body.refs : [],
        });
      } catch (e) {
        return sendJson(res, 400, { error: e.message }); // e.g. unknown dep
      }
      sendJson(res, 201, { task });
    }),
  );

  // Worker-pull: atomically claim the highest-priority ready task.
  // 200 { task } — or 200 { task: null } when nothing is ready (not an error;
  // a polling worker just idles).
  router.post(
    '/tasks/claim-next',
    withAuth(async (_req, res, ctx) => {
      const result = store.claimNextReady({ agentId: ctx.agent.id });
      if (result.ok) return sendJson(res, 200, { task: result.task || null });
      return sendJson(res, 409, { error: result.error });
    }),
  );

  router.post(
    '/tasks/:id/claim',
    withAuth(async (_req, res, ctx) => {
      const result = store.claimTask({ taskId: ctx.params.id, agentId: ctx.agent.id });
      if (result.ok) return sendJson(res, 200, { task: result.task });
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 409, { error: result.error });
    }),
  );

  router.post(
    '/tasks/:id/state',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.setTaskState({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        state: body.state,
        result: typeof body.result === 'string' ? body.result : undefined,
      });
      if (result.ok) return sendJson(res, 200, { task: result.task });
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  router.post(
    '/tasks/:id/categories',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.setTaskCategories({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        categories: body.categories,
        category: typeof body.category === 'string' ? body.category : undefined,
      });
      if (result.ok) return sendJson(res, 200, { task: result.task });
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  router.post(
    '/tasks/:id/handoff',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.handoffTask({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        toAgentId: body.toAgentId,
      });
      if (result.ok) return sendJson(res, 200, { task: result.task });
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  router.get('/tasks', async (req, res, ctx) => {
    const state = ctx.query.get('state') || undefined;
    const ready = ctx.query.get('ready') === '1' || ctx.query.get('ready') === 'true';
    const category = ctx.query.get('category') || undefined;
    sendJson(res, 200, { tasks: store.listTasks({ state, ready, category }) });
  });

  // ============================== Messaging ==============================
  router.post(
    '/messages',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      if (!body.body || typeof body.body !== 'string') {
        return sendJson(res, 400, { error: 'body (string) is required' });
      }
      const message = store.postMessage({
        agentId: ctx.agent.id,
        to: body.to || 'all',
        body: body.body,
      });
      sendJson(res, 201, { message });
    }),
  );

  router.get('/messages', async (req, res, ctx) => {
    const since = Number(ctx.query.get('since')) || 0;
    let to = ctx.query.get('to') || undefined;
    if (to === 'all') {
      to = undefined; // unfiltered
    } else if (to === 'me') {
      const token = bearerToken(req);
      const agent = token ? store.getAgentByToken(token) : null;
      to = agent ? agent.id : undefined; // no token + me => treat as 'all'
    }
    sendJson(res, 200, { messages: store.getMessages({ since, to }) });
  });

  // ============================== Reference docs ==============================
  // Whitelisted read-only serving of the coordination reference files so the
  // dashboard's docs panel can offer copy-content/copy-path without a second
  // static server. Strictly name-keyed — no path resolution from user input.
  const DOC_FILES = ['PROTOCOL.md', 'ORCHESTRATOR.md', 'WORKFLOW_GAPS.md', 'COLD_START_ORCHESTRATOR_PROMPT.md'];

  router.get('/docs', async (_req, res) => {
    sendJson(res, 200, {
      docs: DOC_FILES.map((name) => ({
        name,
        path: path.join(__dirname, name),
        relPath: `tools/agora/${name}`,
      })),
    });
  });

  router.get('/docs/:name', async (_req, res, ctx) => {
    const name = ctx.params.name;
    if (!DOC_FILES.includes(name)) {
      return sendJson(res, 404, { error: `unknown doc "${name}" (have: ${DOC_FILES.join(', ')})` });
    }
    // Default = pretty HTML for humans; ?raw=1 = the plain markdown (what the
    // dashboard copy-content button and agents consume).
    const raw = ctx.query.get('raw') === '1' || ctx.query.get('raw') === 'true';
    fs.readFile(path.join(__dirname, name), 'utf8', (err, data) => {
      if (err) return sendJson(res, 404, { error: 'doc unreadable: ' + err.message });
      if (raw) {
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
        return res.end(data);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderDocPage(name, data, { docNames: DOC_FILES }));
    });
  });

  // ============================== Gap index (tracker bridge) ==============================
  // Serves the project tracker's GAPS registries as data + a browsable card
  // view, so the dashboard can categorize tasks by owning project and link
  // each one to its tracker card. Index is cached briefly (directory walk).
  const GAPS_ROOTS = ['docs/projects', 'tools/agora'];
  let gapsCache = null; // { at, gaps }
  function getGapIndex() {
    if (gapsCache && Date.now() - gapsCache.at < 60000) return gapsCache.gaps;
    let gaps = [];
    for (const root of GAPS_ROOTS) {
      try {
        gaps = gaps.concat(indexGaps({ root }));
      } catch {
        // a missing root (e.g. gitignored docs/projects absent) is not fatal
      }
    }
    gapsCache = { at: Date.now(), gaps };
    return gaps;
  }

  router.get('/gaps', async (_req, res, ctx) => {
    let gaps = getGapIndex();
    const project = ctx.query.get('project');
    if (project) gaps = gaps.filter((g) => g.project === project);
    if (ctx.query.get('open') === '1') {
      const { OPEN_STATUSES } = await import('./gapIndex.mjs');
      gaps = gaps.filter((g) => OPEN_STATUSES.has(g.status));
    }
    sendJson(res, 200, { gaps, count: gaps.length });
  });

  router.get('/gaps/view', async (_req, res, ctx) => {
    const project = ctx.query.get('project');
    const gaps = getGapIndex().filter((g) => !project || g.project === project);
    const byProject = new Map();
    for (const g of gaps) {
      if (!byProject.has(g.project)) byProject.set(g.project, []);
      byProject.get(g.project).push(g);
    }
    // Build markdown and reuse the doc-page renderer for a consistent look.
    let md = `# Tracker gaps${project ? ` — ${project}` : ''}\n\n${gaps.length} gap(s)${project ? '' : ` across ${byProject.size} project(s)`}. Source: GAPS.md registries on disk.\n`;
    for (const [proj, rows] of [...byProject.entries()].sort()) {
      md += `\n## ${proj} (${rows.length})\n\n| Gap ID | Status | Severity | Gap | Next action |\n|---|---|---|---|---|\n`;
      for (const r of rows) {
        const clean = (s) => String(s || '').replace(/\|/g, '/');
        md += `| ${clean(r.id)} | ${clean(r.status)} | ${clean(r.severity)} | ${clean(r.gap)} | ${clean(r.nextAction)} |\n`;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDocPage(`gaps${project ? `: ${project}` : ''}`, md, { docNames: [], rawHref: null }));
  });

  // ============================== Health ==============================
  router.get('/health', async (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      port: server.address() ? server.address().port : null,
      counts: {
        agents: store.listAgents().length,
        locks: store.listLocks().length,
        tasks: store.listTasks().length,
        messages: store.getMessages({ since: 0 }).length,
      },
      lastSeq: store.lastSeq,
    });
  });

  // ============================== SSE ==============================
  router.get('/events', async (req, res, ctx) => {
    const sinceParam = ctx.query.get('since') || req.headers['last-event-id'] || null;
    const clientSince = sinceParam != null ? Number(sinceParam) : null;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Flush headers immediately so the client sees the stream open.
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    function writeEvent(seq, type, data) {
      res.write(`id: ${seq}\n`);
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Resume handshake: hello carries lastSeq + a full snapshot for re-sync…
    writeEvent(store.lastSeq, 'hello', {
      lastSeq: store.lastSeq,
      clientSince,
      version: VERSION,
      snapshot: {
        agents: store.listAgents(),
        locks: store.listLocks(),
        tasks: store.listTasks(),
      },
    });
    // …and (WF-G6) the recent-event ring replays the gap when the client's
    // since falls inside it — real event objects, not just the snapshot.
    if (clientSince != null && Number.isFinite(clientSince)) {
      for (const ev of eventRing) {
        if (ev.seq > clientSince) {
          writeEvent(ev.seq, ev.type, { ...ev.payload, type: ev.type, ts: ev.ts, seq: ev.seq, replayed: true });
        }
      }
    }

    const unsubscribe = store.subscribe((event) => {
      // event = { seq, type, payload, ts }
      writeEvent(event.seq, event.type, { ...event.payload, type: event.type, ts: event.ts, seq: event.seq });
    });

    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, SSE_PING_INTERVAL_MS);
    if (typeof ping.unref === 'function') ping.unref();

    const client = { res, unsubscribe, ping };
    sseClients.add(client);

    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
      sseClients.delete(client);
    });
  });

  // ============================== Static dashboard ==============================
  function serveStatic(res, relPath) {
    // relPath is already resolved within DASHBOARD_DIR by the caller.
    const ext = path.extname(relPath).toLowerCase();
    const type = CONTENT_TYPES[ext] || 'application/octet-stream';
    fs.readFile(relPath, (err, data) => {
      if (err) {
        // Missing dashboard file: serve a placeholder so the server still boots/tests pass.
        if (ext === '' || ext === '.html') {
          const html =
            '<!doctype html><meta charset="utf-8"><title>Agora</title>' +
            '<body style="font-family:sans-serif;padding:2rem">' +
            '<h1>Agora dashboard not yet built</h1>' +
            '<p>The daemon is running. The dashboard slice will provide index.html.</p>' +
            '</body>';
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  }

  function handleStatic(req, res, pathname) {
    // Map `/` -> index.html; `/dashboard/<x>` -> <x>. Prevent path traversal.
    let rel;
    if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/') {
      rel = 'index.html';
    } else if (pathname.startsWith('/dashboard/')) {
      rel = pathname.slice('/dashboard/'.length);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('not found');
    }
    const target = path.normalize(path.join(DASHBOARD_DIR, rel));
    if (!target.startsWith(DASHBOARD_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('forbidden');
    }
    serveStatic(res, target);
  }

  // ============================== Request dispatch ==============================
  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendJson(res, 400, { error: 'bad url' });
    }
    const pathname = url.pathname;
    const method = req.method;

    // Static / dashboard routes (GET only).
    if (method === 'GET' && (pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
      return handleStatic(req, res, pathname);
    }

    const matched = router.match(method, pathname);
    if (!matched) {
      return sendJson(res, 404, { error: `no route for ${method} ${pathname}` });
    }
    const ctx = { params: matched.params, query: url.searchParams, agent: null };
    try {
      await matched.handler(req, res, ctx);
    } catch (e) {
      if (!res.headersSent) sendJson(res, 500, { error: 'internal error: ' + e.message });
      else res.end();
    }
  });

  // Periodic expiry sweep.
  const sweep = setInterval(() => {
    try {
      store.sweepExpired();
    } catch {
      // never let a sweep error crash the daemon
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweep.unref === 'function') sweep.unref();

  function close() {
    clearInterval(sweep);
    for (const client of sseClients) {
      clearInterval(client.ping);
      try {
        client.unsubscribe();
      } catch {
        /* noop */
      }
      try {
        client.res.end();
      } catch {
        /* noop */
      }
    }
    sseClients.clear();
    if (detachMirror) {
      try {
        detachMirror();
      } catch {
        /* noop */
      }
      detachMirror = null;
    }
    return new Promise((resolve) => {
      server.close(() => {
        try {
          store.close();
        } catch {
          /* noop */
        }
        resolve();
      });
    });
  }

  function listen(port = DEFAULT_PORT, cb) {
    server.listen(port, cb);
    return server;
  }

  return { server, store, listen, close };
}

// Default store factory — uses the real store.mjs (imported at top).
function defaultStoreFactory({ dir }) {
  return createStore({ dir });
}

// ---------------------------------------------------------------------------
// CLI bootstrap — runs ONLY when this module is executed directly (not imported).
// Guards listening on 4319 + signal handlers behind the main-module check so that
// importing the module for tests does not start a server or hook process signals.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--activity-file') opts.activityFile = argv[++i];
    else if (a === '--no-activity-mirror') opts.activityFile = 'off';
    else if (a.startsWith('--port=')) opts.port = Number(a.slice('--port='.length));
    else if (a.startsWith('--dir=')) opts.dir = a.slice('--dir='.length);
    else if (a.startsWith('--activity-file=')) opts.activityFile = a.slice('--activity-file='.length);
  }
  return opts;
}

function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invoked === __filename;
}

if (isMainModule()) {
  const cli = parseArgs(process.argv.slice(2));
  const port = cli.port || Number(process.env.AGORA_PORT) || DEFAULT_PORT;
  let dir = cli.dir || process.env.AGORA_DIR || DEFAULT_DIR;
  // Resolve a relative --dir against the cwd the operator launched from.
  dir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);

  // Cockpit activity bridge: default to the operator dashboard's feed file so
  // peer-coordination events show up there. Override with --activity-file <p>
  // or AGORA_ACTIVITY_FILE; disable with --no-activity-mirror (or value 'off').
  const DEFAULT_ACTIVITY_FILE = path.resolve(
    process.cwd(),
    '.agent/orchestration/activity.jsonl',
  );
  const activityRaw = cli.activityFile || process.env.AGORA_ACTIVITY_FILE || '';
  let activityFile;
  if (activityRaw === 'off') activityFile = undefined;
  else if (activityRaw) {
    activityFile = path.isAbsolute(activityRaw)
      ? activityRaw
      : path.resolve(process.cwd(), activityRaw);
  } else activityFile = DEFAULT_ACTIVITY_FILE;

  const app = createAgoraServer({ dir, activityFile });
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `Agora listening on http://localhost:${port}  (dir: ${dir})` +
        (activityFile ? `\n  cockpit activity bridge → ${activityFile}` : ''),
    );
  });

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log('\nAgora shutting down…');
    await app.close();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
