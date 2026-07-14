// tools/agora/store.mjs
// Agora coordination store — the single source of truth for all coordination state.
//
// Pure Node.js ESM, zero npm dependencies. Holds in-memory state (agents, locks,
// tasks, messages), funnels every mutation through one `emit()` path that:
//   (a) appends the Event to the append-only JSONL journal,
//   (b) fans the Event out to in-process subscribers (for SSE later),
//   (c) updates in-memory state.
// Durability is a periodic JSON snapshot + the journal tail; on construction we load
// the snapshot then replay journal events with seq > snapshot.lastSeq.
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TASK_STATES = new Set(['open', 'claimed', 'in_progress', 'blocked', 'done']);
const CAMPAIGN_STATES = new Set(['active', 'blocked', 'done']);
const CAMPAIGN_ROLES = new Set(['lead', 'deputy']);

const UNCATEGORIZED_TASK_CATEGORY = 'uncategorized';

// Structured, provenance-encoding handle grammar: lowercase role.domain[/child...],
// e.g. "master.desktop", "orch.planmap/glossary". Opaque auto-names ("agent-16d417")
// and bare single-segment names ("alice") are rejected so the handle itself carries
// provenance. See docs/superpowers/plans/2026-07-06-agent-identity-provenance-plan.md.
const HANDLE_RE = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+(\/[a-z0-9][a-z0-9-]*)*$/;

export function validateHandle(handle) {
  if (typeof handle !== 'string' || handle.length === 0) {
    return { ok: false, reason: 'handle is required' };
  }
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      reason: 'handle must be lowercase role.domain[/child], e.g. "orch.planmap/glossary" — not an opaque name like "agent-16d417"',
    };
  }
  return { ok: true };
}

function normalizeCategoryInput(category) {
  if (typeof category !== 'string') return '';
  const v = category.trim().toLowerCase();
  if (!v) return '';
  return v.replace(/[^a-z0-9:_-]/g, ' ').replace(/\s+/g, '-');
}

function normalizeCategoryList(categories = []) {
  const input = Array.isArray(categories) ? categories : [categories];
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    const n = normalizeCategoryInput(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function normalizeTaskPath(raw) {
  if (!raw) return '';
  let p = String(raw).trim().replace(/\\/g, '/');
  // Normalize absolute Windows / mixed paths into repo-relative style.
  const lower = p.toLowerCase();
  const marker = '/repos/aralia/';
  const markerPos = lower.indexOf(marker);
  if (markerPos >= 0) {
    p = p.slice(markerPos + marker.length);
  }
  p = p.replace(/^[a-z]:\//, '');
  p = p.replace(/^\/+/, '').replace(/\/+$/, '');
  return p;
}

function categoryFromPath(raw) {
  const p = normalizeTaskPath(raw);
  if (!p) return UNCATEGORIZED_TASK_CATEGORY;
  const lower = p.toLowerCase();
  if (lower.startsWith('.github/')) return 'github';
  if (lower.startsWith('docs/projects/')) {
    const parts = lower.split('/');
    const project = parts[2] || 'docs-project';
    return `project:${project}`;
  }
  if (lower.startsWith('docs/')) return 'docs';
  if (lower.startsWith('src/')) return 'src';
  if (lower.startsWith('tools/')) return 'tools';
  if (lower.startsWith('scripts/')) return 'scripts';
  if (lower.startsWith('tests/')) return 'tests';
  if (lower.startsWith('misc/')) return 'misc';
  return UNCATEGORIZED_TASK_CATEGORY;
}

function firstPathFromRefs(refs = []) {
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const match = ref.match(/([^:]+):\d+$/);
    const rawPath = match ? match[1] : ref;
    const category = categoryFromPath(rawPath);
    if (category !== UNCATEGORIZED_TASK_CATEGORY) return category;
  }
  return '';
}

function inferTodoCategoryFromBody(body) {
  if (typeof body !== 'string') return '';
  const match = /TODO\(\s*([^)]+)\s*\)/i.exec(body);
  if (!match) return '';

  const rawTag = match[1].trim().toLowerCase();
  const normalizedTag = normalizeCategoryInput(rawTag);
  if (!normalizedTag) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(normalizedTag)) return 'todo:cleanup';
  if (/\blint\b/.test(rawTag) || /lint-intent/.test(normalizedTag)) return 'todo:lint';
  if (/next-agent/.test(normalizedTag)) return 'todo:next-agent';
  if (/navigator/.test(normalizedTag)) return 'todo:navigator';
  if (/spell/.test(rawTag)) return 'todo:spells';
  if (/docs|documentation/.test(rawTag)) return 'todo:docs';
  if (/test/.test(rawTag)) return 'todo:tests';
  if (/pass|sweep|cleanup|refactor/.test(rawTag)) return 'todo:cleanup';
  if (/work|task|ticket/.test(rawTag)) return 'todo:work';
  return `todo:${normalizedTag}`;
}

function inferWorkTypeCategoryFromBody(body) {
  const todo = inferTodoCategoryFromBody(body);
  if (!todo) return '';
  return todo.startsWith('todo:') ? todo : `work:${todo}`;
}

function normalizeCategoryPath(raw) {
  const category = categoryFromPath(raw);
  if (category === UNCATEGORIZED_TASK_CATEGORY) return '';
  return `domain:${category}`;
}

