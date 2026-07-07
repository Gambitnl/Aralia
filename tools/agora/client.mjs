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
// Set AGORA_AGENT_ID=<unique key> to scope the file per agent
// (`client-identity.<key>.json`) so concurrent agents in one checkout don't share
// an identity — a shared identity means `unlock --mine` releases the OTHER
// agent's locks.
//
// Base URL precedence: --url > AGORA_URL > http://localhost:4319.
//
// Structured for testing: `run(argv, { env, baseUrl })` returns { code, ... } and
// never calls process.exit; the real CLI bootstrap is guarded behind isMainModule().
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
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

// Per-agent identity scoping: two concurrent agents in ONE checkout used to share
// client-identity.json, so `unlock --mine` from one released the OTHER's locks
// (observed 2026-07-04). Set AGORA_AGENT_ID to any unique string (session id,
// PID+suffix, handle) and this process gets its own identity file. Unset = the
// legacy shared path, so single-agent use is unchanged.
function identityPath(env) {
  const agentKey = typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim()
    ? env.AGORA_AGENT_ID.trim().replace(/[^A-Za-z0-9._-]/g, '_')
    : null;
  const file = agentKey ? `client-identity.${agentKey}.json` : 'client-identity.json';
  return path.join(identityDir(env), file);
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

Env:
  AGORA_AGENT_ID         unique per-agent key; scopes the stored identity file so
                         concurrent agents in one checkout don't share locks/identity
  AGORA_DIR              identity dir override (default .agent/agora)
  AGORA_URL              daemon base URL override

Commands:
  onboard <handle> [--note "..."] [--gaps [root]]
                                          START HERE if you are new: register + one-shot
                                          briefing (peers, locks, ready tasks, rules;
                                          --gaps adds the project-tracker open-gap summary)
  register <handle> [--note "..."] [--model <m>] [--session <id>] [--role worker|orchestrator|master|human]
                                          register, store identity, print agentId+handle
                                          (409 if a live agent already holds <handle>);
                                          --model = which model you are (orchestrator stamps it),
                                          --session/--thread/--conversation = your own thread id
  register --random [base] [--note "..."] auto-claim a free unique handle (solo agents)
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
  reserve <path...> [--glob g...] [--reason "..."]
                                          claim FIFO dibs for future lock access
  unreserve <reservationId|path>           leave a reservation queue you hold
  reservations                            list active file-access reservation queues

  campaign claim <id> [--role lead|deputy] [--lead <id>] [--scope "..."] [--path <p>...] [--glob <g>...] [--wave <name>]
                                          declare an orchestrator campaign before seeding a wave;
                                          overlapping lead domains fail before tasks are created
  campaign state <id> <active|blocked|done>
                                          update a campaign lifecycle state
  campaigns [--state active|blocked|done] list campaign governance records

  task new <title> [--body "..."] [--dep <taskId>...] [--priority N] [--ref <gapId|path>...] [--category <name>] [--campaign <id>] [--wave <name>]
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
  say --channel command <body>            post on the command channel (orchestrator/master/human
                                          roles only — register with --role <r> to qualify)
  inbox [--since <seq>] [--mine] [--channel main|command|all]
                                          read messages (default channel: main; prints max seq
                                          for next --since)

  watch                                   stream the live SSE event feed (Ctrl-C to stop)
  health                                  probe the daemon
  help                                    this message`;

// A collision-resistant handle for a solo agent that has no name assigned to it
// (`register --random` / bare `register`). The daemon still enforces uniqueness;
// the random suffix just makes a clash astronomically unlikely on the first try.
function randomHandle(base) {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${(base && String(base)) || 'agent'}-${suffix}`;
}

