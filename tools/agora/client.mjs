// tools/agora/client.mjs
// Agora coordination daemon — thin, dependency-free CLI.
//
// Pure Node.js ESM, zero npm dependencies (node: built-ins + the global `fetch`).
// Lets a human OR an agent drive the daemon without curl boilerplate:
//
//   node tools/agora/client.mjs register <handle> --pet <slug> --session <task/thread-id> [--note "..."]
//   node tools/agora/client.mjs lock src/foo.ts --reason "refactor"
//   node tools/agora/client.mjs watch
//   ... (run with no args / `help` for the full list)
//
// Identity persistence: registration is stored per (host,port) base URL in a small
// JSON file (default `.agent/agora/client-identity.json`, dir configurable via
// AGORA_DIR). Shape: { "<baseUrl>": { agentId, handle, token } }. `register` writes
// it; other commands read the token from it (or accept `--token`). The unscoped
// default file cannot be replaced while its saved agent is still live, preventing
// a second onboarding attempt from inheriting or releasing the first agent's work.
// Set AGORA_AGENT_ID=<unique key> to scope the file per agent
// (`client-identity.<key>.json`) so concurrent agents in one checkout don't share
// an identity — a shared identity means `unlock --mine` releases the OTHER
// agent's locks.
//
// Base URL precedence: --url > AGORA_URL > http://localhost:4319.
//
// Structured for testing: `run(argv, { env, baseUrl, repoRoot })` returns
// `{ code, ... }` and never calls process.exit; `repoRoot` lets retrace tests use
// an isolated temporary Git repository instead of touching the shared checkout.
// The real CLI bootstrap is guarded behind isMainModule().
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

import { validateRegistrationThreadIdentity } from './identity-policy.mjs';
import { readAllowedVocabularies } from './gapIndex.mjs';
import { resolveGapsFile } from './gapAppend.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_BASE_URL = 'http://localhost:4319';
const UNCATEGORIZED_TASK_CATEGORY = 'uncategorized';
const DEFAULT_HEARTBEAT_EVERY_SEC = 600;
const DEFAULT_HEARTBEAT_FOR_MIN = 30;
const DEFAULT_OWNER_POLL_MS = 5000;
// Focused tests need to exercise the truly unscoped default behavior without
// writing into this checkout. A symbol keeps that temporary path out of the
// public environment-variable contract used by real client invocations.
const IDENTITY_DIR_OVERRIDE = Symbol('identityDirOverride');

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
  return { _: positionals, flags, raw: [...argv] };
}

// A quoted reason reaches Node as one argument. More bare words after that value
// are almost always an accidentally unquoted reason, not extra file paths.
function hasAmbiguousReasonTail(raw = []) {
  const index = raw.findIndex((value) => value === '--reason');
  if (index < 0 || index + 1 >= raw.length) return false;
  for (let i = index + 2; i < raw.length; i++) {
    if (raw[i].startsWith('--')) break;
    return true;
  }
  return false;
}

function suspiciousBarePathTokens(values = []) {
  if (values.length < 2) return [];
  return values.filter((value) => {
    if (/[\\/.*?]/.test(value) || /^[A-Za-z]:/.test(value)) return false;
    return !fs.existsSync(path.resolve(REPO_ROOT, value));
  });
}

function asArray(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// Identity file: { "<baseUrl>": { agentId, handle, token } }
// ---------------------------------------------------------------------------
function identityDir(env) {
  // The in-process test harness may redirect the default file to a temporary
  // directory while deliberately leaving AGORA_DIR and AGORA_AGENT_ID absent.
  const override = env[IDENTITY_DIR_OVERRIDE];
  if (override) return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  const d = env.AGORA_DIR;
  if (d) return path.isAbsolute(d) ? d : path.resolve(process.cwd(), d);
  return path.join(REPO_ROOT, '.agent', 'agora');
}

// Per-agent identity scoping: two concurrent agents in ONE checkout used to share
// client-identity.json, so `unlock --mine` from one released the OTHER's locks
// (observed 2026-07-04). Set AGORA_AGENT_ID to any unique string (session id,
// PID+suffix, handle) and this process gets its own identity file. Unset = the
// legacy shared path. Existing unscoped identities remain readable, but a new
// registration must explicitly opt into that path with --legacy-unscoped.
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

// Only the shared legacy path needs this extra stop. AGORA_AGENT_ID creates a
// per-agent file, while AGORA_DIR is already an explicit isolated location.
function usesLegacyDefaultIdentityScope(env) {
  const hasAgentId = typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim();
  const hasAgoraDir = typeof env.AGORA_DIR === 'string' && env.AGORA_DIR.trim();
  return !hasAgentId && !hasAgoraDir;
}

// Refuse to replace a live identity in the shared default file. The public
// roster is the authority for liveness: retired or expired identities disappear
// from it and may then be replaced without requiring manual file cleanup.
async function defaultIdentityIsAvailable(out, env, baseUrl, { legacyUnscoped = false } = {}) {
  // WF-G344/WF-G345: a missing AGORA_AGENT_ID on the register call selects
  // client-identity.json. In a shared checkout with scoped agents already
  // present, that is almost certainly a missed export. Refuse before the POST
  // rather than create a live agent whose next scoped call cannot find it.
  if (!(typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim())) {
    let scopedFiles;
    try {
      scopedFiles = fs.readdirSync(identityDir(env), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^client-identity\..+\.json$/.test(entry.name));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        out.log(`register refused: cannot inspect identity scopes in ${identityDir(env)} (${error.message})`);
        return false;
      }
      scopedFiles = [];
    }
    if (scopedFiles.length) {
      out.log(`register refused: AGORA_AGENT_ID is unset, but ${scopedFiles.length} scoped identity file(s) exist in ${identityDir(env)}.`);
      out.log('  Set your unique AGORA_AGENT_ID before register/onboard and keep it unchanged on every later call. No presence was created.');
      return false;
    }
    // WF-G344: the scoped-file check alone misses a fresh checkout. An
    // unscoped register would succeed there, then a worker following the
    // fleet brief on the next shell call would look in a different file.
    if (!legacyUnscoped) {
      out.log('register refused: AGORA_AGENT_ID is unset. Set a unique key on the register/onboard call itself and reuse it on every later call. No presence was created.');
      out.log('  For deliberate single-agent compatibility only, pass --legacy-unscoped and keep AGORA_AGENT_ID unset on later calls.');
      return false;
    }
  }
  if (!usesLegacyDefaultIdentityScope(env)) return true;
  const stored = loadIdentity(env, baseUrl);
  if (!stored || !stored.agentId) return true;

  const roster = await api(baseUrl, 'GET', '/agents');
  if (roster.status !== 200 || !roster.json || !Array.isArray(roster.json.agents)) {
    out.log(`register refused: could not verify whether the stored default identity is still live (${roster.status})`);
    out.log('  Set a unique AGORA_AGENT_ID or AGORA_DIR before onboarding. The existing identity was not changed.');
    return false;
  }

  const live = roster.json.agents.find((agent) => agent.id === stored.agentId);
  if (!live) return true;
  out.log(`register refused: the default identity still belongs to live agent "${live.handle || stored.handle}" (${stored.agentId})`);
  out.log('  Set a unique AGORA_AGENT_ID or AGORA_DIR before onboarding. The existing identity was not changed.');
  return false;
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
  const stderrLines = [];
  return {
    lines,
    stderrLines,
    log: (...args) => lines.push(args.join(' ')),
    warn: (...args) => stderrLines.push(args.join(' ')),
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

// GG-119: locks that lapse silently let a second agent start editing while the
// first still believes it holds exclusivity. Surface locks inside the warning
// window wherever expiry is printed or listed.
const LOCK_WARN_MS = 5 * 60 * 1000;

function expiryFlag(ts, nowMs = Date.now()) {
  if (!ts) return '';
  const remain = ts - nowMs;
  if (remain <= 0) return '  [EXPIRED — renew before relying on it]';
  if (remain <= LOCK_WARN_MS) return `  [EXPIRING in ${Math.max(1, Math.round(remain / 1000))}s — renew]`;
  return '';
}

// GG-118: ready-task refs can point at paths another agent already holds
// locked; annotate listings so claimants see the collision before claiming.
function refMatchesLock(ref, lock) {
  if (!ref) return false;
  const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const r = norm(ref);
  for (const p of lock.paths || []) {
    const lp = norm(p);
    if (!lp || lp.includes('*')) continue;
    if (r === lp || r.startsWith(`${lp}/`)) return true;
  }
  for (const g of lock.globs || []) {
    if (!g) continue;
    let re;
    try {
      re = new RegExp('^' + norm(g).split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^]*') + '$');
    } catch { continue; }
    if (re.test(r)) return true;
  }
  return false;
}

function lockedRefsForTask(task, locks, handleFor, map) {
  const hits = [];
  for (const ref of task.refs || []) {
    for (const l of locks) {
      if (refMatchesLock(ref, l)) {
        hits.push(`${ref} [LOCKED by ${handleFor(map, l.agentId)}]`);
        break;
      }
    }
  }
  return hits;
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

// WF-G118: the same forgiving id matching resolveTaskId performs, but against
// a board the caller already fetched. An ambiguous prefix is refused with the
// candidates listed (WF-G64), never resolved to the first hit.
function findTaskByIdOrPrefix(tasks, wanted, out) {
  const lower = String(wanted).toLowerCase();
  const exact = tasks.find((t) => t.id === wanted) || tasks.find((t) => t.id.toLowerCase() === lower);
  if (exact) return exact;
  const prefixed = tasks.filter((t) => t.id.toLowerCase().startsWith(lower));
  if (prefixed.length === 1) return prefixed[0];
  if (prefixed.length > 1 && out) {
    out.log(`ambiguous task id "${wanted}" matches ${prefixed.length} tasks: ${prefixed.slice(0, 8).map((t) => t.id).join(', ')}${prefixed.length > 8 ? ', …' : ''}`);
  }
  return null;
}

// WF-G65: resolve a short-id prefix to the full UUID by querying the board.
// Returns the full UUID if found, null otherwise. This allows agents to claim
// tasks using the short IDs displayed by `tasks --ready`.
async function resolveTaskId(prefix, baseUrl, token, out) {
  // If it's already a full UUID (36 chars with hyphens), return it as-is.
  if (prefix.length === 36 && prefix.includes('-')) return prefix;
  const r = await api(baseUrl, 'GET', '/tasks', { token });
  if (r.status !== 200 || !r.json || !r.json.tasks) return null;
  const tasks = r.json.tasks;
  // First try exact match, then prefix match.
  const exact = tasks.find((t) => t.id === prefix);
  if (exact) return exact.id;
  // Board task agora-6f81: the match is case-insensitive, because a short id
  // is often retyped from a listing and UUID hex casing carries no meaning.
  const lower = String(prefix).toLowerCase();
  const exactCi = tasks.find((t) => t.id.toLowerCase() === lower);
  if (exactCi) return exactCi.id;
  // WF-G64 (verified 2026-09-09): a prefix must name ONE task. Hierarchical
  // ids (`agora-8a7f.1`, `agora-8a7f.12`) make bare `startsWith` ambiguous —
  // `agora-8a7f.1` is a prefix of `agora-8a7f.12`, and a campaign code is a
  // prefix of every task in it. Acting on the first hit would finish the
  // wrong task, so an ambiguous prefix is refused with the candidates listed.
  const prefixed = tasks.filter((t) => t.id.toLowerCase().startsWith(lower));
  if (prefixed.length === 1) return prefixed[0].id;
  if (prefixed.length > 1 && out) {
    out.log(`ambiguous task id "${prefix}" matches ${prefixed.length} tasks: ${prefixed.slice(0, 8).map((t) => t.id).join(', ')}${prefixed.length > 8 ? ', …' : ''}`);
  }
  return null;
}

// WF-G217: taskLint is needed only by task creation, lint, and edit. A sibling
// can be mid-write on that helper in the shared checkout; loading it at startup
// used to take every unrelated Agora command offline with a SyntaxError.
async function loadTaskLint() {
  try {
    return await import('./taskLint.mjs');
  } catch (error) {
    throw new Error(`task lint module taskLint.mjs is unavailable: ${error.message}`);
  }
}

// WF-G118: the reason a task is blocked lives in its history, not on the row.
// A `tasks --state blocked` listing that omits it makes the board unreadable
// exactly where a reader most needs to know what to do next.
function blockedReasonOf(task) {
  const history = Array.isArray(task && task.history) ? task.history : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry && entry.state === 'blocked' && entry.reason) return entry.reason;
  }
  return '';
}

/**
 * WF-G177: the readiness marker for one task row.
 *
 * `ready` is false for EVERY task that is not open, so `task show` printed
 * "[done] (not ready)" on five finished tasks with full result text. The two
 * words contradict each other and a reader cannot tell a finished task from a
 * broken one.
 *
 * Readiness answers one question — may this open task be claimed now? — so the
 * marker shows only on an open task, and it names the unmet blocking
 * dependencies instead of standing bare.
 */
function readinessMarker(task) {
  if (!task || task.state !== 'open' || task.ready !== false) return '';
  const unmet = (task.depStates || []).filter((d) => d.blocking && d.state !== 'done');
  if (!unmet.length) return '  (not ready)';
  return `  (not ready: ${unmet.length} unmet dep${unmet.length === 1 ? '' : 's'} — ${unmet.map((d) => `${shortId(d.id)} [${d.state}]`).join(', ')})`;
}

/**
 * WF-G194: every category in use on the board, with its task count.
 *
 * Returns a lower-cased Map<name, count>, or null when the board does not
 * answer — a caller must not report "no categories" when it simply could not
 * read the board.
 */
async function taskCategoryCounts(baseUrl) {
  const r = await api(baseUrl, 'GET', '/tasks');
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.tasks)) return null;
  const counts = new Map();
  for (const t of r.json.tasks) {
    // A task row may carry one `category` or the derived `categories` list.
    const names = Array.isArray(t.categories) && t.categories.length
      ? t.categories
      : (t.category ? [t.category] : []);
    for (const raw of names) {
      const name = String(raw || '').trim().toLowerCase();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return counts;
}

// WF-G116: how long the lock holder has been quiet, in words a waiter can act
// on. `holderIdleMs` is null when the holder's presence row is already gone.
function idleNote(lock) {
  if (!lock || lock.holderIdleMs == null) return lock && lock.holderStatus === 'gone' ? '  holder GONE' : '';
  const mins = Math.round(lock.holderIdleMs / 60000);
  const status = lock.holderStatus && lock.holderStatus !== 'online' ? ` ${lock.holderStatus.toUpperCase()}` : '';
  return `  idle ${mins}m${status}`;
}

// WF-G81: a task ref that LOOKS like a repository path but points at nothing
// in the checkout sent a worker to split `src/report.py`, a file that never
// existed here. Refs are free strings (gap ids, planmap:<topic>, URLs), so this
// only inspects the ones shaped like a relative file path and warns; it never
// refuses the task — the creator may be naming a file the task will create.
function missingPathRefs(refs, repoRoot = REPO_ROOT) {
  const out = [];
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const r = ref.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (!r || /^[a-z][a-z0-9+.-]*:/i.test(r)) continue; // planmap:, workflow:, https:, etc.
    if (!/^[A-Za-z0-9_.@-]+(\/[A-Za-z0-9_.@ -]+)+$/.test(r)) continue; // needs a slash, no glob chars
    if (!/\.[A-Za-z0-9]{1,8}$/.test(r) && !/^(src|tools|docs|public|scripts|tests)\//.test(r)) continue;
    if (!fs.existsSync(path.resolve(repoRoot, r))) out.push(r);
  }
  return out;
}

// A task body can repeat a bad ref or name a wrong file without a ref at all.
// Keep creation advisory because CREATES/EXPECTED-ABSENT paths are intentional.
async function missingTaskPaths(task, repoRoot = REPO_ROOT) {
  const { extractPathTokens, extractDeclaredCreates, extractDeclaredAbsent } = await loadTaskLint();
  const refs = Array.isArray(task.refs) ? task.refs : [];
  const prose = [task.title || '', task.body || ''].join('\n');
  const declared = new Set([...extractDeclaredCreates(task.body || ''), ...extractDeclaredAbsent(task.body || '')]);
  const refPaths = new Set(missingPathRefs(refs, repoRoot));
  // Keep whole refs intact: splitting a valid path containing spaces into
  // prose tokens would invent a second, bogus missing path.
  const candidates = new Set([...refPaths, ...extractPathTokens(prose)]);
  return [...candidates]
    .filter((p) => !declared.has(p) && !fs.existsSync(path.resolve(repoRoot, p)))
    .map((p) => ({ path: p, source: refPaths.has(p) ? 'ref' : 'title/body path' }));
}

// ---------------------------------------------------------------------------
// Command authentication guidance
// ---------------------------------------------------------------------------
// Most authenticated commands retain the legacy registration hint. Task creation
// instead points newcomers at `onboard`, because that one command establishes the
// pet and Codex task/thread provenance required for safe coordination.
// ---------------------------------------------------------------------------
function printTaskOnboardingHint(out, reason) {
  out.log(`${reason} Run: onboard <handle> --pet <slug> --session <task/thread-id>`);
}

function needToken(out, parsed, env, baseUrl, { taskCreation = false } = {}) {
  const token = resolveToken(parsed, env, baseUrl);
  if (!token) {
    if (taskCreation) {
      printTaskOnboardingHint(out, `No Agora identity is stored for ${baseUrl}.`);
    } else {
      out.log(`Not registered for ${baseUrl}. Run: register <handle> --pet <slug>  (or pass --token <token>)`);
    }
    if (typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim()) {
      out.log(`  Looked in ${identityPath(env)}. Use the same AGORA_AGENT_ID you used at registration; setting it only afterward does not move an unscoped identity.`);
    }
  }
  return token;
}

// ---------------------------------------------------------------------------
// Command implementations. Each returns { code } and may add user-facing output.
// ---------------------------------------------------------------------------

// WF-G219: help is data, not executable syntax. A raw backtick pasted into
// this prose can no longer prevent register, unlock, or task done from loading.
// Read it only for help; a missing or half-written help file degrades help,
// never the coordination commands.
function usageText() {
  try {
    return fs.readFileSync(new URL('./client-usage.txt', import.meta.url), 'utf8').trimEnd();
  } catch (error) {
    return 'Agora client help unavailable: ' + error.message + '\nOther commands remain available.';
  }
}

// A collision-resistant handle for a solo agent that has no name assigned to it
// (`register --random` / bare `register`). The daemon still enforces uniqueness;
// the random suffix just makes a clash astronomically unlikely on the first try.
function randomHandle(base) {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${(base && String(base)) || 'agent'}-${suffix}`;
}

// A dispatch can accidentally number a known pet family beyond its catalog
// entries (for example chef-4 when only chef, chef-2, chef-3 exist). Recover
// only that shape; arbitrary unknown slugs remain a typo/error. The daemon is
// still the authority on the final assignment and handles races atomically.
function availablePetForUnknownNumberedSlug(requestedSlug, pets) {
  const numbered = /^(.+)-([1-9]\d*)$/.exec(String(requestedSlug || '').trim());
  if (!numbered || !Array.isArray(pets)) return null;
  const family = numbered[1];
  if (!pets.some((pet) => pet && pet.slug === family)) return null;
  const available = pets.filter((pet) => pet && typeof pet.slug === 'string' && pet.available === true);
  const sameFamily = available.find((pet) => pet.slug === family || (
    pet.slug.startsWith(`${family}-`) && /^[1-9]\d*$/.test(pet.slug.slice(family.length + 1))
  ));
  return (sameFamily || available[0])?.slug || null;
}

async function cmdRegister(out, parsed, env, baseUrl) {
  // Solo agents can't reliably invent a unique name, so `--random` (or omitting
  // the handle) lets the client generate one and CLAIM it against the daemon,
  // retrying if some other agent grabbed it first. Orchestrated workers still
  // pass an explicit handle their parent allocated.
  const wantRandom = parsed.flags.random === true || parsed._[0] === undefined;
  const base = typeof parsed.flags.random === 'string' ? parsed.flags.random : parsed._[0];
  if (!wantRandom && !parsed._[0]) {
    out.log('Usage: register <handle> --pet <slug> [--note "..."]   |   register --random [base] --pet <slug>');
    return { code: 1 };
  }
  const note = typeof parsed.flags.note === 'string' ? parsed.flags.note : undefined;
  const petSlug = typeof parsed.flags.pet === 'string' ? parsed.flags.pet
    : (typeof env.AGORA_PET === 'string' && env.AGORA_PET) ? env.AGORA_PET : undefined;
  if (!petSlug) {
    out.log('register failed: --pet <slug> is required before claiming presence');
    out.log('  Run `node tools/agora/client.mjs pets`, choose one identity, then register again.');
    return { code: 1 };
  }
  // `--allow-duplicate` opts out of the daemon's handle-claim check (legacy flows).
  const unique = parsed.flags['allow-duplicate'] === true ? false : undefined;
  // Optional provenance. --model is usually stamped by the orchestrator at launch;
  // the agent's own conversation/thread id accepts several flag names.
  const model = typeof parsed.flags.model === 'string' ? parsed.flags.model
    : (typeof env.AGORA_MODEL === 'string' && env.AGORA_MODEL) ? env.AGORA_MODEL : undefined;
  const reasoningEffort = typeof parsed.flags.reasoning === 'string' ? parsed.flags.reasoning
    : typeof parsed.flags['reasoning-effort'] === 'string' ? parsed.flags['reasoning-effort']
    : (typeof env.AGORA_REASONING_EFFORT === 'string' && env.AGORA_REASONING_EFFORT) ? env.AGORA_REASONING_EFFORT : undefined;
  let sessionId = typeof parsed.flags.session === 'string' ? parsed.flags.session
    : typeof parsed.flags.thread === 'string' ? parsed.flags.thread
    : typeof parsed.flags.conversation === 'string' ? parsed.flags.conversation
    : (typeof env.AGORA_SESSION_ID === 'string' && env.AGORA_SESSION_ID) ? env.AGORA_SESSION_ID : undefined;

  // Coordination role: default worker; orchestrators/master/human declare
  // themselves to unlock the command channel.
  const role = typeof parsed.flags.role === 'string' ? parsed.flags.role : undefined;
  // WF-G145 (2026-09-09): the seat had no environment fallback while every
  // other identity input did, so a dispatch template could carry everything
  // except the seat, and the exit-0 refusal let a forgotten flag walk past.
  const seat = typeof parsed.flags.seat === 'string' ? parsed.flags.seat
    : (typeof env.AGORA_SEAT === 'string' && env.AGORA_SEAT) ? env.AGORA_SEAT : undefined;

  // Identity provenance (Wave 1). Usually stamped by the spawner at launch; a root
  // agent (a person-opened chat) sets its own.
  const type = typeof parsed.flags.type === 'string' ? parsed.flags.type : undefined;
  const spawnedBy = typeof parsed.flags['spawned-by'] === 'string' ? parsed.flags['spawned-by'] : undefined;
  // WF-G85 (3): on `register` this is a free-text PRESENCE LABEL, not the
  // validated campaign foreign key that `task new --campaign` sets. The flag is
  // now `--lane`; `--campaign` is still read for old prompts but says so.
  let campaign = typeof parsed.flags.lane === 'string' ? parsed.flags.lane : undefined;
  if (campaign === undefined && typeof parsed.flags.campaign === 'string') {
    campaign = parsed.flags.campaign;
    out.log('note: `register --campaign` is a presence label only (use --lane); it does NOT link tasks to a campaign — pass --campaign on `task new` for that (WF-G85)');
  }
  const cwd = typeof parsed.flags.cwd === 'string' ? parsed.flags.cwd : undefined;

  // Mirror the store's hard gate locally so a Codex worker or orchestrator gets
  // an actionable error before the client attempts an open registration call.
  const threadIdentity = validateRegistrationThreadIdentity({
    handle: wantRandom ? base : parsed._[0],
    model,
    sessionId,
    role,
    type,
  });
  if (!threadIdentity.ok) {
    out.log(`register failed: ${threadIdentity.error}`);
    out.log('  Use the Codex task/thread id for this exact agent, then verify it with `whoami`.');
    return { code: 1 };
  }
  sessionId = threadIdentity.sessionId;

  // Registration is the only command that can replace stored identity. Stop
  // before POSTing when another live agent still owns the legacy default slot.
  if (!await defaultIdentityIsAvailable(out, env, baseUrl, {
    legacyUnscoped: parsed.flags['legacy-unscoped'] === true,
  })) return { code: 1 };

  const maxTries = wantRandom ? 6 : 1;
  let last = null;
  let submittedPetSlug = petSlug;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const handle = wantRandom ? randomHandle(base) : parsed._[0];
    const body = (chosenPet) => ({ handle, note, unique, model, reasoningEffort, sessionId, role, type, spawnedBy, campaign, cwd, petSlug: chosenPet, seat });
    let r = await api(baseUrl, 'POST', '/agents/register', { body: body(submittedPetSlug) });
    if (r.status === 400 && /^unknown petSlug\b/i.test(r.json?.error || '') && submittedPetSlug === petSlug) {
      const catalog = await api(baseUrl, 'GET', '/pets');
      const fallback = catalog.status === 200
        ? availablePetForUnknownNumberedSlug(petSlug, catalog.json?.pets)
        : null;
      if (fallback) {
        out.log(`Requested pet "${petSlug}" is not in the catalog; retrying with available "${fallback}" from GET /pets.`);
        submittedPetSlug = fallback;
        r = await api(baseUrl, 'POST', '/agents/register', { body: body(submittedPetSlug) });
      }
    }
    last = r;
    if (r.status === 201 && r.json) {
      saveIdentity(env, baseUrl, {
        agentId: r.json.agentId,
        handle: r.json.handle,
        token: r.json.token,
        registeredAt: r.json.registeredAt,
        model: r.json.model || '',
        reasoningEffort: r.json.reasoningEffort || '',
        sessionId: r.json.sessionId || '',
        pet: r.json.pet || null,
        requestedPetSlug: r.json.requestedPetSlug || '',
        petSubstituted: Boolean(r.json.petSubstituted),
      });
      out.log(`Registered as "${r.json.handle}"  agentId=${r.json.agentId}`);
      // D-AB: the seat is taken at sign-in. Say plainly whether this session
      // got it — a silent miss would leave the campaign it claims with no
      // durable owner, and nothing would say why.
      if (r.json.seatId) out.log(`Seat held: ${r.json.seatId}`);
      if (r.json.seatError) {
        out.log(`Seat NOT held: ${r.json.seatError}`);
        out.log('  You are registered, but any campaign you claim will have no durable owner.');
      }
      if (r.json.pet) out.log(`Pet identity: ${r.json.pet.displayName} (${r.json.pet.slug})`);
      if (r.json.petSubstituted) {
        out.log(`Requested pet "${r.json.requestedPetSlug}" was already claimed; Agora assigned "${r.json.pet.slug}" instead.`);
      }
      if (submittedPetSlug !== petSlug && r.json.pet) {
        out.log(`Requested pet "${petSlug}" is not in the catalog; registered with "${r.json.pet.slug}" instead.`);
      }
      out.log(`Identity saved to ${identityPath(env)} for ${baseUrl}`);
      // The identity file scope was fixed before registration. When no
      // AGORA_AGENT_ID was provided, remind the caller to preserve that scope;
      // adding the new handle afterward would select a different, empty file.
      if (!(typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim())) {
        out.log('TIP: Keep AGORA_AGENT_ID and AGORA_DIR unchanged for later commands; changing either selects a different identity file.');
      }
      return { code: 0, identity: r.json };
    }
    if (r.status === 409) {
      if (r.json && r.json.code === 'AGORA_PET_CATALOG_EXHAUSTED') {
        out.log(`register failed: ${r.json.error}`);
        return { code: 1 };
      }
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

async function cmdWhoami(out, parsed, env, baseUrl) {
  const id = loadIdentity(env, baseUrl);
  if (!id) {
    out.log(`not registered for ${baseUrl}`);
    return { code: 1 };
  }
  // Label this as saved client state so the local-only default cannot be
  // mistaken for proof that the daemon still recognizes the identity.
  out.log('stored identity:');
  out.log(`handle:    ${id.handle}`);
  out.log(`agentId:   ${id.agentId}`);
  out.log(`baseUrl:   ${baseUrl}`);
  if (id.model) out.log(`model:     ${id.model}`);
  if (id.reasoningEffort) out.log(`reasoning: ${id.reasoningEffort}`);
  if (id.sessionId) out.log(`sessionId: ${id.sessionId}`);
  if (id.pet) out.log(`pet:       ${id.pet.displayName} (${id.pet.slug})`);
  if (id.registeredAt) out.log(`checkedIn: ${new Date(id.registeredAt).toISOString()}`);
  // The token remains in the identity file for authenticated commands, but a
  // routine provenance check must never copy it into terminal or task logs.
  const { token: _token, ...publicIdentity } = id;
  if (parsed.flags.live !== true) return { code: 0, identity: publicIdentity };

  // Ask the dedicated authentication endpoint whether this exact saved token
  // and agent id are current. The endpoint deliberately does not touch presence.
  const response = await api(baseUrl, 'GET', '/agents/me', { token: id.token });
  if (response.status === 401) {
    // Authentication alone cannot say whether the saved presence was reaped or
    // only its local bearer was damaged. The public roster resolves that split
    // without sending a secret or touching any agent's presence timestamp.
    const roster = await api(baseUrl, 'GET', '/agents');
    if (roster.status !== 200 || !roster.json || !Array.isArray(roster.json.agents)) {
      out.log(`live status check failed (${roster.status}): bearer was rejected and roster fallback was unavailable`);
      return { code: 1, identity: publicIdentity, live: false };
    }
    const storedPresence = roster.json.agents.find((agent) => agent.id === id.agentId);
    if (storedPresence) {
      out.log('live status: not current (stored presence exists, but its saved bearer is invalid)');
    } else {
      out.log('live status: not live (stored identity was reaped or retired)');
    }
    out.log('  Re-onboard before making authenticated Agora calls.');
    return { code: 1, identity: publicIdentity, live: false };
  }
  if (response.status !== 200 || !response.json || !response.json.agent) {
    out.log(`live status check failed (${response.status}): ${response.json ? response.json.error : response.text}`);
    return { code: 1, identity: publicIdentity, live: false };
  }
  if (response.json.agent.id !== id.agentId) {
    out.log(`live status: identity mismatch (stored ${id.agentId}, authenticated ${response.json.agent.id})`);
    return { code: 1, identity: publicIdentity, live: false };
  }
  out.log(`live status: current (${response.json.agent.status})`);
  return { code: 0, identity: publicIdentity, live: true, agent: response.json.agent };
}

async function cmdAgents(out, parsed, env, baseUrl) {
  if (typeof parsed.flags['retire-stale'] === 'string') {
    const token = needToken(out, parsed, env, baseUrl);
    if (!token) return { code: 1 };
    const target = parsed.flags['retire-stale'];
    const roster = await api(baseUrl, 'GET', '/agents');
    const agents = (roster.json && roster.json.agents) || [];
    const agent = agents.find((candidate) => candidate.id === target || candidate.handle === target);
    if (!agent) {
      out.log(`retire-stale failed: agent "${target}" not found`);
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/agents/${encodeURIComponent(agent.id)}/retire-stale`, { token });
    if (r.status === 200) {
      out.log(`retired stale idle presence ${agent.handle} (${agent.id})`);
      return { code: 0, agentId: agent.id };
    }
    out.log(`retire-stale failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }
  const r = await api(baseUrl, 'GET', '/agents');
  const agents = (r.json && r.json.agents) || [];
  if (agents.length === 0) {
    out.log('no agents registered');
    return { code: 0, agents };
  }
  const now = Date.now();
  for (const a of agents) {
    const model = a.model ? `  [${a.model}${a.reasoningEffort ? `/${a.reasoningEffort}` : ''}]` : '';
    const inFor = a.registeredAt ? `  in ${relativeTime(a.registeredAt, now)}` : '';
    const note = a.note ? `  — ${a.note}` : '';
    const recoverable = a.capacityRecoverable ? '  [stale-idle: retire-stale candidate]' : '';
    const pet = a.pet ? `  pet:${a.pet.slug}` : '  pet:MISSING';
    const thread = a.sessionId ? `  thread:${a.sessionId}` : (a.threadIdRequired ? '  thread:MISSING-LEGACY' : '');
    out.log(`${statusDot(a.status)} ${a.handle.padEnd(16)} ${shortId(a.id)}${model}  seen ${relativeTime(a.lastSeen, now)}${inFor}${pet}${thread}${recoverable}${note}`);
  }
  return { code: 0, agents };
}

// Pet identity is a registration prerequisite, so discovery cannot require an
// agent token. Keep output intentionally slug-first for easy `--pet` reuse.
async function cmdPets(out, _parsed, _env, baseUrl) {
  const r = await api(baseUrl, 'GET', '/pets');
  const pets = (r.json && r.json.pets) || [];
  if (r.status !== 200) {
    out.log(`pets failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1, pets: [] };
  }
  for (const pet of pets) {
    const availability = pet.available === false && pet.claimedBy
      ? `claimed by ${pet.claimedBy.handle}`
      : 'available';
    out.log(`${String(pet.slug).padEnd(30)} ${String(pet.displayName || pet.slug).padEnd(28)} ${availability}`);
  }
  const availableCount = pets.filter((pet) => pet.available !== false).length;
  out.log(`${availableCount} of ${pets.length} pet identities available`);
  return { code: 0, pets };
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

