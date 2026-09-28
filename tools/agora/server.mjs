// tools/agora/server.mjs
// Agora coordination daemon — the thin HTTP layer over store.mjs.
//
// Pure Node.js ESM, zero npm dependencies (node:http / node:fs / node:path / node:url).
// Holds NO state of its own beyond the store instance + the live SSE subscriber set;
// every state change delegates to the store. Serves the live dashboard's static files.
//
// Auth: `register` is open; all other MUTATING endpoints require
// `Authorization: Bearer <token>` resolved via store.getAgentByToken(token) (401 otherwise).
// Authenticated activity refreshes meaningful presence via store.touch(agent.id).
// Heartbeats use a separate bounded lease path and cannot extend liveness forever.
// GET read endpoints (/agents,/locks,/tasks,/messages,/health,/events,/glossary,/) are open so
// the dashboard works token-free. GET /agents/me authenticates without renewing presence so
// a client can check whether its stored identity is still live; /messages may take an optional
// token to resolve `to=me`.
//
// SSE resume: the store does not expose arbitrary event history, so on connect we send a
// single `event: hello` carrying lastSeq + a full snapshot of {agents,locks,tasks} for the
// client to re-sync, then stream live events. `?since=`/`Last-Event-ID` are accepted and
// surfaced in the hello payload (clientSince) for diagnostics, but cannot replay the gap.
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStore, TASK_DEP_TYPES, DEFAULT_TASK_DEP_TYPE } from './store.mjs';
import { attachActivityMirror } from './activityMirror.mjs';
import { installFatalErrorHandlers } from './fatalErrorLog.mjs';
import { renderDocPage } from './mdRender.mjs';
import { indexGaps, OPEN_STATUSES } from './gapIndex.mjs';
import { appendGapRow, updateGapRow, resolveGapsFile } from './gapAppend.mjs';
import { parseGlossaryFile, GLOSSARY_TAGS } from './glossaryParse.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = '0.3.0';
const DEFAULT_PORT = 4319;
// Repo root is two levels up from tools/agora/server.mjs.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.agent', 'agora');
const DASHBOARD_DIR = path.join(__dirname, 'dashboard');

