// tools/agora/client.mjs
// Agora coordination daemon — thin, dependency-free CLI.
//
// Pure Node.js ESM, zero npm dependencies (node: built-ins + the global `fetch`).
// Lets a human OR an agent drive the daemon without curl boilerplate:
//
//   node tools/agora/client.mjs register <handle> [--note "..."]
//   node tools/agora/client.mjs lock src/foo.ts --reason "refactor"
//   node tools/agora/client.mjs watch
//   ... (run with no args / `help` for the full list)
//
// Identity persistence: registration is stored per (host,port) base URL in a small
// JSON file (default `.agent/agora/client-identity.json`, dir configurable via
// AGORA_DIR). Shape: { "<baseUrl>": { agentId, handle, token } }. `register` writes
// it; other commands read the token from it (or accept `--token`).
//
// Base URL precedence: --url > AGORA_URL > http://localhost:4319.
//
// Structured for testing: `run(argv, { env, baseUrl })` returns { code, ... } and
// never calls process.exit; the real CLI bootstrap is guarded behind isMainModule().
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_BASE_URL = 'http://localhost:4319';
const UNCATEGORIZED_TASK_CATEGORY = 'uncategorized';

// ---------------------------------------------------------------------------
// argv parsing — supports `--flag value`, `--flag=value`, and bare positionals.
// Returns { _: [positionals], flags: { name: value | true } }.
// Repeatable flags (paths, globs, to) collect into arrays when given more than once.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name;
      let value;
      if (eq !== -1) {
        name = a.slice(2, eq);
        value = a.slice(eq + 1);
      } else {
        name = a.slice(2);
        const next = argv[i + 1];
        // Treat a following non-flag token as this flag's value; bare flags -> true.
        if (next !== undefined && !next.startsWith('--')) {
          value = next;
          i++;
        } else {
          value = true;
        }
      }
      if (name in flags) {
        if (Array.isArray(flags[name])) flags[name].push(value);
        else flags[name] = [flags[name], value];
      } else {
        flags[name] = value;
      }
    } else {
      positionals.push(a);
    }
  }
  return { _: positionals, flags };
}

