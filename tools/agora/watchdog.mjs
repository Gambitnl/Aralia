#!/usr/bin/env node

// One Agora-owned activation watchdog for every registered orchestrator.
// Durable adapter definitions live in agents.json. Ephemeral target/session
// bindings and delivery cursors live below .agent/agora so repository history
// never accumulates machine-specific conversation ids.

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DEFAULT_REGISTRY = path.join(HERE, 'agents.json');
const DEFAULT_TARGETS = path.join(REPO, '.agent', 'agora', 'watchdog-targets.json');
const DEFAULT_STATE = path.join(REPO, '.agent', 'agora', 'watchdog-state.json');
const DEFAULT_AUDIT = path.join(REPO, '.agent', 'agora', 'watchdog-audit.jsonl');
const DEFAULT_LOG_DIR = path.join(REPO, '.agent', 'agora', 'watchdog-logs');
const DEFAULT_URL = process.env.AGORA_URL || 'http://127.0.0.1:4319';

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
}

function persistTargetState(file, state, handle) {
  const fresh = readJson(file, { version: 1, targets: {} });
  fresh.version = state.version || fresh.version || 1;
  fresh.service = state.service || fresh.service;
  fresh.targets ||= {};
  fresh.targets[handle] = state.targets[handle];
  writeJsonAtomic(file, fresh);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasesFor(target) {
  return [...new Set([target.callsign, target.handle, ...(target.aliases || [])]
    .filter(Boolean)
    .map((value) => String(value).replace(/^@/, '').toLowerCase()))];
}

export function isWakeWorthy(message, target, agentsById) {
  const sender = agentsById.get(message.from);
  if (sender?.role === 'human') return true;
  if (message.to === target.agentId) return true;
  const body = String(message.body || '');
  return aliasesFor(target).some((alias) => {
    const pattern = new RegExp(`(^|[^a-z0-9_-])@${escapeRegex(alias)}(?![a-z0-9_-])`, 'i');
    return pattern.test(body);
  });
}

export function lifecycleSignal(message, target) {
  if (message.from !== target.agentId) return '';
  const names = aliasesFor(target).map(escapeRegex).join('|');
  if (!names) return '';
  const body = String(message.body || '');
  if (new RegExp(`\\b(?:${names})\\s+DORMANT\\b`, 'i').test(body)) return 'dormant';
  if (new RegExp(`\\b(?:${names})\\s+AWAKE\\b`, 'i').test(body)) return 'awake';
  return '';
}

export function planTargetMessages({ messages, target, agentsById, targetState, now, cooldownMs }) {
  const originalCursor = Number(targetState.cursor) || 0;
  let proposedCursor = originalCursor;
  let safeCursor = originalCursor;
  let dormant = Boolean(targetState.dormant);
  let awakeSeen = false;
  let launchRequired = false;
  const wakes = [];
  const presence = agentsById.get(target.agentId)?.status || 'gone';

  for (const message of [...messages].sort((a, b) => a.seq - b.seq)) {
    if (message.seq <= originalCursor) continue;
    proposedCursor = message.seq;
    const lifecycle = lifecycleSignal(message, target);
    if (lifecycle === 'dormant') dormant = true;
    if (lifecycle === 'awake') {
      // A native watcher may answer while the activation watchdog is holding the
      // triggering wake during its grace window. The explicit AWAKE is delivery
      // proof: cancel the fallback launch and advance safely through the reply.
      dormant = false;
      awakeSeen = true;
      launchRequired = false;
      wakes.length = 0;
      safeCursor = message.seq;
      continue;
    }

    const wake = isWakeWorthy(message, target, agentsById);
    if (!wake) {
      if (!launchRequired) safeCursor = message.seq;
      continue;
    }
    // A stale roster entry may still own work, but its harness is no longer
    // proving liveness. A wake-worthy event may restore that same session after
    // the target's native grace window; task ownership itself is not changed.
    if (dormant || presence !== 'online') {
      launchRequired = true;
      wakes.push(message);
      continue;
    }
    if (!launchRequired) safeCursor = message.seq;
  }

  if (!launchRequired) {
    return { kind: 'active', cursor: proposedCursor, safeCursor: proposedCursor, dormant, presence, wakes: [], awakeSeen };
  }
  const coolingDown = Number(targetState.lastLaunchAt) > 0
    && now - Number(targetState.lastLaunchAt) < cooldownMs;
  const nativeGraceMs = Math.max(0, Number(target.nativeGraceMs) || 0);
  const firstWakeAt = Number(wakes[0]?.createdAt) || 0;
  const waitingForNative = presence !== 'gone' && nativeGraceMs > 0 && firstWakeAt > 0
    && now - firstWakeAt < nativeGraceMs;
  const pendingStartedAt = Number(targetState.pending?.startedAt) || 0;
  const launchPending = pendingStartedAt > 0 && now - pendingStartedAt < 30 * 60_000;
  const backingOff = Number(targetState.backoffUntil) > now;
  return {
    kind: waitingForNative
      ? 'native-grace'
      : launchPending
        ? 'launch-pending'
        : backingOff
          ? 'failure-backoff'
          : coolingDown
            ? 'cooldown'
            : 'launch',
    cursor: proposedCursor,
    safeCursor,
    dormant,
    presence,
    wakes,
    awakeSeen,
  };
}

export function failureBackoffMs(failureCount) {
  const exponent = Math.max(0, Math.min(5, Number(failureCount) - 1));
  return Math.min(15 * 60_000, 30_000 * (2 ** exponent));
}

export function expandTemplate(value, variables) {
  return String(value).replace(/\{(sessionId|prompt|cwd|handle|callsign|script)\}/g, (_match, key) => variables[key] || '');
}

function firstJsonLine(file, maxBytes = 2 * 1024 * 1024) {
  const fd = openSync(file, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    let text = '';
    let offset = 0;
    while (offset < maxBytes) {
      const bytesRead = readSync(fd, chunk, 0, Math.min(chunk.length, maxBytes - offset), offset);
      if (bytesRead === 0) break;
      text += chunk.toString('utf8', 0, bytesRead);
      const newline = text.indexOf('\n');
      if (newline >= 0) return JSON.parse(text.slice(0, newline));
      offset += bytesRead;
    }
    if (text.trim()) return JSON.parse(text.trim());
    throw new Error(`empty session file: ${file}`);
  } finally {
    closeSync(fd);
  }
}

function findFileBySuffix(root, suffix) {
  if (!root || !existsSync(root)) return '';
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile() && entry.name.endsWith(suffix)) return candidate;
    }
  }
  return '';
}