/**
 * WF-G183: the path a rename moved this one to, or an empty string.
 *
 * `git log --diff-filter=R` is the only signal that tells a STALE path (one
 * that used to exist under another name) from a NEW path (one git has never
 * seen). The check is advice, so any failure returns an empty string.
 */
export function renameTargetOf(root, rel) {
  try {
    // A PATHSPEC cannot be used here: git prunes the rename commit out of the
    // log for the OLD name, so `git log -- <old path>` prints nothing at all.
    // The scan is bounded to the last 300 commits instead, which is where a
    // rename an agent still has a stale reference to will be, and the 5 s
    // timeout keeps a cold repository from stalling a lock call.
    const out = execFileSync('git', ['log', '-M', '-n', '120', '--diff-filter=R', '--name-status', '--format='], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    });
    for (const line of String(out).split(/\r?\n/)) {
      const cells = line.split(/\t/);
      if (!/^R\d*$/.test(cells[0] || '')) continue;
      const [, from, to] = cells;
      if (String(from || '').replace(/\\/g, '/') === rel && to) return String(to).replace(/\\/g, '/');
    }
  } catch { /* advice only */ }
  return '';
}

/** WF-G183: has git EVER held this path? A path it has never seen is new. */
export function everTracked(root, rel) {
  try {
    const out = execFileSync('git', ['log', '--all', '--format=%H', '-1', '--', rel], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    });
    return String(out).trim().length > 0;
  } catch {
    return false;
  }
}

/** WF-G279: an untracked-looking lock target may be a misplaced existing file. */
function existingSameBasename(root, rel) {
  const name = path.posix.basename(rel.replace(/\\/g, '/'));
  if (!name || /[*?\[\]]/.test(name)) return [];
  try {
    const found = execFileSync('git', [
      'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', `:(glob)**/${name}`,
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
    return String(found).split('\0')
      .filter((candidate) => candidate && candidate !== rel)
      .filter((candidate) => {
        try { return fs.statSync(path.resolve(root, candidate)).isFile(); } catch { return false; }
      })
      .slice(0, 4);
  } catch {
    return []; // A warning is advisory; a Git failure must not prevent a lock.
  }
}

/**
 * WF-G173: the facts an agent can actually act on for an UNTRACKED file.
 * git diff has nothing to say about it, so say how big it is and when it was
 * last written — that is what tells a stale leftover from live sibling work.
 */
export function fileFacts(root, rel) {
  try {
    const st = fs.statSync(path.resolve(root, rel));
    const age = Math.max(0, Math.round((Date.now() - st.mtimeMs) / 60000));
    return `It is ${st.size} byte(s) and was last written ${age} minute(s) ago.`;
  } catch {
    return '';
  }
}

// WF-G275: Git's --eol inspection succeeds with EMPTY output for untracked
// files. Read a bounded byte sample so the lock warning gives a real answer
// without rewriting the file or mistaking a partial/binary read for proof.
function fileLineEndings(root, rel) {
  const limit = 256 * 1024;
  let fd;
  try {
    const target = path.resolve(root, rel);
    const st = fs.statSync(target);
    if (!st.isFile()) return 'EOL: unavailable (not a regular file).';
    const buffer = Buffer.allocUnsafe(Math.min(st.size, limit));
    fd = fs.openSync(target, 'r');
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const partial = bytes < st.size;
    if (buffer.subarray(0, bytes).includes(0)) return 'EOL: unavailable (binary-looking file).';
    let lf = 0;
    let crlf = 0;
    let bareCr = 0;
    for (let i = 0; i < bytes; i++) {
      if (buffer[i] === 13) {
        if (i + 1 < bytes && buffer[i + 1] === 10) { crlf++; i++; }
        else if (!(partial && i === bytes - 1)) bareCr++;
      } else if (buffer[i] === 10) {
        lf++;
      }
    }
    const sample = partial ? `; sampled first ${bytes} byte(s)` : '';
    if (!lf && !crlf && !bareCr) {
      return `EOL: no line endings detected${partial ? ` in first ${bytes} byte(s)` : ''}.`;
    }
    const kinds = Number(lf > 0) + Number(crlf > 0) + Number(bareCr > 0);
    const kind = kinds > 1 ? 'mixed' : crlf ? 'CRLF' : lf ? 'LF' : 'CR';
    return `EOL: ${kind} (${lf} LF, ${crlf} CRLF, ${bareCr} bare CR${sample}).`;
  } catch {
    return 'EOL: unavailable (could not read file).';
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* Keep this lock-time check advisory. */ }
    }
  }
}