function inferTaskCategories(task = {}) {
  const explicitList = normalizeCategoryList(task.categories || []);
  const explicitPrimary = normalizeCategoryInput(task.category);
  const out = [];
  const seen = new Set();
  const add = (v) => {
    const n = normalizeCategoryInput(v);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  if (explicitPrimary) add(explicitPrimary);
  for (const c of explicitList) add(c);

  const fromTodo = inferWorkTypeCategoryFromBody(task.body);
  if (fromTodo) add(fromTodo);

  const fromRefs = firstPathFromRefs(task.refs || []);
  const fromPath = normalizeCategoryPath(fromRefs);
  if (fromPath) add(fromPath);

  if (typeof task.body === 'string') {
    const fileMatch = /File:\s*([^\r\n]+)/i.exec(task.body);
    const bodyPath = normalizeCategoryPath(fileMatch ? fileMatch[1] : '');
    if (bodyPath) add(bodyPath);
  }

  if (!out.length) {
    add(UNCATEGORIZED_TASK_CATEGORY);
  }

  return out;
}

function inferTaskCategory(task = {}) {
  return inferTaskCategories(task)[0] || UNCATEGORIZED_TASK_CATEGORY;
}

function withCategory(task) {
  const categories = inferTaskCategories(task);
  return { ...JSON.parse(JSON.stringify(task)), category: categories[0], categories };
}

// Turn a human campaign name into a stable board id. This keeps plan-provided
// names usable in URLs, snapshot files, and task metadata without requiring a
// separate slug field in every plan.
function normalizeCampaignId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^A-Za-z0-9:_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Clean campaign path/glob lists while preserving the exact token text the
// orchestrator claimed. These tokens are compared with the same overlap rules
// used by advisory locks.
function normalizePathList(raw = []) {
  const input = Array.isArray(raw) ? raw : [raw];
  const out = [];
  const seen = new Set();
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// Campaign scopes use the same path+glob token model as locks, but at the
// orchestrator-supervision level instead of the worker-edit level.
function campaignTokens(campaign) {
  return [...(campaign.paths || []), ...(campaign.globs || [])];
}

// Find the first requested token that collides with a claimed campaign domain.
// Returning the token makes conflict messages actionable before a wave is seeded.
function campaignOverlap(requestTokens, campaign) {
  for (const r of requestTokens) {
    for (const h of campaignTokens(campaign)) {
      if (tokensOverlap(r, h)) return r;
    }
  }
  return null;
}

/**
 * Translate a glob pattern (`*`, `**`, `?`) into a RegExp anchored full-string.
 * Semantics (POSIX-ish, '/' as separator):
 *   `**`  -> matches anything, including '/'        (e.g. src/**\/*.ts)
 *   `*`   -> matches anything except '/'
 *   `?`   -> matches a single char except '/'
 * All other regex metacharacters are escaped.
 */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` — matches across path separators
        re += '.*';
        i++;
        // swallow a following slash so `src/**/x` matches `src/x`
        if (glob[i + 1] === '/') i++;
      } else {
        // single `*` — anything but '/'
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      // escape regex metacharacters
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

function isGlob(s) {
  return /[*?]/.test(s);
}

/**
 * Does one lock-token (path or glob) overlap another?
 * Rules per spec:
 *   - exact path match
 *   - a glob matches a path
 *   - two globs are equal
 */
function tokensOverlap(a, b) {
  const aGlob = isGlob(a);
  const bGlob = isGlob(b);
  if (!aGlob && !bGlob) return a === b; // exact path match
  if (aGlob && bGlob) return a === b; // two globs equal
  // one glob, one path
  const glob = aGlob ? a : b;
  const p = aGlob ? b : a;
  return globToRegExp(glob).test(p);
}

/** Flatten a lock's claimed tokens (paths + globs) into one array. */
function lockTokens(lock) {
  return [...(lock.paths || []), ...(lock.globs || [])];
}

/** Does a set of requested tokens overlap a held lock? Returns the first offending path/token or null. */
function lockOverlap(requestTokens, heldLock) {
  const held = lockTokens(heldLock);
  for (const r of requestTokens) {
    for (const h of held) {
      if (tokensOverlap(r, h)) return r;
    }
  }
  return null;
}

export function createStore({
  dir,
  now = Date.now,
  genId = () => crypto.randomUUID(),
  presenceTtlMs = 600000,
  presenceDropMs = 3600000,
  lockTtlMs = 1800000,
  snapshotEveryEvents = 200,
} = {}) {
  if (!dir) throw new Error('createStore requires a { dir }');

  fs.mkdirSync(dir, { recursive: true });
  const journalPath = path.join(dir, 'journal.jsonl');
  const snapshotPath = path.join(dir, 'snapshot.json');

  // ---- in-memory state ----
  const state = {
    agents: new Map(), // id -> Agent (raw stored fields)
    locks: new Map(), // id -> Lock
    reservations: new Map(), // id -> Reservation, FIFO dibs for future lock access
    reservationSeq: 0, // last assigned reservation queue number
    tasks: new Map(), // id -> Task
    campaigns: new Map(), // id -> Campaign, the active governance domains claimed by orchestrators
    messages: [], // Message[] (ordered by seq)
    seq: 0, // last assigned event seq
    messageSeq: 0, // last assigned message seq
  };

  const subscribers = new Set();
  let eventsSinceSnapshot = 0;
  let replaying = false;

  // ---- journal append stream (created lazily, after replay) ----
  let journalFd = null;
  function openJournal() {
    if (journalFd === null) {
      journalFd = fs.openSync(journalPath, 'a');
    }
  }

  function appendJournal(event) {
    openJournal();
    fs.writeSync(journalFd, JSON.stringify(event) + '\n');
  }

  // ---------------------------------------------------------------------------
  // Mutation reducers — pure(ish): given an event payload, mutate in-memory state.
  // Keyed by event type. Used both for live mutations and journal replay so that
  // replay is guaranteed to reconstruct identical state.
  // ---------------------------------------------------------------------------
  const reducers = {
    'agent.register'(p) {
      state.agents.set(p.agent.id, { ...p.agent });
    },
    'agent.touch'(p) {
      const a = state.agents.get(p.agentId);
      if (a) a.lastSeen = p.lastSeen;
    },
    'agent.drop'(p) {
      state.agents.delete(p.agentId);
    },
    'lock.acquire'(p) {
      state.locks.set(p.lock.id, { ...p.lock });
    },
    'lock.release'(p) {
      state.locks.delete(p.lockId);
    },
    'lock.expired'(p) {
      state.locks.delete(p.lockId);
    },
    'reservation.create'(p) {
      state.reservations.set(p.reservation.id, { ...p.reservation });
      if (p.reservation.queueSeq > state.reservationSeq) state.reservationSeq = p.reservation.queueSeq;
    },
    'reservation.release'(p) {
      state.reservations.delete(p.reservationId);
    },
    'reservation.fulfill'(p) {
      state.reservations.delete(p.reservationId);
    },
    'task.create'(p) {
      state.tasks.set(p.task.id, JSON.parse(JSON.stringify(p.task)));
    },
    'task.claim'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.state = 'claimed';
      t.claimedBy = p.agentId;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.state'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.state = p.state;
      if (p.result !== undefined) t.result = p.result;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.release'(p) {
      // Reopen a claimed/in-progress task (dead-agent reap or explicit release).
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.state = 'open';
      t.claimedBy = null;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
      // A reap carries a retrace dossier (agent-retrace, Wave 2). A clean retire
      // does not, so it neither stamps a crash dossier nor bumps reapCount.
      if (p.retrace) {
        t.retrace = p.retrace;
        t.reapCount = (t.reapCount || 0) + 1;
      }
    },
    'task.checkpoint'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.checkpoint = p.checkpoint; // latest-wins resumable note
      t.updatedAt = p.ts;
    },
    'task.handoff'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.claimedBy = p.toAgentId;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.categories'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.category = normalizeCategoryInput(p.category || '');
      t.categories = normalizeCategoryList(p.categories);
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'campaign.claim'(p) {
      state.campaigns.set(p.campaign.id, JSON.parse(JSON.stringify(p.campaign)));
    },
    'campaign.state'(p) {
      const c = state.campaigns.get(p.campaignId);
      if (!c) return;
      c.state = p.state;
      c.updatedAt = p.ts;
      c.history.push(p.entry);
    },
    'message.post'(p) {
      state.messages.push({ ...p.message });
      if (p.message.seq > state.messageSeq) state.messageSeq = p.message.seq;
    },
  };

  /**
   * The single mutation path. Assigns the event seq, applies the reducer to
   * in-memory state, appends to the journal, and fans out to subscribers.
   * During replay only the reducer runs (no journal append, no fan-out, seq is
   * driven by the replayed event).
   */
  function emit(type, payload) {
    const reducer = reducers[type];
    if (!reducer) throw new Error('Unknown event type: ' + type);

    const event = {
      seq: ++state.seq,
      type,
      payload,
      ts: now(),
    };
    // ts on the event is authoritative; payloads that need a timestamp carry their own.
    reducer(payload);
    appendJournal(event);

    for (const fn of subscribers) {
      try {
        fn(event);
      } catch {
        // a misbehaving subscriber must not break the mutation path
      }
    }

    eventsSinceSnapshot++;
    if (eventsSinceSnapshot >= snapshotEveryEvents) snapshot();

    return event;
  }

  // ---------------------------------------------------------------------------
  // Snapshot + replay
  // ---------------------------------------------------------------------------
  function serializeState() {
    return {
      lastSeq: state.seq,
      messageSeq: state.messageSeq,
      agents: [...state.agents.values()],
      locks: [...state.locks.values()],
      reservations: [...state.reservations.values()],
      reservationSeq: state.reservationSeq,
      tasks: [...state.tasks.values()],
      campaigns: [...state.campaigns.values()],
      messages: state.messages,
    };
  }

  function snapshot() {
    const snap = serializeState();
    const tmp = snapshotPath + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snap));
    fs.renameSync(tmp, snapshotPath); // atomic replace

    // Journal now only needs post-snapshot events. Close, truncate, reopen.
    if (journalFd !== null) {
      fs.closeSync(journalFd);
      journalFd = null;
    }
    fs.writeFileSync(journalPath, ''); // truncate/rotate
    eventsSinceSnapshot = 0;
  }

  function loadSnapshot() {
    if (!fs.existsSync(snapshotPath)) return 0;
    let snap;
    try {
      snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      return 0; // corrupt snapshot — fall back to pure journal replay
    }
    state.seq = snap.lastSeq || 0;
    state.messageSeq = snap.messageSeq || 0;
    for (const a of snap.agents || []) state.agents.set(a.id, a);
    for (const l of snap.locks || []) state.locks.set(l.id, l);
    for (const r of snap.reservations || []) state.reservations.set(r.id, r);
    state.reservationSeq = snap.reservationSeq || Math.max(0, ...[...state.reservations.values()].map((r) => r.queueSeq || 0));
    for (const t of snap.tasks || []) state.tasks.set(t.id, t);
    for (const c of snap.campaigns || []) state.campaigns.set(c.id, c);
    state.messages = snap.messages || [];
    return state.seq;
  }

  function replayJournal(snapshotSeq) {
    if (!fs.existsSync(journalPath)) return;
    const raw = fs.readFileSync(journalPath, 'utf8');
    if (!raw) return;
    replaying = true;
    const lines = raw.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // skip a torn last line from a crash mid-write
      }
      if (event.seq <= snapshotSeq) continue; // already folded into snapshot
      const reducer = reducers[event.type];
      if (reducer) reducer(event.payload);
      if (event.seq > state.seq) state.seq = event.seq;
    }
    replaying = false;
  }

  // ---- bootstrap: snapshot then journal tail ----
  const snapSeq = loadSnapshot();
  replayJournal(snapSeq);
  openJournal();

  // ===========================================================================
  // Presence
  // ===========================================================================
  const AGENT_ROLES = ['worker', 'orchestrator', 'master', 'human'];
  // Roles allowed to post on (and expected to read) the command channel.
  const COMMAND_CHANNEL_ROLES = ['orchestrator', 'master', 'human'];
  function registerAgent({ handle, note, model, sessionId, role, type, spawnedBy, campaign, cwd } = {}) {
    const ts = now();
    const agent = {
      id: genId(),
      handle: handle || 'agent',
      token: genId(),
      registeredAt: ts, // the "checked in" moment
      lastSeen: ts, // "last touched"; refreshed by every authed call + heartbeat
      status: 'online',
      note: note || '',
      // Optional provenance: which model this agent is (usually stamped by the
      // orchestrator at launch) and its own harness conversation/thread id (so an
      // agent can look up and report which session it is).
      model: typeof model === 'string' ? model : '',
      sessionId: typeof sessionId === 'string' ? sessionId : '',
      // Coordination role: workers do the tasks; orchestrator/master/human may
      // also use the command channel. Self-declared (local-trust model).
      role: AGENT_ROLES.includes(role) ? role : 'worker',
      // Identity and provenance (fleet-coordination Wave 1), on top of fable's role.
      // `type` is the runtime kind. `spawnedBy`, `campaign`, and `cwd` say where the
      // agent came from. The spawner usually sets these; a root agent self-declares.
      type: typeof type === 'string' ? type : '',
      spawnedBy: typeof spawnedBy === 'string' ? spawnedBy : '',
      campaign: typeof campaign === 'string' ? campaign : '',
      cwd: typeof cwd === 'string' ? cwd : '',
      // Whether the handle follows the structured grammar. A flag, not a block.
      handleValid: validateHandle(handle || '').ok,
    };
    emit('agent.register', { agent });
    return { ...agent };
  }

  // Clean voluntary exit — the counterpart to reap (see `sweepExpired`). It releases
  // the agent's locks. It reopens the agent's in-flight tasks with a `retired` marker,
  // not the crash marker `reaped`, plus an optional final note. It then drops the agent.
  function retireAgent(agentId, { note } = {}) {
    const agent = state.agents.get(agentId);
    if (!agent) return { ok: false, error: 'unknown agent' };
    const t = now();
    for (const lock of [...state.locks.values()]) {
      if (lock.agentId === agentId) {
        emit('lock.release', { lockId: lock.id, agentId, retired: true });
      }
    }
    for (const task of [...state.tasks.values()]) {
      if (task.claimedBy === agentId && (task.state === 'claimed' || task.state === 'in_progress')) {
        const entry = { at: t, by: agentId, action: 'retired', state: 'open' };
        if (typeof note === 'string' && note) entry.note = note;
        emit('task.release', { taskId: task.id, ts: t, entry });
      }
    }
    emit('agent.drop', { agentId, retired: true });
    return { ok: true, agentId };
  }

  function touch(agentId) {
    if (!state.agents.has(agentId)) return;
    emit('agent.touch', { agentId, lastSeen: now() });
  }

  function computeStatus(agent, t) {
    return t - agent.lastSeen <= presenceTtlMs ? 'online' : 'stale';
  }

  function listAgents() {
    const t = now();
    const out = [];
    for (const agent of state.agents.values()) {
      const age = t - agent.lastSeen;
      if (age > presenceDropMs) continue; // dropped from the active list
      // WF-G24: never expose the bearer token on the public roster — an agent
      // only ever learns its own token from its register response.
      const { token, ...pub } = agent;
      out.push({ ...pub, status: computeStatus(agent, t) });
    }
    return out;
  }

  // Find a live (online-or-stale, i.e. not yet dropped) agent holding this handle.
  // Used to enforce handle-claim uniqueness at register: a name may be reclaimed
  // once its previous holder is reaped, but not while it's still active.
  function findLiveAgentByHandle(handle) {
    if (!handle) return null;
    const t = now();
    for (const agent of state.agents.values()) {
      if (agent.handle !== handle) continue;
      if (t - agent.lastSeen > presenceDropMs) continue; // dropped -> reclaimable
      return { ...agent, status: computeStatus(agent, t) };
    }
    return null;
  }

  function getAgentByToken(token) {
    if (!token) return null;
    for (const agent of state.agents.values()) {
      if (agent.token === token) {
        const t = now();
        return { ...agent, status: computeStatus(agent, t) };
      }
    }
    return null;
  }

  function taskCreatorSnapshot(agentId) {
    const agent = state.agents.get(agentId);
    if (!agent) throw new Error('registered creator agent is required');

    // Tasks outlive live presence rows, so each task carries a token-free copy of
    // the creator identity. This keeps handoffs and dashboard inspection readable
    // after the creator agent has gone stale or been reaped.
    return {
      id: agent.id,
      handle: agent.handle,
      note: agent.note || '',
      model: agent.model || '',
      sessionId: agent.sessionId || '',
    };
  }

  // ===========================================================================
  // Locks (advisory)
  // ===========================================================================
  function activeLocks(t = now()) {
    const out = [];
    for (const lock of state.locks.values()) {
      if (lock.expiresAt && lock.expiresAt <= t) continue;
      out.push(lock);
    }
    return out;
  }

  function acquireLock({ agentId, paths = [], globs = [], reason, ttlMs } = {}) {
    const t = now();
    const requestTokens = [...paths, ...globs];
    if (requestTokens.length === 0) {
      return { ok: false, conflict: null, error: 'no paths or globs specified' };
    }

    for (const held of activeLocks(t)) {
      if (held.agentId === agentId) continue; // same agent may re-lock its own paths
      const offending = lockOverlap(requestTokens, held);
      if (offending) {
        return {
          ok: false,
          conflict: { path: offending, heldBy: held.agentId, lock: { ...held } },
        };
      }
    }

    const reservationConflict = reservationConflictFor(agentId, requestTokens);
    if (reservationConflict) {
      return {
        ok: false,
        conflict: { type: 'reservation', ...reservationConflict },
      };
    }

    const ttl = typeof ttlMs === 'number' ? ttlMs : lockTtlMs;
    const lock = {
      id: genId(),
      paths: [...paths],
      globs: [...globs],
      agentId,
      reason: reason || '',
      createdAt: t,
      expiresAt: t + ttl,
    };
    emit('lock.acquire', { lock });
    fulfillHeadReservations(agentId, requestTokens);
    return { ok: true, lock: { ...lock } };
  }

  function releaseLock({ lockId, agentId, force } = {}) {
    const lock = state.locks.get(lockId);
    if (!lock) return { ok: false, error: 'lock not found' };
    if (lock.agentId !== agentId) {
      if (!force) return { ok: false, error: 'only the holder may release' };
      // Force release: allowed only when the holder is stale or gone — a live
      // agent's lock is never yanked out from under it.
      const holder = state.agents.get(lock.agentId);
      if (holder && now() - holder.lastSeen <= presenceTtlMs) {
        return { ok: false, error: 'holder is online — force release refused' };
      }
    }
    emit('lock.release', { lockId, agentId, forced: lock.agentId !== agentId || undefined });
    return { ok: true };
  }

  function listLocks() {
    return activeLocks().map((l) => ({ ...l }));
  }

  // ===========================================================================
  // Reservations (file-access waiting room)
  // ===========================================================================
  // Reservations are not edit permission. They are a visible FIFO queue for agents
  // that want a file after the current holder. The queue becomes enforceable when
  // a lock is requested: anyone behind #1 gets a reservation conflict instead of
  // silently jumping the line.
  // ===========================================================================
  function reservationTokens(reservation) {
    return [...(reservation.paths || []), ...(reservation.globs || [])];
  }

  function reservationOverlap(requestTokens, reservation) {
    for (const r of requestTokens) {
      for (const h of reservationTokens(reservation)) {
        if (tokensOverlap(r, h)) return r;
      }
    }
    return null;
  }

  function activeReservationsFor(requestTokens) {
    return [...state.reservations.values()]
      .filter((reservation) => reservationOverlap(requestTokens, reservation))
      .sort((a, b) => (a.queueSeq || 0) - (b.queueSeq || 0) || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
  }

  function withReservationPosition(reservation) {
    const queue = activeReservationsFor(reservationTokens(reservation));
    const position = queue.findIndex((item) => item.id === reservation.id) + 1;
    return { ...reservation, position: position || 1 };
  }

  function reservationConflictFor(agentId, requestTokens) {
    const queue = activeReservationsFor(requestTokens);
    if (!queue.length) return null;
    const head = queue[0];
    if (head.agentId === agentId) return null;
    return { path: reservationOverlap(requestTokens, head), reservation: withReservationPosition(head) };
  }

  function fulfillHeadReservations(agentId, requestTokens) {
    for (const reservation of activeReservationsFor(requestTokens)) {
      if (reservation.agentId !== agentId) continue;
      const head = activeReservationsFor(reservationTokens(reservation))[0];
      if (!head || head.id !== reservation.id) continue;
      emit('reservation.fulfill', { reservationId: reservation.id, agentId, lockTokens: requestTokens });
    }
  }

  function reserveFiles({ agentId, paths = [], globs = [], reason } = {}) {
    const requestTokens = [...paths, ...globs];
    if (requestTokens.length === 0) {
      return { ok: false, error: 'no paths or globs specified' };
    }

    const reservation = {
      id: genId(),
      paths: [...paths],
      globs: [...globs],
      agentId,
      reason: reason || '',
      createdAt: now(),
      queueSeq: state.reservationSeq + 1,
    };
    emit('reservation.create', { reservation });
    return { ok: true, reservation: withReservationPosition(reservation) };
  }

  function releaseReservation({ agentId, target } = {}) {
    if (!target) return { ok: false, error: 'reservation id or path required' };
    const targetTokens = [target];
    const reservation = state.reservations.get(target)
      || [...state.reservations.values()].find(
        (item) => item.agentId === agentId && reservationOverlap(targetTokens, item),
      );
    if (!reservation) return { ok: false, error: 'reservation not found' };
    if (reservation.agentId !== agentId) return { ok: false, error: 'only the reserver may release' };
    emit('reservation.release', { reservationId: reservation.id, agentId });
    return { ok: true };
  }

  function listReservations() {
    return [...state.reservations.values()]
      .sort((a, b) => (a.queueSeq || 0) - (b.queueSeq || 0) || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)))
      .map(withReservationPosition);
  }

  // ===========================================================================
  // Campaign Governance
  // ===========================================================================
  // Orchestrator campaigns reserve broad supervisory domains before a wave is
  // seeded. This deliberately mirrors advisory locks: the board warns or refuses
  // unsafe orchestration overlap, while individual workers still lock concrete
  // files before editing.
  // ===========================================================================
  function isLiveAgent(agentId, t = now()) {
    return agentPresenceStatus(agentId, t) !== 'gone';
  }

  function agentPresenceStatus(agentId, t = now()) {
    const agent = state.agents.get(agentId);
    if (!agent || t - agent.lastSeen > presenceDropMs) return 'gone';
    return computeStatus(agent, t);
  }

  function activeCampaigns(t = now()) {
    return [...state.campaigns.values()].filter(
      (campaign) => campaign.state === 'active' && isLiveAgent(campaign.agentId, t),
    );
  }

  function activeLeadCampaign(id) {
    const campaign = state.campaigns.get(id);
    if (!campaign || campaign.role !== 'lead' || campaign.state !== 'active') return null;
    return isLiveAgent(campaign.agentId) ? campaign : null;
  }

  function claimCampaign({
    agentId,
    campaignId,
    role = 'lead',
    leadCampaignId,
    scope,
    paths = [],
    globs = [],
    wave,
  } = {}) {
    const id = normalizeCampaignId(campaignId || '');
    if (!id) return { ok: false, error: 'campaign id is required' };
    const normalizedRole = CAMPAIGN_ROLES.has(role) ? role : 'lead';
    const claimPaths = normalizePathList(paths);
    const claimGlobs = normalizePathList(globs);
    const requestTokens = [...claimPaths, ...claimGlobs];
    if (!requestTokens.length) return { ok: false, error: 'campaign must declare at least one path or glob' };

    const t = now();
    const existing = state.campaigns.get(id);
    if (existing && existing.agentId !== agentId && existing.state === 'active' && isLiveAgent(existing.agentId, t)) {
      return {
        ok: false,
        error: `campaign "${id}" is already active`,
        conflict: { campaign: JSON.parse(JSON.stringify(existing)) },
      };
    }

    const normalizedLeadId = normalizeCampaignId(leadCampaignId || '');
    if (normalizedRole === 'deputy' && !activeLeadCampaign(normalizedLeadId)) {
      return { ok: false, error: 'deputy campaign must name an active lead campaign' };
    }

    // A successor may adopt an active campaign whose owner has fallen beyond
    // the drop horizon. Keep the original creation time and history so the
    // dashboard shows continuity instead of making the old owner disappear.
    const adoptsDeadOwner = Boolean(
      existing
      && existing.state === 'active'
      && existing.agentId !== agentId
      && !isLiveAgent(existing.agentId, t),
    );

    for (const campaign of activeCampaigns(t)) {
      if (campaign.id === id) continue;
      if (campaign.role !== 'lead') continue;
      const overlap = campaignOverlap(requestTokens, campaign);
      if (!overlap) continue;
      const allowedDeputyJoin = normalizedRole === 'deputy' && campaign.id === normalizedLeadId;
      if (!allowedDeputyJoin) {
        return {
          ok: false,
          error: `campaign "${id}" overlaps active lead campaign "${campaign.id}" on "${overlap}"`,
          conflict: { path: overlap, campaign: JSON.parse(JSON.stringify(campaign)) },
        };
      }
    }

    const warnings = [];
    if (normalizedRole === 'deputy') {
      const lead = activeLeadCampaign(normalizedLeadId);
      const overlapsLead = lead ? requestTokens.some((token) => campaignOverlap([token], lead)) : false;
      if (!overlapsLead) warnings.push(`deputy campaign "${id}" does not overlap lead "${normalizedLeadId}"`);
      for (const campaign of activeCampaigns(t)) {
        if (campaign.id === id || campaign.role !== 'deputy') continue;
        if (campaign.leadCampaignId !== normalizedLeadId) continue;
        const overlap = campaignOverlap(requestTokens, campaign);
        if (overlap) warnings.push(`deputy campaign "${id}" overlaps deputy "${campaign.id}" on "${overlap}"`);
      }
    }

    const campaign = {
      id,
      role: normalizedRole,
      leadCampaignId: normalizedRole === 'deputy' ? normalizedLeadId : '',
      agentId,
      scope: typeof scope === 'string' ? scope.trim() : '',
      paths: claimPaths,
      globs: claimGlobs,
      wave: typeof wave === 'string' ? wave.trim() : '',
      state: 'active',
      warnings,
      createdAt: existing ? existing.createdAt : t,
      updatedAt: t,
      history: [
        ...((existing && existing.history) || []),
        {
          at: t,
          by: agentId,
          action: adoptsDeadOwner ? 'adopted' : 'claimed',
          state: 'active',
          role: normalizedRole,
          ...(adoptsDeadOwner ? { previousOwner: existing.agentId } : {}),
        },
      ],
    };
    emit('campaign.claim', { campaign });
    return { ok: true, campaign: JSON.parse(JSON.stringify(campaign)), warnings };
  }

  function setCampaignState({ campaignId, agentId, state: newState } = {}) {
    const id = normalizeCampaignId(campaignId || '');
    const campaign = state.campaigns.get(id);
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!CAMPAIGN_STATES.has(newState)) return { ok: false, error: 'invalid campaign state: ' + newState };
    if (campaign.agentId !== agentId) return { ok: false, error: 'only the campaign owner may change state' };
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'state', state: newState };
    emit('campaign.state', { campaignId: id, agentId, state: newState, ts, entry });
    return { ok: true, campaign: JSON.parse(JSON.stringify(state.campaigns.get(id))) };
  }

  function listCampaigns({ state: filterState } = {}) {
    const t = now();
    return [...state.campaigns.values()]
      .filter((campaign) => !filterState || campaign.state === filterState)
      .map((campaign) => {
        const ownerStatus = agentPresenceStatus(campaign.agentId, t);
        return {
          ...JSON.parse(JSON.stringify(campaign)),
          // Ownership remains authoritative through the stale window. Only a
          // gone owner may be replaced; stale is a warning, not permission.
          ownerStatus,
          ownerLive: ownerStatus !== 'gone',
        };
      });
  }

  // ===========================================================================
  // Task board
  // ===========================================================================
  function createTask({ agentId, title, body, deps, priority, refs, category, campaignId, wave } = {}) {
    const ts = now();
    const creatorAgent = taskCreatorSnapshot(agentId);
    const depIds = Array.isArray(deps) ? deps.filter(Boolean) : [];
    for (const d of depIds) {
      if (!state.tasks.has(d)) throw new Error('unknown dep: ' + d);
    }
    const normalizedCampaignId = normalizeCampaignId(campaignId || '');
    if (normalizedCampaignId && !state.campaigns.has(normalizedCampaignId)) {
      throw new Error('unknown campaign: ' + normalizedCampaignId);
    }
    const task = {
      id: genId(),
      title: title || '',
      body: body || '',
      category: normalizeCategoryInput(category),
      campaignId: normalizedCampaignId,
      wave: typeof wave === 'string' ? wave.trim() : '',
      state: 'open',
      createdBy: agentId,
      creatorAgent,
      claimedBy: null,
      // Orchestration metadata: deps gate readiness, priority orders the ready
      // queue, refs link out to tracker artifacts (gap IDs, doc paths).
      deps: depIds,
      priority: typeof priority === 'number' && Number.isFinite(priority) ? priority : 0,
      refs: Array.isArray(refs) ? refs.filter((r) => typeof r === 'string') : [],
      result: null,
      createdAt: ts,
      updatedAt: ts,
      history: [{ at: ts, by: agentId, action: 'created', state: 'open' }],
    };
    emit('task.create', { task });
    return JSON.parse(JSON.stringify(task));
  }

  /** A task is ready when it is open and every dep is done. Pre-upgrade tasks
   *  have no deps field — they count as dep-free. */
  function isTaskReady(t) {
    if (t.state !== 'open') return false;
    for (const d of t.deps || []) {
      const dep = state.tasks.get(d);
      if (!dep || dep.state !== 'done') return false;
    }
    return true;
  }

  function readyOrder(a, b) {
    const pa = a.priority || 0;
    const pb = b.priority || 0;
    if (pb !== pa) return pb - pa; // higher priority first
    return a.createdAt - b.createdAt; // then FIFO
  }

  function claimTask({ taskId, agentId } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if ((t.state === 'claimed' || t.state === 'in_progress') && t.claimedBy && t.claimedBy !== agentId) {
      return { ok: false, error: 'task already claimed by another agent' };
    }
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'claimed', state: 'claimed' };
    emit('task.claim', { taskId, agentId, ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  function setTaskState({ taskId, agentId, state: newState, result } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!TASK_STATES.has(newState)) return { ok: false, error: 'invalid state: ' + newState };
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'state', state: newState };
    if (typeof result === 'string' && result) entry.result = result;
    const payload = { taskId, agentId, state: newState, ts, entry };
    if (typeof result === 'string' && result) payload.result = result;
    emit('task.state', payload);
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  /** Atomically claim the highest-priority ready task (worker-pull model).
   *  Returns { ok: true, task } or { ok: true, task: null } when nothing is ready. */
  function claimNextReady({ agentId, campaignId, category } = {}) {
    const normalizedCampaignId = normalizeCampaignId(campaignId || '');
    const normalizedCategory = normalizeCategoryInput(category);
    const ready = [...state.tasks.values()]
      .filter(isTaskReady)
      .filter((task) => !normalizedCampaignId || task.campaignId === normalizedCampaignId)
      .filter((task) => !normalizedCategory || withCategory(task).categories.includes(normalizedCategory))
      .sort(readyOrder);
    if (ready.length === 0) return { ok: true, task: null };
    return claimTask({ taskId: ready[0].id, agentId });
  }

  function handoffTask({ taskId, agentId, toAgentId } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!toAgentId) return { ok: false, error: 'toAgentId required' };
    // Authorization (WF-G11): only the current claimant or the task's creator
    // (the orchestrator, for seeded tasks) may reassign it.
    if (t.claimedBy && t.claimedBy !== agentId && t.createdBy !== agentId) {
      return { ok: false, error: 'only the claimant or the task creator may handoff' };
    }
    const ts = now();
    if (!state.agents.has(toAgentId) || !isLiveAgent(toAgentId, ts)) {
      return { ok: false, error: 'target agent is not registered or live' };
    }
    const entry = { at: ts, by: agentId, action: 'handoff', to: toAgentId, state: t.state };
    emit('task.handoff', { taskId, agentId, toAgentId, ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  function setTaskCategories({ taskId, agentId, categories, category } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    const merged = normalizeCategoryList([
      ...(typeof category === 'string' ? [category] : []),
      ...normalizeCategoryList(categories),
    ]);
    if (!merged.length) return { ok: false, error: 'at least one category is required' };

    const ts = now();
    const entry = { at: ts, by: agentId, action: 'categories', state: t.state };
    emit('task.categories', { taskId, agentId, categories: merged, category: merged[0], ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  // Leave a resumable checkpoint on a task (agent-retrace, Wave 2). Latest-wins: the
  // newest checkpoint replaces the last. Captured into the retrace dossier on reap.
  function checkpointTask({ taskId, agentId, did, next, files } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    const ts = now();
    const list = Array.isArray(files)
      ? files
      : typeof files === 'string' && files
        ? files.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const checkpoint = {
      at: ts,
      by: agentId,
      did: typeof did === 'string' ? did : '',
      next: typeof next === 'string' ? next : '',
      files: list,
    };
    emit('task.checkpoint', { taskId, checkpoint, ts });
    return { ok: true, checkpoint };
  }

  function listTasks({ state: filterState, ready, category } = {}) {
    let source = [...state.tasks.values()];
    if (ready) source = source.filter(isTaskReady).sort(readyOrder);
    const normalizedCategory = category == null ? '' : normalizeCategoryInput(category);
    const out = [];
    for (const t of source) {
      const row = withCategory(t);
      if (normalizedCategory && !row.categories.includes(normalizedCategory)) continue;
      if (filterState && t.state !== filterState) continue;
      out.push(row);
    }
    return out;
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================
  function postMessage({ agentId, to, body, channel } = {}) {
    // The command channel is a control-plane feed: only orchestrators, the
    // master, and the human may post there. Workers get a refusal, not a
    // silent drop, so a misconfigured agent learns immediately.
    if (channel === 'command') {
      const sender = state.agents.get(agentId);
      const role = (sender && sender.role) || 'worker';
      if (!COMMAND_CHANNEL_ROLES.includes(role)) {
        return { ok: false, error: `role "${role}" may not post on the command channel (need one of: ${COMMAND_CHANNEL_ROLES.join(', ')}) — register with that role if you are one` };
      }
    }
    const ts = now();
    const message = {
      id: genId(),
      seq: state.messageSeq + 1,
      from: agentId,
      to: to || 'all',
      body: body || '',
      channel: channel === 'command' ? 'command' : 'main',
      createdAt: ts,
    };
    emit('message.post', { message });
    return { ok: true, message: { ...message } };
  }

  function getMessages({ since = 0, to, channel } = {}) {
    // channel: 'main' (default — pre-channel messages count as main),
    // 'command', or 'all'. Workers polling their inbox never see command
    // traffic unless they ask for it; the gate is on POSTING, not reading.
    const wanted = channel === 'command' || channel === 'all' ? channel : 'main';
    return state.messages
      .filter((m) => m.seq > since)
      .filter((m) => {
        if (wanted === 'all') return true;
        return (m.channel || 'main') === wanted;
      })
      .filter((m) => {
        if (!to) return true;
        return m.to === 'all' || m.to === to || m.from === to;
      })
      .map((m) => ({ ...m }));
  }

  // ===========================================================================
  // Real-time pub/sub
  // ===========================================================================
  function subscribe(fn) {
    subscribers.add(fn);
    return function unsubscribe() {
      subscribers.delete(fn);
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  function sweepExpired() {
    const t = now();
    for (const lock of [...state.locks.values()]) {
      if (lock.expiresAt && lock.expiresAt <= t) {
        emit('lock.expired', { lockId: lock.id, agentId: lock.agentId });
      }
    }
    // Reap dead agents: past the drop horizon an agent is presumed crashed —
    // free its locks NOW (not at lock TTL), reopen its in-flight tasks so the
    // wave can reassign them, and retire its record (token stops working;
    // a returning agent re-registers). Presence demotion (online -> stale)
    // stays lazy in listAgents().
    for (const agent of [...state.agents.values()]) {
      // Grace for agents mid-work (WF-G4): an agent holding a claimed/
      // in-progress task gets DOUBLE the silence horizon before reaping —
      // quiet-but-alive workers deep in an edit are the false-positive case.
      const holdsWork = [...state.tasks.values()].some(
        (task) => task.claimedBy === agent.id && (task.state === 'claimed' || task.state === 'in_progress'),
      );
      const horizon = holdsWork ? presenceDropMs * 2 : presenceDropMs;
      if (t - agent.lastSeen <= horizon) continue;
      // Preserve-on-reap (agent-retrace, Wave 2): capture WHO died and what it was
      // doing BEFORE freeing its locks and dropping it, so a successor can retrace it.
      const filesHeld = [];
      for (const lock of state.locks.values()) {
        if (lock.agentId === agent.id) {
          filesHeld.push({
            paths: [...(lock.paths || [])],
            globs: [...(lock.globs || [])],
            reason: lock.reason || '',
            lockedAt: lock.createdAt,
          });
        }
      }
      const sayTail = state.messages
        .filter((m) => m.from === agent.id)
        .slice(-8)
        .map((m) => ({ at: m.createdAt, body: m.body, channel: m.channel }));
      const dossier = {
        reapedAt: t,
        lastSeenAt: agent.lastSeen,
        agent: {
          handle: agent.handle,
          type: agent.type || '',
          role: agent.role || '',
          model: agent.model || '',
          spawnedBy: agent.spawnedBy || '',
          campaign: agent.campaign || '',
          sessionId: agent.sessionId || '',
        },
        filesHeld,
        sayTail,
      };
      for (const lock of [...state.locks.values()]) {
        if (lock.agentId === agent.id) {
          emit('lock.release', { lockId: lock.id, agentId: agent.id, reaped: true });
        }
      }
      for (const reservation of [...state.reservations.values()]) {
        if (reservation.agentId === agent.id) {
          emit('reservation.release', { reservationId: reservation.id, agentId: agent.id, reaped: true });
        }
      }
      for (const task of [...state.tasks.values()]) {
        if (task.claimedBy === agent.id && (task.state === 'claimed' || task.state === 'in_progress')) {
          const entry = { at: t, by: agent.id, action: 'reaped', state: 'open' };
          const retrace = { ...dossier, checkpoint: task.checkpoint || null };
          emit('task.release', { taskId: task.id, ts: t, entry, retrace });
        }
      }
      emit('agent.drop', { agentId: agent.id, reaped: true });
    }

    // Invariant repair for legacy/corrupt state: old versions could hand a
    // task to a typo or already-gone agent id. No reaper can visit an identity
    // that has no roster record, so sweep those orphan claims directly.
    for (const task of [...state.tasks.values()]) {
      if (!task.claimedBy || !['claimed', 'in_progress'].includes(task.state)) continue;
      if (state.agents.has(task.claimedBy)) continue;
      const previousClaimant = task.claimedBy;
      const entry = {
        at: t,
        by: 'system',
        action: 'reaped',
        state: 'open',
        reason: 'orphan claimant missing from roster',
        previousClaimant,
      };
      emit('task.release', { taskId: task.id, ts: t, entry, orphaned: true });
    }
  }

  function close() {
    snapshot(); // final snapshot (also rotates the journal)
    if (journalFd !== null) {
      fs.closeSync(journalFd);
      journalFd = null;
    }
    subscribers.clear();
  }

  return {
    // presence
    registerAgent,
    retireAgent,
    touch,
    listAgents,
    getAgentByToken,
    findLiveAgentByHandle,
    // locks
    acquireLock,
    releaseLock,
    listLocks,
    // reservations
    reserveFiles,
    releaseReservation,
    listReservations,
    // campaigns
    claimCampaign,
    setCampaignState,
    listCampaigns,
    // tasks
    createTask,
    claimTask,
    claimNextReady,
    setTaskState,
    setTaskCategories,
    checkpointTask,
    handoffTask,
    listTasks,
    // messaging
    postMessage,
    getMessages,
    // pub/sub
    subscribe,
    // lifecycle
    snapshot,
    sweepExpired,
    close,
    // introspection (handy for server /health + tests)
    get lastSeq() {
      return state.seq;
    },
  };
}