async function cmdRegister(out, parsed, env, baseUrl) {
  // Solo agents can't reliably invent a unique name, so `--random` (or omitting
  // the handle) lets the client generate one and CLAIM it against the daemon,
  // retrying if some other agent grabbed it first. Orchestrated workers still
  // pass an explicit handle their parent allocated.
  const wantRandom = parsed.flags.random === true || parsed._[0] === undefined;
  const base = typeof parsed.flags.random === 'string' ? parsed.flags.random : parsed._[0];
  if (!wantRandom && !parsed._[0]) {
    out.log('Usage: register <handle> [--note "..."]   |   register --random [base]');
    return { code: 1 };
  }
  const note = typeof parsed.flags.note === 'string' ? parsed.flags.note : undefined;
  // `--allow-duplicate` opts out of the daemon's handle-claim check (legacy flows).
  const unique = parsed.flags['allow-duplicate'] === true ? false : undefined;
  // Optional provenance. --model is usually stamped by the orchestrator at launch;
  // the agent's own conversation/thread id accepts several flag names.
  const model = typeof parsed.flags.model === 'string' ? parsed.flags.model
    : (typeof env.AGORA_MODEL === 'string' && env.AGORA_MODEL) ? env.AGORA_MODEL : undefined;
  const sessionId = typeof parsed.flags.session === 'string' ? parsed.flags.session
    : typeof parsed.flags.thread === 'string' ? parsed.flags.thread
    : typeof parsed.flags.conversation === 'string' ? parsed.flags.conversation
    : (typeof env.AGORA_SESSION_ID === 'string' && env.AGORA_SESSION_ID) ? env.AGORA_SESSION_ID : undefined;

  // Coordination role: default worker; orchestrators/master/human declare
  // themselves to unlock the command channel.
  const role = typeof parsed.flags.role === 'string' ? parsed.flags.role : undefined;

  // Identity provenance (Wave 1). Usually stamped by the spawner at launch; a root
  // agent (a person-opened chat) sets its own.
  const type = typeof parsed.flags.type === 'string' ? parsed.flags.type : undefined;
  const spawnedBy = typeof parsed.flags['spawned-by'] === 'string' ? parsed.flags['spawned-by'] : undefined;
  const campaign = typeof parsed.flags.campaign === 'string' ? parsed.flags.campaign : undefined;
  const cwd = typeof parsed.flags.cwd === 'string' ? parsed.flags.cwd : undefined;

  const maxTries = wantRandom ? 6 : 1;
  let last = null;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const handle = wantRandom ? randomHandle(base) : parsed._[0];
    const r = await api(baseUrl, 'POST', '/agents/register', { body: { handle, note, unique, model, sessionId, role, type, spawnedBy, campaign, cwd } });
    last = r;
    if (r.status === 201 && r.json) {
      saveIdentity(env, baseUrl, {
        agentId: r.json.agentId,
        handle: r.json.handle,
        token: r.json.token,
        registeredAt: r.json.registeredAt,
        model: r.json.model || '',
        sessionId: r.json.sessionId || '',
      });
      out.log(`Registered as "${r.json.handle}"  agentId=${r.json.agentId}`);
      out.log(`Identity saved to ${identityPath(env)} for ${baseUrl}`);
      // A stable per-session key is what ties this agent's LATER cli invocations
      // to this identity. If the caller didn't set one, tell them to pin it — the
      // daemon-claimed name is the natural value.
      if (!(typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim())) {
        out.log(`TIP: export AGORA_AGENT_ID="${r.json.handle}" so your next commands reuse THIS identity`);
      }
      return { code: 0, identity: r.json };
    }
    if (r.status === 409) {
      if (wantRandom) continue; // name got taken between tries — spin a new one
      out.log(`register failed: ${r.json ? r.json.error : 'handle already claimed'}`);
      out.log('  Pick a different handle, or `register --random` to auto-claim a free one.');
      return { code: 1, conflict: r.json && r.json.conflict };
    }
    break; // non-409 error: stop and report below
  }
  out.log(`register failed (${last ? last.status : '?'}): ${last && last.json ? last.json.error : last ? last.text : 'no response'}`);
  return { code: 1 };
}