function asArray(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// Identity file: { "<baseUrl>": { agentId, handle, token } }
// ---------------------------------------------------------------------------
function identityDir(env) {
  const d = env.AGORA_DIR;
  if (d) return path.isAbsolute(d) ? d : path.resolve(process.cwd(), d);
  return path.join(REPO_ROOT, '.agent', 'agora');
}

function identityPath(env) {
  return path.join(identityDir(env), 'client-identity.json');
}

function loadIdentities(env) {
  try {
    const raw = fs.readFileSync(identityPath(env), 'utf8');
    const json = JSON.parse(raw);
    return json && typeof json === 'object' ? json : {};
  } catch {
    return {};
  }
}

function loadIdentity(env, baseUrl) {
  const all = loadIdentities(env);
  return all[baseUrl] || null;
}

function saveIdentity(env, baseUrl, identity) {
  const all = loadIdentities(env);
  all[baseUrl] = identity;
  const file = identityPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Base URL resolution: explicit override > --url > AGORA_URL > default.
// ---------------------------------------------------------------------------
function resolveBaseUrl({ flags }, env, override) {
  let url = override || flags.url || env.AGORA_URL || DEFAULT_BASE_URL;
  if (typeof url !== 'string') url = DEFAULT_BASE_URL;
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

// Resolve the bearer token: --token wins, else the stored identity for this baseUrl.
function resolveToken({ flags }, env, baseUrl) {
  if (typeof flags.token === 'string') return flags.token;
  const id = loadIdentity(env, baseUrl);
  return id ? id.token : null;
}

// ---------------------------------------------------------------------------
// HTTP via global fetch. Throws a tagged error on connection failure so the
// caller can print the friendly "daemon not reachable" message.
// ---------------------------------------------------------------------------
class AgoraUnreachable extends Error {}

async function api(baseUrl, method, urlPath, { token, body } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(baseUrl + urlPath, { method, headers, body: payload });
  } catch (e) {
    throw new AgoraUnreachable(e.message);
  }
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// Output sink — collected into result.lines so tests can assert on output
// without capturing stdout. Real CLI flushes them to console.
// ---------------------------------------------------------------------------
function makeOut() {
  const lines = [];
  return {
    lines,
    log: (...args) => lines.push(args.join(' ')),
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function relativeTime(ts, nowMs = Date.now()) {
  if (!ts) return '—';
  const diff = nowMs - ts;
  const fut = diff < 0;
  const s = Math.round(Math.abs(diff) / 1000);
  let out;
  if (s < 60) out = `${s}s`;
  else if (s < 3600) out = `${Math.round(s / 60)}m`;
  else if (s < 86400) out = `${Math.round(s / 3600)}h`;
  else out = `${Math.round(s / 86400)}d`;
  return fut ? `in ${out}` : `${out} ago`;
}

function clockTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function statusDot(status) {
  if (status === 'online') return '●';
  if (status === 'stale') return '○';
  return '·';
}

// Build an agentId -> handle map by fetching /agents. Best-effort; returns {}.
async function buildAgentMap(baseUrl) {
  try {
    const r = await api(baseUrl, 'GET', '/agents');
    const map = {};
    for (const a of (r.json && r.json.agents) || []) map[a.id] = a.handle;
    return map;
  } catch {
    return {};
  }
}

function handleFor(map, id) {
  if (id === 'all') return 'all';
  if (!id) return '—';
  return map[id] || id.slice(0, 8);
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

// ---------------------------------------------------------------------------
// Command implementations. Each returns { code } (and may push to out).
// `requireToken` resolves the bearer token or prints a hint + returns code 1.
// ---------------------------------------------------------------------------
function needToken(out, parsed, env, baseUrl) {
  const token = resolveToken(parsed, env, baseUrl);
  if (!token) {
    out.log(`Not registered for ${baseUrl}. Run: register <handle>  (or pass --token <token>)`);
  }
  return token;
}

const USAGE = `Agora client — drive the peer-agent coordination daemon.

Usage: node tools/agora/client.mjs <command> [args] [--flags]

Global flags:
  --url <baseUrl>        daemon base URL (default http://localhost:4319, or AGORA_URL)
  --token <token>        bearer token override (default: stored identity)

Commands:
  onboard <handle> [--note "..."] [--gaps [root]]
                                          START HERE if you are new: register + one-shot
                                          briefing (peers, locks, ready tasks, rules;
                                          --gaps adds the project-tracker open-gap summary)
  register <handle> [--note "..."]       register, store identity, print agentId+handle
  heartbeat [--every <sec>] [--count N | --for <min>]
                                          keep presence fresh during long work (run in bg;
                                          silent >60min = reaped)
  whoami                                  print stored identity for the current base URL
  agents                                  list agents (status, handle, note, last-seen)

  lock <path...> [--glob g...] [--reason "..."] [--ttl <minutes>]
                                          acquire an advisory lock (409 -> conflict + exit 1)
  unlock <lockId|path>                    release a lock you hold (by id OR file path)
  unlock --mine                           release ALL locks you hold
  unlock <lockId> --force                 release a STALE/GONE holder's lock (refused if online)
  locks                                   list active locks

  task new <title> [--body "..."] [--dep <taskId>...] [--priority N] [--ref <gapId|path>...] [--category <name>]
                                          create a task; deps gate readiness, priority orders it
  task claim <taskId>                     claim a task
  task next [--id-only]                   claim the highest-priority READY task (worker pull)
  task state <taskId> <state>             set state (open|claimed|in_progress|blocked|done)
  task done <taskId> [--result "..."]     mark done, recording WHAT was done (evidence)
  task handoff <taskId> <toAgentId>       reassign a task
  tasks [--state s] [--ready] [--category <name>] [--group-by-category]
                                          show the board (--ready: open tasks whose deps are done);
                                          --group-by-category shows optional visual sections by category

  say <body>                              broadcast a message to all (e.g. "WORKFLOW: ...")
  say --to <agentId|handle> <body>        direct message
  inbox [--since <seq>] [--mine]          read messages (prints max seq for next --since)

  watch                                   stream the live SSE event feed (Ctrl-C to stop)
  health                                  probe the daemon
  help                                    this message`;

async function cmdRegister(out, parsed, env, baseUrl) {
  const handle = parsed._[0];
  if (!handle) {
    out.log('Usage: register <handle> [--note "..."]');
    return { code: 1 };
  }
  const note = typeof parsed.flags.note === 'string' ? parsed.flags.note : undefined;
  const r = await api(baseUrl, 'POST', '/agents/register', { body: { handle, note } });
  if (r.status !== 201 || !r.json) {
    out.log(`register failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }
  saveIdentity(env, baseUrl, { agentId: r.json.agentId, handle: r.json.handle, token: r.json.token });
  out.log(`Registered as "${r.json.handle}"  agentId=${r.json.agentId}`);
  out.log(`Identity saved to ${identityPath(env)} for ${baseUrl}`);
  return { code: 0, identity: r.json };
}

function cmdWhoami(out, parsed, env, baseUrl) {
  const id = loadIdentity(env, baseUrl);
  if (!id) {
    out.log(`not registered for ${baseUrl}`);
    return { code: 1 };
  }
  out.log(`handle:  ${id.handle}`);
  out.log(`agentId: ${id.agentId}`);
  out.log(`baseUrl: ${baseUrl}`);
  out.log(`token:   ${id.token}`);
  return { code: 0, identity: id };
}

async function cmdAgents(out, parsed, env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/agents');
  const agents = (r.json && r.json.agents) || [];
  if (agents.length === 0) {
    out.log('no agents registered');
    return { code: 0, agents };
  }
  const now = Date.now();
  for (const a of agents) {
    const note = a.note ? `  — ${a.note}` : '';
    out.log(`${statusDot(a.status)} ${a.handle.padEnd(16)} ${shortId(a.id)}  seen ${relativeTime(a.lastSeen, now)}${note}`);
  }
  return { code: 0, agents };
}

async function cmdLock(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const paths = parsed._.slice(); // all positionals are paths
  const globs = asArray(parsed.flags.glob).filter((g) => typeof g === 'string');
  if (paths.length === 0 && globs.length === 0) {
    out.log('Usage: lock <path...> [--glob g...] [--reason "..."] [--ttl <minutes>]');
    return { code: 1 };
  }
  const body = { paths, globs };
  if (typeof parsed.flags.reason === 'string') body.reason = parsed.flags.reason;
  if (parsed.flags.ttl !== undefined) {
    const mins = Number(parsed.flags.ttl);
    if (Number.isFinite(mins)) body.ttlMs = Math.round(mins * 60000);
  }
  const r = await api(baseUrl, 'POST', '/locks', { token, body });
  if (r.status === 201 && r.json && r.json.lock) {
    // Iteration-2 (Wave-1/2 feedback): --id-only prints just the id so agents
    // can capture it without regex-scraping the human-readable output.
    if (parsed.flags['id-only']) { out.log(r.json.lock.id); return { code: 0, lock: r.json.lock }; }
    out.log(`Lock acquired: ${r.json.lock.id}`);
    const targets = [...(r.json.lock.paths || []), ...(r.json.lock.globs || [])];
    out.log(`  ${targets.join(', ')}`);
    out.log(`  expires ${relativeTime(r.json.lock.expiresAt)}`);
    return { code: 0, lock: r.json.lock };
  }
  if (r.status === 409 && r.json && r.json.conflict) {
    const c = r.json.conflict;
    const map = await buildAgentMap(baseUrl);
    out.log(`CONFLICT: "${c.path}" is locked by ${handleFor(map, c.heldBy)}`);
    if (c.lock) {
      const targets = [...(c.lock.paths || []), ...(c.lock.globs || [])];
      out.log(`  held lock ${c.lock.id} covers: ${targets.join(', ')}`);
      if (c.lock.reason) out.log(`  reason: ${c.lock.reason}`);
      out.log(`  expires ${relativeTime(c.lock.expiresAt)}`);
    }
    return { code: 1, conflict: c };
  }
  if (r.status === 401) {
    out.log('unauthorized — your stored token is invalid; re-run register');
    return { code: 1 };
  }
  out.log(`lock failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
}

async function cmdUnlock(out, parsed, env, baseUrl) {
  // Iteration-1 (Wave-1 workflow feedback): agents kept calling `unlock <path>`
  // and getting 404 because it only accepted a lock id. Now accepts a lock id,
  // a file path you hold, or `--mine` / no-arg to release ALL your locks.
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const arg = parsed._[0];
  const looksLikeId = arg && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(arg);

  // Fast path: an explicit lock id. --force releases a stale/gone holder's
  // lock (the daemon refuses force against an online holder).
  if (looksLikeId) {
    const forceQs = parsed.flags.force === true ? '?force=1' : '';
    const r = await api(baseUrl, 'DELETE', `/locks/${encodeURIComponent(arg)}${forceQs}`, { token });
    if (r.status === 200) { out.log(`Released lock ${arg}${forceQs ? ' (forced)' : ''}`); return { code: 0 }; }
    out.log(`unlock failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Otherwise resolve YOUR locks and release by path (arg given) or all (--mine / no arg).
  const me = loadIdentity(env, baseUrl);
  const myId = me && me.agentId;
  if (!myId) { out.log('unlock: no stored identity — pass a <lockId>, or `register` first'); return { code: 1 }; }
  const releaseAll = !arg || parsed.flags.mine === true || parsed.flags.all === true;
  const lr = await api(baseUrl, 'GET', '/locks');
  const mineLocks = ((lr.json && lr.json.locks) || []).filter((l) => l.agentId === myId);
  const targets = releaseAll
    ? mineLocks
    : mineLocks.filter((l) => [...(l.paths || []), ...(l.globs || [])]
        .some((t) => t === arg || t.endsWith('/' + arg) || t.includes(arg)));
  if (targets.length === 0) {
    out.log(releaseAll ? 'no locks held by you' : `no lock of yours matches "${arg}"`);
    return { code: 0 };
  }
  let ok = 0;
  for (const l of targets) {
    const r = await api(baseUrl, 'DELETE', `/locks/${encodeURIComponent(l.id)}`, { token });
    if (r.status === 200) { ok++; out.log(`Released ${l.id}  (${[...(l.paths || []), ...(l.globs || [])].join(', ')})`); }
    else out.log(`unlock ${l.id} failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  }
  return { code: ok === targets.length ? 0 : 1 };
}

async function cmdLocks(out, parsed, env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/locks');
  const locks = (r.json && r.json.locks) || [];
  if (locks.length === 0) {
    out.log('no active locks');
    return { code: 0, locks };
  }
  const map = await buildAgentMap(baseUrl);
  for (const l of locks) {
    const targets = [...(l.paths || []), ...(l.globs || [])];
    const reason = l.reason ? `  (${l.reason})` : '';
    out.log(`${l.id}  ${handleFor(map, l.agentId).padEnd(16)} ${targets.join(', ')}  expires ${relativeTime(l.expiresAt)}${reason}`);
  }
  return { code: 0, locks };
}

async function cmdTask(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const rest = parsed._.slice(1);
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };

  if (sub === 'new') {
    const title = rest[0];
    if (!title) {
      out.log('Usage: task new <title> [--body "..."] [--dep <taskId>...] [--priority N] [--ref <r>...] [--category <name>]');
      return { code: 1 };
    }
    const body = { title };
    if (typeof parsed.flags.body === 'string') body.body = parsed.flags.body;
    const deps = asArray(parsed.flags.dep).filter((d) => typeof d === 'string');
    if (deps.length) body.deps = deps;
    if (parsed.flags.priority !== undefined) {
      const p = Number(parsed.flags.priority);
      if (Number.isFinite(p)) body.priority = p;
    }
    const refs = asArray(parsed.flags.ref).filter((x) => typeof x === 'string');
    if (refs.length) body.refs = refs;
    if (typeof parsed.flags.category === 'string') body.category = parsed.flags.category;
    const r = await api(baseUrl, 'POST', '/tasks', { token, body });
    if (r.status === 201 && r.json && r.json.task) {
      // Iteration-2: --id-only prints just the task id (no grep needed).
      if (parsed.flags['id-only']) { out.log(r.json.task.id); return { code: 0, task: r.json.task }; }
      out.log(`Task created: ${r.json.task.id}  "${r.json.task.title}"  [${r.json.task.state}]`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task new failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  if (sub === 'claim') {
    const taskId = rest[0];
    if (!taskId) {
      out.log('Usage: task claim <taskId>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(taskId)}/claim`, { token });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`Claimed ${r.json.task.id}  [${r.json.task.state}]`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task claim failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Worker-pull: grab the top-priority ready task in one call.
  if (sub === 'next') {
    const r = await api(baseUrl, 'POST', '/tasks/claim-next', { token });
    if (r.status === 200 && r.json) {
      if (!r.json.task) { out.log('no ready tasks'); return { code: 0, task: null }; }
      if (parsed.flags['id-only']) { out.log(r.json.task.id); return { code: 0, task: r.json.task }; }
      out.log(`Claimed ${r.json.task.id}  "${r.json.task.title}"  [${r.json.task.state}]`);
      if (r.json.task.body) out.log(`  ${r.json.task.body}`);
      if ((r.json.task.refs || []).length) out.log(`  refs: ${r.json.task.refs.join(', ')}`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task next failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  if (sub === 'state') {
    const taskId = rest[0];
    const state = rest[1];
    if (!taskId || !state) {
      out.log('Usage: task state <taskId> <open|claimed|in_progress|blocked|done>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(taskId)}/state`, { token, body: { state } });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`${r.json.task.id} -> [${r.json.task.state}]`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task state failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  if (sub === 'handoff') {
    const taskId = rest[0];
    let toAgentId = rest[1];
    if (!taskId || !toAgentId) {
      out.log('Usage: task handoff <taskId> <toAgentId|handle>');
      return { code: 1 };
    }
    // Allow a handle to be passed; resolve to agentId if it matches.
    const map = await buildAgentMap(baseUrl);
    if (!map[toAgentId]) {
      const byHandle = Object.entries(map).find(([, h]) => h === toAgentId);
      if (byHandle) toAgentId = byHandle[0];
    }
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(taskId)}/handoff`, { token, body: { toAgentId } });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`${r.json.task.id} handed off to ${handleFor(map, r.json.task.claimedBy)}`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task handoff failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Iteration-1 (Wave-1 feedback): agents reached for `task done <id>` repeatedly;
  // alias it (and `complete`) to the state transition so it just works.
  if (sub === 'done' || sub === 'complete') {
    const taskId = rest[0];
    if (!taskId) { out.log('Usage: task done <taskId> [--result "what was done + proof"]'); return { code: 1 }; }
    const body = { state: 'done' };
    if (typeof parsed.flags.result === 'string') body.result = parsed.flags.result;
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(taskId)}/state`, { token, body });
    if (r.status === 200 && r.json && r.json.task) { out.log(`${r.json.task.id} -> [${r.json.task.state}]`); return { code: 0, task: r.json.task }; }
    out.log(`task done failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  out.log(`unknown task subcommand "${sub}". Use: task new|claim|next|state|done|handoff`);
  return { code: 1 };
}

const STATE_ORDER = ['open', 'claimed', 'in_progress', 'blocked', 'done'];

async function cmdTasks(out, parsed, env, baseUrl) {
  const stateFilter = typeof parsed.flags.state === 'string' ? parsed.flags.state : undefined;
  const categoryFilter = typeof parsed.flags.category === 'string' ? parsed.flags.category : undefined;
  const groupByCategory = parsed.flags['group-by-category'] === true;
  const ready = parsed.flags.ready === true;
  const params = [];
  if (stateFilter) params.push(`state=${encodeURIComponent(stateFilter)}`);
  if (ready) params.push('ready=1');
  if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const r = await api(baseUrl, 'GET', `/tasks${qs}`);
  const tasks = (r.json && r.json.tasks) || [];
  if (tasks.length === 0) {
    out.log(ready ? 'no ready tasks' : stateFilter ? `no tasks in state "${stateFilter}"` : 'no tasks');
    return { code: 0, tasks };
  }
  const map = await buildAgentMap(baseUrl);
  const order = [...STATE_ORDER];
  if (ready) {
    if (groupByCategory) {
      const groups = new Map();
      for (const t of tasks) {
        const cat = t.category || UNCATEGORIZED_TASK_CATEGORY || 'uncategorized';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(t);
      }
      const categoryOrder = [...groups.keys()].sort();
      for (const cat of categoryOrder) {
        out.log(`[${cat}]`);
        for (const t of groups.get(cat)) {
          const pri = t.priority ? `  p${t.priority}` : '';
          const refs = (t.refs || []).length ? `  refs: ${t.refs.join(', ')}` : '';
          const catLabel = t.category ? `  category: ${t.category}` : '';
          out.log(`  ${shortId(t.id)}  ${t.title}${pri}${refs}${catLabel}`);
        }
      }
      return { code: 0, tasks };
    }

    // Ready view: already priority-ordered by the daemon — show it as a queue.
    for (const t of tasks) {
      const pri = t.priority ? `  p${t.priority}` : '';
      const refs = (t.refs || []).length ? `  refs: ${t.refs.join(', ')}` : '';
      const cat = t.category ? `  category: ${t.category}` : '';
      out.log(`${shortId(t.id)}  ${t.title}${pri}${refs}${cat}`);
    }
    return { code: 0, tasks };
  }
  const groups = new Map();
  for (const t of tasks) {
    if (!groups.has(t.state)) groups.set(t.state, []);
    groups.get(t.state).push(t);
  }
  if (groupByCategory) {
    const grouped = new Map();
    for (const st of order) {
      const tasksByState = groups.get(st) || [];
      for (const t of tasksByState) {
        const cat = t.category || UNCATEGORIZED_TASK_CATEGORY || 'uncategorized';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat).push(t);
      }
    }
    const categoryOrder = [...grouped.keys()].sort();
    for (const cat of categoryOrder) {
      out.log(`[${cat}]`);
      const byState = new Map();
      for (const s of order) byState.set(s, []);
      for (const t of grouped.get(cat) || []) {
        const arr = byState.get(t.state);
        if (arr) arr.push(t);
      }
      for (const st of order) {
        const section = byState.get(st);
        if (!section || !section.length) continue;
        out.log(`  [${st}]`);
        for (const t of section) {
          const who = t.claimedBy ? `  @${handleFor(map, t.claimedBy)}` : '';
          const blocked = (t.deps || []).length && t.state === 'open' ? `  (deps: ${t.deps.map(shortId).join(', ')})` : '';
          const category = t.category ? `  category: ${t.category}` : '';
          out.log(`    ${shortId(t.id)}  ${t.title}${who}${blocked}${category}`);
        }
      }
    }
    return { code: 0, tasks };
  }
  const filteredOrder = [...STATE_ORDER.filter((s) => groups.has(s)), ...[...groups.keys()].filter((s) => !STATE_ORDER.includes(s))];
  for (const st of filteredOrder) {
    out.log(`[${st}]`);
    for (const t of groups.get(st)) {
      const who = t.claimedBy ? `  @${handleFor(map, t.claimedBy)}` : '';
      const blocked = (t.deps || []).length && t.state === 'open' ? `  (deps: ${t.deps.map(shortId).join(', ')})` : '';
      const category = t.category ? `  category: ${t.category}` : '';
      out.log(`  ${shortId(t.id)}  ${t.title}${who}${blocked}${category}`);
      if (t.state === 'done' && t.result) out.log(`      result: ${t.result}`);
    }
  }
  return { code: 0, tasks };
}

async function cmdSay(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const body = parsed._.join(' ');
  if (!body) {
    out.log('Usage: say <body>   |   say --to <agentId|handle> <body>');
    return { code: 1 };
  }
  let to = 'all';
  if (typeof parsed.flags.to === 'string') {
    to = parsed.flags.to;
    // Resolve a handle to an agentId.
    const map = await buildAgentMap(baseUrl);
    if (!map[to]) {
      const byHandle = Object.entries(map).find(([, h]) => h === to);
      if (byHandle) to = byHandle[0];
    }
  }
  const r = await api(baseUrl, 'POST', '/messages', { token, body: { to, body } });
  if (r.status === 201 && r.json && r.json.message) {
    const map = await buildAgentMap(baseUrl);
    out.log(`Sent (seq ${r.json.message.seq}) to ${handleFor(map, r.json.message.to)}`);
    return { code: 0, message: r.json.message };
  }
  out.log(`say failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
}

async function cmdInbox(out, parsed, env, baseUrl) {
  const since = parsed.flags.since !== undefined ? Number(parsed.flags.since) || 0 : 0;
  const params = [];
  if (since) params.push(`since=${since}`);
  let token;
  if (parsed.flags.mine) {
    params.push('to=me');
    token = needToken(out, parsed, env, baseUrl);
    if (!token) return { code: 1 };
  }
  const qs = params.length ? `?${params.join('&')}` : '';
  const r = await api(baseUrl, 'GET', `/messages${qs}`, { token });
  const messages = (r.json && r.json.messages) || [];
  if (messages.length === 0) {
    out.log('no messages');
    return { code: 0, messages, maxSeq: since };
  }
  const map = await buildAgentMap(baseUrl);
  let maxSeq = since;
  for (const m of messages) {
    if (m.seq > maxSeq) maxSeq = m.seq;
    const toLabel = m.to === 'all' ? 'all' : handleFor(map, m.to);
    out.log(`[${m.seq}] ${clockTime(m.createdAt)}  ${handleFor(map, m.from)} -> ${toLabel}: ${m.body}`);
  }
  out.log(`(max seq ${maxSeq} — pass --since ${maxSeq} next time)`);
  return { code: 0, messages, maxSeq };
}

// ---------------------------------------------------------------------------
// watch — consume the SSE stream via node:http/https (not fetch, so we can read
// the text/event-stream incrementally). Parses `id:` / `event:` / `data:` lines
// per the SSE spec (event terminated by a blank line), resolves agent ids to
// handles where possible, and prints a one-line summary per event. Resolves only
// when the connection ends or `opts.maxEvents` events have been printed (used by
// tests). Ctrl-C in the real CLI tears down the request cleanly.
// ---------------------------------------------------------------------------
function summarizeEvent(type, data, map) {
  const h = (id) => handleFor(map, id);
  switch (type) {
    case 'hello':
      return `connected (lastSeq ${data.lastSeq}, ${(data.snapshot && data.snapshot.agents || []).length} agents online)`;
    case 'agent.register':
      return `${data.agent ? data.agent.handle : '?'} registered`;
    case 'agent.touch':
      return `${h(data.agentId)} heartbeat`;
    case 'agent.drop':
      return `${h(data.agentId)} dropped`;
    case 'lock.acquire':
      return `${h(data.lock && data.lock.agentId)} locked ${[...(data.lock.paths || []), ...(data.lock.globs || [])].join(', ')}`;
    case 'lock.release':
      return `${h(data.agentId)} released lock ${shortId(data.lockId)}`;
    case 'lock.expired':
      return `lock ${shortId(data.lockId)} expired`;
    case 'task.create':
      return `${h(data.task && data.task.createdBy)} created task "${data.task ? data.task.title : ''}"`;
    case 'task.claim':
      return `${h(data.agentId)} claimed task ${shortId(data.taskId)}`;
    case 'task.state':
      return `${h(data.agentId)} set task ${shortId(data.taskId)} -> ${data.state}`;
    case 'task.handoff':
      return `${h(data.agentId)} handed task ${shortId(data.taskId)} to ${h(data.toAgentId)}`;
    case 'message.post':
      return `${h(data.message && data.message.from)} -> ${data.message && data.message.to === 'all' ? 'all' : h(data.message && data.message.to)}: ${data.message ? data.message.body : ''}`;
    default:
      return JSON.stringify(data);
  }
}

async function cmdWatch(out, parsed, env, baseUrl, opts = {}) {
  const map = await buildAgentMap(baseUrl);
  const url = new URL(baseUrl + '/events');
  const lib = url.protocol === 'https:' ? https : http;
  const maxEvents = opts.maxEvents || Infinity;
  const timeoutMs = opts.timeoutMs || 0;

  return new Promise((resolve) => {
    let settled = false;
    let count = 0;
    let buffer = '';
    let req;
    let timer;

    function finish(code) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (req) req.destroy();
      } catch {
        /* noop */
      }
      resolve({ code, events: count });
    }

    function handleBlock(block) {
      let event = 'message';
      const dataLines = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue; // comment / ping
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        // `id:` lines are accepted but not needed for display.
      }
      if (dataLines.length === 0) return;
      let data = {};
      try {
        data = JSON.parse(dataLines.join('\n'));
      } catch {
        data = {};
      }
      // Keep the agent map fresh as new agents register.
      if (event === 'agent.register' && data.agent) map[data.agent.id] = data.agent.handle;
      if (event === 'hello' && data.snapshot) {
        for (const a of data.snapshot.agents || []) map[a.id] = a.handle;
      }
      out.log(`${clockTime(data.ts || Date.now())}  ${event.padEnd(14)} ${summarizeEvent(event, data, map)}`);
      count++;
      if (opts.onEvent) opts.onEvent(event, data);
      if (count >= maxEvents) finish(0);
    }

    req = lib.get(url, (res) => {
      if (res.statusCode !== 200) {
        out.log(`watch: unexpected status ${res.statusCode}`);
        res.resume();
        finish(1);
        return;
      }
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (block.trim()) handleBlock(block);
        }
      });
      res.on('end', () => finish(0));
      res.on('error', () => finish(1));
    });
    req.on('error', (e) => {
      if (!settled) {
        out.log(friendlyUnreachable(baseUrl, e.message));
        finish(1);
      }
    });

    if (timeoutMs > 0) timer = setTimeout(() => finish(0), timeoutMs);
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => finish(0), { once: true });
    }
    // Expose a stopper for the real CLI's SIGINT handler.
    if (opts.onReady) opts.onReady(() => finish(0));
  });
}

async function cmdHealth(out, parsed, env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/health');
  if (r.status !== 200 || !r.json) {
    out.log(`health failed (${r.status})`);
    return { code: 1 };
  }
  const h = r.json;
  out.log(`ok:       ${h.ok}`);
  out.log(`version:  ${h.version}`);
  out.log(`uptime:   ${h.uptime}s`);
  if (h.port != null) out.log(`port:     ${h.port}`);
  out.log(`lastSeq:  ${h.lastSeq}`);
  if (h.counts) {
    out.log(`counts:   agents=${h.counts.agents} locks=${h.counts.locks} tasks=${h.counts.tasks} messages=${h.counts.messages}`);
  }
  return { code: 0, health: h };
}

// ---------------------------------------------------------------------------
// onboard — the fresh-agent front door: register + one-shot situational
// briefing (peers, locks, ready queue, optionally open tracker gaps) + the
// coordination rules. One command instead of three prose docs.
// ---------------------------------------------------------------------------
const ONBOARD_RULES = `THE RULES (the whole contract):
  1. Your AGORA_DIR must be UNIQUE to you (e.g. .agent/agora/ids/<your-handle>) — shared
     dirs overwrite each other's identity.
  2. lock BEFORE editing any shared file; a 409 CONFLICT is a HARD STOP on that file.
  3. HEARTBEAT during long work (client.mjs heartbeat --every 600 in the background, or any
     authed call at least every ~30 min). Silent >60 min = reaped: locks freed, your claimed
     tasks reopened, token retired.
  4. Pull work with \`task next\`; finish with \`task done <id> --result "<files + proof>"\` —
     the result on the board is how the orchestrator learns what you did.
  5. When done: \`unlock --mine\`, then \`say "WORKFLOW: <friction or none>"\` — and register
     real workflow friction as a row in tools/agora/WORKFLOW_GAPS.md (schema in the file).
  6. No git commits/resets/branches/worktrees unless YOUR task says so.
Full API: tools/agora/PROTOCOL.md · campaign loop: tools/agora/ORCHESTRATOR.md ·
agent fleet registry: node tools/agora/orchestrate.mjs agents`;

async function cmdOnboard(out, parsed, env, baseUrl) {
  const reg = await cmdRegister(out, parsed, env, baseUrl);
  if (reg.code !== 0) return reg;
  const token = resolveToken(parsed, env, baseUrl);
  const map = await buildAgentMap(baseUrl);
  const myId = reg.identity.agentId;

  out.log('');
  out.log('=== WHO IS HERE ===');
  const ar = await api(baseUrl, 'GET', '/agents');
  const others = ((ar.json && ar.json.agents) || []).filter((a) => a.id !== myId);
  if (!others.length) out.log('  (you are alone)');
  for (const a of others) out.log(`  ${statusDot(a.status)} ${a.handle.padEnd(20)} ${a.note || ''}`);

  out.log('');
  out.log('=== ACTIVE LOCKS (files you must NOT touch) ===');
  const lr = await api(baseUrl, 'GET', '/locks');
  const locks = (lr.json && lr.json.locks) || [];
  if (!locks.length) out.log('  (none)');
  for (const l of locks) {
    out.log(`  ${handleFor(map, l.agentId).padEnd(20)} ${[...(l.paths || []), ...(l.globs || [])].join(', ')}  (${l.reason || 'no reason'})`);
  }

  out.log('');
  out.log('=== READY TASKS (claim with: task next) ===');
  const tr = await api(baseUrl, 'GET', '/tasks?ready=1', { token });
  const ready = (tr.json && tr.json.tasks) || [];
  if (!ready.length) out.log('  (queue is empty)');
  for (const t of ready.slice(0, 8)) {
    out.log(`  ${shortId(t.id)}  ${t.title}${t.priority ? `  p${t.priority}` : ''}${(t.refs || []).length ? `  refs: ${t.refs.join(', ')}` : ''}`);
  }
  if (ready.length > 8) out.log(`  … and ${ready.length - 8} more`);

  // Tracker intake is optional (scanning docs/projects costs a moment).
  if (parsed.flags.gaps !== undefined) {
    const root = typeof parsed.flags.gaps === 'string' ? parsed.flags.gaps : 'docs/projects';
    out.log('');
    out.log(`=== OPEN GAPS (project tracker, ${root}) ===`);
    try {
      const { indexGaps, OPEN_STATUSES } = await import('./gapIndex.mjs');
      const gaps = indexGaps({ root, openOnly: true });
      const byProject = new Map();
      for (const g of gaps) byProject.set(g.project, (byProject.get(g.project) || 0) + 1);
      out.log(`  ${gaps.length} open gap(s) across ${byProject.size} project(s); top:`);
      const top = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      for (const [project, n] of top) out.log(`    ${String(n).padStart(3)}  ${project}`);
      out.log('  Full intake: node tools/agora/gapIndex.mjs --open-only');
      void OPEN_STATUSES; // (re-exported for callers; not needed here)
    } catch (e) {
      out.log(`  gap index unavailable: ${e.message}`);
    }
  }

  out.log('');
  out.log(ONBOARD_RULES);
  return { code: 0, identity: reg.identity };
}

// ---------------------------------------------------------------------------
// heartbeat — keep presence fresh during long work so the reaper (60 min
// silent) never fires on a live agent. Run in the background:
//   node tools/agora/client.mjs heartbeat --every 600 &
// ---------------------------------------------------------------------------
async function cmdHeartbeat(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const everySec = Number(parsed.flags.every) > 0 ? Number(parsed.flags.every) : 600;
  const count = Number(parsed.flags.count) > 0 ? Number(parsed.flags.count) : null;
  const forMin = Number(parsed.flags.for) > 0 ? Number(parsed.flags.for) : null;
  const endAt = forMin ? Date.now() + forMin * 60000 : null;

  let beats = 0;
  for (;;) {
    const r = await api(baseUrl, 'POST', '/agents/heartbeat', { token });
    if (r.status !== 200) {
      out.log(`heartbeat failed (${r.status}): ${r.json ? r.json.error : r.text} — re-register if your token was reaped`);
      return { code: 1, beats };
    }
    beats++;
    if (count && beats >= count) break;
    if (endAt && Date.now() >= endAt) break;
    if (!count && !endAt && beats === 1) out.log(`heartbeating every ${everySec}s (Ctrl-C to stop)`);
    await new Promise((resolve) => setTimeout(resolve, everySec * 1000));
  }
  out.log(`${beats} heartbeat(s) sent`);
  return { code: 0, beats };
}

function friendlyUnreachable(baseUrl, detail) {
  return `Agora daemon not reachable at ${baseUrl} — is it running? (npm run agora)` + (detail ? `\n  (${detail})` : '');
}

// ---------------------------------------------------------------------------
// Dispatcher. `run(argv, { env, baseUrl })` -> Promise<{ code, ... }>.
// Never calls process.exit; returns an out-buffer in result.lines.
// ---------------------------------------------------------------------------
export async function run(argv, { env = process.env, baseUrl: baseOverride, watchOpts } = {}) {
  const out = makeOut();
  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const baseUrl = resolveBaseUrl(parsed, env, baseOverride);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    out.log(USAGE);
    return { code: 0, lines: out.lines };
  }

  // whoami is purely local (no network).
  if (command === 'whoami') {
    const res = cmdWhoami(out, parsed, env, baseUrl);
    return { ...res, lines: out.lines };
  }

  try {
    let res;
    switch (command) {
      case 'register':
        res = await cmdRegister(out, parsed, env, baseUrl);
        break;
      case 'onboard':
        res = await cmdOnboard(out, parsed, env, baseUrl);
        break;
      case 'heartbeat':
        res = await cmdHeartbeat(out, parsed, env, baseUrl);
        break;
      case 'agents':
        res = await cmdAgents(out, parsed, env, baseUrl);
        break;
      case 'lock':
        res = await cmdLock(out, parsed, env, baseUrl);
        break;
      case 'unlock':
        res = await cmdUnlock(out, parsed, env, baseUrl);
        break;
      case 'locks':
        res = await cmdLocks(out, parsed, env, baseUrl);
        break;
      case 'task':
        res = await cmdTask(out, parsed, env, baseUrl);
        break;
      case 'tasks':
        res = await cmdTasks(out, parsed, env, baseUrl);
        break;
      case 'say':
        res = await cmdSay(out, parsed, env, baseUrl);
        break;
      case 'inbox':
        res = await cmdInbox(out, parsed, env, baseUrl);
        break;
      case 'watch':
        res = await cmdWatch(out, parsed, env, baseUrl, watchOpts || {});
        break;
      case 'health':
        res = await cmdHealth(out, parsed, env, baseUrl);
        break;
      default:
        out.log(`unknown command "${command}"`);
        out.log('Run with no arguments or `help` for usage.');
        res = { code: 1 };
    }
    return { ...res, lines: out.lines };
  } catch (e) {
    if (e instanceof AgoraUnreachable) {
      out.log(friendlyUnreachable(baseUrl, e.message));
      return { code: 1, lines: out.lines, unreachable: true };
    }
    out.log(`error: ${e.message}`);
    return { code: 1, lines: out.lines };
  }
}

// ---------------------------------------------------------------------------
// CLI bootstrap — only when executed directly (not imported for tests).
// ---------------------------------------------------------------------------
export function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invoked === __filename;
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  // For `watch`, wire SIGINT to the stopper so Ctrl-C ends the stream cleanly.
  if (argv[0] === 'watch') {
    let stop = null;
    const watchOpts = { onReady: (s) => { stop = s; } };
    const onSigint = () => {
      if (stop) stop();
      else process.exit(0);
    };
    process.on('SIGINT', onSigint);
    run(argv, { watchOpts }).then((res) => {
      for (const line of res.lines) console.log(line);
      process.exit(res.code || 0);
    });
  } else {
    run(argv).then((res) => {
      for (const line of res.lines) console.log(line);
      process.exit(res.code || 0);
    });
  }
}