/** WF-G129: which of these repo-relative paths already differ from HEAD.
 *  Git shows the change, not its author. A granted lock proves only that no
 *  conflicting Agora lock blocked the claim (WF-G223), not that an online
 *  sibling did or did not make the edit. This remains advice, not a gate. */
export function dirtyInWorktree(paths, repoRoot = REPO_ROOT, { lockGranted = false } = {}) {
  if (!paths.length) return [];
  // WF-G144 (2026-09-09): a lock path may name a SIBLING checkout
  // (`Entity-Generator/README.md`, `entity-forge/src/...`). Those live beside
  // the repo root, not under it, so they are grouped by that checkout and
  // both the git status and the existence check run there; otherwise every
  // one of them was a false "does not exist" hint (33 in one H1b lock call).
  const parent = path.resolve(repoRoot, '..');
  const groups = new Map(); // root -> [relative paths]
  for (const p of paths) {
    const rel = String(p).replace(/\\/g, '/');
    const first = rel.split('/')[0];
    // A sibling checkout beside the repo root; a plain directory counts too,
    // because F:/Repos/Aralia-operator-dashboard is not a git repository (GG-231)
    // and its files must still be found rather than reported as ghosts.
    const siblingDir = path.join(parent, first);
    const sibling = first && first !== '.' && first !== '..' && !fs.existsSync(path.resolve(repoRoot, first))
      && fs.existsSync(siblingDir) && fs.statSync(siblingDir).isDirectory() ? siblingDir : null;
    const root = sibling || repoRoot;
    const inRoot = sibling ? rel.slice(first.length + 1) : rel;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push({ rel, inRoot });
  }
  const out = [];
  const provenanceHint = lockGranted
    ? 'Agora granted this lock without a conflicting active lock, but Git cannot identify who made the change.'
    : 'Git cannot identify who made the change.';
  for (const [root, entries] of groups) {
    const label = root === repoRoot ? '' : ` [${path.basename(root)}]`;
    // A checkout with no commits (entity-forge, 2026-09-09) reports EVERY file
    // as untracked, which is noise, and `git diff` there can show nothing.
    // Say that once instead of one hint per path.
    let hasCommits = true;
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
    } catch {
      hasCommits = false;
    }
    if (!hasCommits && fs.existsSync(path.join(root, '.git'))) {
      out.push(`${path.basename(root)} has no commits, so git cannot tell your work from a sibling's; read the file before you edit it (WF-G129).`);
    }
    let porcelain = '';
    try {
      porcelain = execFileSync('git', ['status', '--porcelain', '--', ...entries.map((e) => e.inRoot)], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
      });
    } catch {
      porcelain = '';
    }
    for (const { rel, inRoot } of entries) {
      if (/[*?[]/.test(inRoot)) continue;
      if (!fs.existsSync(path.resolve(root, inRoot))) {
        // WF-G183: this warning used to fire on EVERY new-file lock, which is
        // the normal case for a task that exists to create the file. A warning
        // that always fires trains agents to ignore it — and that is exactly
        // when the real stale-path case (a renamed file) gets ignored too.
        //
        // The two cases are told apart by git history: a path git has NEVER
        // seen is new, and the lock is correct. A path git DID see, and that a
        // rename moved away, is stale, and the hint names the new name.
        // ORDER MATTERS. `everTracked` is one cheap pathspec query;
        // `renameTargetOf` has to scan history WITHOUT a pathspec (git prunes
        // the rename commit out of the log for the old name) and costs seconds
        // on this repository. A brand-new path is the common case, so it must
        // never reach the expensive scan.
        if (!everTracked(root, inRoot)) {
          // WF-G279: src/hooks/combat/useBattleMap.ts was silently accepted
          // although src/hooks/useBattleMap.ts already existed. Do not turn
          // every legitimate new-file lock into a warning (WF-G183); name the
          // specific ambiguity when this basename is present elsewhere.
          const candidates = existingSameBasename(root, inRoot);
          if (candidates.length) {
            out.push(`${rel}${label} does not exist in the worktree (WF-G279); same-named file(s): ${candidates.join(', ')}. If this is not a deliberate new file, lock the existing path instead.`);
            continue;
          }
          if (!fs.existsSync(path.dirname(path.resolve(root, inRoot)))) {
            out.push(`${rel}${label} does not exist, and neither does its parent directory (WF-G136). Check the path before you create it.`);
          }
          // A brand-new path under a directory that exists prints NOTHING: that
          // is a correct lock for a file this task creates.
          continue;
        }
        const renamedTo = renameTargetOf(root, inRoot);
        if (renamedTo) {
          out.push(`${rel}${label} does not exist in the worktree (WF-G136): git history shows it was RENAMED to ${renamedTo}. Lock that path instead.`);
        } else {
          out.push(`${rel}${label} does not exist in the worktree (WF-G136): git history holds this path, so it was DELETED or renamed outside the recent scan. Confirm that before you recreate it (git log --all --diff-filter=D -- '${inRoot}').`);
        }
      }
    }
    for (const raw of porcelain.split(/\r?\n/)) {
      if (!raw.trim()) continue;
      const code = raw.slice(0, 2);
      const file = raw.slice(3).trim().replace(/\\/g, '/');
      if (!hasCommits) continue;
      const what = code === '??' ? 'untracked' : code.includes('D') ? 'deleted' : 'already modified in the working tree';
      // WF-G173: the hint used to say "run git diff -- <file>" for EVERY case.
      // git diff prints nothing for an untracked file, so an agent that
      // followed the advice saw an empty diff, read it as "no sibling work",
      // and proceeded with false confidence. An untracked file has no HEAD to
      // diff against, so the hint names what it DOES have: size and mtime.
      if (code === '??') {
        out.push(`${file}${label} is untracked before your lock (WF-G129): git diff shows NOTHING for an untracked file. ${fileFacts(root, file)} ${fileLineEndings(root, file)} ${provenanceHint} Read the file before you write over it.`);
      } else {
        // WF-G292: some fleet packets prohibit Git commands. The warning must
        // still offer a safe next step that every worker can follow.
        const nextStep = code.includes('D')
          ? 'Check why it was removed before recreating it.'
          : 'Read the current file before editing; preserve any existing changes you cannot attribute to this task.';
        const facts = code.includes('D') ? '' : fileFacts(root, file);
        out.push(`${file}${label} is ${what} before your lock (WF-G129): ${facts ? `${facts} ` : ''}${provenanceHint} ${nextStep}`);
      }
    }
  }
  return out;
}