// WF-G171: every new task must carry an explicit campaign decision.
//
// 50 of 51 open tasks on 2026-09-17 had an empty campaignId, because omitting
// it was free. In `required` mode `POST /tasks` refuses a task that names no
// campaign and declares no standalone reason.
//
// THE DAEMON AGENTS TALK TO IS ALWAYS `required`. The CLI bootstrap at the
// bottom of this file passes it, so the rule holds on the board that matters.
// `AGORA_CAMPAIGN_INTAKE=legacy` is the operator's documented escape hatch for
// a board that still has to absorb a campaignless batch.
//
// An IMPORTED server defaults to `legacy` instead, and that default is the
// measured escape hatch the fix was allowed to keep: 30 suites across nine
// files that predate this rule build a server with `createAgoraServer({ dir })`
// and create tasks over HTTP with a bare title, and `orchestrate.mjs` seeds a
// wave the same way. A test that means to exercise the gate asks for it with
// `createAgoraServer({ dir, campaignIntake: 'required' })`.
const CAMPAIGN_INTAKE_MODES = new Set(['required', 'legacy']);
const DEFAULT_CAMPAIGN_INTAKE = 'legacy';
function resolveCampaignIntake(raw) {
  const value = String(raw == null ? '' : raw).trim().toLowerCase();
  return CAMPAIGN_INTAKE_MODES.has(value) ? value : DEFAULT_CAMPAIGN_INTAKE;
}

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
    patch: (p, h) => add('PATCH', p, h), // WF-G130
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
export function createAgoraServer({ dir = DEFAULT_DIR, storeFactory, activityFile, syncDelayMs, syncRunner, seatRosterPath, gapsRepoRoot = REPO_ROOT, campaignIntake = process.env.AGORA_CAMPAIGN_INTAKE } = {}) {
  const campaignIntakeMode = resolveCampaignIntake(campaignIntake);
  // Lazy import keeps the factory synchronous for the common path while still
  // allowing tests to inject a store. Default uses the real store.mjs.
  // (storeFactory is primarily a seam for tests; production uses the default.)
  if (!storeFactory) {
    // eslint-disable-next-line no-param-reassign -- intentional default
    storeFactory = defaultStoreFactory;
  }
  const store = storeFactory({ dir, seatRosterPath });
  const startedAt = Date.now();
  // WF-G147 (2026-09-09): event-loop lag sampler. A 500 ms timer measures how
  // late it fires; the worst value of the last minute is what a stalled
  // probe should be compared against. Under the 4-worker load the monitor
  // reported DAEMON_DOWN once while the process was alive, and nothing could
  // say whether the daemon or the machine had paused.
  const loop = { lagMs: 0, maxLagMs: 0, samples: [] };
  let lagExpected = Date.now() + 500;
  const lagTimer = setInterval(() => {
    const now = Date.now();
    const lag = Math.max(0, now - lagExpected);
    lagExpected = now + 500;
    loop.lagMs = lag;
    loop.samples.push({ at: now, lag });
    while (loop.samples.length && loop.samples[0].at < now - 60000) loop.samples.shift();
    loop.maxLagMs = loop.samples.reduce((m, x) => Math.max(m, x.lag), 0);
  }, 500);
  if (lagTimer.unref) lagTimer.unref();

  // Freshness trigger (planning-surface-freshness Task 7): any successful task
  // mutation schedules ONE sync-surfaces run; new events inside the window ride
  // the same timer, so bursts coalesce. The timer is unref'd and the child is
  // detached — a broken sync must never take the daemon with it.
  let syncTimer = null;
  const runSync = syncRunner ?? (() => {
    try {
      const child = spawn(process.execPath, [path.join(__dirname, 'sync-surfaces.mjs')], {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
    } catch {
      // sync failing to SPAWN is invisible here by design; the planmap page's
      // last-sync banner is the loud surface for a sync that stops running.
    }
  });
  const scheduleSyncSoon = () => {
    if (syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      runSync();
    }, syncDelayMs ?? 60000);
    if (syncTimer.unref) syncTimer.unref();
  };

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

  // --- auth wrapper: resolves bearer -> agent, 401 if missing/invalid, and
  // records meaningful activity unless the caller is the heartbeat route. ---
  function withAuth(handler, { touchPresence = true } = {}) {
    return async (req, res, ctx) => {
      const token = bearerToken(req);
      const agent = token ? store.getAgentByToken(token) : null;
      if (!agent) {
        sendJson(res, 401, { error: 'unauthorized: missing or invalid bearer token' });
        return;
      }
      if (touchPresence) store.touch(agent.id);
      ctx.agent = agent;
      return handler(req, res, ctx);
    };
  }

  // ============================== Presence ==============================
  // Pet discovery is open because registration itself is open and now refuses
  // any identity that does not name one of these catalog entries.
  router.get('/pets', async (_req, res) => {
    sendJson(res, 200, { pets: store.listPetIdentities() });
  });

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
    if (!body.petSlug || typeof body.petSlug !== 'string') {
      return sendJson(res, 400, { error: 'petSlug (string) is required before claiming presence' });
    }
    // Handle-claim uniqueness: refuse a name a still-live agent already holds, so
    // two agents can't silently share an identity (opt out with unique:false for
    // legacy flows that intentionally re-register). A reaped/dropped name is free
    // to reclaim.
    if (body.unique !== false) {
      const holder = store.findLiveAgentByHandle(body.handle);
      if (holder) {
        return sendJson(res, 409, {
          error: `handle "${body.handle}" is already claimed by a live agent — pick another`,
          conflict: { handle: body.handle, heldBy: holder.id, status: holder.status },
        });
      }
    }
    // Accept the agent's own conversation/thread id under any of the common names.
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId
      : typeof body.threadId === 'string' ? body.threadId
      : typeof body.conversationId === 'string' ? body.conversationId
      : undefined;
    let agent;
    try {
      agent = store.registerAgent({
        handle: body.handle, note: body.note, model: body.model, reasoningEffort: body.reasoningEffort, sessionId, role: body.role,
        type: body.type, spawnedBy: body.spawnedBy, campaign: body.campaign, cwd: body.cwd,
        petSlug: body.petSlug,
        // D-AB: the seat is taken at sign-in, so it travels with registration.
        seat: body.seat,
      });
    } catch (error) {
      if (error && error.code === 'AGORA_PET_CATALOG_EXHAUSTED') {
        return sendJson(res, 409, { error: error.message, code: error.code });
      }
      if (error && (
        error.code === 'AGORA_PET_REQUIRED'
        || error.code === 'AGORA_PET_INVALID'
        || error.code === 'AGORA_THREAD_ID_REQUIRED'
      )) {
        return sendJson(res, 400, { error: error.message });
      }
      throw error;
    }
    sendJson(res, 201, {
      agentId: agent.id,
      token: agent.token,
      handle: agent.handle,
      registeredAt: agent.registeredAt,
      model: agent.model,
      reasoningEffort: agent.reasoningEffort,
      sessionId: agent.sessionId,
      role: agent.role,
      type: agent.type,
      spawnedBy: agent.spawnedBy,
      campaign: agent.campaign,
      cwd: agent.cwd,
      handleValid: agent.handleValid,
      pet: agent.pet,
      requestedPetSlug: agent.requestedPetSlug,
      petSubstituted: agent.petSubstituted,
      // D-AB: which durable identity this session took, or why it did not.
      // A silent miss would leave every campaign this session claims without
      // a durable owner, and nothing would say so.
      seatId: agent.seatId || '',
      seatError: agent.seatError || '',
    });
  });

  router.post(
    '/agents/heartbeat',
    withAuth(async (_req, res, ctx) => {
      const result = store.heartbeatAgent(ctx.agent.id);
      if (!result.ok) {
        const status = result.code === 'heartbeat_lease_expired' ? 410 : 404;
        return sendJson(res, status, result);
      }
      sendJson(res, 200, result);
    }, { touchPresence: false }),
  );

  // Report the identity currently authenticated by this bearer without calling
  // store.touch(). This no-touch path lets `whoami --live` diagnose a stale saved
  // identity without turning the diagnostic itself into a liveness renewal.
  router.get(
    '/agents/me',
    withAuth(async (_req, res, ctx) => {
      // The store lookup necessarily sees the secret used for authentication.
      // Return only the public identity fields so the bearer never reaches logs.
      const { token: _token, ...publicAgent } = ctx.agent;
      sendJson(res, 200, { agent: publicAgent });
    }, { touchPresence: false }),
  );

  router.get('/agents', async (_req, res) => {
    sendJson(res, 200, { agents: store.listAgents() });
  });

  router.post(
    '/agents/:id/retire-stale',
    withAuth(async (_req, res, ctx) => {
      const result = store.retireStaleIdleAgent({ requesterId: ctx.agent.id, targetAgentId: ctx.params.id });
      if (result.ok) return sendJson(res, 200, result);
      if (result.error === 'agent not found') return sendJson(res, 404, { error: result.error });
      if (/online|holds|in-flight/.test(result.error || '')) return sendJson(res, 409, { error: result.error });
      return sendJson(res, 403, { error: result.error || 'forbidden' });
    }),
  );

  // Clean voluntary exit. The agent retires itself with its own token; the store
  // frees its locks, reopens its in-flight tasks (marked "retired", not "reaped"),
  // and drops it from the roster. Body is optional; `note` is a final handoff line.
  router.post(
    '/agents/retire',
    withAuth(async (req, res, ctx) => {
      let note;
      try {
        const body = await readJsonBody(req);
        note = typeof body.note === 'string' ? body.note : undefined;
      } catch {
        note = undefined;
      }
      const result = store.retireAgent(ctx.agent.id, { note });
      if (!result.ok) return sendJson(res, 404, { error: result.error });
      sendJson(res, 200, { ok: true, agentId: ctx.agent.id });
    }),
  );

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
      // WF-G91: warnings name held paths that look like the same file under
      // another root prefix; the lock is still granted.
      if (result.ok) return sendJson(res, 201, { lock: result.lock, warnings: result.warnings || [] });
      if (result.conflict) return sendJson(res, 409, { conflict: result.conflict });
      return sendJson(res, 400, { error: result.error || 'bad lock request' });
    }),
  );

  router.get('/locks', async (_req, res) => {
    sendJson(res, 200, { locks: store.listLocks() });
  });

  // WF-G122: release SOME tokens of a lock; the record keeps its id and expiry.
  router.post(
    '/locks/:id/shrink',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
      const result = store.shrinkLock({
        lockId: ctx.params.id,
        agentId: ctx.agent.id,
        paths: Array.isArray(body.paths) ? body.paths : [],
        globs: Array.isArray(body.globs) ? body.globs : [],
      });
      if (result.ok) return sendJson(res, 200, { lock: result.lock, released: result.released });
      if (result.error === 'lock not found') return sendJson(res, 404, { error: result.error });
      if (/holder/.test(result.error || '')) return sendJson(res, 403, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  router.post(
    '/locks/:id/renew',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
      const result = store.renewLock({
        lockId: ctx.params.id,
        agentId: ctx.agent.id,
        ttlMs: typeof body.ttlMs === 'number' ? body.ttlMs : undefined,
      });
      if (result.ok) return sendJson(res, 200, { lock: result.lock });
      if (result.error === 'lock not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 403, { error: result.error || 'forbidden' });
    }),
  );

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

  // ============================== Reservations ==============================
  // Reservations are the waiting room for files that are locked or about to be
  // contested. They do not grant edit rights; they only preserve FIFO order until
  // the first reserver can acquire the real advisory lock.
  router.post(
    '/reservations',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.reserveFiles({
        agentId: ctx.agent.id,
        paths: Array.isArray(body.paths) ? body.paths : [],
        globs: Array.isArray(body.globs) ? body.globs : [],
        reason: body.reason,
      });
      if (result.ok) return sendJson(res, 201, { reservation: result.reservation });
      return sendJson(res, 400, { error: result.error || 'bad reservation request' });
    }),
  );

  router.get('/reservations', async (_req, res) => {
    sendJson(res, 200, { reservations: store.listReservations() });
  });

  router.delete(
    '/reservations/:id',
    withAuth(async (_req, res, ctx) => {
      const force = ctx.query.get('force') === '1' || ctx.query.get('force') === 'true';
      const result = store.releaseReservation({ agentId: ctx.agent.id, target: ctx.params.id, force });
      if (result.ok) return sendJson(res, 200, { ok: true });
      if (result.error === 'reservation not found') return sendJson(res, 404, { error: result.error });
      if (/online/.test(result.error || '')) return sendJson(res, 409, { error: result.error });
      return sendJson(res, 403, { error: result.error || 'forbidden' });
    }),
  );

  // ============================== Campaign Governance ==============================
  // Campaign records let several orchestrators announce their supervisory domains
  // before they seed waves. They are advisory like locks, but lead overlap is a
  // hard pre-seed failure so two orchestrators do not unknowingly own the same files.
  router.post(
    '/campaigns',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.claimCampaign({
        agentId: ctx.agent.id,
        campaignId: body.id || body.campaignId,
        role: body.role,
        leadCampaignId: body.leadCampaignId,
        scope: body.scope,
        paths: Array.isArray(body.paths) ? body.paths : [],
        globs: Array.isArray(body.globs) ? body.globs : [],
        wave: body.wave,
        // WF-G207: the Plan Map topic or feature this effort serves. It is what
        // rank 1 of the membership mapping compares against, so the board and
        // the Plan Map hold the relationship ONCE and cannot disagree.
        planmapRef: body.planmapRef || body.planmap,
      });
      if (result.ok) return sendJson(res, 201, { campaign: result.campaign, warnings: result.warnings || [] });
      if (result.conflict) return sendJson(res, 409, { error: result.error, conflict: result.conflict });
      return sendJson(res, 400, { error: result.error || 'bad campaign request' });
    }),
  );

  router.get('/campaigns', async (_req, res, ctx) => {
    const state = ctx.query.get('state') || undefined;
    // ownerAlive mirrors the store's ownerLive under the board-tidying name so
    // dashboards can flag campaigns whose lead has left the roster.
    const campaigns = store.listCampaigns({ state }).map((c) => ({
      ...c,
      ownerAlive: Boolean(c.ownerLive),
    }));
    sendJson(res, 200, { campaigns });
  });

  router.post(
    '/campaigns/:id/state',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.setCampaignState({
        campaignId: ctx.params.id,
        agentId: ctx.agent.id,
        state: body.state,
        reason: typeof body.reason === 'string' ? body.reason : undefined, // WF-G86 / WF-G83
      });
      if (result.ok) return sendJson(res, 200, { campaign: result.campaign });
      if (result.error === 'campaign not found') return sendJson(res, 404, { error: result.error });
      if (/owner/.test(result.error || '')) return sendJson(res, 403, { error: result.error });
      return sendJson(res, 400, { error: result.error || 'bad campaign state request' });
    }),
  );

  // ======================= Charters, read model, and triage =======================
  // Design §6, §7, §10, §72. The rules live in campaign-model.mjs; these routes
  // only carry a request to the store and map its refusal to a status code.
  function charterStatus(result) {
    if (result.error === 'campaign not found' || /task not found/.test(result.error || '')) return 404;
    if (/only |needs approval from|may not approve|needs recorded human approval|command channel/.test(result.error || '')) return 403;
    if (/already|still live|adoptable/.test(result.error || '')) return 409;
    return 400;
  }

  async function readBodyOrEmpty(req) {
    try {
      return await readJsonBody(req);
    } catch {
      return {};
    }
  }

  // One read: the campaign, its charter and live validity, tasks with computed
  // start, completion and agent trail, and progress. Token-free, like /campaigns.
  router.get('/campaigns/:id', async (_req, res, ctx) => {
    const view = store.campaignView(ctx.params.id);
    if (!view.ok) return sendJson(res, 404, { error: view.error });
    sendJson(res, 200, view);
  });

  router.post(
    '/campaigns/:id/charter',
    withAuth(async (req, res, ctx) => {
      const body = await readBodyOrEmpty(req);
      const result = store.putCharter({
        campaignId: ctx.params.id,
        agentId: ctx.agent.id,
        body: body.charter,
        summary: body.summary,
      });
      if (!result.ok) return sendJson(res, charterStatus(result), result);
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/campaigns/:id/charter/approve',
    withAuth(async (req, res, ctx) => {
      const body = await readBodyOrEmpty(req);
      const result = store.approveCharter({ campaignId: ctx.params.id, agentId: ctx.agent.id, note: body.note });
      if (!result.ok) return sendJson(res, charterStatus(result), result);
      sendJson(res, 200, result);
    }),
  );

  // §10 step 2: the report is a GET and it cannot change a record — the store
  // function behind it never emits. The read-only server on 4321 serves the same
  // report from a snapshot, for when this daemon is the thing that is broken.
  router.get('/campaigns/:id/triage', async (_req, res, ctx) => {
    const report = store.triageReport(ctx.params.id);
    if (!report.ok) return sendJson(res, 404, { error: report.error });
    sendJson(res, 200, report);
  });

  // `start` and `finish` are registered before `:taskId`, because the router
  // takes the first pattern that matches and all three have the same length.
  router.post(
    '/campaigns/:id/triage/start',
    withAuth(async (req, res, ctx) => {
      const body = await readBodyOrEmpty(req);
      const result = store.startTriage({ campaignId: ctx.params.id, agentId: ctx.agent.id, reason: body.reason });
      if (!result.ok) return sendJson(res, charterStatus(result), result);
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/campaigns/:id/triage/finish',
    withAuth(async (req, res, ctx) => {
      const body = await readBodyOrEmpty(req);
      const result = store.finishTriage({ campaignId: ctx.params.id, agentId: ctx.agent.id, reason: body.reason });
      if (!result.ok) return sendJson(res, charterStatus(result), result);
      scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/campaigns/:id/triage/:taskId',
    withAuth(async (req, res, ctx) => {
      const body = await readBodyOrEmpty(req);
      const result = store.applyDisposition({
        campaignId: ctx.params.id,
        taskId: ctx.params.taskId,
        agentId: ctx.agent.id,
        disposition: body.disposition,
        reason: body.reason,
        toAgentId: body.toAgentId,
        blocker: body.blocker,
        supersededBy: body.supersededBy,
        approvalQuote: body.approvalQuote,
        evidence: body.evidence,
      });
      if (!result.ok) return sendJson(res, charterStatus(result), result);
      scheduleSyncSoon();
      sendJson(res, 200, result);
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
      // WF-G171: the campaign decision is made HERE or not at all. A task that
      // reaches the board without one cannot be repaired by guesswork later.
      const askedCampaign = typeof body.campaignId === 'string' ? body.campaignId.trim() : '';
      const wantsStandalone = body.standalone === true || /^(none|standalone)$/i.test(askedCampaign);
      const standaloneReason = typeof body.standaloneReason === 'string' ? body.standaloneReason.trim() : '';
      if (campaignIntakeMode === 'required') {
        if (wantsStandalone && !standaloneReason) {
          return sendJson(res, 400, {
            error: 'a standalone task needs "standaloneReason": say why this work belongs to no campaign (WF-G171)',
            campaignIntake: campaignIntakeMode,
          });
        }
        if (!wantsStandalone && !askedCampaign && !store.defaultCampaignFor(ctx.agent.id)) {
          return sendJson(res, 400, {
            error: 'a new task needs an explicit campaign decision: send "campaignId": "<id>", or "standalone": true with "standaloneReason": "<why>" (WF-G171). GET /campaigns lists the open efforts.',
            campaignIntake: campaignIntakeMode,
          });
        }
        // WF-G293: a title plus campaign decision is not a work packet. Do
        // not send a worker to reconstruct the ask from a title alone.
        const hasBody = typeof body.body === 'string' && body.body.trim().length > 0;
        const hasRefs = Array.isArray(body.refs)
          && body.refs.some((ref) => typeof ref === 'string' && ref.trim().length > 0);
        if (!hasBody && !hasRefs) {
          return sendJson(res, 400, {
            error: 'a new task needs a non-empty body or one or more refs; title-only work is not dispatchable (WF-G293)',
          });
        }
      }
      let task;
      try {
        task = store.createTask({
          agentId: ctx.agent.id,
          title: body.title,
          body: body.body,
          category: typeof body.category === 'string' ? body.category : undefined,
          campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
          // `campaignId: "none"` already reads as standalone inside the store,
          // so only the explicit boolean is forwarded; forwarding both would
          // make the store demand a reason for a legacy `"none"` caller.
          standalone: body.standalone === true,
          standaloneReason: standaloneReason || undefined,
          wave: typeof body.wave === 'string' ? body.wave : undefined,
          deps: Array.isArray(body.deps) ? body.deps : [],
          priority: typeof body.priority === 'number' ? body.priority : undefined,
          refs: Array.isArray(body.refs) ? body.refs : [],
          deliverable: body.deliverable,
        });
      } catch (e) {
        // Unknown dep id, unknown campaign, or an unknown dependency TYPE. The
        // last one is a refusal on purpose: a typo must not quietly become the
        // default edge.
        return sendJson(res, 400, { error: e.message });
      }
      scheduleSyncSoon();
      sendJson(res, 201, { task });
    }),
  );

  // The dependency vocabulary, served rather than only documented. A client
  // that can read the list can validate before it posts, instead of learning
  // the ten names from a 400.
  router.get('/tasks/dep-types', async (req, res) => {
    sendJson(res, 200, {
      depTypes: Object.entries(TASK_DEP_TYPES).map(([type, spec]) => ({
        type,
        blocking: spec.blocking,
        summary: spec.summary,
      })),
      defaultType: DEFAULT_TASK_DEP_TYPE,
    });
  });

  // WF-G128 (2026-09-09): read ONE task by id. Until now a caller had to list
  // the whole board and guess the task's `?state=` to find it (the liveness
  // scenario test had to GET /tasks?state=open and .find()). Registered AFTER
  // `/tasks/dep-types`, which this router would otherwise capture as an id.
  router.get('/tasks/:id', async (req, res, ctx) => {
    const wanted = String(ctx.params.id || '').trim().toLowerCase();
    if (!wanted || wanted === 'dep-types') return sendJson(res, 404, { error: 'task not found' });
    const task = store.listTasks({}).find((t) => String(t.id).toLowerCase() === wanted);
    if (!task) return sendJson(res, 404, { error: `task not found: ${ctx.params.id}` });
    return sendJson(res, 200, { task });
  });

  // D-K/D-O/r9q1: work out which effort each job belongs to, place what is
  // certain, list every tie, and never write a guess as a fact. ?dry=1 shows
  // the verdict for every job without writing one.
  router.post(
    '/tasks/membership/infer',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try { body = await readJsonBody(req); } catch { body = {}; }
      const result = store.inferTaskMembership({
        agentId: ctx.agent.id,
        note: typeof body.note === 'string' ? body.note : undefined,
        dryRun: ctx.query.get('dry') === '1' || body.dryRun === true,
      });
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      if (!result.dryRun) scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  // D-S: give every task a hierarchical id. Pass ?dry=1 to see exactly what
  // would change without changing it — this renames the whole board, so the
  // preview is not a nicety.
  router.post(
    '/tasks/ids/migrate',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const result = store.migrateIds({
        agentId: ctx.agent.id,
        note: typeof body.note === 'string' ? body.note : undefined,
        dryRun: ctx.query.get('dry') === '1' || body.dryRun === true,
      });
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      if (!result.dryRun) scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  // D-T: give every untyped dep its type, in ONE journal event that edits no
  // past event. Idempotent — a second call finds nothing and writes nothing.
  router.post(
    '/tasks/deps/migrate',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const result = store.migrateTaskDeps({
        agentId: ctx.agent.id,
        note: typeof body.note === 'string' ? body.note : undefined,
        // Same gate as /tasks/ids/migrate. It was missing here, so `--dry`
        // reached a store that had no dry branch and wrote anyway. WF-G105.
        dryRun: ctx.query.get('dry') === '1' || body.dryRun === true,
      });
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      if (!result.dryRun) scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  // ===========================================================================
  // Seats — durable identity for campaign ownership (phase 3)
  // ===========================================================================
  router.get('/seats', (req, res) => {
    sendJson(res, 200, { seats: store.listSeats() });
  });

  router.post(
    '/seats',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const result = store.createSeat({
        agentId: ctx.agent.id,
        name: typeof body.name === 'string' ? body.name : '',
        note: typeof body.note === 'string' ? body.note : undefined,
      });
      // A refused NAME is the caller's mistake; a refused ROLE is permission.
      if (!result.ok) return sendJson(res, /needs one of/.test(result.error) ? 403 : 400, { error: result.error });
      scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/seats/release',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const seatId = (typeof body.seat === 'string' && body.seat) ? body.seat : (ctx.agent.seatId || '');
      if (!seatId) {
        return sendJson(res, 400, {
          error: 'you are not sitting in a seat. Sign in with --seat <name>, or name one: seat release <name>',
        });
      }
      const result = store.releaseSeat({
        seatId: store.resolveSeatId(seatId) /* WF-G140 */,
        agentId: ctx.agent.id,
        why: typeof body.why === 'string' ? body.why : undefined,
      });
      if (!result.ok) return sendJson(res, 400, { error: result.error });
      scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/seats/rename',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const seatId = String(body.seat || '');
      const result = store.renameSeat({
        seatId: store.resolveSeatId(seatId) /* WF-G140 */,
        agentId: ctx.agent.id,
        name: typeof body.name === 'string' ? body.name : '',
        why: typeof body.why === 'string' ? body.why : undefined,
      });
      if (!result.ok) return sendJson(res, /needs one of/.test(result.error) ? 403 : 400, { error: result.error });
      scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  router.post(
    '/seats/diary',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const seatId = typeof body.seat === 'string' && body.seat ? body.seat : (ctx.agent.seatId || '');
      if (!seatId) {
        return sendJson(res, 400, {
          error: 'you are not sitting in a seat, so there is no diary to write to. '
            + 'Sign in with --seat <name>, or name one: seat diary <text> --seat <name>',
        });
      }
      const result = store.seatDiary({
        seatId: store.resolveSeatId(seatId) /* WF-G140 */,
        agentId: ctx.agent.id,
        text: typeof body.text === 'string' ? body.text : '',
      });
      if (!result.ok) return sendJson(res, 400, { error: result.error });
      sendJson(res, 200, result);
    }),
  );

  // D-AC: close campaigns that hold no work and that nobody is on.
  // Control-plane only, because `setCampaignState` allows only the OWNER to
  // close a campaign and every owner is a session that has ended — which made
  // this cleanup impossible to perform by any other path.
  router.post(
    '/campaigns/sweep',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      // The PREVIEW is the default. A caller has to say `?apply=1` to write,
      // so the printed list always comes before anything closes (D-AC).
      const apply = ctx.query.get('apply') === '1' || body.apply === true;
      const result = store.sweepEmptyCampaigns({
        agentId: ctx.agent.id,
        minAgeDays: Number.isFinite(Number(body.minAgeDays)) ? Number(body.minAgeDays) : undefined,
        dryRun: !apply,
        note: typeof body.note === 'string' ? body.note : undefined,
      });
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      if (!result.dryRun) scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  // WF-G104: repoint every dependency at the id its target carries now.
  router.post(
    '/tasks/deps/canonicalize',
    withAuth(async (req, res, ctx) => {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
      const result = store.migrateDepIds({
        agentId: ctx.agent.id,
        note: typeof body.note === 'string' ? body.note : undefined,
        dryRun: ctx.query.get('dry') === '1' || body.dryRun === true,
      });
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      if (!result.dryRun) scheduleSyncSoon();
      sendJson(res, 200, result);
    }),
  );

  // Worker-pull: atomically claim the highest-priority ready task.
  // 200 { task } — or 200 { task: null } when nothing is ready (not an error;
  // a polling worker just idles).
  router.post(
    '/tasks/claim-next',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      // The body is canonical for CLI callers. Query parameters are also
      // accepted so lightweight harnesses can opt into a lane without adding
      // a request body. Omitting both preserves the global worker-pull queue.
      const campaignId = typeof body.campaignId === 'string'
        ? body.campaignId
        : (ctx.query.get('campaignId') || ctx.query.get('campaign') || undefined);
      const category = typeof body.category === 'string'
        ? body.category
        : (ctx.query.get('category') || undefined);
      const result = store.claimNextReady({ agentId: ctx.agent.id, campaignId, category });
      if (result.ok) {
        if (result.task) scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task || null });
      }
      // WF-G127: an unknown lane is a caller error (400), like GET /tasks?campaign=.
      if (/^unknown campaign/.test(result.error || '')) return sendJson(res, 400, { error: result.error });
      return sendJson(res, 409, { error: result.error });
    }),
  );

  router.post(
    '/tasks/:id/claim',
    withAuth(async (_req, res, ctx) => {
      // WF-G55: an open task with unresolved deps is gated. `?force=1` is the
      // orchestrator-only bypass the task creator may use for hand-assignment.
      const force = ctx.query.get('force') === '1';
      const result = store.claimTask({ taskId: ctx.params.id, agentId: ctx.agent.id, force });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 409, { error: result.error });
    }),
  );

  // A worker leaves a resumable checkpoint on the task it is working — a short
  // "here is what I did and what I was about to do next" note. If that worker
  // later goes silent and gets reaped, this note is folded into the retrace
  // dossier so whoever inherits the task is not starting blind. Latest note
  // wins; the store overwrites any earlier checkpoint.
  router.post(
    '/tasks/:id/checkpoint',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.checkpointTask({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        did: typeof body.did === 'string' ? body.did : undefined,
        next: typeof body.next === 'string' ? body.next : undefined,
        files: body.files,
      });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { checkpoint: result.checkpoint });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      // Authentication alone does not grant checkpoint authority. A different
      // live agent gets 403; an owned task in open/blocked/done state gets 409
      // because its lifecycle conflicts with a live-work checkpoint.
      if (result.code === 'not_task_claimant') return sendJson(res, 403, { error: result.error });
      if (result.code === 'task_not_active') return sendJson(res, 409, { error: result.error });
      return sendJson(res, 400, { error: result.error });
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
        // Result disposition is orthogonal to the five task states. Pass the
        // authored review fields through unchanged; the store owns validation
        // and journal persistence so HTTP and in-process callers behave alike.
        resultDisposition: body.resultDisposition,
        finding: body.finding,
        evidence: body.evidence,
        reason: typeof body.reason === 'string' ? body.reason : undefined, // WF-G86
      });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  // WF-G130: edit a task's authored fields in place (creator or claimant).
  router.patch(
    '/tasks/:id',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const fields = {};
      for (const key of ['title', 'body', 'appendBody', 'priority', 'refs', 'deliverable', 'design', 'wave']) {
        if (body[key] !== undefined) fields[key] = body[key];
      }
      const result = store.editTask({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        fields,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
      });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task, changed: result.changed });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      if (/only the creator/.test(result.error)) return sendJson(res, 403, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  // WF-G153: support POST /tasks/:id/edit as an alias to PATCH /tasks/:id
  router.post(
    '/tasks/:id/edit',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const fields = {};
      for (const key of ['title', 'body', 'appendBody', 'priority', 'refs', 'deliverable', 'design', 'wave']) {
        if (body[key] !== undefined) fields[key] = body[key];
      }
      const result = store.editTask({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        fields,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
      });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task, changed: result.changed });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      if (/only the creator/.test(result.error)) return sendJson(res, 403, { error: result.error });
      return sendJson(res, 400, { error: result.error });
    }),
  );

  // WF-G169: move one task to another campaign, or make it standalone. The
  // campaign is not an authored field, so PATCH /tasks/:id refuses it; this is
  // the guarded path that records prior campaign, new campaign, actor and
  // reason in the task's own history.
  router.post(
    '/tasks/:id/campaign',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const result = store.setTaskCampaign({
        taskId: ctx.params.id,
        agentId: ctx.agent.id,
        campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
        standalone: body.standalone === true || body.campaignId === null,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
      });
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, result);
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      if (/^unknown campaign/.test(result.error)) return sendJson(res, 404, { error: result.error });
      if (/needs one of/.test(result.error)) return sendJson(res, 403, { error: result.error });
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
      if (result.ok) {
        scheduleSyncSoon();
        return sendJson(res, 200, { task: result.task });
      }
      if (result.error === 'task not found') return sendJson(res, 404, { error: result.error });
      // Handoff liveness (planning-surface-freshness Task 6): a dead or
      // never-registered target is a semantic refusal, not a malformed request.
      if (result.error === 'target agent is not registered or live') {
        return sendJson(res, 422, { error: result.error });
      }
      return sendJson(res, 400, { error: result.error });
    }),
  );

  router.get('/tasks', async (req, res, ctx) => {
    const state = ctx.query.get('state') || undefined;
    const ready = ctx.query.get('ready') === '1' || ctx.query.get('ready') === 'true';
    const category = ctx.query.get('category') || undefined;
    // WF-G88: accept the same `campaignId` lane filter that claim-next takes.
    // An unknown id is a 400, never a silent full-board response: the old
    // behavior ignored the parameter, so a typo returned every task and looked
    // like a successful filter.
    const campaignId = ctx.query.get('campaignId') || ctx.query.get('campaign') || undefined;
    try {
      sendJson(res, 200, { tasks: store.listTasks({ state, ready, category, campaignId }) });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
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
      const result = store.postMessage({
        agentId: ctx.agent.id,
        to: body.to || 'all',
        body: body.body,
        channel: body.channel,
      });
      // The command channel refuses worker posts (role-gated control plane).
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      sendJson(res, 201, { message: result.message });
    }),
  );

  router.get('/messages', async (req, res, ctx) => {
    const since = Number(ctx.query.get('since')) || 0;
    const channel = ctx.query.get('channel') || undefined; // main (default) | command | all
    let to = ctx.query.get('to') || undefined;
    if (to === 'all') {
      to = undefined; // unfiltered
    } else if (to === 'me') {
      const token = bearerToken(req);
      const agent = token ? store.getAgentByToken(token) : null;
      to = agent ? agent.id : undefined; // no token + me => treat as 'all'
    }
    sendJson(res, 200, { messages: store.getMessages({ since, to, channel }) });
  });

  // ============================== Reference docs ==============================
  // Whitelisted read-only serving of the coordination reference files so the
  // dashboard's docs panel can offer copy-content/copy-path without a second
  // static server. Strictly name-keyed — no path resolution from user input.
  const DOC_FILES = [
    'PROTOCOL.md',
    'ORCHESTRATOR.md',
    'CO-ORCHESTRATION.md',
    'VEGA.md',
    'WORKFLOW_GAPS.md',
    'COLD_START_ORCHESTRATOR_PROMPT.md',
  ];

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
        gaps = gaps.concat(indexGaps({ root: path.join(gapsRepoRoot, root) }));
      } catch {
        // a missing root (e.g. gitignored docs/projects absent) is not fatal
      }
    }
    gapsCache = { at: Date.now(), gaps };
    return gaps;
  }

  // WF-G205 / WF-G184: the accepted Suggested agent values for ONE registry.
  // A registry declares `suggested_agent_values` in its YAML header when the
  // column is closed; only such a registry is validated. The list itself is
  // tools/agora/agents.json plus `human-operator`, exactly the list
  // validateWorkflowGapRows checks the file against afterwards.
  function validateSuggestedAgentForRegistry(file, value, repoRoot) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      return null; // a missing registry is reported by the append itself
    }
    if (!/^suggested_agent_values:/m.test(raw.slice(0, 4000))) return null;
    let keys;
    try {
      const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools', 'agora', 'agents.json'), 'utf8'));
      keys = [...Object.keys(registry.agents || {}), 'human-operator'].sort();
    } catch {
      return null; // no registry to check against — do not block the append
    }
    const wanted = String(value || '').trim();
    if (!wanted) {
      return `suggestedAgent is required for this registry — it is routing data. One of: ${keys.join(', ')}`;
    }
    if (!keys.includes(wanted)) {
      return `suggestedAgent "${wanted}" is not a tools/agora/agents.json key. One of: ${keys.join(', ')}`;
    }
    return null;
  }

  // ============================== Gap intake (WF-G113) ==============================
  // One-row appends to a GAPS.md registry were the hottest lock on the board:
  // every worker owed one, ids raced, and 3-hour locks held for a single row
  // blocked six workers who then filed by hand. The daemon owns the write now.
  //
  // Serialization is THIS promise chain, not an Agora file lock — the whole
  // point is that a worker should not need a lock for a one-row append. Every
  // POST /gaps is queued behind the previous one, so two concurrent callers
  // read the registry at different moments and allocate different ids.
  let gapWriteChain = Promise.resolve();
  function serializeGapWrite(fn) {
    const next = gapWriteChain.then(fn, fn);
    // Keep the chain alive after a rejection; each caller sees its own error.
    gapWriteChain = next.then(() => {}, () => {});
    return next;
  }

  router.post(
    '/gaps',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      if (!body.gap || typeof body.gap !== 'string' || !body.gap.trim()) {
        return sendJson(res, 400, { error: 'gap (string) is required — say what is missing or wrong' });
      }
      let file;
      try {
        file = resolveGapsFile(body.project, gapsRepoRoot);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      // WF-G205 / WF-G184: a registry that DECLARES suggested_agent_values in
      // its header (the workflow registry does) has its own validator reject an
      // em dash in that column afterwards. Reject it here instead, so the row
      // is never written and the test suite never goes red over a row the
      // daemon itself created. Registries that declare nothing are untouched.
      const agentError = validateSuggestedAgentForRegistry(file, body.suggestedAgent, gapsRepoRoot);
      if (agentError) return sendJson(res, 400, { error: agentError });
      // Provenance is taken from the authenticated agent, never from the body:
      // the registries require the exact Agora handle, UUID and task/thread of
      // whoever filed the row, and a caller cannot forge those here.
      const values = {
        gap: body.gap,
        evidence: body.evidence || '',
        whyItMatters: body.why || body.whyItMatters || '',
        nextAction: body.next || body.nextAction || '',
        nextProof: body.proof || body.nextProof || '',
        severity: body.severity || 'medium',
        classification: body.classification || '',
        surface: body.surface || '',
        suggestedAgent: body.suggestedAgent || '',
        detectedDuring: body.detectedDuring || '',
        notes: body.notes || '',
        registeredBy: ctx.agent.handle,
        registrantAgentId: ctx.agent.id,
        registrantTaskId: ctx.agent.sessionId || '',
      };
      try {
        const result = await serializeGapWrite(() => appendGapRow(file, values, { repoRoot: gapsRepoRoot }));
        gapsCache = null; // the index just went stale by our own hand
        return sendJson(res, 201, {
          id: result.id,
          file: path.relative(gapsRepoRoot, result.file).split(path.sep).join('/'),
          line: result.line,
          row: result.row,
        });
      } catch (e) {
        // WF-G206 / WF-G180: a transient Windows open failure is NOT a broken
        // registry. gapAppend already retried it for ~1.4 s and the message
        // names the file, the errno and the likely holder, so the caller gets
        // 503 (try again) instead of a bare 500 that reads as a refusal.
        if (e && e.transient) {
          return sendJson(res, 503, { error: `gap append could not open the registry: ${e.message}`, retryable: true });
        }
        return sendJson(res, 500, { error: `gap append failed: ${e.message}` });
      }
    }),
  );

  // WF-G124: rewrite the named cells of one existing row, same serialized
  // chain as the append, so a worker can repair or resolve its own row without
  // the registry lock. The id and the provenance cells cannot be changed here.
  router.post(
    '/gaps/:id',
    withAuth(async (req, res, ctx) => {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      let file;
      try {
        file = resolveGapsFile(body.project, gapsRepoRoot);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      const patch = {
        status: body.status,
        severity: body.severity,
        classification: body.classification,
        surface: body.surface,
        suggestedAgent: body.suggestedAgent,
        gap: body.gap,
        evidence: body.evidence,
        whyItMatters: body.why ?? body.whyItMatters,
        nextAction: body.next ?? body.nextAction,
        nextProof: body.proof ?? body.nextProof,
        notes: body.notes,
        note: body.note === undefined ? undefined : `${body.note} (${ctx.agent.handle}, ${new Date().toISOString().slice(0, 10)})`,
        detectedDuring: body.detectedDuring,
        suspectedOwner: body.suspectedOwner,
        routingDecision: body.routingDecision,
        destination: body.destination,
      };
      try {
        const result = await serializeGapWrite(() => updateGapRow(file, ctx.params.id, patch));
        gapsCache = null;
        return sendJson(res, 200, {
          id: result.id,
          file: path.relative(gapsRepoRoot, result.file).split(path.sep).join('/'),
          line: result.line,
          row: result.row,
          changed: result.changed,
        });
      } catch (e) {
        if (e && e.transient) {
          return sendJson(res, 503, { error: `gap update could not open the registry: ${e.message}`, retryable: true });
        }
        const status = /no row with id/.test(e.message) ? 404 : 400;
        return sendJson(res, status, { error: `gap update failed: ${e.message}` });
      }
    }),
  );

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

  // ============================== Glossary ==============================
  // The dev glossary page (public/glossary/index.html, served from the Vite dev
  // server on :3000) reads its terms from HERE — there is no generated
  // terms.json any more, and no static fallback. GLOSSARY.md on disk is the one
  // source; when the daemon is down the page says so instead of showing stale
  // words.
  //
  // Cache: keyed on the file's own mtime + size, so an edit to GLOSSARY.md
  // invalidates it by definition — the daemon can never answer with a stale
  // parse, and a page reload does not re-parse 15 KB of markdown for nothing.
  const GLOSSARY_FILE = path.join(__dirname, 'GLOSSARY.md');
  let glossaryCache = null; // { mtimeMs, size, terms }
  function getGlossaryTerms() {
    const stat = fs.statSync(GLOSSARY_FILE);
    if (glossaryCache && glossaryCache.mtimeMs === stat.mtimeMs && glossaryCache.size === stat.size) {
      return glossaryCache.terms;
    }
    const terms = parseGlossaryFile(GLOSSARY_FILE);
    glossaryCache = { mtimeMs: stat.mtimeMs, size: stat.size, terms };
    return terms;
  }

  router.get('/glossary', async (_req, res) => {
    let terms;
    try {
      terms = getGlossaryTerms();
    } catch (e) {
      return sendJson(res, 500, { error: 'glossary unreadable: ' + e.message });
    }
    // The page is served cross-origin (Vite :3000 -> daemon :4319), so this one
    // read-only route carries an explicit CORS header. No other route is touched.
    const payload = JSON.stringify({ terms, count: terms.length, tags: GLOSSARY_TAGS, source: 'tools/agora/GLOSSARY.md' });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(payload);
  });

  // ============================== Admin ==============================
  // Board tidying: archive stale done tasks (store.archiveDoneTasks). Authed
  // like every other mutation; the sync program's tidy step is the intended
  // caller, so store files are only ever touched by the daemon that owns them.
  router.post(
    '/admin/tidy',
    withAuth(async (_req, res) => {
      sendJson(res, 200, store.archiveDoneTasks());
    }),
  );

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
        reservations: store.listReservations().length,
        tasks: store.listTasks().length,
        campaigns: store.listCampaigns().length,
        messages: store.getMessages({ since: 0 }).length,
        // Open rows in the workflow registry (tools/agora/WORKFLOW_GAPS.md), for the dashboard header.
        gapsOpen: getGapIndex().filter((g) => g.project === 'workflow' && OPEN_STATUSES.has(g.status)).length,
      },
      lastSeq: store.lastSeq,
      // WF-G147: how responsive the process has been, and what the last snapshot cost.
      loop: { lagMs: loop.lagMs, maxLagMs60s: loop.maxLagMs },
      snapshot: store.getSnapshotStats ? store.getSnapshotStats() : null,
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
      // WF-G24: the agent.register event (journaled with the bearer token for
      // replay durability) must never cross the public SSE boundary intact.
      if (data && data.agent && typeof data.agent === 'object' && 'token' in data.agent) {
        const { token, ...pub } = data.agent;
        data = { ...data, agent: pub };
      }
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
        reservations: store.listReservations(),
        tasks: store.listTasks(),
        campaigns: store.listCampaigns(),
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
function defaultStoreFactory({ dir, seatRosterPath }) {
  // seatRosterPath is undefined in production, so the store picks its own
  // default under the repo. A test passes its own path, or null to switch
  // the tracked mirror off entirely.
  return seatRosterPath === undefined
    ? createStore({ dir })
    : createStore({ dir, seatRosterPath });
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

  // Install fatal handlers before opening the store or HTTP listener. An early startup failure and
  // every later uncaught process error will be appended synchronously beside Agora's runtime state,
  // where a detached daemon can leave evidence even when no terminal is attached.
  installFatalErrorHandlers({ logFile: path.join(dir, 'daemon-crash.log') });

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

  // Busy-port pre-probe (added 2026-08-27). Every recorded "agora won't start" failure
  // (5/5 entries in daemon-crash.log, all EADDRINUSE at Object.listen) came from a second
  // `npm run agora` racing a live daemon, so probe the port first and end a double start
  // with a plain explanatory message instead of a fatal stack. A genuine bind failure on a
  // free port still surfaces unchanged through installFatalErrorHandlers. The small race
  // window between this probe and listen() is accepted as rare and remains fatal-logged.
  const portHeld = await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(800);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
  if (portHeld) {
    console.log(
      `Agora is already listening on http://localhost:${port} — leaving that daemon alone.`,
    );
    process.exit(0);
  }

  // WF-G171: the live daemon always enforces the campaign decision at intake.
  // AGORA_CAMPAIGN_INTAKE=legacy is the operator's documented way back.
  const app = createAgoraServer({
    dir,
    activityFile,
    campaignIntake: process.env.AGORA_CAMPAIGN_INTAKE || 'required',
  });
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