export function readSessionCliVersion(sessionId, codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || '', '.codex')) {
  const sessionFile = findFileBySuffix(path.join(codexHome, 'sessions'), `${sessionId}.jsonl`);
  if (!sessionFile) throw new Error(`Codex session file not found for ${sessionId}`);
  const first = firstJsonLine(sessionFile);
  if (first?.type !== 'session_meta' || !first.payload?.cli_version) {
    throw new Error(`Codex session ${sessionId} has no leading session_meta cli_version`);
  }
  return { version: String(first.payload.cli_version), sessionFile };
}

function localCodexCandidates() {
  const candidates = [];
  if (process.env.CODEX_APP_EXECUTABLE) candidates.push(process.env.CODEX_APP_EXECUTABLE);
  const localBin = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  if (existsSync(localBin)) {
    for (const entry of readdirSync(localBin, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const executable = path.join(localBin, entry.name, process.platform === 'win32' ? 'codex.exe' : 'codex');
      if (existsSync(executable) && statSync(executable).isFile()) candidates.push(executable);
    }
  }
  candidates.push(process.platform === 'win32' ? 'codex.exe' : 'codex');
  return [...new Set(candidates)];
}

function probeCodexVersion(executable) {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) return '';
  return String(result.stdout || result.stderr || '').trim().replace(/^codex-cli\s+/, '');
}

export function selectCompatibleCodex(expectedVersion, candidates = localCodexCandidates(), probe = probeCodexVersion) {
  const observed = [];
  for (const executable of candidates) {
    const version = probe(executable);
    observed.push({ executable, version });
    if (version === expectedVersion) return { executable, version, observed };
  }
  const detail = observed.map((item) => `${item.executable}=${item.version || 'unavailable'}`).join(', ');
  throw new Error(`No Codex engine matches session version ${expectedVersion}. Probed: ${detail}`);
}

