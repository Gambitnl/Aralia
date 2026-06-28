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
    tasks: new Map(), // id -> Task
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
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.handoff'(p) {
      const t = state.tasks.get(p.taskId);
      if (!t) return;
      t.claimedBy = p.toAgentId;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
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
      tasks: [...state.tasks.values()],
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
    for (const t of snap.tasks || []) state.tasks.set(t.id, t);
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
  function registerAgent({ handle, note } = {}) {
    const ts = now();
    const agent = {
      id: genId(),
      handle: handle || 'agent',
      token: genId(),
      registeredAt: ts,
      lastSeen: ts,
      status: 'online',
      note: note || '',
    };
    emit('agent.register', { agent });
    return { ...agent };
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
      out.push({ ...agent, status: computeStatus(agent, t) });
    }
    return out;
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
    return { ok: true, lock: { ...lock } };
  }

  function releaseLock({ lockId, agentId } = {}) {
    const lock = state.locks.get(lockId);
    if (!lock) return { ok: false, error: 'lock not found' };
    if (lock.agentId !== agentId) return { ok: false, error: 'only the holder may release' };
    emit('lock.release', { lockId, agentId });
    return { ok: true };
  }

  function listLocks() {
    return activeLocks().map((l) => ({ ...l }));
  }

  // ===========================================================================
  // Task board
  // ===========================================================================
  function createTask({ agentId, title, body } = {}) {
    const ts = now();
    const task = {
      id: genId(),
      title: title || '',
      body: body || '',
      state: 'open',
      createdBy: agentId,
      claimedBy: null,
      createdAt: ts,
      updatedAt: ts,
      history: [{ at: ts, by: agentId, action: 'created', state: 'open' }],
    };
    emit('task.create', { task });
    return JSON.parse(JSON.stringify(task));
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

  function setTaskState({ taskId, agentId, state: newState } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!TASK_STATES.has(newState)) return { ok: false, error: 'invalid state: ' + newState };
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'state', state: newState };
    emit('task.state', { taskId, agentId, state: newState, ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  function handoffTask({ taskId, agentId, toAgentId } = {}) {
    const t = state.tasks.get(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!toAgentId) return { ok: false, error: 'toAgentId required' };
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'handoff', to: toAgentId, state: t.state };
    emit('task.handoff', { taskId, agentId, toAgentId, ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(state.tasks.get(taskId))) };
  }

  function listTasks({ state: filterState } = {}) {
    const out = [];
    for (const t of state.tasks.values()) {
      if (filterState && t.state !== filterState) continue;
      out.push(JSON.parse(JSON.stringify(t)));
    }
    return out;
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================
  function postMessage({ agentId, to, body } = {}) {
    const ts = now();
    const message = {
      id: genId(),
      seq: state.messageSeq + 1,
      from: agentId,
      to: to || 'all',
      body: body || '',
      createdAt: ts,
    };
    emit('message.post', { message });
    return { ...message };
  }

  function getMessages({ since = 0, to } = {}) {
    return state.messages
      .filter((m) => m.seq > since)
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
    // Presence demotion/drop is computed lazily in listAgents(); nothing to mutate here.
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
    touch,
    listAgents,
    getAgentByToken,
    // locks
    acquireLock,
    releaseLock,
    listLocks,
    // tasks
    createTask,
    claimTask,
    setTaskState,
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