function cmdWhoami(out, parsed, env, baseUrl) {
  const id = loadIdentity(env, baseUrl);
  if (!id) {
    out.log(`not registered for ${baseUrl}`);
    return { code: 1 };
  }
  out.log(`handle:    ${id.handle}`);
  out.log(`agentId:   ${id.agentId}`);
  out.log(`baseUrl:   ${baseUrl}`);
  if (id.model) out.log(`model:     ${id.model}`);
  if (id.sessionId) out.log(`sessionId: ${id.sessionId}`);
  if (id.registeredAt) out.log(`checkedIn: ${new Date(id.registeredAt).toISOString()}`);
  out.log(`token:     ${id.token}`);
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
    const model = a.model ? `  [${a.model}]` : '';
    const inFor = a.registeredAt ? `  in ${relativeTime(a.registeredAt, now)}` : '';
    const note = a.note ? `  — ${a.note}` : '';
    out.log(`${statusDot(a.status)} ${a.handle.padEnd(16)} ${shortId(a.id)}${model}  seen ${relativeTime(a.lastSeen, now)}${inFor}${note}`);
  }
  return { code: 0, agents };
}

// whois <handle> — show one agent's full identity record.
async function cmdWhois(out, parsed, _env, baseUrl) {
  const handle = parsed._[0];
  if (!handle) {
    out.log('Usage: whois <handle>');
    return { code: 1 };
  }
  const r = await api(baseUrl, 'GET', '/agents');
  const agents = (r.json && r.json.agents) || [];
  const a = agents.find((x) => x.handle === handle);
  if (!a) {
    out.log(`no agent with handle "${handle}"`);
    return { code: 1 };
  }
  const row = (label, value, fallback) => out.log(`${label.padEnd(11)} ${value || fallback}`);
  row('handle:', a.handle, '');
  row('type:', a.type, '(unset)');
  row('role:', a.role, '(unset)');
  row('model:', a.model, '(unset)');
  row('spawnedBy:', a.spawnedBy, '(root)');
  row('campaign:', a.campaign, '(unset)');
  row('sessionId:', a.sessionId, '(unset)');
  row('cwd:', a.cwd, '(unset)');
  row('status:', a.status, '');
  row('handle ok:', a.handleValid ? 'yes' : 'no', '');
  row('agentId:', a.id, '');
  return { code: 0, agent: a };
}

// lineage <handle> — walk spawnedBy up to the root and print it root-first.
async function cmdLineage(out, parsed, _env, baseUrl) {
  const handle = parsed._[0];
  if (!handle) {
    out.log('Usage: lineage <handle>');
    return { code: 1 };
  }
  const r = await api(baseUrl, 'GET', '/agents');
  const agents = (r.json && r.json.agents) || [];
  const byHandle = new Map(agents.map((a) => [a.handle, a]));
  const start = byHandle.get(handle);
  if (!start) {
    out.log(`no agent with handle "${handle}"`);
    return { code: 1 };
  }
  const chain = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur.handle)) {
    seen.add(cur.handle);
    chain.push(cur);
    const parent = cur.spawnedBy;
    if (!parent) break;
    const next = byHandle.get(parent);
    if (!next) {
      chain.push({ handle: parent, gone: true });
      break;
    }
    cur = next;
  }
  chain.reverse(); // root first
  chain.forEach((a, i) => {
    const arrow = i === 0 ? '' : `${'  '.repeat(i)}└─ `;
    const tag = a.gone ? ' (gone — not on roster)' : a.type ? ` [${a.type}]` : '';
    out.log(`${arrow}${a.handle}${tag}`);
  });
  return { code: 0, chain };
}

// tree — the fleet as a spawn tree, grouped by campaign.
async function cmdTree(out, _parsed, _env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/agents');
  const agents = (r.json && r.json.agents) || [];
  if (agents.length === 0) {
    out.log('no agents registered');
    return { code: 0 };
  }
  const byCampaign = new Map();
  for (const a of agents) {
    const c = a.campaign || '(no campaign)';
    if (!byCampaign.has(c)) byCampaign.set(c, []);
    byCampaign.get(c).push(a);
  }
  for (const [campaign, members] of byCampaign) {
    out.log(`# ${campaign}`);
    const inCampaign = new Set(members.map((m) => m.handle));
    const childrenOf = new Map();
    const roots = [];
    for (const m of members) {
      if (m.spawnedBy && inCampaign.has(m.spawnedBy)) {
        if (!childrenOf.has(m.spawnedBy)) childrenOf.set(m.spawnedBy, []);
        childrenOf.get(m.spawnedBy).push(m);
      } else {
        roots.push(m);
      }
    }
    const printNode = (a, depth) => {
      out.log(`${'  '.repeat(depth + 1)}${a.handle}${a.type ? ` [${a.type}]` : ''}`);
      for (const child of childrenOf.get(a.handle) || []) printNode(child, depth + 1);
    };
    for (const root of roots) printNode(root, 0);
  }
  return { code: 0 };
}