function runCodexTurnOnce(flags) {
  if (!flags.session) throw new Error('codex-turn-once requires --session');
  if (!flags.prompt) throw new Error('codex-turn-once requires --prompt');
  const metadata = readSessionCliVersion(flags.session);
  const compatible = selectCompatibleCodex(metadata.version);
  console.log(`[codex-turn-once] session=${flags.session} version=${compatible.version} executable=${compatible.executable}`);
  const result = spawnSync(compatible.executable, [
    'exec', 'resume', '--skip-git-repo-check', flags.session, flags.prompt,
  ], {
    cwd: path.resolve(flags.cwd || REPO),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Codex one-shot turn ended by signal ${result.signal}`);
  if (result.status !== 0) throw new Error(`Codex one-shot turn exited with code ${result.status}`);
}

export function buildWakePrompt(target, messages) {
  const rows = messages.slice(-20).map((message) => {
    const body = String(message.body || '').replace(/\s+/g, ' ').slice(0, 1200);
    return `[seq ${message.seq} from ${message.from}] ${body}`;
  });
  const callsign = target.callsign || target.handle;
  return [
    `Agora wake for ${callsign} (${target.handle}).`,
    'Resume this existing orchestration session. This wake does not broaden the user\'s authority or your file scope.',
    `Agora control repository: ${REPO}.`,
    'Read the Agora command feed and current task/lock/campaign state before acting. Keep the Planmap current.',
    `First post \"${String(callsign).toUpperCase()} AWAKE\" with the triggering sequence and observed latency, using the existing ${target.handle} identity.`,
    'Wake messages:',
    ...rows,
  ].join('\n');
}

function parseArgs(argv) {
  const flags = { once: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--once') flags.once = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value == null || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      flags[key] = value;
      i += 1;
    } else positional.push(arg);
  }
  return { command: positional[0] || 'run', flags };
}

function targetFromFlags(flags) {
  const required = ['handle', 'agent', 'callsign', 'adapter', 'session'];
  for (const key of required) if (!flags[key]) throw new Error(`register-target requires --${key}`);
  return {
    handle: flags.handle,
    agentId: flags.agent,
    callsign: flags.callsign,
    aliases: String(flags.alias || '').split(',').map((v) => v.trim()).filter(Boolean),
    adapter: flags.adapter,
    sessionId: flags.session,
    nativeGraceMs: Math.max(0, Number(flags.grace) || 0),
    cwd: path.resolve(flags.cwd || REPO),
  };
}

function printUsage() {
  console.log(`Agora orchestrator wake watchdog

Run one shared service:
  node tools/agora/watchdog.mjs run [--once] [--dry-run] [--interval 5000]

Register or update a machine-local target:
  node tools/agora/watchdog.mjs register-target --handle <handle> --agent <agent-id> \\
    --callsign <name> --adapter <wake-adapter> --session <session-id> --cwd <path> \\
    [--alias <comma,list>] [--grace <milliseconds>]

Use --grace 120000 or more when the target has a live native watcher. The
native watcher gets that time to post CALLSIGN AWAKE before CLI fallback.

First registration bootstraps the target cursor to the latest Agora message.
It does not replay historical wake requests. Later delivery is per-target and
crash-safe through .agent/agora/watchdog-state.json.`);
}

function registerTarget(file, target) {
  const config = readJson(file, { version: 1, targets: [] });
  const existing = config.targets.findIndex((item) => item.handle === target.handle);
  if (existing >= 0) config.targets[existing] = target;
  else config.targets.push(target);
  writeJsonAtomic(file, config);
  return target;
}

async function requestJson(baseUrl, route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { ok: response.ok, status: response.status, json, text };
}

