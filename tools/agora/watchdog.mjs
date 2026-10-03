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
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

/**
 * This file wakes dormant Agora orchestrators through explicit harness adapters.
 *
 * It watches the shared message feed, classifies human/direct/@callsign wake
 * requests, keeps one durable cursor per target, and launches only the adapter
 * registered for that target. Machine-specific session ids stay under
 * `.agent/agora`, while the tracked registry describes reusable capabilities.
 *
 * Called by: the detached Agora watchdog process and focused watchdog tests
 * Depends on: agents.json adapter definitions and the local Agora HTTP daemon
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DEFAULT_REGISTRY = path.join(HERE, 'agents.json');
const DEFAULT_TARGETS = path.join(REPO, '.agent', 'agora', 'watchdog-targets.json');
const DEFAULT_STATE = path.join(REPO, '.agent', 'agora', 'watchdog-state.json');
const DEFAULT_AUDIT = path.join(REPO, '.agent', 'agora', 'watchdog-audit.jsonl');
const DEFAULT_LOG_DIR = path.join(REPO, '.agent', 'agora', 'watchdog-logs');
const DEFAULT_URL = process.env.AGORA_URL || 'http://127.0.0.1:4319';
const PET_MANIFEST = path.join(HERE, 'dashboard', 'pets', 'pets.json');

// The watchdog is a real presence participant and therefore needs the same
// explicit catalog identity as interactive agents. Operators may pin a service
// pet through AGORA_WATCHDOG_PET; otherwise the tracked manifest's first pet is
// the deterministic service identity.
function watchdogPetSlug() {
  if (process.env.AGORA_WATCHDOG_PET) return process.env.AGORA_WATCHDOG_PET;
  const manifest = readJson(PET_MANIFEST, { pets: [] });
  return manifest.pets[0] && manifest.pets[0].slug;
}

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
    if (lifecycle === 'dormant') {
      // The target's own dormancy announcement controls lifecycle state; it is
      // never also a wake request. This matters when the announcement teaches
      // peers to use "@callsign", because that example mentions the target.
      dormant = true;
      if (!launchRequired) safeCursor = message.seq;
      continue;
    }
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

// ============================================================================
// Codex Session Compatibility
// ============================================================================
// Codex resume must preserve both the engine version and the last model that
// completed a turn. The machine-wide default can drift after a session was
// created, and an older engine may reject that newer default before waking.
// ============================================================================

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

function visitJsonLines(file, visitor) {
  // Read incrementally so a long-running orchestration transcript does not have
  // to be copied into memory just to recover its last successful model.
  const fd = openSync(file, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    const decoder = new StringDecoder('utf8');
    let pending = '';
    let offset = 0;
    while (true) {
      const bytesRead = readSync(fd, chunk, 0, chunk.length, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
      // Preserve a multi-byte character that lands across two filesystem reads;
      // transcripts often contain human punctuation, emoji, and localized text.
      pending += decoder.write(chunk.subarray(0, bytesRead));

      // Session transcripts are JSONL. Process complete records now and carry
      // the final partial line into the next chunk.
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) visitor(JSON.parse(line));
        newline = pending.indexOf('\n');
      }
    }

    // Flush any partial UTF-8 character, then preserve a valid final record even
    // when the transcript writer omitted its trailing newline.
    pending += decoder.end();
    if (pending.trim()) visitor(JSON.parse(pending.trim()));
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

  // A failed resume still appends a turn_context using the incompatible model.
  // Only promote a model after its matching task_complete carries a real final
  // answer; otherwise retain the previous successfully completed turn.
  let currentTurn = null;
  let firstModel = '';
  let lastSuccessfulModel = '';
  visitJsonLines(sessionFile, (record) => {
    if (record?.type === 'turn_context' && record.payload?.model) {
      currentTurn = {
        id: String(record.payload.turn_id || ''),
        model: String(record.payload.model),
      };
      if (!firstModel) firstModel = currentTurn.model;
      return;
    }
    const completed = record?.type === 'event_msg' && record.payload?.type === 'task_complete';
    const matchingTurn = !record.payload?.turn_id || record.payload.turn_id === currentTurn?.id;
    if (completed && matchingTurn && record.payload.last_agent_message && currentTurn?.model) {
      lastSuccessfulModel = currentTurn.model;
    }
  });

  const model = lastSuccessfulModel || firstModel;
  if (!model) throw new Error(`Codex session ${sessionId} has no recorded turn model`);
  return { version: String(first.payload.cli_version), model, sessionFile };
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

export function withCodexResumeModel(command, args, model) {
  // Only Codex's explicit resume command needs this guard. Other adapters keep
  // their registry arguments byte-for-byte so Claude and future harnesses remain
  // independent of Codex transcript conventions.
  const executable = path.basename(String(command)).toLowerCase().replace(/\.exe$/, '');
  const isCodexResume = executable === 'codex' && args[0] === 'exec' && args[1] === 'resume';
  if (!isCodexResume || args.includes('-m') || args.includes('--model')) return args;
  if (!model) throw new Error('Codex resume requires the last successfully completed session model');

  // Put the model beside the resume command before any session id or prompt.
  // This overrides a drifting machine default without changing session identity.
  return [...args.slice(0, 2), '-m', model, ...args.slice(2)];
}

// ============================================================================
// Codex Desktop Thread Surfacing
// ============================================================================
// A CLI resume can complete the requested work, but it does not bring the
// result to the operator's foreground. Codex's documented deep-link route lets
// the watchdog open that exact saved thread without simulating keystrokes or
// depending on private desktop message-injection APIs.
// ============================================================================

const CODEX_THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function codexThreadDeepLink(sessionId) {
  // Desktop routing accepts a technical thread UUID. Refusing names and loose
  // text keeps an Agora target from turning a shell launch into an arbitrary URL.
  const threadId = String(sessionId || '').trim();
  if (!CODEX_THREAD_ID.test(threadId)) {
    throw new Error(`Codex desktop surfacing requires a technical thread UUID, received: ${threadId || '(empty)'}`);
  }
  return `codex://threads/${threadId}`;
}

export function codexThreadOpenSpec(sessionId, platform = process.platform) {
  // Windows Explorer and macOS `open` both delegate the documented codex:// URL
  // to the installed desktop app. Linux has no supported Codex desktop surface.
  const uri = codexThreadDeepLink(sessionId);
  if (platform === 'win32') return { command: 'explorer.exe', args: [uri], uri };
  if (platform === 'darwin') return { command: 'open', args: [uri], uri };
  return null;
}

export function openCodexThread(sessionId, options = {}) {
  const spec = codexThreadOpenSpec(sessionId, options.platform || process.platform);
  if (!spec) {
    return Promise.resolve({
      ok: false,
      outcome: 'desktop-surface-unavailable',
      error: `Codex desktop deep links are not supported on ${options.platform || process.platform}`,
    });
  }

  // Resolve as soon as the operating system accepts the deep link. The desktop
  // app owns navigation after that point, so waiting for Explorer to exit would
  // add no delivery proof and could hold the watchdog open unnecessarily.
  const spawnProcess = options.spawnProcess || spawn;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, ...spec });
    };
    let child;
    try {
      child = spawnProcess(spec.command, spec.args, {
        detached: true,
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (error) {
      finish({ ok: false, outcome: 'desktop-surface-error', error: error.message });
      return;
    }
    child.once('error', (error) => finish({ ok: false, outcome: 'desktop-surface-error', error: error.message }));
    child.once('spawn', () => {
      child.unref();
      finish({ ok: true, outcome: 'desktop-thread-opened' });
    });
  });
}

function runCodexTurnOnce(flags) {
  if (!flags.session) throw new Error('codex-turn-once requires --session');
  if (!flags.prompt) throw new Error('codex-turn-once requires --prompt');
  const metadata = readSessionCliVersion(flags.session);
  const compatible = selectCompatibleCodex(metadata.version);
  console.log(`[codex-turn-once] session=${flags.session} version=${compatible.version} executable=${compatible.executable}`);
  const args = withCodexResumeModel(compatible.executable, [
    'exec', 'resume', '--skip-git-repo-check', flags.session, flags.prompt,
  ], metadata.model);
  const result = spawnSync(compatible.executable, args, {
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
crash-safe through .agent/agora/watchdog-state.json.

The codex-session-turn-once adapter resumes the saved turn first. After a clean
exit, Windows or macOS opens that same technical thread through the documented
codex://threads/<thread-id> route. /app is an interactive handoff only.`);
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
      petSlug: watchdogPetSlug(),
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

function adapterCanLaunch(adapter) {
  // Readiness means both policy approval and a complete command recipe. Keeping
  // this test in one place prevents the audit-suppression path from disagreeing
  // with the launcher about whether a recovered adapter can accept the wake.
  return adapter?.status === 'ready' && Boolean(adapter.command) && Array.isArray(adapter.args);
}

function launchAdapter({ adapter, target, prompt, logDir }) {
  if (!adapterCanLaunch(adapter)) {
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
  let args = adapter.args.map((arg) => expandTemplate(arg, variables));
  // Direct Codex adapters run the registry command without the version-matched
  // wrapper, so pin their saved successful model here as the final safety step.
  const directCodexResume = path.basename(command).toLowerCase().replace(/\.exe$/, '') === 'codex'
    && args[0] === 'exec' && args[1] === 'resume';
  if (directCodexResume) {
    try {
      const metadata = readSessionCliVersion(target.sessionId);
      args = withCodexResumeModel(command, args, metadata.model);
    } catch (error) {
      // Treat unreadable session compatibility data like any other launch
      // failure so the durable cursor, backoff, and WAKE-AUDIT path stay intact.
      closeSync(logFd);
      return Promise.resolve({
        ok: false,
        outcome: 'launch-error',
        error: error.message,
        command,
        args,
        logFile,
      });
    }
  }
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
  const surface = entry.surfaceOutcome ? ` surface=${entry.surfaceOutcome}` : '';
  const response = await requestJson(baseUrl, '/messages', {
    method: 'POST', token: service.token,
    body: {
      to: 'all',
      body: `WAKE-AUDIT target=${entry.target} seq=${seqs} outcome=${entry.outcome} presence=${entry.presence} process=${entry.processRunning ? 'running' : 'absent'}${surface}${detail}`,
    },
  });
  if (!response.ok) throw new Error(`audit post failed (${response.status}): ${response.text}`);
}

function monitorChildExit({ child, exitPromise, adapter, target, statePath, auditPath, baseUrl, service, initialEntry, openThread }) {
  exitPromise.then(async ({ code, signal }) => {
    const at = Date.now();
    const failed = code !== 0;
    let surface;

    // Only adapters that explicitly opt into the documented completion action
    // may move the desktop UI. The one-shot turn remains successful even when
    // surfacing fails, because the wake instruction itself has already run.
    if (!failed && adapter?.completionAction?.type === 'codex-thread-deep-link') {
      try {
        surface = await openThread(target.sessionId);
      } catch (error) {
        surface = { ok: false, outcome: 'desktop-surface-error', error: error.message };
      }
    }
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
        if (surface) targetState.surfaceOutcome = surface.outcome;
        // A clean child exit is delivery proof. The wake sequences no longer
        // need their separate audit receipt once the delivery cursor advances.
        delete targetState.auditedUndelivered;
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
      surfaceOutcome: surface?.outcome,
      surfaceError: surface?.error,
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
  const openThread = options.openThread || ((sessionId) => openCodexThread(sessionId));
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
  // Tests may provide an already-captured process list so delivery behavior can
  // be proven without depending on a slow host-wide task enumeration. Normal
  // watchdog cycles still capture the real operating-system process snapshot.
  const processList = typeof options.processList === 'string'
    ? options.processList
    : processSnapshot();
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
      // An active target does not need adapter delivery. Retire any unavailable
      // receipt whose messages are now safely behind the delivery cursor.
      delete targetState.auditedUndelivered;
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

    // Keep the delivery cursor before every pending wake, but remember which
    // exact wake sequences already produced a wake-unavailable audit. Ordinary
    // traffic after a wake must not look like a new batch, so sequence ids are
    // tracked instead of the planner's broader proposed cursor.
    const pendingWakeSeqs = plan.wakes.map((message) => Number(message.seq) || 0).filter(Boolean);
    const auditedWakeSeqs = new Set(
      Array.isArray(targetState.auditedUndelivered?.seqs)
        ? targetState.auditedUndelivered.seqs.map(Number).filter(Boolean)
        : [],
    );
    const unauditedWakeSeqs = pendingWakeSeqs.filter((seq) => !auditedWakeSeqs.has(seq));
    const adapterUnavailable = !adapterCanLaunch(adapter);

    if (!options.dryRun && adapterUnavailable && unauditedWakeSeqs.length === 0) {
      // The same unavailable batch remains intentionally undelivered. Leave it
      // retryable at the old cursor, but do not launch or post another audit
      // until either a new wake arrives or the registry marks the adapter ready.
      targetState.cursor = plan.safeCursor;
      targetState.outcome = 'wake-unavailable-audited';
      results.push({
        target: target.handle,
        outcome: 'wake-unavailable-audited',
        seqs: pendingWakeSeqs,
      });
      persistTargetState(statePath, state, target.handle);
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
      // A recovered adapter receives the complete pending batch. An unavailable
      // adapter reports only newly seen wake sequences, because earlier ones
      // already have a durable audited-undelivered receipt.
      seqs: adapterUnavailable ? unauditedWakeSeqs : pendingWakeSeqs,
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
      // A paused or unconfigured adapter cannot deliver this wake batch. Keep
      // the delivery cursor before it, while recording the audited wake ids in
      // separate durable state. Transient launch failures retain their existing
      // retry/backoff behavior because a ready adapter attempted real delivery.
      const wakeUnavailable = launch.outcome === 'wake-unavailable';
      targetState.cursor = plan.safeCursor;
      targetState.outcome = launch.outcome;
      if (!options.dryRun) {
        if (wakeUnavailable) {
          const seqs = [...new Set([...auditedWakeSeqs, ...pendingWakeSeqs])].sort((a, b) => a - b);
          targetState.auditedUndelivered = { seqs, auditedAt: now };
          targetState.failureCount = 0;
          targetState.backoffUntil = 0;
        } else {
          targetState.failureCount = (Number(targetState.failureCount) || 0) + 1;
          targetState.backoffUntil = now + failureBackoffMs(targetState.failureCount);
        }
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
          adapter,
          target,
          statePath,
          auditPath,
          baseUrl,
          service,
          initialEntry: entry,
          openThread,
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