async function cmdLock(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  if (parsed.flags.partial !== undefined && parsed.flags.partial !== true) {
    out.log('lock failed: --partial takes no value; put it after paths or before another flag');
    return { code: 1 };
  }
  if (parsed.flags.partial && parsed.flags['id-only']) {
    out.log('lock failed: --partial cannot be combined with --id-only (it may acquire several lock ids)');
    return { code: 1 };
  }
  if (typeof parsed.flags.renew === 'string') {
    if (parsed.flags.partial) {
      out.log('lock failed: --partial applies to new locks, not --renew');
      return { code: 1 };
    }
    const lockId = parsed.flags.renew;
    const body = {};
    if (parsed.flags.ttl !== undefined) {
      const mins = Number(parsed.flags.ttl);
      if (Number.isFinite(mins) && mins > 0) body.ttlMs = Math.round(mins * 60000);
    }
    const r = await api(baseUrl, 'POST', `/locks/${encodeURIComponent(lockId)}/renew`, { token, body });
    if (r.status === 200 && r.json && r.json.lock) {
      out.log(`Lock renewed: ${r.json.lock.id}`);
      out.log(`  expires ${relativeTime(r.json.lock.expiresAt)}`);
      return { code: 0, lock: r.json.lock };
    }
    out.log(`lock renew failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }
  if (hasAmbiguousReasonTail(parsed.raw)) {
    out.log('lock failed: quote the complete --reason value; trailing bare words are not accepted as paths');
    return { code: 1 };
  }
  const paths = parsed._.slice(); // all positionals are paths
  const suspiciousPaths = suspiciousBarePathTokens(paths);
  if (suspiciousPaths.length) {
    out.log(`lock failed: unrecognised bare path token(s): ${suspiciousPaths.join(', ')}; put explanatory text in a quoted --reason value`);
    return { code: 1 };
  }
  const globs = asArray(parsed.flags.glob).filter((g) => typeof g === 'string');
  if (paths.length === 0 && globs.length === 0) {
    out.log('Usage: lock <path...> [--glob g...] [--reason "..."] [--ttl <minutes>] [--partial]');
    return { code: 1 };
  }
  const body = { paths, globs };
  if (typeof parsed.flags.reason === 'string') body.reason = parsed.flags.reason;
  if (parsed.flags.ttl !== undefined) {
    const mins = Number(parsed.flags.ttl);
    if (Number.isFinite(mins)) body.ttlMs = Math.round(mins * 60000);
  }
  if (parsed.flags.partial) {
    const requested = [
      ...paths.map((value) => ({ kind: 'path', value })),
      ...globs.map((value) => ({ kind: 'glob', value })),
    ];
    const seen = new Set();
    const targets = requested.filter(({ kind, value }) => {
      const key = `${kind}:${value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const results = [];
    let agentMap;
    for (const target of targets) {
      const one = {
        paths: target.kind === 'path' ? [target.value] : [],
        globs: target.kind === 'glob' ? [target.value] : [],
      };
      if (body.reason !== undefined) one.reason = body.reason;
      if (body.ttlMs !== undefined) one.ttlMs = body.ttlMs;
      const response = await api(baseUrl, 'POST', '/locks', { token, body: one });
      if (response.status === 201 && response.json && response.json.lock) {
        const lock = response.json.lock;
        out.log(`ACQUIRED ${target.kind} "${target.value}": lock ${lock.id}, expires ${relativeTime(lock.expiresAt)}`);
        for (const warning of response.json.warnings || []) out.log(`  !! ${warning}`);
        for (const line of dirtyInWorktree(lock.paths || [], REPO_ROOT, { lockGranted: true })) out.log(`  !! ${line}`);
        results.push({ ...target, status: 'acquired', lock });
      } else if (response.status === 409 && response.json && response.json.conflict) {
        agentMap ||= await buildAgentMap(baseUrl);
        out.log(`NOT ACQUIRED ${target.kind} "${target.value}":`);
        printLockConflict(out, response.json.conflict, agentMap);
        results.push({ ...target, status: 'conflict', conflict: response.json.conflict });
      } else {
        out.log(`NOT ACQUIRED ${target.kind} "${target.value}": ${response.json ? response.json.error : response.text} (${response.status})`);
        results.push({ ...target, status: 'error', error: response.json ? response.json.error : response.text });
      }
    }
    const locks = results.filter((result) => result.status === 'acquired').map((result) => result.lock);
    const incomplete = results.length - locks.length;
    out.log(`Partial lock result: ${locks.length} acquired, ${incomplete} not acquired. Only ACQUIRED targets may be edited.${incomplete ? ' Incomplete batch; exit 1.' : ''}`);
    return { code: incomplete ? 1 : 0, locks, results };
  }
  const r = await api(baseUrl, 'POST', '/locks', { token, body });
  if (r.status === 201 && r.json && r.json.lock) {
    // Iteration-2 (Wave-1/2 feedback): --id-only prints just the id so agents
    // can capture it without regex-scraping the human-readable output. Keep
    // safety hints visible on stderr; otherwise this mode silently accepts a
    // misplaced target (WF-G279).
    if (parsed.flags['id-only']) {
      for (const warning of r.json.warnings || []) out.warn(`!! ${warning}`);
      for (const line of dirtyInWorktree(r.json.lock.paths || [], REPO_ROOT, { lockGranted: true })) out.warn(`!! ${line}`);
      out.log(r.json.lock.id);
      return { code: 0, lock: r.json.lock };
    }
    out.log(`Lock acquired: ${r.json.lock.id}`);
    const targets = [...(r.json.lock.paths || []), ...(r.json.lock.globs || [])];
    out.log(`  ${targets.join(', ')}`);
    out.log(`  expires ${relativeTime(r.json.lock.expiresAt)}`);
    // WF-G91: the same file under a different root prefix is not a conflict
    // the daemon can prove, so it is reported as a warning for a human eye.
    for (const w of r.json.warnings || []) out.log(`  !! ${w}`);
    // WF-G129 (2026-09-09): a free lock is not a quiet file. In a shared
    // checkout the file may already carry a sibling's uncommitted work, and a
    // worker who does not know that mistakes it for its own diff. Say so once,
    // at the moment the worker takes ownership; the hint never blocks the lock.
    for (const line of dirtyInWorktree(r.json.lock.paths || [], REPO_ROOT, { lockGranted: true })) out.log(`  !! ${line}`);
    return { code: 0, lock: r.json.lock, warnings: r.json.warnings || [] };
  }
  if (r.status === 409 && r.json && r.json.conflict) {
    const c = r.json.conflict;
    const map = await buildAgentMap(baseUrl);
    printLockConflict(out, c, map);
    const targets = [
      ...paths.map((value) => ({ kind: 'path', value })),
      ...globs.map((value) => ({ kind: 'glob', value })),
    ];
    if (targets.length > 1) {
      out.log(`No locks acquired by this atomic call; ${targets.length - 1} other requested target(s) were NOT acquired either.`);
      for (const target of targets) out.log(`  NOT ACQUIRED ${target.kind} "${target.value}"`);
      out.log('Use --partial to acquire available targets and see each conflict, or retry a smaller batch.');
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

function printLockConflict(out, conflict, agentMap) {
  if (conflict.type === 'reservation' && conflict.reservation) {
    const reservation = conflict.reservation;
    out.log(`CONFLICT: "${conflict.path}" is reserved by ${handleFor(agentMap, reservation.agentId)} at #${reservation.position}`);
    const targets = [...(reservation.paths || []), ...(reservation.globs || [])];
    out.log(`  reservation ${reservation.id} covers: ${targets.join(', ')}`);
    if (reservation.reason) out.log(`  reason: ${reservation.reason}`);
    return;
  }
  out.log(`CONFLICT: "${conflict.path}" is locked by ${handleFor(agentMap, conflict.heldBy)}`);
  if (conflict.lock) {
    const targets = [...(conflict.lock.paths || []), ...(conflict.lock.globs || [])];
    out.log(`  held lock ${conflict.lock.id} covers: ${targets.join(', ')}`);
    if (conflict.lock.reason) out.log(`  reason: ${conflict.lock.reason}`);
    out.log(`  expires ${relativeTime(conflict.lock.expiresAt)}`);
  }
}

async function cmdUnlock(out, parsed, env, baseUrl) {
  // WF-G156 (2026-09-13): `unlock a.ts b.ts` used to release only a.ts and
  // silently keep b.ts for the 30 min TTL. Every positional argument is now
  // released in turn; the exit code is 0 only when every one succeeded.
  const args = (parsed._ || []).filter((a) => typeof a === 'string' && a.length);
  if (args.length > 1) {
    let code = 0;
    for (const one of args) {
      const r = await cmdUnlockOne(out, { ...parsed, _: [one] }, env, baseUrl);
      if (r.code !== 0) code = r.code;
    }
    return { code };
  }
  return cmdUnlockOne(out, parsed, env, baseUrl);
}

async function cmdUnlockOne(out, parsed, env, baseUrl) {
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
    const tokens = [...(l.paths || []), ...(l.globs || [])];
    // WF-G122: releasing ONE path of a multi-token lock shrinks the record
    // instead of deleting it, so the worker keeps its other files.
    if (!releaseAll && tokens.length > 1) {
      const mine = tokens.filter((t) => t === arg || t.replace(/\\/g, '/') === arg.replace(/\\/g, '/'));
      const body = { paths: mine.filter((t) => (l.paths || []).includes(t)), globs: mine.filter((t) => (l.globs || []).includes(t)) };
      const sr = await api(baseUrl, 'POST', `/locks/${encodeURIComponent(l.id)}/shrink`, { token, body });
      if (sr.status === 200 && sr.json) {
        ok++;
        if (sr.json.released) out.log(`Released ${l.id}  (last token ${mine.join(', ')})`);
        else out.log(`Shrunk ${l.id}: released ${mine.join(', ')}; still held: ${[...(sr.json.lock.paths || []), ...(sr.json.lock.globs || [])].join(', ')}`);
        continue;
      }
      if (sr.status !== 404) { out.log(`shrink failed (${sr.status}): ${sr.json ? sr.json.error : sr.text}`); continue; }
      // 404 = an older daemon without the route; fall through to the whole-record release.
    }
    const r = await api(baseUrl, 'DELETE', `/locks/${encodeURIComponent(l.id)}`, { token });
    if (r.status === 200) { ok++; out.log(`Released ${l.id}  (${tokens.join(', ')})`); }
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
    // WF-G116: a heartbeat-renewed lock used to look identical to live work.
    // The holder's idle time and repo now travel with every listed lock.
    const repo = l.repo ? `  [${l.repo}]` : '';
    out.log(`${l.id}  ${handleFor(map, l.agentId).padEnd(16)} ${targets.join(', ')}${repo}  expires ${relativeTime(l.expiresAt)}${expiryFlag(l.expiresAt)}${idleNote(l)}${reason}`);
  }
  return { code: 0, locks };
}

async function cmdReserve(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  if (hasAmbiguousReasonTail(parsed.raw)) {
    out.log('reserve failed: quote the complete --reason value; trailing bare words are not accepted as paths');
    return { code: 1 };
  }
  const paths = parsed._.slice();
  const suspiciousPaths = suspiciousBarePathTokens(paths);
  if (suspiciousPaths.length) {
    out.log(`reserve failed: unrecognised bare path token(s): ${suspiciousPaths.join(', ')}; put explanatory text in a quoted --reason value`);
    return { code: 1 };
  }
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
  const qs = parsed.flags.force === true ? '?force=1' : '';
  const r = await api(baseUrl, 'DELETE', `/reservations/${encodeURIComponent(target)}${qs}`, { token });
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

/** Seats: the durable identity that owns a campaign (phase 3, D-B/D-L/D-AB).
 *
 *  A session is a day; a seat is a person. Before seats, a campaign's owner
 *  was a session, so every campaign read "owner gone" as soon as that session
 *  ended — which was every campaign, always.
 */
async function cmdSeat(out, parsed, env, baseUrl) {
  const sub = parsed._[0] || 'list';

  if (sub === 'list' || sub === 'ls') {
    const r = await api(baseUrl, 'GET', '/seats', {});
    if (r.status !== 200 || !r.json) {
      out.log(`seats failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const seats = r.json.seats || [];
    if (!seats.length) {
      out.log('No seats yet. Create one: seat new <name>');
      out.log('  A seat is a lasting identity that owns a campaign, so the campaign');
      out.log('  keeps its owner after your session ends.');
      return { code: 0, seats };
    }
    for (const s of seats) {
      const who = s.attended ? `held by ${s.holderHandle || s.holder}` : 'nobody on it';
      const owns = s.campaigns.length ? `  owns ${s.campaigns.length}` : '';
      out.log(`  ${s.name}  (${who})${owns}${s.note ? '  — ' + s.note : ''}`);
      if ((s.formerNames || []).length) out.log(`      also known as: ${s.formerNames.join(', ')}`);
    }
    return { code: 0, seats };
  }

  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };

  if (sub === 'new' || sub === 'create') {
    const name = parsed._[1];
    if (!name) {
      out.log('Usage: seat new <name> [--note "..."]');
      out.log('  The name may not say the JOB (that is a role, which seats replace)');
      out.log('  and may not name a model (a seat must outlive a model change).');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', '/seats', { token, body: { name, note: parsed.flags.note } });
    if (r.status !== 200 || !r.json) {
      out.log(`seat new failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log(`Seat created: ${r.json.seat.name}`);
    out.log(`  Take it at sign-in: register <handle> --pet <slug> --seat ${r.json.seat.name}`);
    return { code: 0, seat: r.json.seat };
  }

  if (sub === 'release') {
    const r = await api(baseUrl, 'POST', '/seats/release', {
      token, body: { seat: parsed._[1], why: parsed.flags.why },
    });
    if (r.status !== 200 || !r.json) {
      out.log(`seat release failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log(`Seat released: ${r.json.seat.name}`);
    return { code: 0, seat: r.json.seat };
  }

  if (sub === 'rename') {
    const r = await api(baseUrl, 'POST', '/seats/rename', {
      token, body: { seat: parsed._[1], name: parsed._[2], why: parsed.flags.why },
    });
    if (r.status !== 200 || !r.json) {
      out.log(`seat rename failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log(`Seat renamed to ${r.json.seat.name}; it also answers to ${(r.json.seat.formerNames || []).join(', ')}`);
    return { code: 0, seat: r.json.seat };
  }

  if (sub === 'diary') {
    const text = parsed._.slice(1).join(' ');
    const r = await api(baseUrl, 'POST', '/seats/diary', {
      token, body: { seat: parsed.flags.seat, text },
    });
    if (r.status !== 200 || !r.json) {
      out.log(`seat diary failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log(`Noted on seat ${r.json.seat.name} (${r.json.seat.diary.length} entries)`);
    return { code: 0, seat: r.json.seat };
  }

  out.log(`unknown seat subcommand "${sub}". Use: seat list|new|release|rename|diary`);
  return { code: 1 };
}

async function cmdCampaign(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const rest = parsed._.slice(1);

  // WF-G154: campaign list subcommand
  if (sub === 'list') {
    return await cmdCampaignList(out, parsed, env, baseUrl);
  }

  // Design §72: two reads that need no token, like `campaigns`.
  if (sub === 'show') {
    const campaignId = rest[0];
    if (!campaignId) {
      out.log('Usage: campaign show <id>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'GET', `/campaigns/${encodeURIComponent(campaignId)}`);
    if (r.status !== 200 || !r.json) {
      out.log(`campaign show failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const v = r.json;
    const c = v.campaign;
    out.log(`${c.id} (${c.name}) [${c.state}]  ${c.attended ? 'attended' : 'unattended'}${c.adoptable ? ', adoptable' : ''}`);
    out.log(`  attended: ${c.attended ? 'yes' : 'no'}${c.seatName ? ` (seat: ${c.seatName})` : ''}`);
    if (v.legacy) {
      out.log('  charter: none (legacy campaign)');
    } else {
      out.log(`  charter: ${c.charter.status}, tier ${c.charter.body.tier}, risk ${c.charter.body.risk}, ${c.charter.revisions.length} revision(s)`);
      out.log(`  plan map: ${c.charter.body.planMapPrimary} ${v.validation.planMapHealth.ok ? 'ok' : '- ' + v.validation.planMapHealth.problems.join('; ')}`);
      for (const e of v.validation.errors) out.log(`  INVALID: ${e}`);
    }
    // WF-G154: show deputies if this is a lead campaign
    const allCampsRes = await api(baseUrl, 'GET', '/campaigns');
    const allCamps = (allCampsRes.json && allCampsRes.json.campaigns) || [];
    const deputies = allCamps.filter((d) => d.leadCampaignId === c.id);
    if (deputies.length) {
      out.log(`  deputies (${deputies.length}):`);
      for (const d of deputies) {
        const depNamed = d.name && d.name !== d.id ? `${d.id} (${d.name})` : d.id;
        out.log(`    - ${depNamed} [${d.state}]  ${d.attended ? 'attended' : 'unattended'}  ${d.scope || ''}`);
      }
    }
    // WF-G154: show tasks breakdown by state
    const tasksByState = {};
    for (const t of v.tasks || []) {
      tasksByState[t.state] = (tasksByState[t.state] || 0) + 1;
    }
    const stateBreakdown = Object.entries(tasksByState)
      .map(([st, count]) => `${count} ${st}`)
      .join(', ');
    out.log(`  tasks by state: ${stateBreakdown || 'no tasks'}`);
    out.log(`  progress: ${v.progress.done} of ${v.progress.total} tasks done (${v.progress.note})`);
    for (const t of v.tasks) out.log(`  - ${t.id} [${t.state}] ${t.title}${t.agentTrail.length ? '  trail: ' + t.agentTrail.join(' > ') : ''}`);
    return { code: 0, view: v, deputies };
  }

  if (sub === 'triage' && (rest[0] === 'report' || !rest[0])) {
    const campaignId = rest[1];
    if (!campaignId) {
      out.log('Usage: campaign triage report <id>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'GET', `/campaigns/${encodeURIComponent(campaignId)}/triage`);
    if (r.status !== 200 || !r.json) {
      out.log(`campaign triage report failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const rep = r.json;
    out.log(`READ-ONLY triage report for ${rep.campaign.id} [${rep.campaign.state}] ${rep.campaign.adoptable ? 'adoptable' : 'not adoptable'}; triage ${rep.triage.state}`);
    for (const note of rep.notes) out.log(`  note: ${note}`);
    for (const t of rep.tasks) {
      out.log(`  - ${t.id} [${t.state}] ${t.title}`);
      out.log(`      advice: ${t.recommendation.disposition} (${t.recommendation.why})${t.disposition ? `; applied: ${t.disposition.disposition}` : ''}`);
    }
    return { code: 0, report: rep };
  }

  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };

  if (sub === 'charter') {
    const campaignId = rest[0];
    const file = typeof parsed.flags.file === 'string' ? parsed.flags.file : '';
    const summary = typeof parsed.flags.summary === 'string' ? parsed.flags.summary : '';
    if (!campaignId || !file || !summary) {
      out.log('Usage: campaign charter <id> --file <charter.json> --summary "what changed"');
      return { code: 1 };
    }
    let charter;
    try {
      charter = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      out.log(`campaign charter: cannot read ${file}: ${e.message}`);
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/charter`, { token, body: { charter, summary } });
    if (r.status === 200 && r.json && r.json.ok) {
      out.log(`charter stored for ${campaignId}: ${r.json.charter.status}, tier ${r.json.charter.body.tier}`);
      for (const w of r.json.warnings || []) out.log(`  warning: ${w}`);
      return { code: 0, charter: r.json.charter };
    }
    out.log(`campaign charter refused (${r.status}): ${r.json ? r.json.error : r.text}`);
    for (const e of (r.json && r.json.errors) || []) out.log(`  - ${e}`);
    return { code: 1, errors: r.json && r.json.errors };
  }

  if (sub === 'approve') {
    const campaignId = rest[0];
    const note = typeof parsed.flags.note === 'string' ? parsed.flags.note : '';
    if (!campaignId || !note) {
      out.log('Usage: campaign approve <id> --note "what you read"');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/charter/approve`, { token, body: { note } });
    if (r.status === 200 && r.json && r.json.ok) {
      out.log(`charter approved for ${campaignId}`);
      return { code: 0, charter: r.json.charter };
    }
    out.log(`campaign approve failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    for (const e of (r.json && r.json.errors) || []) out.log(`  - ${e}`);
    return { code: 1 };
  }

  if (sub === 'triage') {
    const action = rest[0];
    const campaignId = rest[1];
    const reason = typeof parsed.flags.reason === 'string' ? parsed.flags.reason : '';
    if (action === 'start' || action === 'finish') {
      if (!campaignId || !reason) {
        out.log(`Usage: campaign triage ${action} <id> --reason "why"`);
        return { code: 1 };
      }
      const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/triage/${action}`, { token, body: { reason } });
      if (r.status === 200 && r.json && r.json.ok) {
        out.log(`triage ${action === 'start' ? 'started' : 'finished'} for ${campaignId}`);
        return { code: 0, result: r.json };
      }
      out.log(`campaign triage ${action} failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    if (action === 'apply') {
      const taskId = rest[2];
      const disposition = rest[3];
      if (!campaignId || !taskId || !disposition || !reason) {
        out.log('Usage: campaign triage apply <id> <taskId> <continue|reopen|reassign|block|escalate|supersede|close-obsolete> --reason "why" [--to <agentId>] [--blocker "..."] [--superseded-by <taskId>] [--approval "the human\'s words"] [--evidence "..."]');
        return { code: 1 };
      }
      const body = { disposition, reason };
      if (typeof parsed.flags.to === 'string') body.toAgentId = parsed.flags.to;
      if (typeof parsed.flags.blocker === 'string') body.blocker = parsed.flags.blocker;
      if (typeof parsed.flags['superseded-by'] === 'string') body.supersededBy = parsed.flags['superseded-by'];
      if (typeof parsed.flags.approval === 'string') body.approvalQuote = parsed.flags.approval;
      if (typeof parsed.flags.evidence === 'string') body.evidence = parsed.flags.evidence;
      const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/triage/${encodeURIComponent(taskId)}`, { token, body });
      if (r.status === 200 && r.json && r.json.ok) {
        out.log(`${taskId}: ${disposition} (${r.json.record.from} -> ${r.json.record.to})`);
        return { code: 0, record: r.json.record };
      }
      out.log(`campaign triage apply failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log('Usage: campaign triage report|start|apply|finish ...');
    return { code: 1 };
  }

  if (sub === 'claim') {
    const campaignId = rest[0];
    if (!campaignId) {
      out.log('Usage: campaign claim <id> [--role lead|deputy] [--lead <id>] [--scope "..."] [--path <p>...] [--glob <g>...] [--wave <name>] [--planmap <topic>[/<feature>]]');
      out.log('  --planmap states the Plan Map topic this effort serves (WF-G207). It is what rank 1 of the');
      out.log('  membership mapping compares against, so the board and the Plan Map hold the link ONCE.');
      return { code: 1 };
    }
    const body = { id: campaignId };
    // WF-G207: accept a bare topic id as well as a full planmap: reference.
    const planmapFlag = typeof parsed.flags.planmap === 'string' ? parsed.flags.planmap.trim() : '';
    if (planmapFlag) body.planmapRef = /^planmap:/i.test(planmapFlag) ? planmapFlag : 'planmap:' + planmapFlag;
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
      out.log('Usage: campaign state <id> <active|blocked|done> [--reason "..."]');
      return { code: 1 };
    }
    // WF-G86: closure and blocking carry a reason into the campaign history.
    // WF-G83: an orchestrator/master/human may close an UNATTENDED campaign it
    // does not own, and the daemon requires the reason for that path.
    const body = { state };
    if (typeof parsed.flags.reason === 'string') body.reason = parsed.flags.reason;
    if ((state === 'blocked' || state === 'done') && typeof parsed.flags.reason !== 'string') {
      out.log(`campaign state ${state} needs --reason "<why>" (WF-G86)`);
      return { code: 1 };
    }
    const r = await api(baseUrl, 'POST', `/campaigns/${encodeURIComponent(campaignId)}/state`, { token, body });
    if (r.status === 200 && r.json && r.json.campaign) {
      out.log(`${r.json.campaign.id} -> [${r.json.campaign.state}]`);
      const last = (r.json.campaign.history || []).slice(-1)[0];
      if (last && last.adoptedClosure) out.log(`  closed as command-channel closure of an unattended campaign (previous owner ${last.previousOwner})`);
      return { code: 0, campaign: r.json.campaign };
    }
    out.log(`campaign state failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  out.log(`unknown campaign subcommand "${sub}". Use: campaign list|show|claim|state|charter|approve|triage`);
  return { code: 1 };
}

/** D-AC: close campaigns that hold no work and that nobody is on.
 *
 *  The preview is the default. Closing writes only with --apply, because the
 *  printed list has to come first — that is half the decision, not a courtesy.
 */
async function cmdSweep(out, parsed, env, baseUrl) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  const apply = Boolean(parsed.flags.apply);
  const minAgeDays = parsed.flags.days ? Number(parsed.flags.days) : undefined;
  const r = await api(baseUrl, 'POST', '/campaigns/sweep' + (apply ? '?apply=1' : ''), {
    token, body: { minAgeDays, note: parsed.flags.note },
  });
  if (r.status !== 200 || !r.json) {
    out.log(`campaign sweep failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }
  const j = r.json;
  const list = j.closing || [];
  out.log(`${apply ? 'CLOSED' : 'WOULD close'} ${list.length} campaign(s) — empty, unattended, ${j.minAgeDays}+ days old:`);
  for (const c of list) out.log(`  ${c.id}  ${c.name}  ${c.ageDays} days  ${c.tasks} tasks`);
  // Every campaign left alone names its own reason, so the list is auditable
  // rather than a number the reader has to take on trust.
  out.log(`Left alone (${(j.kept || []).length}):`);
  for (const c of j.kept || []) out.log(`  ${c.id}  ${c.name} — ${c.why}`);
  if (!apply) out.log('Nothing was written. Add --apply to close them.');
  return { code: 0, result: j };
}

// ============================================================================
// Campaign Listing & Inspection (WF-G154)
// ============================================================================
// This function lists campaigns from the Agora daemon and formats them into
// a clean, readable hierarchy. It shows whether campaigns are attended,
// nests deputy campaigns directly under their lead campaign, and summarizes
// the number of tasks that are currently open versus done.
//
// Called by: `campaign list` and the top-level `campaigns` CLI command.
// Supports: `--state <active|blocked|done>` and `--mine` (filters to campaigns
// owned by or linked to the current agent session/seat).
// ============================================================================
async function cmdCampaignList(out, parsed, env, baseUrl) {
  const params = [];
  if (typeof parsed.flags.state === 'string') params.push(`state=${encodeURIComponent(parsed.flags.state)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const r = await api(baseUrl, 'GET', `/campaigns${qs}`);
  let campaigns = (r.json && r.json.campaigns) || [];

  // Filter to campaigns owned by the current agent if --mine is requested
  if (parsed.flags.mine) {
    const id = loadIdentity(env, baseUrl);
    if (!id) {
      out.log('cannot filter --mine without stored identity (onboard first)');
      return { code: 1 };
    }
    const myAgentId = id.agentId;
    const mySeatId = id.seatId || '';
    const myLeadIds = new Set(
      campaigns
        .filter((c) => c.role === 'lead' && (c.agentId === myAgentId || (mySeatId && c.seatId === mySeatId)))
        .map((c) => c.id),
    );
    const myDeputyLeadIds = new Set(
      campaigns
        .filter((c) => c.role === 'deputy' && (c.agentId === myAgentId || (mySeatId && c.seatId === mySeatId)))
        .map((c) => c.leadCampaignId)
        .filter(Boolean),
    );
    campaigns = campaigns.filter((c) => {
      if (c.agentId === myAgentId || (mySeatId && c.seatId === mySeatId)) return true;
      if (c.leadCampaignId && myLeadIds.has(c.leadCampaignId)) return true;
      if (c.role === 'lead' && myDeputyLeadIds.has(c.id)) return true;
      return false;
    });
  }

  if (!campaigns.length) {
    out.log(parsed.flags.mine ? 'no campaigns matching --mine' : 'no campaigns');
    return { code: 0, campaigns };
  }

  // Fetch all tasks on the board to calculate open and done task counts per campaign
  const tasksRes = await api(baseUrl, 'GET', '/tasks');
  const allTasks = (tasksRes.json && tasksRes.json.tasks) || [];
  const taskCounts = {};
  for (const t of allTasks) {
    const cid = t.campaignId;
    if (!cid) continue;
    if (!taskCounts[cid]) taskCounts[cid] = { total: 0, open: 0, done: 0 };
    taskCounts[cid].total++;
    if (t.state === 'open') taskCounts[cid].open++;
    else if (t.state === 'done') taskCounts[cid].done++;
  }

  const map = await buildAgentMap(baseUrl);

  // Group child deputies by their lead campaign ID so they can be nested under the lead
  const deputiesByLead = new Map();
  for (const c of campaigns) {
    if (c.role === 'deputy' && c.leadCampaignId) {
      if (!deputiesByLead.has(c.leadCampaignId)) deputiesByLead.set(c.leadCampaignId, []);
      deputiesByLead.get(c.leadCampaignId).push(c);
    }
  }

  const renderedIds = new Set();

  function printCampaignLine(c, indent = '') {
    const targets = [...(c.paths || []), ...(c.globs || [])].join(', ');
    const lead = c.leadCampaignId ? `  lead:${c.leadCampaignId}` : '';
    const wave = c.wave ? `  wave:${c.wave}` : '';
    const owner = c.seatName
      ? `  seat:${c.seatName}  ${c.attended ? 'attended' : 'UNATTENDED'}`
      : '  no seat — UNATTENDED';
    const named = c.name && c.name !== c.id ? `${c.id} (${c.name})` : c.id;
    const cnt = taskCounts[c.id] || { total: 0, open: 0, done: 0 };
    const taskInfo = `  tasks: ${cnt.open} open, ${cnt.done} done (${cnt.total} total)`;
    out.log(`${indent}${named}  [${c.state}/${c.role}]  @${handleFor(map, c.agentId)}${lead}${wave}${owner}${taskInfo}  ${c.scope || '(no scope note)'}`);
    if (targets) out.log(`${indent}  scope files: ${targets}`);
    for (const warning of c.warnings || []) out.log(`${indent}  warning: ${warning}`);
    renderedIds.add(c.id);
  }

  // Print leads first, with their deputies indented underneath
  for (const c of campaigns) {
    if (c.role === 'deputy' && c.leadCampaignId && campaigns.some((other) => other.id === c.leadCampaignId)) {
      continue;
    }
    printCampaignLine(c);
    const deps = deputiesByLead.get(c.id) || [];
    for (const d of deps) {
      printCampaignLine(d, '  ');
    }
  }

  // Fallback print for any orphan deputies whose lead was not present in the current filter
  for (const c of campaigns) {
    if (!renderedIds.has(c.id)) {
      printCampaignLine(c);
    }
  }

  return { code: 0, campaigns };
}

async function cmdCampaigns(out, parsed, env, baseUrl) {
  return await cmdCampaignList(out, parsed, env, baseUrl);
}

// Successor flag: a task that carries a `retrace` dossier was reopened because
// its previous worker died mid-job, leaving half-finished edits sitting in the
// shared tree. Whoever claims it next must NOT blind-restart — they should run
// `retrace <id>` to read the dead worker's trail (identity, durable files, last
// checkpoint, and all working-tree surfaces) before deciding what to keep or redo. This
// prints that one-line warning right after a claim so the doctrine is visible
// at the exact moment it matters.
function printSuccessorFlag(out, task) {
  if (!task || !task.retrace) return;
  const who = (task.retrace.agent && task.retrace.agent.handle) || 'a reaped agent';
  const times = task.reapCount && task.reapCount > 1 ? ` (reaped ${task.reapCount}×)` : '';
  out.log(`  ⚠ reaped from ${who}${times} — run \`retrace ${shortId(task.id)}\` before you start; do not blind-restart.`);
}

// WF-G303: reuse the canonical task entries in the help text so task help cannot
// drift from the flags printed by top-level help.
function taskUsage(sub) {
  const entries = [];
  let current = null;
  for (const line of usageText().split('\n')) {
    if (/^  task\s+\S/.test(line)) {
      current = [line];
      entries.push(current);
    } else if (current && /^\s{4,}\S/.test(line)) {
      current.push(line);
    } else {
      current = null;
    }
  }
  const name = sub === 'view' ? 'show' : sub;
  const matching = name && name !== 'help'
    ? entries.filter(([line]) => line.startsWith(`  task ${name} `))
    : entries;
  return `Task commands:\n${(matching.length ? matching : entries).flat().join('\n')}`;
}

// WF-G322: an evidence file is read by the CLI, not interpreted by the shell.
// Reject malformed or competing forms before changing the task state.
function readTaskTextOption(out, flags, name) {
  const inline = flags[name];
  const file = flags[`${name}-file`];
  if (inline === undefined && file === undefined) return { ok: true, value: undefined };
  if (inline !== undefined && file !== undefined) {
    out.log(`choose either --${name} or --${name}-file, not both`);
    return { ok: false };
  }
  if (file !== undefined) {
    if (typeof file !== 'string' || !file.trim()) {
      out.log(`--${name}-file needs one readable UTF-8 file path`);
      return { ok: false };
    }
    try {
      const value = fs.readFileSync(file, 'utf8');
      if (!value.trim()) {
        out.log(`--${name}-file "${file}" is empty`);
        return { ok: false };
      }
      return { ok: true, value };
    } catch (error) {
      out.log(`cannot read --${name}-file "${file}": ${error.message}`);
      return { ok: false };
    }
  }
  if (typeof inline !== 'string' || !inline.trim()) {
    out.log(`--${name} needs non-empty text`);
    return { ok: false };
  }
  return { ok: true, value: inline };
}

// WF-G234: the daemon echoes the task record after the transition. Compare
// its result to what this process sent, so clipping is visible immediately.
function printStoredResultReceipt(out, task, submitted) {
  if (submitted === undefined) return true;
  const stored = typeof task.result === 'string' ? task.result : '';
  const sentBytes = Buffer.byteLength(submitted, 'utf8');
  const storedBytes = Buffer.byteLength(stored, 'utf8');
  if (stored === submitted) {
    out.log(`result: ${storedBytes} UTF-8 bytes stored; exact match to submitted text`);
    return true;
  }
  out.log(`WARNING: submitted result was ${sentBytes} UTF-8 bytes, but the server returned ${storedBytes} bytes and different text.`);
  out.log(`  Task is already [${task.state}]. Inspect task show ${task.id} and repair the evidence.`);
  return false;
}

async function cmdTask(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const rest = parsed._.slice(1);
  if (parsed.flags.help === true || parsed.flags.h === true || sub === 'help') {
    out.log(taskUsage(sub));
    return { code: 0 };
  }
  // Creating a board task is identity-sensitive, so its missing-token path uses
  // the complete onboarding command while every other task command stays unchanged.
  const token = needToken(out, parsed, env, baseUrl, { taskCreation: sub === 'new' });
  if (!token) return { code: 1 };

  // The two Phase 2 migrations. Both are control-plane only and both write
  // exactly ONE journal event, so a second run is a safe no-op.
  if (sub === 'infer-membership') {
    const dry = Boolean(parsed.flags.dry);
    const r = await api(baseUrl, 'POST', '/tasks/membership/infer' + (dry ? '?dry=1' : ''), { token, body: {} });
    if (r.status !== 200 || !r.json) {
      out.log(`task infer-membership failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const t = r.json.tally || {};
    out.log(`${dry ? 'WOULD set' : 'Set'} membership on ${r.json.changed} job(s):`);
    out.log(`  already named an effort : ${t.recorded || 0}`);
    out.log(`  placed by evidence      : ${t.inferred || 0}   (marked AS a guess)`);
    out.log(`  several efforts matched : ${t.ambiguous || 0}   (none chosen; candidates listed)`);
    out.log(`  no evidence at all      : ${t.unknown || 0}`);
    if (dry) out.log('Nothing was written. Drop --dry to apply.');
    return { code: 0, tally: t };
  }

  if (sub === 'migrate-ids' || sub === 'migrate-deps' || sub === 'migrate-dep-ids') {
    const dry = Boolean(parsed.flags.dry);
    const ROUTES = {
      'migrate-ids': '/tasks/ids/migrate',
      'migrate-deps': '/tasks/deps/migrate',
      // WF-G104: repoint an edge at the id its target carries now.
      'migrate-dep-ids': '/tasks/deps/canonicalize',
    };
    const route = ROUTES[sub];
    const path = route + (dry ? '?dry=1' : '');
    const r = await api(baseUrl, 'POST', path, { token, body: {} });
    if (r.status !== 200 || !r.json) {
      out.log(`task ${sub} failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const rows = r.json.tasks || r.json.changes || [];
    // A dep row carries ARRAYS, and a typed dep is an object. Both went through
    // template interpolation and printed "[object Object]", which told a reader
    // nothing and looked like corrupt data. Each shape now prints itself.
    const depList = (v) => (Array.isArray(v) ? v : [v])
      .map((d) => (d && typeof d === 'object' ? `${d.id}:${d.type}` : String(d)))
      .join(', ');
    // migrate-ids renames campaigns AND tasks, so "task(s)" undercounts what
    // the reader is looking at. Name both.
    const unit = sub === 'migrate-ids' ? 'record(s) — campaigns and tasks' : 'task(s)';
    out.log(`${dry ? 'WOULD change' : 'Changed'} ${r.json.migrated} ${unit}.`);
    for (const row of rows.slice(0, 40)) {
      if (sub === 'migrate-deps' || sub === 'migrate-dep-ids') {
        out.log(`  ${row.taskId}  ${depList(row.from)}  ->  ${depList(row.to)}`);
      } else {
        out.log(`  ${row.from}  ->  ${row.to}`);
      }
    }
    if (rows.length > 40) out.log(`  ... and ${rows.length - 40} more`);
    if (dry) out.log('Nothing was written. Drop --dry to apply.');
    return { code: 0, migrated: r.json.migrated, rows };
  }

  // The ten dependency types, straight from the daemon. A worker checks a
  // value here rather than discovering the list from a 400.
  if (sub === 'dep-types') {
    const r = await api(baseUrl, 'GET', '/tasks/dep-types', { token });
    if (r.status !== 200 || !r.json) {
      out.log(`task dep-types failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    out.log('Dependency types — BLOCKING gate readiness; the rest only record a relationship.');
    for (const d of r.json.depTypes) {
      const mark = d.blocking ? 'BLOCKING' : '        ';
      out.log(`  ${mark}  ${d.type.padEnd(20)} ${d.summary}`);
    }
    out.log(`Default when you pass a bare id: ${r.json.defaultType}`);
    return { code: 0, depTypes: r.json.depTypes };
  }

  // WF-G194: `task new --category` took any string, and no command listed the
  // valid values, so an agent guessed. A silent typo or an invented category
  // hides a task from the orchestrator that filters on it.
  if (sub === 'categories') {
    const counts = await taskCategoryCounts(baseUrl);
    if (!counts) {
      out.log('task categories failed: the board did not answer');
      return { code: 1 };
    }
    if (!counts.size) {
      out.log('No task carries a category yet.');
      return { code: 0, categories: [] };
    }
    out.log(`${counts.size} categor${counts.size === 1 ? 'y' : 'ies'} in use on the board:`);
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [name, count] of rows) out.log(`  ${String(count).padStart(4)}  ${name}`);
    out.log('  Categories are free text. `task new --category <name>` warns when the name is new (WF-G194).');
    return { code: 0, categories: rows.map(([name, count]) => ({ name, count })) };
  }

  if (sub === 'new') {
    const title = rest[0];
    if (!title) {
      out.log('Usage: task new <title> (--campaign <id> | --standalone --reason "...") [--body "..." | --body-file <path>] [--dep <taskId>[:<type>]...] [--priority N] [--ref <r>...] [--deliverable <output-path>] [--category <name>] [--wave <name>]');
      return { code: 1 };
    }
    // WF-G236: parseArgs intentionally keeps bare tokens, but task new used
    // only rest[0]. An unquoted title/body/reason silently lost every later
    // word while still creating a task. Never send that partial record.
    if (rest.length !== 1) {
      out.log(`task new refused: unexpected positional argument(s): ${rest.slice(1).join(' ')}. Quote the title and each multi-word flag value, especially --body and --reason, or use --body-file <path>. No task was created (WF-G236).`);
      return { code: 1 };
    }
    if (parsed.flags.standalone !== undefined && parsed.flags.standalone !== true) {
      out.log('task new refused: --standalone takes no value. Quote the title and use --reason "..."; no task was created.');
      return { code: 1 };
    }
    const inlineBody = parsed.flags.body;
    const bodyFile = parsed.flags['body-file'];
    if (inlineBody !== undefined && bodyFile !== undefined) {
      out.log('task new refused: choose --body or --body-file, not both; no task was created (WF-G236).');
      return { code: 1 };
    }
    if (inlineBody !== undefined && (typeof inlineBody !== 'string' || !inlineBody.trim())) {
      out.log('task new refused: --body needs non-empty quoted text; use --body-file for long or multiline text. No task was created (WF-G236).');
      return { code: 1 };
    }
    if (bodyFile !== undefined && (typeof bodyFile !== 'string' || !bodyFile.trim())) {
      out.log('task new refused: --body-file needs a readable file path; no task was created (WF-G236).');
      return { code: 1 };
    }
    // WF-G171: refuse a campaignless task HERE, before a round trip, and say
    // both ways out. The daemon enforces the same rule; this only makes the
    // message arrive faster and name the flags rather than the JSON fields.
    const wantsStandalone = parsed.flags.standalone === true;
    const standaloneReason = typeof parsed.flags.reason === 'string' ? parsed.flags.reason.trim() : '';
    if (wantsStandalone && typeof parsed.flags.campaign === 'string') {
      out.log('task new failed: pass --campaign <id> OR --standalone, not both');
      return { code: 1 };
    }
    if (wantsStandalone && !standaloneReason) {
      out.log('task new failed: --standalone needs --reason "..." — say why this work belongs to no campaign (WF-G171)');
      return { code: 1 };
    }
    const body = { title };
    if (wantsStandalone) {
      body.standalone = true;
      body.standaloneReason = standaloneReason;
    }
    if (inlineBody !== undefined) body.body = inlineBody;
    if (bodyFile !== undefined) {
      try {
        body.body = fs.readFileSync(path.resolve(bodyFile), 'utf8');
      } catch (error) {
        out.log(`task new refused: cannot read --body-file ${bodyFile}: ${error.message}. No task was created (WF-G236).`);
        return { code: 1 };
      }
      if (!body.body.trim()) {
        out.log('task new refused: --body-file is empty; no task was created (WF-G236).');
        return { code: 1 };
      }
    }
    if (parsed.flags.deliverable !== undefined) {
      if (typeof parsed.flags.deliverable !== 'string' || !parsed.flags.deliverable.trim()) {
        out.log('task new failed: --deliverable needs a non-empty output path (WF-G179)');
        return { code: 1 };
      }
      body.deliverable = parsed.flags.deliverable;
    }
    // --dep <id> is a blocking edge, the same as it always was.
    // --dep <id>:<type> names one of the ten types instead. Ids hold no colon
    // (UUID or short hash), so the split is unambiguous.
    const deps = asArray(parsed.flags.dep)
      .filter((d) => typeof d === 'string')
      .map((d) => {
        const at = d.lastIndexOf(':');
        if (at <= 0) return d;
        return { id: d.slice(0, at), type: d.slice(at + 1) };
      });
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
    // WF-G194: WARN, never refuse — a new category is legitimate, a typo is
    // not, and only the author can tell them apart. Naming the categories in
    // use turns the guess into a choice.
    if (typeof body.category === 'string' && body.category.trim()) {
      const counts = await taskCategoryCounts(baseUrl);
      const wanted = body.category.trim().toLowerCase();
      if (counts && counts.size && ![...counts.keys()].includes(wanted)) {
        const known = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`);
        out.log(`WARNING: category "${body.category}" is NEW — no other task uses it (WF-G194).`);
        out.log(`  In use: ${known.join(', ')}`);
        out.log('  A typo here hides the task from an orchestrator that filters on the category.');
      }
    }
    // WF-G279/WF-G298: refs and body paths receive the same freshness warning
    // before task creation. Declared new or intentionally absent paths are fine.
    for (const missing of await missingTaskPaths(body)) {
      const warning = `WARNING: ${missing.source} "${missing.path}" does not exist in this checkout (WF-G81/WF-G279/WF-G298). Fix the path or declare CREATES: / EXPECTED-ABSENT: in --body when intentional.`;
      if (parsed.flags['id-only']) out.warn(warning);
      else out.log(warning);
    }
    const r = await api(baseUrl, 'POST', '/tasks', { token, body });
    if (r.status === 201 && r.json && r.json.task) {
      const identity = loadIdentity(env, baseUrl);
      const creator = r.json.task.creatorAgent;
      // WF-G85: the daemon fills campaignId from the creator's own lead
      // campaign when the flag is absent. Say so, so the default is visible.
      if (typeof parsed.flags.campaign !== 'string' && r.json.task.campaignId && !parsed.flags['id-only']) {
        out.log(`  campaign: ${r.json.task.campaignId} (defaulted from your lead campaign; pass --campaign to override)`);
      }
      // WF-G171: an opt-out is a decision, so the board echoes it back.
      if (wantsStandalone && !parsed.flags['id-only']) {
        out.log(`  campaign: standalone — ${standaloneReason}`);
      }
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
      if (r.json.task.deliverable) out.log(`  deliverable: ${r.json.task.deliverable}`);
      return { code: 0, task: r.json.task };
    }
    // A rejected explicit token must not leave the user at an opaque 401. The
    // onboarding command restores every identity field that task creation needs.
    if (r.status === 401) {
      printTaskOnboardingHint(out, `task new failed (401): ${r.json ? r.json.error : r.text}.`);
      return { code: 1 };
    }
    out.log(`task new failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // WF-G304: keep the design handoff in its own durable field. A checkpoint
  // says what one claimant did and will do next; it is not a ten-line spec.
  if (sub === 'design') {
    const taskId = rest[0];
    const inline = parsed.flags.text;
    const file = parsed.flags.file;
    if (!taskId || rest.length !== 1 || (inline === undefined) === (file === undefined)) {
      out.log('Usage: task design <taskId> (--text "multiline design" | --file <path>) [--reason "..."]');
      out.log('  Name exactly one source. Quote multi-word text or use a UTF-8 file; no task was changed.');
      return { code: 1 };
    }
    let design;
    if (inline !== undefined) {
      if (typeof inline !== 'string' || !inline.trim()) {
        out.log('task design refused: --text needs non-empty text; no task was changed.');
        return { code: 1 };
      }
      design = inline;
    } else {
      if (typeof file !== 'string' || !file.trim()) {
        out.log('task design refused: --file needs a readable path; no task was changed.');
        return { code: 1 };
      }
      try {
        design = fs.readFileSync(path.resolve(file), 'utf8');
      } catch (error) {
        out.log(`task design refused: cannot read --file ${file}: ${error.message}. No task was changed.`);
        return { code: 1 };
      }
      if (!design.trim()) {
        out.log('task design refused: --file is empty; no task was changed.');
        return { code: 1 };
      }
    }
    const resolvedId = await resolveTaskId(taskId, baseUrl, token, out);
    if (!resolvedId) {
      out.log(`task design failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    const body = { design };
    if (typeof parsed.flags.reason === 'string') body.reason = parsed.flags.reason;
    const r = await api(baseUrl, 'PATCH', `/tasks/${encodeURIComponent(resolvedId)}`, { token, body });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`Design saved for ${r.json.task.id} (${Buffer.byteLength(design, 'utf8')} UTF-8 bytes). Read it with task show ${r.json.task.id}.`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task design failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // WF-G118: the whole record for ONE task. `tasks` truncates ids and results
  // and prints no blocked reason, so workers were reading a sibling task's
  // result out of .agent/agora/snapshot.json by hand.
  if (sub === 'show' || sub === 'view') {
    const wanted = rest[0];
    if (!wanted) {
      out.log('Usage: task show <taskId>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'GET', '/tasks');
    const tasks = (r.json && r.json.tasks) || [];
    const task = findTaskByIdOrPrefix(tasks, wanted, out);
    if (!task) {
      out.log(`task show failed: no task matching "${wanted}"`);
      return { code: 1 };
    }
    const map = await buildAgentMap(baseUrl);
    // WF-G177: the readiness marker answers ONE question — may an open task be
    // claimed now? It is meaningless on a task that is claimed, done or
    // cancelled, and "[done] (not ready)" made five finished tasks read as
    // broken. The marker now shows only on an OPEN task, and it NAMES the
    // unmet dependencies instead of leaving the reader to guess.
    out.log(`${task.id}  "${task.title}"  [${task.state}]${readinessMarker(task)}`);
    if (task.priority) out.log(`  priority: p${task.priority}`);
    if (task.campaignId) out.log(`  campaign: ${task.campaignId}${task.wave ? `  wave: ${task.wave}` : ''}`);
    // WF-G171/WF-G169: a task with no campaign says whether that was decided
    // or merely omitted, so a reviewer never has to guess which it was.
    else {
      const decision = task.campaignDecision || null;
      if (task.membership === 'standalone' && decision && decision.reason) {
        out.log(`  campaign: standalone — ${decision.reason}`);
      } else if (task.membership === 'standalone') {
        out.log(`  campaign: standalone${task.inferredFrom ? ` — ${task.inferredFrom}` : ''}`);
      } else {
        out.log('  campaign: NONE RECORDED — missing membership alone does not block work (WF-G169)');
        out.log('  campaign repair: An orchestrator/master/human can run: task campaign ' + task.id + ' <campaignId> --reason "..."; workers should ask one to do so (WF-G302)');
      }
      if (task.wave) out.log(`  wave: ${task.wave}`);
    }
    if (task.category) out.log(`  category: ${task.category}`);
    if ((task.refs || []).length) out.log(`  refs: ${task.refs.join(', ')}`);
    if (task.deliverable) out.log(`  deliverable: ${task.deliverable}`);
    for (const dep of task.depStates || []) {
      out.log(`  dep: ${shortId(dep.id)} ${dep.type}${dep.blocking ? ' BLOCKING' : ''} [${dep.state}]  ${dep.title || ''}`);
    }
    if (task.creatorAgent) out.log(`  created by: ${task.creatorAgent.handle || task.creatorAgent.id}`);
    if (task.claimedBy) out.log(`  claimed by: ${handleFor(map, task.claimedBy)} (${task.claimedBy})`);
    if (task.body) {
      out.log('  body:');
      for (const line of String(task.body).split('\n')) out.log(`    ${line}`);
    } else {
      out.log('  BODY EMPTY — no instructions were stored. Ask the creator or orchestrator to edit this task before claiming it (WF-G293).');
    }
    if (task.design) {
      out.log('  design:');
      for (const line of String(task.design).split('\n')) out.log(`    ${line}`);
    }
    if (task.result) {
      out.log('  result:');
      for (const line of String(task.result).split('\n')) out.log(`    ${line}`);
    }
    if (task.finding) out.log(`  finding: ${task.finding}`);
    if (task.evidence) out.log(`  evidence: ${task.evidence}`);
    const reason = blockedReasonOf(task);
    if (reason) out.log(`  blocked reason: ${reason}`);
    if (task.checkpoint) {
      const did = task.checkpoint.did || '—';
      const next = String(task.checkpoint.next || '—');
      if (next.includes('\n')) {
        out.log(`  checkpoint: did=${did}`);
        out.log(/^\s*DESIGN\b/i.test(next) ? '  design (legacy checkpoint.next):' : '  checkpoint next:');
        for (const line of next.split('\n')) out.log(`    ${line}`);
      } else {
        out.log(`  checkpoint: did=${did}  next=${next}`);
      }
    }
    const history = Array.isArray(task.history) ? task.history.slice(-5) : [];
    if (history.length) {
      out.log(`  history (last ${history.length}):`);
      for (const entry of history) {
        const when = entry.at ? new Date(entry.at).toISOString().replace('T', ' ').slice(0, 19) : '—';
        const who = entry.by ? handleFor(map, entry.by) : 'system';
        const from = entry.from ? ` from ${entry.from}` : '';
        const why = entry.reason ? `  reason: ${entry.reason}` : '';
        // WF-G169: a campaign move carries `to`, not `state`. Without this the
        // move printed "-> —", which reads as a move to nowhere.
        const to = entry.state || entry.to || '—';
        out.log(`    ${when}  ${entry.action}${from} -> ${to}  by ${who}${why}`);
      }
    }
    return { code: 0, task };
  }

  // WF-G111 (tooling half): check a task BODY against the checkout BEFORE
  // dispatch. 14 of 40 phase-2 bodies on 2026-09-09 named files that do not
  // exist or identifiers that never existed, and each one cost a worker a
  // discovery pass. Findings are evidence, not a veto: a body may legitimately
  // name something the task will create.
  if (sub === 'lint') {
    const wanted = rest[0];
    if (!wanted) {
      out.log('Usage: task lint <taskId>');
      return { code: 1 };
    }
    const r = await api(baseUrl, 'GET', '/tasks');
    const tasks = (r.json && r.json.tasks) || [];
    const task = findTaskByIdOrPrefix(tasks, wanted, out);
    if (!task) {
      out.log(`task lint failed: no task matching "${wanted}"`);
      return { code: 1 };
    }
    const { lintTask, formatLintReport } = await loadTaskLint();
    const result = lintTask(task);
    for (const line of formatLintReport(result)) out.log(line);
    return { code: result.clean ? 0 : 1, lint: result };
  }

  if (sub === 'claim') {
    const taskId = rest[0];
    if (!taskId) {
      out.log('Usage: task claim <taskId> [--force]');
      return { code: 1 };
    }
    // WF-G65: resolve short-id prefixes to full UUIDs before calling the API.
    // The board displays short IDs (first 8 chars), but the server requires exact UUIDs.
    const resolvedId = await resolveTaskId(taskId, baseUrl, token);
    if (!resolvedId) {
      out.log(`task claim failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    // WF-G55: direct claim is gated on readiness. `--force` is the creator-only
    // bypass for deliberate orchestrator hand-assignment of an unready task.
    const qs = parsed.flags.force === true ? '?force=1' : '';
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/claim${qs}`, { token });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`Claimed ${r.json.task.id}  [${r.json.task.state}]`);
      if (r.json.task.assignedPet) {
        out.log(`  pet: ${r.json.task.assignedPet.displayName} (${r.json.task.assignedPet.slug})`);
      }
      printSuccessorFlag(out, r.json.task);
      return { code: 0, task: r.json.task };
    }
    out.log(`task claim failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Worker-pull: grab the top-priority ready task in one call.
  if (sub === 'next') {
    const body = {};
    if (typeof parsed.flags.campaign === 'string') body.campaignId = parsed.flags.campaign;
    if (typeof parsed.flags.category === 'string') body.category = parsed.flags.category;
    const r = await api(baseUrl, 'POST', '/tasks/claim-next', {
      token,
      body: Object.keys(body).length ? body : undefined,
    });
    if (r.status === 200 && r.json) {
      if (!r.json.task) { out.log('no ready tasks'); return { code: 0, task: null }; }
      if (parsed.flags['id-only']) { out.log(r.json.task.id); return { code: 0, task: r.json.task }; }
      out.log(`Claimed ${r.json.task.id}  "${r.json.task.title}"  [${r.json.task.state}]`);
      if (r.json.task.assignedPet) {
        out.log(`  pet: ${r.json.task.assignedPet.displayName} (${r.json.task.assignedPet.slug})`);
      }
      if (r.json.task.body) out.log(`  ${r.json.task.body}`);
      if ((r.json.task.refs || []).length) out.log(`  refs: ${r.json.task.refs.join(', ')}`);
      if (r.json.task.design) {
        out.log('  design:');
        for (const line of String(r.json.task.design).split('\n')) out.log(`    ${line}`);
      }
      printSuccessorFlag(out, r.json.task);
      return { code: 0, task: r.json.task };
    }
    out.log(`task next failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // WF-G169: move a task between campaigns, or make it standalone.
  if (sub === 'campaign') {
    const taskId = rest[0];
    const target = rest[1];
    const wantsStandalone = parsed.flags.standalone === true
      || (typeof target === 'string' && /^(none|standalone)$/i.test(target));
    const reason = typeof parsed.flags.reason === 'string' ? parsed.flags.reason.trim() : '';
    if (!taskId || (!target && !wantsStandalone) || !reason) {
      out.log('Usage: task campaign <taskId> (<campaignId> | --standalone) --reason "..."');
      return { code: 1 };
    }
    const resolvedId = await resolveTaskId(taskId, baseUrl, token);
    if (!resolvedId) {
      out.log(`task campaign failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    const payload = { reason };
    if (wantsStandalone) payload.standalone = true;
    else payload.campaignId = target;
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/campaign`, { token, body: payload });
    if (r.status === 200 && r.json && r.json.task) {
      const from = r.json.from || 'standalone';
      const to = r.json.to || 'standalone';
      out.log(`Moved ${r.json.task.id}: ${from} -> ${to}`);
      out.log(`  reason: ${reason}`);
      out.log(`  check both sides agree: task show ${r.json.task.id}` + (r.json.to ? `  and  campaign show ${r.json.to}` : ''));
      return { code: 0, task: r.json.task };
    }
    out.log(`task campaign failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // WF-G130, WF-G149, WF-G153: correct a task in place or annotate it without claiming.
  if (sub === 'edit') {
    const taskId = rest[0];
    const flags = parsed.flags;
    const refs = [...asArray(flags.ref), ...asArray(flags.refs)].filter((value) => typeof value === 'string');
    const body = {};
    if (typeof flags.title === 'string') body.title = flags.title;
    if (typeof flags.body === 'string') body.body = flags.body;
    if (typeof flags['append-body'] === 'string') body.appendBody = flags['append-body'];
    else if (typeof flags.appendBody === 'string') body.appendBody = flags.appendBody;
    if (flags.priority !== undefined) body.priority = Number(flags.priority);
    if (refs.length) body.refs = refs;
    if (flags.deliverable !== undefined) body.deliverable = flags.deliverable;
    if (typeof flags.wave === 'string') body.wave = flags.wave;
    if (typeof flags.reason === 'string') body.reason = flags.reason;
    if (!taskId || (!Object.keys(body).length)) {
      out.log('Usage: task edit <taskId> [--title "..."] [--body "..."] [--append-body "..."] [--priority N] [--ref r...] [--deliverable <output-path>] [--wave w] [--reason "..."]');
      return { code: 1 };
    }
    const resolvedId = await resolveTaskId(taskId, baseUrl, token, out);
    if (!resolvedId) {
      out.log(`task edit failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    // Load before PATCH so a broken optional lint module cannot leave an edit
    // applied while its CLI command exits with a module error.
    const { lintTask, formatLintReport } = await loadTaskLint();
    const r = await api(baseUrl, 'PATCH', `/tasks/${encodeURIComponent(resolvedId)}`, { token, body });
    if (r.status === 200 && r.json && r.json.task) {
      if (r.json.changed && r.json.changed.length) {
        out.log(`${r.json.task.id} edited: ${r.json.changed.join(', ')}  (id unchanged; old values are in history)`);
      } else {
        out.log(`${r.json.task.id} annotated: note recorded in history (${body.reason || 'no reason'})`);
      }
      // The point of an in-place edit is a clean lint without a new id, so
      // report the lint of the record as it now stands.
      const lint = lintTask(r.json.task);
      for (const line of formatLintReport(lint)) out.log(line);
      return { code: 0, task: r.json.task, lint };
    }
    const editError = r.json ? r.json.error : r.text;
    out.log(`task edit failed (${r.status}): ${editError}`);
    // WF-G189: --append-body returned "nothing to edit" on seven task ids in a
    // row, and the message sent every agent looking for a fault in its own
    // text. The real cause is a daemon that predates the appendBody field: it
    // drops the unknown key, so the edit names no field at all. Say that,
    // instead of letting the agent retype the whole body or drop to raw fetch.
    if (body.appendBody !== undefined && /nothing to edit/.test(String(editError || ''))) {
      out.log('  CAUSE: this daemon does not know the appendBody field, so it dropped it and saw an empty edit.');
      out.log('  appendBody landed in store.mjs and server.mjs on 2026-09-15 (WF-G153); a daemon started before');
      out.log('  that build needs a restart. Ask the orchestrator to restart the daemon, or send the whole body:');
      out.log(`     node tools/agora/client.mjs task show ${resolvedId}    # copy the body`);
      out.log(`     node tools/agora/client.mjs task edit ${resolvedId} --body "<old body>\\n<your line>" --reason "..."`);
      out.log('  The full-body rewrite loses any edit another agent made between your read and your write.');
    }
    return { code: 1 };
  }

  if (sub === 'state' || sub === 'start') {
    const taskId = rest[0];
    const state = sub === 'start' ? 'in_progress' : rest[1];
    if (!taskId || !state) {
      out.log('Usage: task state <taskId> <open|claimed|in_progress|blocked|done>');
      return { code: 1 };
    }
    // WF-G65: resolve short-id prefixes to full UUIDs.
    const resolvedId = await resolveTaskId(taskId, baseUrl, token, out);
    if (!resolvedId) {
      out.log(`task state failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    const reason = readTaskTextOption(out, parsed.flags, 'reason');
    const result = readTaskTextOption(out, parsed.flags, 'result');
    if (!reason.ok || !result.ok) return { code: 1 };
    const body = { state };
    // WF-G86: the history entry records WHY. `blocked` refuses without one.
    if (reason.value !== undefined) body.reason = reason.value;
    if (state === 'blocked' && reason.value === undefined) {
      out.log('task state blocked needs --reason "<what blocks it>" or --reason-file <path> (WF-G86)');
      return { code: 1 };
    }
    if (result.value !== undefined) body.result = result.value;
    const refs = [...asArray(parsed.flags.ref), ...asArray(parsed.flags.refs)].filter((value) => typeof value === 'string');
    if (refs.length) body.refs = refs;
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/state`, { token, body });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`${r.json.task.id} -> [${r.json.task.state}]`);
      return { code: printStoredResultReceipt(out, r.json.task, body.result) ? 0 : 1, task: r.json.task };
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
    // WF-G65: resolve short-id prefixes to full UUIDs.
    const resolvedId = await resolveTaskId(taskId, baseUrl, token);
    if (!resolvedId) {
      out.log(`task handoff failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    // Allow a handle to be passed; resolve to agentId if it matches.
    const map = await buildAgentMap(baseUrl);
    if (!map[toAgentId]) {
      const byHandle = Object.entries(map).find(([, h]) => h === toAgentId);
      if (byHandle) toAgentId = byHandle[0];
    }
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/handoff`, { token, body: { toAgentId } });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`${r.json.task.id} handed off to ${handleFor(map, r.json.task.claimedBy)}`);
      return { code: 0, task: r.json.task };
    }
    out.log(`task handoff failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Leave a resumable checkpoint on a task: a short "here is what I did, here is
  // what I was about to do next" note. Doctrine is to drop one at sub-step
  // boundaries or before a risky move — NOT on a timer. If this worker later
  // goes silent and is reaped, the note rides along in the retrace dossier so a
  // successor can pick up where it left off. Latest note wins.
  if (sub === 'checkpoint') {
    const taskId = rest[0];
    if (!taskId) {
      out.log('Usage: task checkpoint <taskId> --did "what I just finished" --next "what comes next" [--files a.ts,b.ts]');
      return { code: 1 };
    }
    if (rest.length > 1) {
      out.log('task checkpoint failed: checkpoint files must use comma-separated or repeated --files flags (for example --files a.ts,b.ts)');
      return { code: 1 };
    }
    // WF-G65: resolve short-id prefixes to full UUIDs.
    const resolvedId = await resolveTaskId(taskId, baseUrl, token);
    if (!resolvedId) {
      out.log(`task checkpoint failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    const body = {};
    if (typeof parsed.flags.did === 'string') body.did = parsed.flags.did;
    if (typeof parsed.flags.next === 'string') body.next = parsed.flags.next;
    // --files takes a comma-separated list; the daemon also accepts an array.
    const files = asArray(parsed.flags.files)
      .filter((value) => typeof value === 'string')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    if (files.length) body.files = files;
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/checkpoint`, { token, body });
    if (r.status === 200 && r.json && r.json.checkpoint) {
      const cp = r.json.checkpoint;
      out.log(`checkpoint saved on ${shortId(resolvedId)}`);
      if (cp.did) out.log(`  did:   ${cp.did}`);
      if (cp.next) out.log(`  next:  ${cp.next}`);
      if ((cp.files || []).length) out.log(`  files: ${cp.files.join(', ')}`);
      return { code: 0, checkpoint: cp };
    }
    out.log(`task checkpoint failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  // Iteration-1 (Wave-1 feedback): agents reached for `task done <id>` repeatedly;
  // alias it (and `complete`) to the state transition so it just works.
  if (sub === 'done' || sub === 'complete') {
    const taskId = rest[0];
    if (!taskId) { out.log('Usage: task done <taskId> [--result "..." | --result-file <path>] [--reason "..." | --reason-file <path>]'); return { code: 1 }; }
    // WF-G65: resolve short-id prefixes to full UUIDs.
    const resolvedId = await resolveTaskId(taskId, baseUrl, token, out);
    if (!resolvedId) {
      out.log(`task done failed: no task matching "${taskId}"`);
      return { code: 1 };
    }
    const reason = readTaskTextOption(out, parsed.flags, 'reason');
    const result = readTaskTextOption(out, parsed.flags, 'result');
    if (!reason.ok || !result.ok) return { code: 1 };
    const body = { state: 'done' };
    if (reason.value !== undefined) body.reason = reason.value; // WF-G86
    if (result.value !== undefined) body.result = result.value;
    const r = await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(resolvedId)}/state`, { token, body });
    if (r.status === 200 && r.json && r.json.task) {
      out.log(`${r.json.task.id} -> [${r.json.task.state}]`);
      return { code: printStoredResultReceipt(out, r.json.task, body.result) ? 0 : 1, task: r.json.task };
    }
    out.log(`task done failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }

  out.log(`unknown task subcommand "${sub}". Use: task new|design|show|lint|claim|next|state|start|checkpoint|done|handoff|edit|campaign`);
  return { code: 1 };
}

// ---------------------------------------------------------------------------
// retrace <taskId> — recover a dead worker's WORK, not just its task.
//
// When a worker goes silent and is reaped, the daemon stamps a `retrace`
// dossier onto the task it was reopening: who the worker was, which files it
// held, its last few `say` breadcrumbs, and its last checkpoint. But the
// worker's half-finished EDITS are still sitting in the shared working tree —
// the dossier only describes them. So this command prints the dossier and reads
// unstaged, staged, and untracked/new Git state scoped to the recovered file
// union. That lets the successor see the partial work without sweeping in files
// owned by unrelated agents.
//
// Read-only: it hits the open GET /tasks endpoint and never mutates anything.
// ---------------------------------------------------------------------------
async function cmdRetrace(out, parsed, _env, baseUrl, repoRoot = REPO_ROOT) {
  const wanted = parsed._[0];
  if (!wanted) {
    out.log('Usage: retrace <taskId>');
    return { code: 1 };
  }
  // Pull the whole board and find the task by full id or short-id prefix — the
  // same forgiving id matching the rest of the CLI uses.
  const r = await api(baseUrl, 'GET', '/tasks');
  const tasks = (r.json && r.json.tasks) || [];
  const task = tasks.find((t) => t.id === wanted) || tasks.find((t) => t.id.startsWith(wanted));
  if (!task) {
    out.log(`retrace: no task matching "${wanted}"`);
    return { code: 1 };
  }
  const rt = task.retrace;
  if (!rt) {
    // A task with no dossier was never reaped — nothing to retrace. Say so
    // plainly rather than printing an empty report.
    out.log(`retrace ${shortId(task.id)}: no retrace dossier — this task has not been reaped (nothing to recover).`);
    return { code: 0, task };
  }

  // --- The dossier: who died and what they were doing ---
  out.log(`retrace ${shortId(task.id)}  "${task.title}"`);
  const a = rt.agent || {};
  const reapedWhen = rt.reapedAt ? new Date(rt.reapedAt).toISOString() : 'unknown';
  out.log(`  reaped:   ${a.handle || 'unknown'}${a.model ? ` (${a.model})` : ''} at ${reapedWhen}`);
  if (a.role || a.type || a.spawnedBy) {
    out.log(`  identity: role=${a.role || '-'} type=${a.type || '-'} spawnedBy=${a.spawnedBy || '-'}`);
  }
  if (task.reapCount) out.log(`  reapCount: ${task.reapCount}`);

  // Recover both the locks still live at death and the longer-lived task scope.
  const filesHeld = Array.isArray(rt.filesHeld) ? rt.filesHeld : [];
  const heldPaths = [];
  // `filesHeld` is the structured live-lock snapshot at reap. `files` is the
  // durable union of every lock token and checkpoint file seen during the task,
  // which remains complete when the shorter lock TTL elapsed before reap.
  const durableFiles = Array.isArray(rt.files)
    ? rt.files.filter((file) => typeof file === 'string' && file)
    : [];
  const heldPathspecs = [...durableFiles];
  for (const held of filesHeld) {
    for (const p of held.paths || []) { heldPaths.push(p); heldPathspecs.push(p); }
    for (const g of held.globs || []) heldPathspecs.push(g);
  }
  if (heldPathspecs.length) {
    out.log(`  files:     ${[...new Set(heldPathspecs)].join(', ')}`);
  } else {
    out.log('  files:     (none recorded)');
  }
  const liveHeldPathspecs = filesHeld.flatMap((held) => [...(held.paths || []), ...(held.globs || [])]);
  if (liveHeldPathspecs.length) {
    out.log(`  filesHeld: ${liveHeldPathspecs.join(', ')}`);
  } else {
    out.log('  filesHeld: (none live at reap; durable files above may come from expired locks or checkpoints)');
  }

  // Its last checkpoint, if it left one — the clearest signal of intent.
  if (rt.checkpoint) {
    const cp = rt.checkpoint;
    out.log('  checkpoint:');
    if (cp.did) out.log(`    did:   ${cp.did}`);
    if (cp.next) out.log(`    next:  ${cp.next}`);
    if ((cp.files || []).length) out.log(`    files: ${cp.files.join(', ')}`);
  } else {
    out.log('  checkpoint: (none left)');
  }

  // Its `say` breadcrumbs since it claimed the task.
  const sayTail = Array.isArray(rt.sayTail) ? rt.sayTail : [];
  if (sayTail.length) {
    out.log('  sayTail:');
    for (const m of sayTail) {
      const when = m.at ? new Date(m.at).toISOString() : '';
      out.log(`    [${when}] ${m.body || ''}`);
    }
  }

  // --- The partial work itself: three live Git views over recovered files ---
  // Unstaged, staged, and untracked/new work live in different Git surfaces.
  // Printing each explicitly prevents a clean unstaged diff from hiding a
  // staged repair or a brand-new file that a successor must preserve.
  if (heldPathspecs.length) {
    const pathspecs = [...new Set(heldPathspecs)];
    const sections = [
      {
        title: 'unstaged git diff',
        args: ['diff', '--', ...pathspecs],
        empty: 'no unstaged changes in the recovered files',
      },
      {
        title: 'staged git diff',
        args: ['diff', '--cached', '--', ...pathspecs],
        empty: 'no staged changes in the recovered files',
      },
      {
        title: 'untracked/new files',
        args: ['ls-files', '--others', '--exclude-standard', '--', ...pathspecs],
        empty: 'no untracked/new files in the recovered scope',
      },
    ];
    for (const section of sections) {
      out.log('');
      out.log(`  --- ${section.title} -- ${pathspecs.join(' ')} ---`);
      try {
        const text = execFileSync('git', section.args, {
          cwd: repoRoot,
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        });
        out.log(text.trim() ? text.trimEnd() : `  (${section.empty})`);
      } catch (e) {
        // Report each Git surface independently so one failure cannot masquerade
        // as an entirely clean recovered scope.
        out.log(`  (${section.title} failed: ${e.message.split('\n')[0]})`);
      }
    }
  }

  out.log('');
  out.log(`  → decide keep / extend / revert, then: say "resuming ${shortId(task.id)} from ${a.handle || 'prev'}: keeping X, redoing Y"`);
  return { code: 0, task, retrace: rt, heldPaths };
}

const STATE_ORDER = ['open', 'claimed', 'in_progress', 'blocked', 'done'];

async function cmdTasks(out, parsed, env, baseUrl) {
  const requestedId = parsed.flags.id;
  if (requestedId !== undefined && (typeof requestedId !== 'string' || !requestedId.trim())) {
    out.log('Usage: tasks --id <taskId> [--state s] [--ready] [--category <name>]');
    return { code: 1, tasks: [] };
  }
  const stateFilter = typeof parsed.flags.state === 'string' ? parsed.flags.state : undefined;
  const categoryFilter = typeof parsed.flags.category === 'string' ? parsed.flags.category : undefined;
  const groupByCategory = parsed.flags['group-by-category'] === true;
  const ready = parsed.flags.ready === true;
  const params = [];
  if (stateFilter) params.push(`state=${encodeURIComponent(stateFilter)}`);
  if (ready) params.push('ready=1');
  if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  // WF-G316: resolve against the whole board first. A state-filtered response
  // cannot tell an unfinished dependency from a misspelled id, and a completed
  // task's result may mention the dependency without being that task.
  const board = requestedId === undefined ? null : await api(baseUrl, 'GET', '/tasks');
  const selected = board && findTaskByIdOrPrefix((board.json && board.json.tasks) || [], requestedId, out);
  if (board && !selected) {
    out.log(`tasks --id: no unique task matches "${requestedId}"`);
    return { code: 1, tasks: [] };
  }
  const r = board && !params.length ? board : await api(baseUrl, 'GET', `/tasks${qs}`);
  const tasks = ((r.json && r.json.tasks) || []).filter((task) => !selected || task.id === selected.id);
  if (tasks.length === 0) {
    out.log(selected ? 'no tasks match the requested filters' : ready ? 'no ready tasks' : stateFilter ? `no tasks in state "${stateFilter}"` : 'no tasks');
    return { code: 0, tasks };
  }
  const map = await buildAgentMap(baseUrl);
  // GG-118: annotate ready listings when a task's refs overlap a live lock.
  let activeLocks = [];
  if (ready) {
    try {
      const lres = await api(baseUrl, 'GET', '/locks');
      activeLocks = (lres.json && lres.json.locks) || [];
    } catch { /* advisory only */ }
  }
  const lockNote = (t) => {
    if (!activeLocks.length) return '';
    const hits = lockedRefsForTask(t, activeLocks, handleFor, map);
    return hits.length ? `  !! ${hits.join('; ')}` : '';
  };
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
          out.log(`  ${shortId(t.id)}  ${t.title}${pri}${refs}${catLabel}${lockNote(t)}`);
        }
      }
      return { code: 0, tasks };
    }

    // Ready view: already priority-ordered by the daemon — show it as a queue.
    for (const t of tasks) {
      const pri = t.priority ? `  p${t.priority}` : '';
      const refs = (t.refs || []).length ? `  refs: ${t.refs.join(', ')}` : '';
      const cat = t.category ? `  category: ${t.category}` : '';
      out.log(`${shortId(t.id)}  ${t.title}${pri}${refs}${cat}${lockNote(t)}`);
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
      // WF-G118: a blocked row without its reason forces the reader into the
      // snapshot file to learn what is actually in the way.
      if (t.state === 'blocked') {
        const reason = blockedReasonOf(t);
        out.log(`      blocked: ${reason || '(no reason recorded — WF-G86 predates this row)'}`);
      }
    }
  }
  return { code: 0, tasks };
}

// ---------------------------------------------------------------------------
// gap add — WF-G113: file ONE row in a project gap registry through the daemon.
//
// The registries are living markdown tables, and until now every worker had to
// take an Agora lock on docs/projects/GLOBAL_GAPS.md to append one row. That
// made it the hottest lock on the board: ids collided, Windows threw EBUSY
// mid-write, and six workers queued behind 3-hour holds for a single line. The
// daemon owns the write now and serializes it in process, so this command
// needs no lock at all.
//
// Provenance (handle, agent UUID, task/thread) is taken from the registered
// identity server-side — the registries require it and a caller cannot supply
// someone else's.
// ---------------------------------------------------------------------------
/**
 * WF-G205 / WF-G184: the Suggested agent column is ROUTING data. `gap add`
 * used to accept a missing value and write the registry's em dash, which
 * `validateWorkflowGapRows` in gapIndex.mjs then rejected — so every filed row
 * made `gapIndex.test.mjs` redder, and an orchestrator that routed from the
 * column got an em dash instead of an agent key. The value is now checked
 * BEFORE the row is written, against the same list the validator reads after.
 *
 * Returns the sorted list of accepted keys. `human-operator` is accepted
 * exactly as the registry's hard rule 3 states.
 */
export function agentRegistryKeys(repoRoot = REPO_ROOT) {
  const file = path.join(repoRoot, 'tools', 'agora', 'agents.json');
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  return [...Object.keys(registry.agents || {}), 'human-operator'].sort();
}

/**
 * The closed vocabularies a registry declares in its own YAML frontmatter.
 * A registry that declares none (the project GAPS.md files) returns {}, and
 * nothing is checked against it.
 */
export function gapRegistryVocabulary(project, repoRoot = REPO_ROOT) {
  try {
    return readAllowedVocabularies(fs.readFileSync(resolveGapsFile(project, repoRoot), 'utf8'));
  } catch {
    return {};
  }
}

/** WF-G244: names a caller can pass to --project without guessing a folder. */
export function gapRegistryProjects(repoRoot = REPO_ROOT) {
  const found = new Set();
  const base = path.join(repoRoot, 'docs', 'projects');
  const visit = (dir, prefix = '') => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const child = path.join(dir, entry.name);
      if (fs.existsSync(path.join(child, 'GAPS.md'))) found.add(name);
      visit(child, name);
    }
  };
  visit(base);
  found.delete('global');
  found.delete('workflow');
  return ['global', 'workflow', ...[...found].sort()];
}

/**
 * WF-G204 / WF-G205: the Classification a Surface implies.
 *
 * An omitted Classification used to become the registry's em dash, which no
 * allowed_classifications list holds, so every filed row turned the registry
 * validator red again. The Surface already says which part of the system the
 * gap sits in, so the class is derived from it rather than left blank. The
 * caller sees the derivation and may override it with --classification.
 */
export function classificationForSurface(surface) {
  const s = String(surface || '').trim().toLowerCase();
  if (!s) return 'workflow';
  if (s === 'planmap' || s === 'roadmap' || s.startsWith('planmap-')) return 'planning';
  if (s === 'agora-daemon' || s.startsWith('agora-daemon')) return 'daemon';
  if (/^agora-(cli|client|gap|task|lock)/.test(s)) return 'client-tooling';
  if (/^agora-orchestrat|^orchestrate/.test(s)) return 'dispatch';
  if (s === 'docs' || s.startsWith('docs-')) return 'docs';
  if (s === 'agents-registry' || s === 'gap-index') return 'registry';
  return 'workflow';
}

/**
 * WF-G200: three workers filed the same defect as WF-G189, WF-G192 and WF-G196
 * inside one hour. Compare the new gap text against the OPEN rows of the same
 * registry by token overlap and hand the near matches back, so the caller can
 * add evidence to the existing row instead of minting a fourth.
 *
 * The measure is a Jaccard overlap of the significant words (4 letters or more,
 * stop words removed). It is deliberately crude: the command reports, it never
 * decides. `--force` files the row anyway.
 */
const GAP_STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'when', 'then', 'than', 'into', 'over', 'every',
  'which', 'while', 'after', 'before', 'because', 'cannot', 'does', 'have', 'been',
  'they', 'their', 'there', 'them', 'what', 'will', 'would', 'should', 'could',
  'agent', 'agora', 'task', 'gap', 'file', 'line', 'call', 'runs', 'same', 'only',
]);

export function gapTokens(text) {
  // A hyphen or an underscore SPLITS a token. Two agents describing one defect
  // write "--append-body" and "append body"; if the flag stayed one token those
  // two rows would share nothing and the duplicate check would miss the exact
  // case it exists for (WF-G189 / WF-G192 / WF-G196).
  const words = String(text || '').toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || [];
  return new Set(words.filter((w) => !GAP_STOP_WORDS.has(w)));
}

/**
 * CONTAINMENT, not Jaccard: shared / min(size). Measured against the real rows
 * on 2026-09-20, a fresh one-line restatement of WF-G189 scored 0.29 by Jaccard
 * — under any usable threshold — because the existing row is three times longer
 * and length alone sank the score. By containment the same pair scores 0.80
 * while the nearest unrelated row (WF-G173) scores 0.40, which separates.
 *
 * The question the check asks is "does an open row already COVER this text",
 * and containment is that question.
 */
export function gapOverlap(a, b) {
  const left = gapTokens(a);
  const right = gapTokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / Math.min(left.size, right.size);
}

/**
 * Open rows of one registry whose gap text is largely contained in `text`.
 *
 * `minShared` stops a two-word probe from scoring 1.0 against everything: a
 * match on fewer than three distinctive words is a coincidence, not a
 * duplicate.
 */
export function findNearDuplicateGaps(text, gaps, threshold = 0.6, minShared = 3) {
  const probe = gapTokens(text);
  return gaps
    .map((g) => {
      const other = gapTokens(g.gap);
      let shared = 0;
      for (const token of probe) if (other.has(token)) shared++;
      return { gap: g, score: gapOverlap(text, g.gap), shared };
    })
    .filter((m) => m.score >= threshold && m.shared >= minShared)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function cmdGap(out, parsed, env, baseUrl) {
  const sub = parsed._[0];
  const flag = (name) => (typeof parsed.flags[name] === 'string' ? parsed.flags[name] : undefined);
  // WF-G259: these repairs are complete in source but not yet loaded by the
  // running daemon. Read the unfiltered registry so this remains listable even
  // while an older daemon build does not count the new status as open.
  if (sub === 'pending-restart' && !parsed._[1]) {
    const project = flag('project') || 'workflow';
    const r = await api(baseUrl, 'GET', `/gaps?project=${encodeURIComponent(project)}`);
    if (r.status !== 200 || !r.json || !Array.isArray(r.json.gaps)) {
      out.log(`pending-restart list failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    const gaps = r.json.gaps.filter((gap) => gap.status === 'pending_restart');
    out.log(`${gaps.length} ${project} gap(s) pending daemon restart and live verification`);
    for (const gap of gaps) out.log(`  ${gap.id}  ${gap.gap}`);
    return { code: 0, gaps };
  }
  // WF-G124: repair or resolve ONE row you can name, without the registry lock.
  if (sub === 'update' || sub === 'set' || sub === 'resolve' || sub === 'pending-restart') {
    const id = parsed._[1];
    if (!id) {
      // WF-G174: `gap resolve --help` printed no --project at all, although
      // --project is what selects the registry the row lives in. The default
      // is named here too, because a resolve sent to the wrong registry
      // silently reports "no row with id".
      out.log('Usage: gap update <id> [--project <p>] [--status s] [--note "append to Notes"] [--notes "replace Notes"] [--gap|--evidence|--why|--next|--proof|--severity|--classification|--surface|--suggested-agent "..."]');
      out.log('       gap resolve <id> [--project <p>] --note "how it was resolved"   (= --status resolved)');
      out.log('       gap pending-restart <id> [--project <p>] --note "source repair evidence"   (= --status pending_restart)');
      out.log('  --project selects the registry: global (default) = docs/projects/GLOBAL_GAPS.md,');
      out.log('            workflow = tools/agora/WORKFLOW_GAPS.md, <dir> = docs/projects/<dir>/GAPS.md.');
      out.log('            A WF-G<n> id needs --project workflow; the default registry does not hold it.');
      return { code: 1 };
    }
    if (sub === 'pending-restart' && !flag('note')) {
      out.log('gap pending-restart requires --note with the repair evidence. The row stays unchanged.');
      return { code: 1 };
    }
    const token = needToken(out, parsed, env, baseUrl);
    if (!token) return { code: 1 };
    const body = {
      project: flag('project') || (sub === 'pending-restart' ? 'workflow' : 'global'),
      status: sub === 'resolve' ? 'resolved' : sub === 'pending-restart' ? 'pending_restart' : flag('status'),
      note: flag('note'),
      notes: flag('notes'),
      gap: flag('gap'),
      evidence: flag('evidence'),
      why: flag('why'),
      next: flag('next'),
      proof: flag('proof'),
      severity: flag('severity'),
      classification: flag('classification'),
      surface: flag('surface'),
      suggestedAgent: flag('suggested-agent') || flag('suggestedAgent'),
    };
    const r = await api(baseUrl, 'POST', `/gaps/${encodeURIComponent(id)}`, { token, body });
    if (r.status === 200 && r.json && r.json.id) {
      out.log(`Updated ${r.json.id} in ${r.json.file} (line ${r.json.line}): ${r.json.changed.join(', ')}`);
      out.log('  No lock was needed or taken: the daemon serialized this edit (WF-G124).');
      return { code: 0, gap: r.json };
    }
    out.log(`gap update failed (${r.status}): ${r.json ? r.json.error : r.text}`);
    return { code: 1 };
  }
  // WF-G200: read the open rows before you file, so a duplicate is a choice.
  if (sub === 'search' || sub === 'find') {
    const text = flag('gap') || parsed._.slice(1).join(' ');
    if (!text) {
      out.log('Usage: gap search "<text>" [--project <p>] [--all]');
      return { code: 1 };
    }
    const project = flag('project') || 'workflow';
    const r = await api(baseUrl, 'GET', `/gaps?project=${encodeURIComponent(project)}${parsed.flags.all ? '' : '&open=1'}`);
    if (r.status !== 200 || !r.json) {
      out.log(`gap search failed (${r.status}): ${r.json ? r.json.error : r.text}`);
      return { code: 1 };
    }
    // `gap search` is a READING command, so it casts wider than the refusal
    // does: the caller wants every row worth a look, not only the certain ones.
    const matches = findNearDuplicateGaps(text, r.json.gaps || [], 0.3, 2);
    if (!matches.length) {
      out.log(`No ${project} gap row overlaps that text.`);
      return { code: 0, matches: [] };
    }
    for (const m of matches) {
      out.log(`  ${m.gap.id}  [${m.gap.status}]  overlap ${(m.score * 100).toFixed(0)}%`);
      out.log(`     ${String(m.gap.gap).slice(0, 180)}`);
    }
    return { code: 0, matches };
  }
  if (sub !== 'add' && sub !== 'new' && sub !== 'file') {
    out.log('Usage: gap add --project <global|workflow|<project-dir>> --gap "..." --evidence "..." --why "..." --next "..." --proof "..." --suggested-agent <agents.json key|human-operator> [--severity s] [--classification c] [--surface s] [--detected-during "..."] [--notes "..."] [--force]');
    out.log('       gap update <id> [--project <p>] --status <s> --note "..."   |   gap resolve <id> [--project <p>] --note "..."');
    out.log('       gap pending-restart [<id> --note "source repair evidence"] [--project <p>]');
    out.log('       gap search "<text>" [--project <p>]');
    return { code: 1 };
  }
  const project = flag('project') || 'global';
  const gap = flag('gap') || parsed._.slice(1).join(' ');
  // A worker asking for help must see the whole flag set, not one missing-arg line.
  if (!gap || parsed.flags.help) {
    out.log('Usage: gap add --project <global|workflow|<project-dir>> --gap "what is missing or wrong" --evidence "where you saw it" --why "why it matters" --next "next action" --proof "next proof" --suggested-agent <key> [--severity low|medium|high] [--classification c] [--surface s] [--detected-during "..."] [--notes "..."] [--force]');
    out.log('       gap update <id> [--project <p>] --status <s> --note "..."   |   gap resolve <id> [--project <p>] --note "..."');
    out.log('       gap pending-restart [<id> --note "source repair evidence"] [--project <p>]');
    out.log('  Provenance (handle, agent id, task) comes from your AGORA_AGENT_ID; no lock is taken.');
    out.log('  --suggested-agent is REQUIRED (WF-G205): one exact tools/agora/agents.json key, or human-operator.');
    try {
      out.log(`  Accepted --suggested-agent values: ${agentRegistryKeys().join(', ')}`);
    } catch (error) {
      out.log(`  Accepted --suggested-agent values unavailable: ${error.message}`);
    }
    out.log('  --surface names the repair location; a board task id belongs in --detected-during (WF-G253).');
    out.log('  --force files the row although an open row overlaps it (WF-G200).');
    return { code: 1 };
  }
  // WF-G244: do not derive a class, inspect duplicate rows, or POST until the
  // destination registry is known. A misspelled project must name the valid
  // choices while the caller can still correct the original command.
  try {
    const file = resolveGapsFile(project);
    if (!fs.existsSync(file)) throw new Error('registry file is absent');
  } catch {
    out.log(`gap add refused: --project "${project}" has no gap registry. No row was filed.`);
    out.log(`  Available registries: ${gapRegistryProjects().join(', ')}`);
    out.log('  Use global for docs/projects/GLOBAL_GAPS.md or workflow for tools/agora/WORKFLOW_GAPS.md.');
    return { code: 1 };
  }
  // WF-G205 / WF-G184: refuse an absent or unknown Suggested agent HERE, with
  // the accepted keys printed, instead of writing a row that the registry's
  // own validator rejects afterwards.
  const suggestedAgent = flag('suggested-agent') || flag('suggestedAgent');
  let agentKeys = [];
  try {
    agentKeys = agentRegistryKeys();
  } catch (e) {
    out.log(`gap add cannot read tools/agora/agents.json: ${e.message}`);
    return { code: 1 };
  }
  if (!suggestedAgent) {
    out.log('gap add refused: --suggested-agent is required (WF-G205).');
    out.log('  It is ROUTING data: an orchestrator picks the lane from this column.');
    out.log(`  Accepted values: ${agentKeys.join(', ')}`);
    out.log('  Use human-operator when the repair needs operator-only access or a human decision.');
    return { code: 1 };
  }
  if (!agentKeys.includes(suggestedAgent)) {
    out.log(`gap add refused: --suggested-agent "${suggestedAgent}" is not a tools/agora/agents.json key.`);
    out.log(`  Accepted values: ${agentKeys.join(', ')}`);
    return { code: 1 };
  }
  const surface = flag('surface');
  // WF-G253: Surface is WHERE the repair lands. A board task id is provenance
  // for --detected-during, not a new surface; warning and filing it anyway
  // leaves an unrouteable row. Refuse before a write or class derivation.
  if (surface && /^[a-z]+-[0-9a-f]{4}(\.\d+)?$/i.test(surface)) {
    out.log(`gap add refused: --surface "${surface}" is a board task id, not a repair location. No row was filed.`);
    out.log(`  Put the task id in --detected-during ${surface}; use --surface for where the repair belongs (agora-client, agora-daemon, planmap-<topic>, ...).`);
    return { code: 1 };
  }
  // The registry may declare closed vocabularies for Classification and
  // Surface. An unknown value is a WARNING, not a refusal: a new surface is
  // legitimate, but it must be added to the header in the same turn.
  const vocab = gapRegistryVocabulary(project);
  // WF-G204/WF-G205: an omitted Classification used to become the registry's em
  // dash, which is not in any allowed list, so every filed row turned the
  // registry validator red again. The Surface already says which part of the
  // system the gap is in, so the class is derived from it and the derivation is
  // printed. Pass --classification to override.
  const classification = flag('classification') || classificationForSurface(surface);
  if (!flag('classification') && classification) {
    out.log(`No --classification; derived "${classification}" from the surface "${surface || '(none)'}". Pass --classification to override.`);
  }
  for (const [key, value, label] of [['classification', classification, 'Classification'], ['surface', surface, 'Surface']]) {
    if (!value || !vocab[key] || vocab[key].has(value)) continue;
    out.log(`WARNING: ${label} "${value}" is not in this registry's allowed_${key === 'classification' ? 'classifications' : 'surfaces'} list.`);
    out.log(`  Add it to the YAML header of the registry in the same turn, or use one of: ${[...vocab[key]].join(', ')}`);
  }
  // The registries ask for five substantive fields. A row missing one is a row
  // the next reader cannot act on, so say so rather than filing a stub quietly.
  const body = {
    project,
    gap,
    evidence: flag('evidence'),
    why: flag('why'),
    next: flag('next'),
    proof: flag('proof'),
    severity: flag('severity'),
    classification,
    surface,
    suggestedAgent,
    detectedDuring: flag('detected-during') || flag('detectedDuring'),
    notes: flag('notes'),
  };
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  for (const missing of ['evidence', 'why', 'next', 'proof'].filter((k) => !body[k])) {
    out.log(`WARNING: no --${missing}; the row will read "—" in that column and the next reader cannot act on it.`);
  }
  // WF-G200: stop before the write when an OPEN row of the same registry
  // already says this. The command reports the near matches and refuses; the
  // caller either adds evidence to that row or passes --force.
  if (!parsed.flags.force) {
    const existing = await api(baseUrl, 'GET', `/gaps?project=${encodeURIComponent(project)}&open=1`);
    if (existing.status === 200 && existing.json && Array.isArray(existing.json.gaps)) {
      const near = findNearDuplicateGaps(gap, existing.json.gaps);
      if (near.length) {
        out.log(`gap add refused: ${near.length} OPEN row(s) in "${project}" already overlap this text (WF-G200).`);
        for (const m of near) {
          out.log(`  ${m.gap.id}  overlap ${(m.score * 100).toFixed(0)}%  ${String(m.gap.gap).slice(0, 160)}`);
        }
        out.log('  Add your evidence to that row:  gap update <id> --project ' + project + ' --note "..."');
        out.log('  Or file a separate row anyway:   ... --force');
        return { code: 1, nearDuplicates: near };
      }
    }
  }
  const r = await api(baseUrl, 'POST', '/gaps', { token, body });
  if (r.status === 201 && r.json && r.json.id) {
    out.log(`Filed ${r.json.id} in ${r.json.file} (line ${r.json.line})`);
    out.log('  No lock was needed or taken: the daemon serialized this append (WF-G113).');
    return { code: 0, gap: r.json };
  }
  out.log(`gap add failed (${r.status}): ${r.json ? r.json.error : r.text}`);
  return { code: 1 };
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
  2. Presence requires a pet identity: run \`pets\` and register with \`--pet <slug>\`.
     Codex agents and orchestrator/master roles must also pass their own task/thread id as
     \`--session <id>\`. Self-check both values with \`whoami\`; stop if either is wrong.
  3. lock BEFORE editing any shared file; a 409 CONFLICT is a HARD STOP on that file.
     If you still need it later, use \`reserve <path> --reason "<why>"\` to join the FIFO
     waiting list. A reservation is not edit permission; wait until the real lock succeeds.
  4. HEARTBEAT during long quiet work with the bounded default (or --owner-pid <pid> when the
     harness exposes its owner). Bare heartbeat stops after 30 min; --forever is exceptional.
     Meaningful authenticated activity (locks, tasks, messages, etc.) renews the server lease.
  5. Pull work with \`task next\`; finish with \`task done <id> --result "<files + proof>"\` —
     the result on the board is how the orchestrator learns what you did.
  6. When done: \`unlock --mine\`, \`say "WORKFLOW: <friction or none>"\`, then
     \`retire --note "<final state>"\`. Register real workflow friction as a row in
     tools/agora/WORKFLOW_GAPS.md (schema in the file).
  7. No git commits/resets/branches/worktrees unless YOUR task says so.
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
    out.log(`  ${handleFor(map, l.agentId).padEnd(20)} ${[...(l.paths || []), ...(l.globs || [])].join(', ')}  (expires ${relativeTime(l.expiresAt)}${expiryFlag(l.expiresAt)}) ${l.reason || 'no reason'}`);
  }

  out.log('');
  out.log('=== READY TASKS (claim with: task next) ===');
  const tr = await api(baseUrl, 'GET', '/tasks?ready=1', { token });
  const ready = (tr.json && tr.json.tasks) || [];
  if (!ready.length) out.log('  (queue is empty)');
  for (const t of ready.slice(0, 8)) {
    // GG-118: flag tasks whose refs overlap a live lock before anyone claims.
    const lockedHits = lockedRefsForTask(t, locks, handleFor, map);
    out.log(`  ${shortId(t.id)}  ${t.title}${t.priority ? `  p${t.priority}` : ''}${(t.refs || []).length ? `  refs: ${t.refs.join(', ')}` : ''}${lockedHits.length ? `\n    !! ${lockedHits.join('; ')}` : ''}`);
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
// heartbeat — bounded quiet-work presence bridge. Authenticated activity is the
// primary liveness signal; this helper only covers gaps between such calls.
// ---------------------------------------------------------------------------
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForHeartbeatDelay(delayMs, {
  ownerPid,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ownerAlive = isProcessAlive,
  ownerPollMs = DEFAULT_OWNER_POLL_MS,
} = {}) {
  let remaining = Math.max(0, delayMs);
  while (remaining > 0) {
    const slice = ownerPid ? Math.min(ownerPollMs, remaining) : remaining;
    await sleep(slice);
    remaining -= slice;
    if (ownerPid && !ownerAlive(ownerPid)) return false;
  }
  return true;
}

async function cmdHeartbeat(out, parsed, env, baseUrl, opts = {}) {
  const token = needToken(out, parsed, env, baseUrl);
  if (!token) return { code: 1 };
  if (parsed.flags.daemonize === true) {
    const spawnDetached = typeof opts.spawnDetached === 'function' ? opts.spawnDetached : spawn;
    const childArgs = parsed.raw.filter((value) => value !== '--daemonize');
    const child = spawnDetached(process.execPath, [__filename, 'heartbeat', ...childArgs], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    });
    if (child && typeof child.unref === 'function') child.unref();
    out.log(`detached bounded heartbeat started${child && child.pid ? ` (pid ${child.pid})` : ''}`);
    return { code: 0, detached: true, pid: child && child.pid };
  }
  const everySec = Number(parsed.flags.every) > 0 ? Number(parsed.flags.every) : DEFAULT_HEARTBEAT_EVERY_SEC;
  const count = Number(parsed.flags.count) > 0 ? Number(parsed.flags.count) : null;
  const explicitForMin = Number(parsed.flags.for) > 0 ? Number(parsed.flags.for) : null;
  const forever = parsed.flags.forever === true;
  if ([Boolean(count), Boolean(explicitForMin), forever].filter(Boolean).length > 1) {
    out.log('heartbeat accepts only one of --count, --for, or --forever');
    return { code: 1, beats: 0 };
  }

  const ownerValue = parsed.flags['owner-pid'] ?? env.AGORA_OWNER_PID;
  const ownerPid = ownerValue === undefined ? null : Number(ownerValue);
  if (ownerValue !== undefined && (!Number.isInteger(ownerPid) || ownerPid <= 0)) {
    out.log('--owner-pid (or AGORA_OWNER_PID) must be a positive integer');
    return { code: 1, beats: 0 };
  }

  const defaultForMin = Number(opts.defaultForMin) > 0 ? Number(opts.defaultForMin) : DEFAULT_HEARTBEAT_FOR_MIN;
  const forMin = explicitForMin || (!count && !forever ? defaultForMin : null);
  const now = typeof opts.now === 'function' ? opts.now : Date.now;
  const endAt = forMin ? now() + forMin * 60000 : null;
  const ownerAlive = typeof opts.ownerAlive === 'function' ? opts.ownerAlive : isProcessAlive;
  const waitOpts = {
    ownerPid,
    sleep: opts.sleep,
    ownerAlive,
    ownerPollMs: opts.ownerPollMs,
  };

  if (ownerPid && !ownerAlive(ownerPid)) {
    out.log(`heartbeat owner PID ${ownerPid} is not running; no heartbeat started`);
    return { code: 0, beats: 0, stopped: 'owner_exited' };
  }
  if (forever) {
    out.log(`unbounded heartbeat explicitly enabled every ${everySec}s${ownerPid ? ` for owner PID ${ownerPid}` : ''}`);
  } else if (forMin) {
    out.log(`bounded heartbeat every ${everySec}s for at most ${forMin} minute(s)${ownerPid ? `; owner PID ${ownerPid}` : ''}`);
  }

  // WF-G91: a lock's TTL (30 min default) is shorter than most packets, and
  // seven of nine workers in one wave lost their locks mid-edit without
  // noticing. The heartbeat helper is the one process that is provably still
  // working, so each beat renews the caller's own locks unless told not to.
  const renewLocks = parsed.flags['renew-locks'] !== false && parsed.flags['no-renew-locks'] !== true;
  const identity = loadIdentity(env, baseUrl);
  const myAgentId = identity && identity.agentId;
  const renewOwnLocks = async () => {
    if (!renewLocks || !myAgentId) return 0;
    const locks = await api(baseUrl, 'GET', '/locks');
    if (locks.status !== 200 || !locks.json || !Array.isArray(locks.json.locks)) return 0;
    let renewed = 0;
    for (const lock of locks.json.locks) {
      if (lock.agentId !== myAgentId) continue;
      const rr = await api(baseUrl, 'POST', `/locks/${encodeURIComponent(lock.id)}/renew`, { token, body: {} });
      if (rr.status === 200) renewed++;
    }
    return renewed;
  };

  let beats = 0;
  for (;;) {
    if (endAt && now() >= endAt) break;
    const r = await api(baseUrl, 'POST', '/agents/heartbeat', { token });
    if (r.status !== 200) {
      out.log(`heartbeat failed (${r.status}): ${r.json ? r.json.error : r.text} — re-register only after confirming the agent is active`);
      return { code: 1, beats };
    }
    beats++;
    const renewed = await renewOwnLocks();
    if (renewed) out.log(`renewed ${renewed} lock(s)`);
    if (count && beats >= count) break;
    if (endAt && now() >= endAt) break;
    const delayMs = endAt ? Math.min(everySec * 1000, Math.max(0, endAt - now())) : everySec * 1000;
    if (delayMs <= 0) break;
    const ownerStillAlive = await waitForHeartbeatDelay(delayMs, waitOpts);
    if (!ownerStillAlive) {
      out.log(`heartbeat owner PID ${ownerPid} exited; stopping after ${beats} beat(s)`);
      return { code: 0, beats, stopped: 'owner_exited' };
    }
  }
  out.log(`${beats} heartbeat(s) sent`);
  return { code: 0, beats, stopped: count ? 'count' : (endAt ? 'duration' : 'signal') };
}

function friendlyUnreachable(baseUrl, detail) {
  return `Agora daemon not reachable at ${baseUrl} — is it running? (npm run agora)` + (detail ? `\n  (${detail})` : '');
}

// ---------------------------------------------------------------------------
// Dispatcher. `run(argv, { env, baseUrl, repoRoot, identityDirOverride })`
// -> Promise<{ code, ... }>.
// Never calls process.exit; returns an out-buffer in result.lines.
// ---------------------------------------------------------------------------
export async function run(argv, {
  env = process.env,
  baseUrl: baseOverride,
  watchOpts,
  heartbeatOpts,
  repoRoot = REPO_ROOT,
  identityDirOverride,
} = {}) {
  // Tests may relocate only the default identity file. Real CLI calls never
  // receive this option and continue to use the documented environment rules.
  if (identityDirOverride) env = { ...env, [IDENTITY_DIR_OVERRIDE]: identityDirOverride };
  const out = makeOut();
  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const baseUrl = resolveBaseUrl(parsed, env, baseOverride);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    out.log(usageText());
    return { code: 0, lines: out.lines };
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
        res = await cmdHeartbeat(out, parsed, env, baseUrl, heartbeatOpts || {});
        break;
      case 'whoami':
        res = await cmdWhoami(out, parsed, env, baseUrl);
        break;
      case 'agents':
        res = await cmdAgents(out, parsed, env, baseUrl);
        break;
      case 'pets':
        res = await cmdPets(out, parsed, env, baseUrl);
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
      case 'seat':
      case 'seats':
        res = await cmdSeat(out, parsed, env, baseUrl);
        break;
      case 'campaign':
        res = await cmdCampaign(out, parsed, env, baseUrl);
        break;
      case 'campaigns':
        res = await cmdCampaigns(out, parsed, env, baseUrl);
        break;
      case 'sweep':
        res = await cmdSweep(out, parsed, env, baseUrl);
        break;
      case 'task':
        res = await cmdTask(out, parsed, env, baseUrl);
        break;
      case 'tasks':
        res = await cmdTasks(out, parsed, env, baseUrl);
        break;
      case 'retrace':
        res = await cmdRetrace(out, parsed, env, baseUrl, repoRoot);
        break;
      case 'gap':
      case 'gaps':
        res = await cmdGap(out, parsed, env, baseUrl);
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
    return { ...res, lines: out.lines, stderrLines: out.stderrLines };
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
      for (const line of res.stderrLines || []) console.error(line);
      process.exit(res.code || 0);
    });
  } else {
    run(argv).then((res) => {
      for (const line of res.lines) console.log(line);
      for (const line of res.stderrLines || []) console.error(line);
      process.exit(res.code || 0);
    });
  }
}