// retire — clean voluntary exit for the current agent.
async function cmdRetire(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const note = typeof parsed.flags.note === 'string' ? parsed.flags.note : undefined;
  const r = await api(baseUrl, 'POST', '/agents/retire', { token, body: { note } });
  if (r.status === 200) {
    out.log('retired — locks released, in-flight tasks reopened, removed from the roster');
    return { code: 0 };
  }
  out.log(`retire failed: ${(r.json && r.json.error) || r.status}`);
  return { code: 1 };
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
    if (c.type === 'reservation' && c.reservation) {
      const who = handleFor(map, c.reservation.agentId);
      out.log(`CONFLICT: "${c.path}" is reserved by ${who} at #${c.reservation.position}`);
      const targets = [...(c.reservation.paths || []), ...(c.reservation.globs || [])];
      out.log(`  reservation ${c.reservation.id} covers: ${targets.join(', ')}`);
      if (c.reservation.reason) out.log(`  reason: ${c.reservation.reason}`);
      return { code: 1, conflict: c };
    }
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

async function cmdReserve(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const paths = parsed._.slice();
  const globs = asArray(parsed.flags.glob).filter((g) => typeof g === 'string');
  if (paths.length === 0 && globs.length === 0) {
    out.log('Usage: reserve <path...> [--glob g...] [--reason "..."]');
    return { code: 1 };
  }
  const body = { paths, globs };
  if (typeof parsed.flags.reason === 'string') body.reason = parsed.flags.reason;
  const r = await api(baseUrl, 'POST', '/reservations', { token, body });
  if (r.status === 201 && r.json && r.json.reservation) {
    const reservation = r.json.reservation;
    const targets = [...(reservation.paths || []), ...(reservation.globs || [])];
    out.log(`Reservation queued: ${reservation.id}  #${reservation.position}`);
    out.log(`  ${targets.join(', ')}`);
    return { code: 0, reservation };
  }
  if (r.status === 401) {
    out.log('unauthorized — your stored token is invalid; re-run register');
    return { code: 1 };
  }
  out.log(`reserve failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
}

async function cmdUnreserve(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const target = parsed._[0];
  if (!target) {
    out.log('Usage: unreserve <reservationId|path>');
    return { code: 1 };
  }
  const r = await api(baseUrl, 'DELETE', `/reservations/${encodeURIComponent(target)}`, { token });
  if (r.status === 200) {
    out.log(`Released reservation ${target}`);
    return { code: 0 };
  }
  out.log(`unreserve failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
}

async function cmdReservations(out, _parsed, _env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/reservations');
  const reservations = (r.json && r.json.reservations) || [];
  if (reservations.length === 0) {
    out.log('no active reservations');
    return { code: 0, reservations };
  }
  const map = await buildAgentMap(baseUrl);
  for (const reservation of reservations) {
    const targets = [...(reservation.paths || []), ...(reservation.globs || [])];
    const reason = reservation.reason ? `  (${reservation.reason})` : '';
    out.log(`#${reservation.position} ${reservation.id}  ${handleFor(map, reservation.agentId).padEnd(16)} ${targets.join(', ')}${reason}`);
  }
  return { code: 0, reservations };
}

async function cmdCampaign(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const rest = parsed._.slice(1);
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };

  if (sub === 'claim') {
    const campaignId = rest[0];
    if (!campaignId) {
      out.log('Usage: campaign claim <id> [--role lead|deputy] [--lead <id>] [--scope "..."] [--path <p>...] [--glob <g>...] [--wave <name>]');
      return { code: 1 };
    }
    const body = { id: campaignId };
    if (typeof parsed.flags.role === 'string') body.role = parsed.flags.role;
    if (typeof parsed.flags.lead === 'string') body.leadCampaignId = parsed.flags.lead;
    if (typeof parsed.flags.scope === 'string') body.scope = parsed.flags.scope;
    if (typeof parsed.flags.wave === 'string') body.wave = parsed.flags.wave;
    const paths = [...rest.slice(1), ...asArray(parsed.flags.path)].filter((x) => typeof x === 'string');
    const globs = asArray(parsed.flags.glob).filter((x) => typeof x === 'string');
    if (paths.length) body.paths = paths;
    if (globs.length) body.globs = globs;
    const r = await api(baseUrl, 'POST', '/campaigns', { token, body });
    if (r.status === 201 && r.json && r.json.campaign) {
      const campaign = r.json.campaign;
      out.log(`Campaign claimed: ${campaign.id}  [${campaign.role}]  ${campaign.scope || '(no scope note)'}`);
      for (const warning of r.json.warnings || []) out.log(`  warning: ${warning}`);
      return { code: 0, campaign, warnings: r.json.warnings || [] };
    }
    out.log(`campaign claim failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    if (r.json && r.json.conflict && r.json.conflict.campaign) {
      out.log(`  conflict: ${r.json.conflict.campaign.id} (${r.json.conflict.campaign.scope || 'no scope'})`);
    }
    return { code: 1, conflict: r.json && r.json.conflict };
  }

  if (sub === 'state') {
    const campaignId = rest[0];
    const state = rest[1];
    if (!campaignId || !state) {
      out.log('Usage: campaign state <id> <active|blocked|done>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/state`, { token, body: { state } });
    if (r.status === 200 && r.json && r.json.campaign) {
      out.log(`${r.json.campaign.id} -> [${r.json.campaign.state}]`);
      return { code: 0, campaign: r.json.campaign };
    }
    out.log(`campaign state failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  out.log(`unknown campaign subcommand "${sub}". Use: campaign claim|state`);
  return { code: 1 };
}

async function cmdCampaigns(out, parsed, _env, baseUrl) {
  const params = [];
  if (typeof parsed.flags.state === 'string') params.push(`state=${encodeURIComponent(parsed.flags.state)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const r = await api(baseUrl, 'GET', `/campaigns${qs}`);
  const campaigns = (r.json && r.json.campaigns) || [];
  if (!campaigns.length) {
    out.log('no campaigns');
    return { code: 0, campaigns };
  }
  const map = await buildAgentMap(baseUrl);
  for (const c of campaigns) {
    const targets = [...(c.paths || []), ...(c.globs || [])].join(', ');
    const lead = c.leadCampaignId ? `  lead:${c.leadCampaignId}` : '';
    const wave = c.wave ? `  wave:${c.wave}` : '';
    out.log(`${c.id}  [${c.state}/${c.role}]  @${handleFor(map, c.agentId)}${lead}${wave}  ${c.scope || '(no scope note)'}`);
    if (targets) out.log(`  scope files: ${targets}`);
    for (const warning of c.warnings || []) out.log(`  warning: ${warning}`);
  }
  return { code: 0, campaigns };
}

async function cmdTask(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const rest = parsed._.slice(1);
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };

  if (sub === 'new') {
    const title = rest[0];
    if (!title) {
      out.log('Usage: task new <title> [--body "..."] [--dep <taskId>...] [--priority N] [--ref <r>...] [--category <name>] [--campaign <id>] [--wave <name>]');
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
    if (typeof parsed.flags.campaign === 'string') body.campaignId = parsed.flags.campaign;
    if (typeof parsed.flags.wave === 'string') body.wave = parsed.flags.wave;
    const r = await api(baseUrl, 'POST', '/tasks', { token, body });
    if (r.status === 201 && r.json && r.json.task) {
      const identity = loadIdentity(env, baseUrl);
      const creator = r.json.task.creatorAgent;
      if (!creator || !creator.id) {
        out.log('task new failed creator self-check: daemon did not return creatorAgent metadata');
        return { code: 1, task: r.json.task };
      }
      // Agents normally use their saved token, but explicit --token still works.
      // When a saved identity exists, verify the board attributed the task to it.
      if (parsed.flags.token === undefined && identity && identity.agentId && creator.id !== identity.agentId) {
        out.log(`task new failed creator self-check: expected ${identity.agentId}, got ${creator.id}`);
        return { code: 1, task: r.json.task };
      }
      // Iteration-2: --id-only prints just the task id (no grep needed).
      if (parsed.flags['id-only']) { out.log(r.json.task.id); return { code: 0, task: r.json.task }; }
      out.log(`Task created: ${r.json.task.id}  "${r.json.task.title}"  [${r.json.task.state}]`);
      out.log(`  creator: ${creator.handle || creator.id} (${creator.id})`);
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
  const channel = typeof parsed.flags.channel === 'string' ? parsed.flags.channel : undefined;
  const r = await api(baseUrl, 'POST', '/messages', { token, body: { to, body, channel } });
  if (r.status === 201 && r.json && r.json.message) {
    const map = await buildAgentMap(baseUrl);
    const chan = r.json.message.channel === 'command' ? ' [command]' : '';
    out.log(`Sent (seq ${r.json.message.seq}) to ${handleFor(map, r.json.message.to)}${chan}`);
    return { code: 0, message: r.json.message };
  }
  out.log(`say failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
}

async function cmdInbox(out, parsed, env, baseUrl) {
  const since = parsed.flags.since !== undefined ? Number(parsed.flags.since) || 0 : 0;
  const params = [];
  if (since) params.push(`since=${since}`);
  if (typeof parsed.flags.channel === 'string') params.push(`channel=${encodeURIComponent(parsed.flags.channel)}`);
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
    case 'reservation.create':
      return `${h(data.reservation && data.reservation.agentId)} reserved ${[...(data.reservation.paths || []), ...(data.reservation.globs || [])].join(', ')}`;
    case 'reservation.release':
      return `${h(data.agentId)} released reservation ${shortId(data.reservationId)}`;
    case 'reservation.fulfill':
      return `${h(data.agentId)} fulfilled reservation ${shortId(data.reservationId)}`;
    case 'task.create':
      return `${h(data.task && data.task.createdBy)} created task "${data.task ? data.task.title : ''}"`;
    case 'task.claim':
      return `${h(data.agentId)} claimed task ${shortId(data.taskId)}`;
    case 'task.state':
      return `${h(data.agentId)} set task ${shortId(data.taskId)} -> ${data.state}`;
    case 'task.handoff':
      return `${h(data.agentId)} handed task ${shortId(data.taskId)} to ${h(data.toAgentId)}`;
    case 'campaign.claim':
      return `${h(data.campaign && data.campaign.agentId)} claimed campaign ${data.campaign ? data.campaign.id : '?'}`;
    case 'campaign.state':
      return `${h(data.agentId)} set campaign ${data.campaignId} -> ${data.state}`;
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
  1. Your identity must be UNIQUE to you: export AGORA_AGENT_ID=<your-handle-or-session-id>
     before ANY client call (or use a unique AGORA_DIR). Sharing an identity means
     \`unlock --mine\` releases ANOTHER agent's locks. No name assigned to you? Use
     \`register --random\` — the daemon rejects a name a live agent already holds.
  2. lock BEFORE editing any shared file; a 409 CONFLICT is a HARD STOP on that file.
     If you still need it later, use \`reserve <path> --reason "<why>"\` to join the FIFO
     waiting list. A reservation is not edit permission; wait until the real lock succeeds.
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
      case 'whois':
        res = await cmdWhois(out, parsed, env, baseUrl);
        break;
      case 'lineage':
        res = await cmdLineage(out, parsed, env, baseUrl);
        break;
      case 'tree':
        res = await cmdTree(out, parsed, env, baseUrl);
        break;
      case 'retire':
        res = await cmdRetire(out, parsed, env, baseUrl);
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
      case 'reserve':
        res = await cmdReserve(out, parsed, env, baseUrl);
        break;
      case 'unreserve':
        res = await cmdUnreserve(out, parsed, env, baseUrl);
        break;
      case 'reservations':
        res = await cmdReservations(out, parsed, env, baseUrl);
        break;
      case 'campaign':
        res = await cmdCampaign(out, parsed, env, baseUrl);
        break;
      case 'campaigns':
        res = await cmdCampaigns(out, parsed, env, baseUrl);
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