async function ensureServiceIdentity(baseUrl, state) {
  if (state.service?.token) {
    const heartbeat = await requestJson(baseUrl, '/agents/heartbeat', {
      method: 'POST', token: state.service.token, body: {},
    });
    if (heartbeat.ok) return state.service;
  }
  const registered = await requestJson(baseUrl, '/agents/register', {
    method: 'POST',
    body: {
      handle: 'agora-watchdog',
      note: 'Registry-driven orchestrator activation and wake audit service',
      model: 'node-watchdog',
      role: 'worker',
      type: 'service',
      cwd: REPO,
    },
  });
  if (!registered.ok) throw new Error(`watchdog registration failed (${registered.status}): ${registered.text}`);
  state.service = {
    agentId: registered.json.agentId,
    token: registered.json.token,
    handle: registered.json.handle,
  };
  return state.service;
}

function processSnapshot() {
  if (process.platform === 'win32') {
    const result = spawnSync('tasklist.exe', ['/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
    return String(result.stdout || '').toLowerCase();
  }
  const result = spawnSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8' });
  return String(result.stdout || '').toLowerCase();
}

function adapterProcessRunning(adapter, snapshot) {
  return (adapter.processNames || []).some((name) => snapshot.includes(String(name).toLowerCase()));
}

function launchAdapter({ adapter, target, prompt, logDir }) {
  if (adapter.status !== 'ready' || !adapter.command || !Array.isArray(adapter.args)) {
    return Promise.resolve({ ok: false, outcome: 'wake-unavailable', error: 'adapter is not ready' });
  }
  mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `${target.handle}-${stamp}.log`);
  const logFd = openSync(logFile, 'a');
  const variables = {
    sessionId: target.sessionId,
    prompt,
    cwd: target.cwd,
    handle: target.handle,
    callsign: target.callsign,
    script: fileURLToPath(import.meta.url),
  };
  const command = expandTemplate(adapter.command, variables);
  const args = adapter.args.map((arg) => expandTemplate(arg, variables));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { closeSync(logFd); } catch { /* already closed */ }
      resolve({ ...result, command, args, logFile });
    };
    const child = spawn(command, args, {
      cwd: target.cwd || REPO,
      detached: true,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        AGORA_AGENT_ID: target.handle,
        AGORA_DIR: path.join(REPO, '.agent', 'agora'),
        AGORA_URL: DEFAULT_URL,
      },
    });
    const exitPromise = new Promise((resolveExit) => {
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });
    child.once('error', (error) => finish({ ok: false, outcome: 'launch-error', error: error.message }));
    child.once('spawn', () => {
      child.unref();
      finish({ ok: true, outcome: 'launched', pid: child.pid, child, exitPromise });
    });
  });
}

function logTail(logFile, maxLength = 500) {
  try {
    const text = readFileSync(logFile, 'utf8').replace(/\s+/g, ' ').trim();
    return text.slice(-maxLength);
  } catch {
    return '';
  }
}

function appendAudit(file, entry) {
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function postAudit(baseUrl, service, entry) {
  const seqs = entry.seqs?.join(',') || '-';
  const detail = entry.error ? ` error=${entry.error}` : '';
  const response = await requestJson(baseUrl, '/messages', {
    method: 'POST', token: service.token,
    body: {
      to: 'all',
      body: `WAKE-AUDIT target=${entry.target} seq=${seqs} outcome=${entry.outcome} presence=${entry.presence} process=${entry.processRunning ? 'running' : 'absent'}${detail}`,
    },
  });
  if (!response.ok) throw new Error(`audit post failed (${response.status}): ${response.text}`);
}

function monitorChildExit({ child, exitPromise, target, statePath, auditPath, baseUrl, service, initialEntry }) {
  exitPromise.then(async ({ code, signal }) => {
    const at = Date.now();
    const failed = code !== 0;
    const freshState = readJson(statePath, { version: 1, targets: {} });
    const targetState = freshState.targets[target.handle] || {};
    const pending = targetState.pending;
    if (pending?.pid === child.pid) {
      if (failed) {
        targetState.cursor = Number(pending.safeCursor) || Number(targetState.cursor) || 0;
        targetState.failureCount = (Number(targetState.failureCount) || 0) + 1;
        targetState.backoffUntil = at + failureBackoffMs(targetState.failureCount);
        targetState.outcome = 'child-failed';
      } else {
        targetState.cursor = Math.max(Number(targetState.cursor) || 0, Number(pending.cursor) || 0);
        targetState.failureCount = 0;
        targetState.backoffUntil = 0;
        targetState.dormant = false;
        targetState.outcome = 'child-completed';
      }
      delete targetState.pending;
      freshState.targets[target.handle] = targetState;
      writeJsonAtomic(statePath, freshState);
    }
    const tail = logTail(initialEntry.logFile);
    const followUp = {
      ...initialEntry,
      at: new Date(at).toISOString(),
      outcome: failed ? 'child-failed' : 'child-completed',
      exitCode: code,
      signal: signal || undefined,
      error: failed ? (tail || `child exited with code ${code}`) : undefined,
    };
    appendAudit(auditPath, followUp);
    try {
      await postAudit(baseUrl, service, followUp);
    } catch (error) {
      appendAudit(auditPath, {
        at: new Date().toISOString(),
        target: target.handle,
        outcome: 'audit-post-error',
        error: error.message,
      });
    }
  }).catch((error) => {
    appendAudit(auditPath, {
      at: new Date().toISOString(),
      target: target.handle,
      outcome: 'child-monitor-error',
      error: error.message,
    });
  });
}

export async function runCycle(options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_URL;
  const registryPath = options.registryPath || DEFAULT_REGISTRY;
  const targetsPath = options.targetsPath || DEFAULT_TARGETS;
  const statePath = options.statePath || DEFAULT_STATE;
  const auditPath = options.auditPath || DEFAULT_AUDIT;
  const logDir = options.logDir || DEFAULT_LOG_DIR;
  const cooldownMs = Number(options.cooldownMs) || 30_000;
  const registry = readJson(registryPath, {});
  const targetsConfig = readJson(targetsPath, { targets: [] });
  const state = readJson(statePath, { version: 1, targets: {} });
  const service = options.dryRun ? state.service : await ensureServiceIdentity(baseUrl, state);
  // Persist the audit token immediately. A later fetch failure must not leave a
  // live service identity whose credential only existed in process memory.
  if (!options.dryRun) writeJsonAtomic(statePath, state);
  const agentsResponse = await requestJson(baseUrl, '/agents');
  if (!agentsResponse.ok) throw new Error(`GET /agents failed (${agentsResponse.status})`);
  const agents = agentsResponse.json.agents || [];
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const existingCursors = targetsConfig.targets
    .map((target) => state.targets[target.handle]?.cursor)
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);
  const since = existingCursors.length ? Math.min(...existingCursors) : 0;
  const messagesResponse = await requestJson(baseUrl, `/messages?since=${since}&channel=all`);
  if (!messagesResponse.ok) throw new Error(`GET /messages failed (${messagesResponse.status})`);
  const messages = messagesResponse.json.messages || [];
  const latestSeq = messages.reduce((max, message) => Math.max(max, Number(message.seq) || 0), since);
  const now = Date.now();
  const processList = processSnapshot();
  const results = [];

  for (const target of targetsConfig.targets) {
    const adapter = registry.wakeAdapters?.[target.adapter];
    if (!state.targets[target.handle]) {
      state.targets[target.handle] = { cursor: latestSeq, dormant: false, lastLaunchAt: 0, outcome: 'bootstrapped' };
      results.push({ target: target.handle, outcome: 'bootstrapped', cursor: latestSeq });
      if (!options.dryRun) persistTargetState(statePath, state, target.handle);
      continue;
    }
    const targetState = state.targets[target.handle];
    const plan = planTargetMessages({ messages, target, agentsById, targetState, now, cooldownMs });
    targetState.dormant = plan.dormant;
    if (plan.kind === 'active') {
      targetState.cursor = plan.cursor;
      targetState.outcome = 'active-harness';
      if (plan.awakeSeen) {
        delete targetState.pending;
        targetState.failureCount = 0;
        targetState.backoffUntil = 0;
      }
      if (!options.dryRun) persistTargetState(statePath, state, target.handle);
      continue;
    }
    if (['cooldown', 'native-grace', 'launch-pending', 'failure-backoff'].includes(plan.kind)) {
      targetState.cursor = plan.safeCursor;
      targetState.outcome = plan.kind;
      results.push({ target: target.handle, outcome: plan.kind, seqs: plan.wakes.map((m) => m.seq) });
      if (!options.dryRun) persistTargetState(statePath, state, target.handle);
      continue;
    }

    const prompt = buildWakePrompt(target, plan.wakes);
    // Advisory only. A GUI process can exist while its conversation is idle;
    // DORMANT/AWAKE lifecycle and Agora presence are the launch gates.
    const running = adapterProcessRunning(adapter || {}, processList);
    const launch = options.dryRun
      ? { ok: true, outcome: 'dry-run', command: adapter?.command, args: adapter?.args }
      : await launchAdapter({ adapter: adapter || {}, target, prompt, logDir });
    const entry = {
      at: new Date(now).toISOString(),
      target: target.handle,
      agentId: target.agentId,
      seqs: plan.wakes.map((message) => message.seq),
      outcome: launch.outcome,
      presence: plan.presence,
      processRunning: running,
      pid: launch.pid,
      logFile: launch.logFile,
      error: launch.error,
    };
    results.push(entry);
    if (launch.ok && !options.dryRun) {
      // Spawning is not delivery. Hold the cursor before the wake until either
      // the target posts AWAKE or the child exits successfully.
      targetState.cursor = plan.safeCursor;
      targetState.lastLaunchAt = now;
      targetState.outcome = launch.outcome;
      targetState.pending = {
        pid: launch.pid,
        cursor: plan.cursor,
        safeCursor: plan.safeCursor,
        startedAt: now,
        seqs: entry.seqs,
      };
    } else {
      targetState.cursor = plan.safeCursor;
      targetState.outcome = launch.outcome;
      if (!options.dryRun) {
        targetState.failureCount = (Number(targetState.failureCount) || 0) + 1;
        targetState.backoffUntil = now + failureBackoffMs(targetState.failureCount);
      }
    }
    if (!options.dryRun) {
      // Persist the pending delivery before the best-effort visible audit.
      // The cursor stays before the wake until AWAKE or clean child exit.
      persistTargetState(statePath, state, target.handle);
      appendAudit(auditPath, entry);
      if (launch.ok && launch.child) {
        monitorChildExit({
          child: launch.child,
          exitPromise: launch.exitPromise,
          target,
          statePath,
          auditPath,
          baseUrl,
          service,
          initialEntry: entry,
        });
      }
      try {
        await postAudit(baseUrl, service, entry);
      } catch (error) {
        appendAudit(auditPath, {
          at: new Date().toISOString(),
          target: target.handle,
          outcome: 'audit-post-error',
          error: error.message,
        });
      }
    }
  }

  return results;
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const targetsPath = flags.targets ? path.resolve(flags.targets) : DEFAULT_TARGETS;
  if (command === 'help' || flags.help) {
    printUsage();
    return;
  }
  if (command === 'register-target') {
    const target = registerTarget(targetsPath, targetFromFlags(flags));
    console.log(`registered wake target ${target.handle} -> ${target.adapter}`);
    return;
  }
  if (command === 'codex-turn-once') {
    runCodexTurnOnce(flags);
    return;
  }
  if (command !== 'run') throw new Error(`unknown command: ${command}`);
  const options = {
    baseUrl: flags.url || DEFAULT_URL,
    registryPath: flags.registry ? path.resolve(flags.registry) : DEFAULT_REGISTRY,
    targetsPath,
    statePath: flags.state ? path.resolve(flags.state) : DEFAULT_STATE,
    auditPath: flags.audit ? path.resolve(flags.audit) : DEFAULT_AUDIT,
    logDir: flags.logs ? path.resolve(flags.logs) : DEFAULT_LOG_DIR,
    cooldownMs: Number(flags.cooldown) || 30_000,
    dryRun: flags.dryRun,
  };
  const intervalMs = Math.max(1_000, Number(flags.interval) || 5_000);
  do {
    try {
      const results = await runCycle(options);
      for (const result of results) console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`[watchdog] ${error.stack || error.message}`);
    }
    if (flags.once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
