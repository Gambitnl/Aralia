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
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
const DEFAULT_SERVICE_LOCK = path.join(REPO, '.agent', 'agora', 'watchdog-service.lock');
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

// ============================================================================
// Single Service Guard
// ============================================================================
// Two watchdog services that read the same wake could each resume the same
// Codex chat (WF-G358). The per-target pending state guards one service, not
// two, so `run` holds an exclusive lock file for its whole lifetime. Every
// failure path refuses:
// - an unreadable lock file, or one with no valid pid, is not proof of a stale
//   holder;
// - a holder whose process is gone is NOT replaced automatically. Two services
//   that both judged the same holder stale could each remove the other's fresh
//   lock (an ABA race). The operator repairs it once, by naming that dead
//   holder's token with --reclaim-stale <token>, and the token is re-read just
//   before removal.
// Release needs the holder's unique token as well as its pid, because Windows
// can reuse a pid after the first holder exits.
// ============================================================================

export function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists under another account; it is alive.
    return error?.code === 'EPERM';
  }
}

export function acquireServiceLock(lockPath, {
  pid = process.pid,
  now = Date.now(),
  isAlive = processIsAlive,
  token = randomUUID(),
  reclaimStaleToken = '',
} = {}) {
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const record = { pid, token, startedAt: new Date(now).toISOString() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        writeFileSync(fd, `${JSON.stringify(record)}\n`, 'utf8');
      } finally {
        closeSync(fd);
      }
      return { ok: true, lockPath, ...record };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    let holder;
    try {
      holder = JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      return { ok: false, reason: 'unreadable', lockPath };
    }
    const holderPid = Number(holder?.pid);
    if (!Number.isInteger(holderPid) || holderPid <= 0) return { ok: false, reason: 'unknown-holder', lockPath, holder };
    if (isAlive(holderPid)) return { ok: false, reason: 'held', lockPath, holder };
    if (!reclaimStaleToken || holder?.token !== reclaimStaleToken) {
      return { ok: false, reason: 'stale', lockPath, holder };
    }
    // Owned repair: re-read immediately before removal, so a lock that another
    // service already replaced is never deleted under the old token.
    let current;
    try {
      current = JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      return { ok: false, reason: 'contended', lockPath };
    }
    if (current?.token !== reclaimStaleToken) return { ok: false, reason: 'contended', lockPath, holder: current };
    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    // One repair per call: if another service created a lock in the meantime,
    // the next exclusive create fails and that holder is reported.
    reclaimStaleToken = '';
  }
  return { ok: false, reason: 'contended', lockPath };
}

export function releaseServiceLock(lockPath, { pid = process.pid, token } = {}) {
  // Release only this process's own lock, never a successor's: both the pid
  // and the unique token from acquireServiceLock must match.
  if (!token) return false;
  try {
    const holder = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (Number(holder?.pid) !== pid || holder?.token !== token) return false;
    unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
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

/**
 * Seqs a native-queue target explicitly marks as read. Only an anchored header
 * counts: the body must START with "ACK", optionally after "<callsign> AWAKE;",
 * and only the seq numbers directly after it are taken ("ACK seq 8094",
 * "ACK 8094, 8095"). A quoted line, a mention later in the text, or the same
 * words from another sender never clear a wake (Codex review, Agora 8144).
 */
export function anchoredAckSeqs(body, target) {
  const names = aliasesFor(target).map(escapeRegex).join('|');
  const awake = names ? `(?:(?:${names})\\s+AWAKE\\s*[;,.:-]?\\s*)?` : '';
  const header = new RegExp(`^\\s*${awake}ACK\\s*((?:seq\\s*)?\\d+(?:\\s*(?:,|and|&)\\s*(?:seq\\s*)?\\d+)*)`, 'i')
    .exec(String(body || ''));
  if (!header) return [];
  return [...header[1].matchAll(/\d+/g)].map((match) => Number(match[0]));
}

export function planTargetMessages({ messages, target, agentsById, targetState, now, cooldownMs, nativeQueue = false }) {
  const originalCursor = Number(targetState.cursor) || 0;
  let proposedCursor = originalCursor;
  let safeCursor = originalCursor;
  // While a native queue send is in flight, the target's turn input is already
  // fixed, so a new wake cannot reach it in that turn: plan as dormant even if a
  // carried-over state says otherwise. A state copied from pre-WF-G361 code held
  // dormant=false during an inflight turn and skipped direct message 8147.
  let dormant = Boolean(targetState.dormant) || (nativeQueue && Boolean(targetState.inflight));
  let awakeSeen = false;
  let launchRequired = false;
  const wakes = [];
  const presence = agentsById.get(target.agentId)?.status || 'gone';

  for (const message of [...messages].sort((a, b) => a.seq - b.seq)) {
    if (message.seq <= originalCursor) continue;
    proposedCursor = message.seq;
    if (nativeQueue && message.from === target.agentId && wakes.length) {
      // An anchored, target-owned ACK proves the target read THOSE seqs, so only
      // they leave the pending list; every other pending wake stays.
      const acked = new Set(anchoredAckSeqs(message.body, target));
      for (let index = wakes.length - 1; index >= 0; index -= 1) {
        if (acked.has(wakes[index].seq)) wakes.splice(index, 1);
      }
      if (!wakes.length) launchRequired = false;
    }
    const lifecycle = lifecycleSignal(message, target);
    if (lifecycle === 'dormant') {
      // The target's own dormancy announcement controls lifecycle state; it is
      // never also a wake request. This matters when the announcement teaches
      // peers to use "@callsign", because that example mentions the target.
      dormant = true;
      if (!launchRequired) safeCursor = message.seq;
      continue;
    }
    if (lifecycle === 'awake' && nativeQueue) {
      // A native-queue target proves delivery with its completed queue turn, not
      // with an AWAKE line. That turn's input was fixed when it was queued, so an
      // AWAKE cannot prove the target saw a wake posted after the queue send.
      // Before WF-G361 this branch fell through to the one below and erased
      // Remy's 8094, which arrived during the inflight 8091 turn and never got
      // its own launch. Keep pending wakes and the tool-controlled dormancy.
      awakeSeen = true;
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
  return String(value).replace(/\{(sessionId|prompt|cwd|handle|callsign|script|ownerExecutable)\}/g, (_match, key) => variables[key] || '');
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
  let turnState = 'unknown';
  let lastTurnId = '';
  visitJsonLines(sessionFile, (record) => {
    const event = record?.type === 'event_msg' ? record.payload : null;
    const turnId = String(record?.payload?.turn_id || '');
    // Presence can outlive a desktop turn, and a DORMANT message is sent just
    // before the final answer. Only the saved turn's terminal event permits a
    // second process to resume this chat; an unreadable or unknown state waits.
    if (event?.type === 'task_started' || (record?.type === 'turn_context' && turnId && turnId !== lastTurnId)) {
      lastTurnId = turnId;
      turnState = 'active';
    }
    if (event && ['task_complete', 'turn_aborted'].includes(event.type) && turnId && turnId === lastTurnId) {
      turnState = 'idle';
    }
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
  return { version: String(first.payload.cli_version), model, sessionFile, turnState, lastTurnId };
}

// ============================================================================
// Native Desktop Queue Delivery (WF-G358)
// ============================================================================
// The Codex desktop app owns its chats through a private app-server child. A
// second executor (`codex exec resume`) is refused as a second writer, so the
// native path is `codex queue`: it only adds a queue item, and the app's own
// owner runs the turn when the chat is idle. These helpers find that owner and
// read the saved transcript for the proof that the owner ran a queued turn.
// ============================================================================

/**
 * Pick the one Codex desktop app-server owner from a process list.
 * Each entry: { pid, parent, name, cmd, exe }. A daemon, a proxy or an
 * app-server whose parent is not the desktop app is never an owner. Zero or
 * several owners is not a guess: the caller must treat it as unavailable.
 */
export function pickCodexAppOwner(processes) {
  const byPid = new Map(processes.map((p) => [Number(p.pid), p]));
  const isDesktop = (p) => Boolean(p) && (/^chatgpt(\.exe)?$/i.test(String(p.name || ''))
    || /OpenAI\.Codex/i.test(String(p.exe || '')));
  const owners = processes.filter((p) => /^codex(\.exe)?$/i.test(String(p.name || ''))
    && /\sapp-server(\s|$)/.test(` ${p.cmd || ''} `)
    && !/\bapp-server\s+(daemon|proxy|generate-ts|generate-json-schema)\b/.test(String(p.cmd || ''))
    && isDesktop(byPid.get(Number(p.parent))));
  if (owners.length !== 1) {
    return { ok: false, reason: owners.length ? `ambiguous: ${owners.length} desktop app-server owners` : 'no desktop app-server owner' };
  }
  const owner = owners[0];
  if (!owner.exe) return { ok: false, reason: 'desktop app-server owner has no executable path' };
  return { ok: true, ownerPid: Number(owner.pid), ownerAppPid: Number(owner.parent), ownerExecutable: String(owner.exe) };
}

function listCodexProcesses() {
  // Windows only: the desktop app ships there today. Other platforms report no
  // owner, which keeps the adapter truthfully unavailable instead of guessing.
  if (process.platform !== 'win32') return [];
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command',
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'codex|ChatGPT' } | " +
    'Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath | ConvertTo-Json -Compress'],
  { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  const parsed = JSON.parse(result.stdout || 'null');
  return (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).map((p) => ({
    pid: p.ProcessId, parent: p.ParentProcessId, name: p.Name, cmd: p.CommandLine || '', exe: p.ExecutablePath || '',
  }));
}

export function resolveCodexAppOwner({ listProcesses = listCodexProcesses } = {}) {
  try {
    return pickCodexAppOwner(listProcesses());
  } catch (error) {
    return { ok: false, reason: `process inventory failed: ${error.message}` };
  }
}

function messageText(payload) {
  // A user message carries content parts; keep every text field so markers in
  // any part are found, and fall back to the raw JSON for unknown shapes.
  if (Array.isArray(payload?.content)) {
    return payload.content.map((part) => String(part?.text ?? part?.input_text ?? '')).join('\n');
  }
  return JSON.stringify(payload?.content ?? '');
}

/**
 * Find the first queue-triggered turn after a completed baseline turn.
 * Only task_started.payload.turn_attribution.turn_trigger === 'queue' counts;
 * a human 'composer' turn never proves delivery. Returns the turn, whether it
 * completed, and whether its user input carries every expected marker.
 */
export function findQueuedTurn(sessionId, { baselineTurnId, markers = [], codexHome } = {}) {
  const home = codexHome || process.env.CODEX_HOME || path.join(process.env.USERPROFILE || '', '.codex');
  const sessionFile = findFileBySuffix(path.join(home, 'sessions'), `${sessionId}.jsonl`);
  if (!sessionFile) return { found: false, reason: 'session file not found' };
  let afterBaseline = false;
  let current = '';
  const turns = new Map();
  visitJsonLines(sessionFile, (record) => {
    const payload = record?.payload || {};
    const event = record?.type === 'event_msg' ? payload.type : '';
    const turnId = String(payload.turn_id || '');
    if (!afterBaseline) {
      if (['task_complete', 'turn_aborted'].includes(event) && turnId === baselineTurnId) afterBaseline = true;
      return;
    }
    if (event === 'task_started' && turnId) {
      current = turnId;
      turns.set(turnId, {
        turnId, trigger: String(payload.turn_attribution?.turn_trigger || ''),
        startedAt: record.timestamp || '', input: '', completed: false, aborted: false, completedAt: '',
      });
      return;
    }
    if (record?.type === 'response_item' && payload.type === 'message' && payload.role === 'user' && turns.has(current)) {
      turns.get(current).input += `${messageText(payload)}\n`;
      return;
    }
    if (['task_complete', 'turn_aborted'].includes(event) && turns.has(turnId)) {
      const turn = turns.get(turnId);
      turn.completed = event === 'task_complete';
      turn.aborted = event === 'turn_aborted';
      turn.completedAt = record.timestamp || '';
    }
  });
  if (!afterBaseline) return { found: false, reason: 'baseline turn has no completion record' };
  const queued = [...turns.values()].find((turn) => turn.trigger === 'queue');
  if (!queued) return { found: false, reason: 'no queue-triggered turn after the baseline' };
  const { input, ...rest } = queued;
  return { found: true, ...rest, markersMatched: markers.length > 0 && markers.every((marker) => input.includes(marker)) };
}

export function queueMarkers(messages) {
  // The same peer line that buildWakePrompt writes, so the queued turn's input
  // proves which exact requests it carries.
  return messages.map((message) => `[seq ${message.seq} from ${message.from}]`);
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
  node tools/agora/watchdog.mjs run [--once] [--dry-run] [--interval 5000] [--handles <comma,list>] [--for <minutes>]

Register or update a machine-local target:
  node tools/agora/watchdog.mjs register-target --handle <handle> --agent <agent-id> \\
    --callsign <name> --adapter <wake-adapter> --session <session-id> --cwd <path> \\
    [--alias <comma,list>] [--grace <milliseconds>]

Use --grace 120000 or more when the target has a live native watcher. The
native watcher gets that time to post CALLSIGN AWAKE before CLI fallback.

First registration bootstraps the target cursor to the latest Agora message.
It does not replay historical wake requests. Later delivery is per-target and
crash-safe through .agent/agora/watchdog-state.json.

Use --handles to qualify selected targets without waking old registered chats.
Use --for to bound the service lifetime; an already launched child may finish.
Only one live service runs at a time: it holds .agent/agora/watchdog-service.lock
(override with --service-lock <path>). --dry-run takes no lock. A lock whose
process is gone is never replaced automatically: rerun with
--reclaim-stale <token> using the token that the refusal prints.

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

function launchAdapter({ adapter, target, prompt, logDir, owner }) {
  if (!adapterCanLaunch(adapter)) {
    return Promise.resolve({ ok: false, outcome: 'wake-unavailable', error: 'adapter is not ready' });
  }
  // A native-queue adapter runs the running owner's own executable. Without a
  // resolved owner there is nothing to deliver to, which is unavailable, not a
  // retryable launch failure.
  if (adapter.ownerResolver && !owner?.ok) {
    return Promise.resolve({ ok: false, outcome: 'wake-unavailable', error: owner?.reason || 'no app owner resolved' });
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
    ownerExecutable: owner?.ownerExecutable,
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
    if (adapter?.deliveryMode === 'native-queue') {
      // A queue client's exit is enqueue only, never delivery. Exit 0 with the
      // client's "Queued message <id>" line is 'queued'. Anything else is
      // 'queue-indeterminate': the item may or may not be stored, so it is never
      // requeued automatically (the inflight record blocks a new launch).
      let logText = '';
      try { logText = readFileSync(initialEntry.logFile, 'utf8'); } catch { /* unreadable log is indeterminate */ }
      const queuedMessageId = /Queued message\s+(\S+)\s+for thread/.exec(logText)?.[1] || '';
      const queued = code === 0 && Boolean(queuedMessageId);
      const inflight = targetState.inflight;
      if (inflight?.launchId === initialEntry.launchId) {
        inflight.queuedAt = new Date(at).toISOString();
        inflight.queueOutcome = queued ? 'queued' : 'queue-indeterminate';
        if (queuedMessageId) inflight.queuedMessageId = queuedMessageId;
        targetState.outcome = inflight.queueOutcome;
        freshState.targets[target.handle] = targetState;
        writeJsonAtomic(statePath, freshState);
      }
      const queueEntry = {
        ...initialEntry,
        at: new Date(at).toISOString(),
        outcome: queued ? 'queued' : 'queue-indeterminate',
        exitCode: code,
        signal: signal || undefined,
        queuedMessageId: queuedMessageId || undefined,
        error: queued ? undefined : (logTail(initialEntry.logFile) || `queue client exited with code ${code}`),
      };
      appendAudit(auditPath, queueEntry);
      try {
        await postAudit(baseUrl, service, queueEntry);
      } catch (error) {
        appendAudit(auditPath, { at: new Date().toISOString(), target: target.handle, outcome: 'audit-post-error', error: error.message });
      }
      return;
    }
    // A one-shot adapter's child ends its harness turn when it exits. After a
    // clean exit nobody is left to answer the next peer message, so the target
    // is dormant again by tool behavior, not by a DORMANT line the model may
    // forget (WF-G358). A persistent native harness keeps dormant=false.
    const oneShot = adapter?.capabilities?.stop === 'child-process-exits-after-one-turn';
    // Correlate by this exact launch. An AWAKE reply may already have deleted
    // pending, and a newer launch must never be overridden by an older exit.
    const launchId = initialEntry.launchId;
    const matchesPending = pending && (pending.launchId ? pending.launchId === launchId : pending.pid === child.pid);
    const isLatestLaunch = !targetState.lastLaunchId || targetState.lastLaunchId === launchId;
    if (matchesPending) {
      if (failed) {
        targetState.cursor = Number(pending.safeCursor) || Number(targetState.cursor) || 0;
        targetState.failureCount = (Number(targetState.failureCount) || 0) + 1;
        targetState.backoffUntil = at + failureBackoffMs(targetState.failureCount);
        targetState.outcome = 'child-failed';
      } else {
        targetState.cursor = Math.max(Number(targetState.cursor) || 0, Number(pending.cursor) || 0);
        targetState.failureCount = 0;
        targetState.backoffUntil = 0;
        targetState.dormant = oneShot;
        targetState.outcome = 'child-completed';
        if (surface) targetState.surfaceOutcome = surface.outcome;
        // A clean child exit is delivery proof. The wake sequences no longer
        // need their separate audit receipt once the delivery cursor advances.
        delete targetState.auditedUndelivered;
      }
      delete targetState.pending;
      freshState.targets[target.handle] = targetState;
      writeJsonAtomic(statePath, freshState);
    } else if (!failed && oneShot && isLatestLaunch && !pending) {
      // AWAKE already delivered and cleared this launch's pending record. Only
      // re-arm dormancy; the cursor and failure state were settled by AWAKE.
      targetState.dormant = true;
      targetState.outcome = 'child-completed';
      if (surface) targetState.surfaceOutcome = surface.outcome;
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
  // One shared service may qualify a selected set without touching another
  // chat's target, pending work, or cursor. Unknown names fail before any write.
  const requestedHandles = options.handles || [];
  const selectedTargets = requestedHandles.length
    ? targetsConfig.targets.filter((target) => requestedHandles.includes(target.handle))
    : targetsConfig.targets;
  const unknownHandles = requestedHandles.filter((handle) => !selectedTargets.some((target) => target.handle === handle));
  if (unknownHandles.length) throw new Error(`Unknown wake target(s): ${unknownHandles.join(', ')}`);
  const state = readJson(statePath, { version: 1, targets: {} });
  const service = options.dryRun ? state.service : await ensureServiceIdentity(baseUrl, state);
  // Persist the audit token immediately. A later fetch failure must not leave a
  // live service identity whose credential only existed in process memory.
  if (!options.dryRun) writeJsonAtomic(statePath, state);
  const agentsResponse = await requestJson(baseUrl, '/agents');
  if (!agentsResponse.ok) throw new Error(`GET /agents failed (${agentsResponse.status})`);
  const agents = agentsResponse.json.agents || [];
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const existingCursors = selectedTargets
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

  for (const target of selectedTargets) {
    const adapter = registry.wakeAdapters?.[target.adapter];
    if (!state.targets[target.handle]) {
      state.targets[target.handle] = { cursor: latestSeq, dormant: false, lastLaunchAt: 0, outcome: 'bootstrapped' };
      results.push({ target: target.handle, outcome: 'bootstrapped', cursor: latestSeq });
      if (!options.dryRun) persistTargetState(statePath, state, target.handle);
      continue;
    }
    const targetState = state.targets[target.handle];
    const nativeQueue = adapter?.deliveryMode === 'native-queue';
    const inflight = nativeQueue ? targetState.inflight : null;
    if (inflight && !options.dryRun) {
      // Delivery proof for a native queue send is the app owner's own turn: the
      // first queue-triggered turn after the send baseline, carrying the exact
      // peer markers, with task_complete. Only then is the target dormant
      // again, so the next peer wake can queue (tool behavior, not a DORMANT
      // line the model may forget).
      const turn = findQueuedTurn(target.sessionId, {
        baselineTurnId: inflight.baselineTurnId, markers: inflight.markers || [], codexHome: options.codexHome,
      });
      if (turn.found && turn.completed && turn.markersMatched) {
        // Re-observe the live owner instead of copying the send-time fields:
        // a missing or different owner makes the result inconclusive, so the
        // record is held and nothing re-arms (Codex review, Agora 7909).
        const liveOwner = (options.resolveOwner || resolveCodexAppOwner)();
        const sameOwner = liveOwner.ok && liveOwner.ownerPid === inflight.ownerPid
          && liveOwner.ownerAppPid === inflight.ownerAppPid
          && liveOwner.ownerExecutable === inflight.ownerExecutable;
        const done = {
          // A fresh clock, read AFTER the transcript showed task_complete and the
          // owner was re-observed. The cycle-start `now` can predate a turn that
          // completed during this cycle; Q3 clean pair 3 recorded the C2
          // completion 472 ms before its own turnCompletedAt (Codex, Agora 8102).
          at: new Date().toISOString(),
          target: target.handle,
          agentId: target.agentId,
          sessionId: target.sessionId,
          seqs: inflight.seqs,
          outcome: sameOwner ? 'app-turn-completed' : 'queue-owner-changed',
          deliveryMode: 'native-queue',
          launchId: inflight.launchId,
          pid: inflight.pid,
          ownerPid: inflight.ownerPid,
          ownerAppPid: inflight.ownerAppPid,
          ownerExecutable: inflight.ownerExecutable,
          liveOwnerPid: liveOwner.ownerPid,
          liveOwnerAppPid: liveOwner.ownerAppPid,
          liveOwnerExecutable: liveOwner.ownerExecutable,
          liveOwnerError: liveOwner.ok ? undefined : liveOwner.reason,
          baselineTurnId: inflight.baselineTurnId,
          queuedMessageId: inflight.queuedMessageId,
          turnId: turn.turnId,
          turnTrigger: turn.trigger,
          turnStartedAt: turn.startedAt,
          turnCompletedAt: turn.completedAt,
        };
        results.push(done);
        if (!sameOwner) {
          // Hold for review: keep inflight so no second copy is queued, and do
          // not re-arm dormancy on an owner we cannot match.
          if (targetState.outcome !== 'queue-owner-changed') {
            targetState.outcome = 'queue-owner-changed';
            persistTargetState(statePath, state, target.handle);
            appendAudit(auditPath, done);
            try { await postAudit(baseUrl, service, done); } catch { /* local audit already written */ }
          }
          continue;
        }
        targetState.cursor = Math.max(Number(targetState.cursor) || 0, Number(inflight.cursor) || 0);
        targetState.dormant = true;
        targetState.outcome = 'app-turn-completed';
        targetState.failureCount = 0;
        targetState.backoffUntil = 0;
        targetState.lastCompletedTurnId = turn.turnId;
        delete targetState.pending;
        delete targetState.inflight;
        delete targetState.auditedUndelivered;
        persistTargetState(statePath, state, target.handle);
        appendAudit(auditPath, done);
        try {
          await postAudit(baseUrl, service, done);
        } catch (error) {
          appendAudit(auditPath, { at: new Date().toISOString(), target: target.handle, outcome: 'audit-post-error', error: error.message });
        }
        continue;
      }
    }
    const plan = planTargetMessages({ messages, target, agentsById, targetState, now, cooldownMs, nativeQueue });
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

    if (inflight) {
      // An unresolved native queue send may already be stored. Never queue a
      // second copy, even after the pending window expires: wait for the app
      // owner's queue-triggered turn, or for an operator to clear the record.
      targetState.cursor = plan.safeCursor;
      targetState.outcome = targetState.outcome === 'queue-owner-changed' ? 'queue-owner-changed' : 'queue-inflight';
      results.push({ target: target.handle, outcome: targetState.outcome, seqs: plan.wakes.map((m) => m.seq),
        launchId: inflight.launchId, queueOutcome: inflight.queueOutcome });
      if (!options.dryRun) persistTargetState(statePath, state, target.handle);
      continue;
    }

    const directCodexResume = path.basename(String(adapter?.command || '')).toLowerCase().replace(/\.exe$/, '') === 'codex'
      && adapter.args?.[0] === 'exec' && adapter.args?.[1] === 'resume';
    let baselineTurnId = '';
    if (adapterCanLaunch(adapter)
      && (target.adapter === 'codex-session-turn-once' || directCodexResume || adapter.requiresIdleTranscript)) {
      let turnState = 'unknown';
      try {
        const sessionInfo = readSessionCliVersion(target.sessionId, options.codexHome);
        turnState = sessionInfo.turnState;
        baselineTurnId = sessionInfo.lastTurnId;
      } catch {
        // A partial transcript write or unavailable session is not idle proof.
      }
      if (turnState !== 'idle') {
        targetState.cursor = plan.safeCursor;
        targetState.outcome = turnState === 'active' ? 'active-turn' : 'session-state-unavailable';
        results.push({ target: target.handle, outcome: targetState.outcome, seqs: plan.wakes.map((message) => message.seq) });
        if (!options.dryRun) persistTargetState(statePath, state, target.handle);
        continue;
      }
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
    // Resolve the native owner only for an adapter that needs one, right before
    // the send, so the queue client matches the owner's current build.
    const owner = adapter?.ownerResolver === 'codex-desktop-app-server' && !adapterUnavailable
      ? (options.resolveOwner || resolveCodexAppOwner)()
      : undefined;
    const launch = options.dryRun
      ? { ok: true, outcome: 'dry-run', command: adapter?.command, args: adapter?.args }
      : await launchAdapter({ adapter: adapter || {}, target, prompt, logDir, owner });
    const entry = {
      at: new Date(now).toISOString(),
      target: target.handle,
      agentId: target.agentId,
      // The exact chat, so a verifier can correlate this launch with one saved
      // session instead of a handle that may point at another chat later.
      sessionId: target.sessionId,
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
      // Unique per launch, so a child's exit is matched to this exact launch
      // even after AWAKE deletes pending, and never to a newer launch.
      launchId: launch.ok && !options.dryRun ? randomUUID() : undefined,
    };
    if (nativeQueue) {
      entry.deliveryMode = 'native-queue';
      entry.baselineTurnId = baselineTurnId || undefined;
      entry.ownerPid = owner?.ownerPid;
      entry.ownerAppPid = owner?.ownerAppPid;
      entry.ownerExecutable = owner?.ownerExecutable;
      if (owner && !owner.ok) entry.ownerError = owner.reason;
    }
    results.push(entry);
    if (launch.ok && !options.dryRun) {
      // Spawning is not delivery. Hold the cursor before the wake until either
      // the target posts AWAKE or the child exits successfully.
      targetState.cursor = plan.safeCursor;
      targetState.lastLaunchAt = now;
      targetState.lastLaunchId = entry.launchId;
      targetState.outcome = launch.outcome;
      targetState.pending = {
        pid: launch.pid,
        launchId: entry.launchId,
        cursor: plan.cursor,
        safeCursor: plan.safeCursor,
        startedAt: now,
        seqs: entry.seqs,
      };
      if (nativeQueue) {
        // Kept until the owner's queue-triggered turn completes. An AWAKE reply
        // deletes pending, so this separate record preserves the baseline,
        // markers and owner identity for the completion check and the audit.
        targetState.inflight = {
          ...targetState.pending,
          deliveryMode: 'native-queue',
          baselineTurnId,
          markers: queueMarkers(plan.wakes),
          ownerPid: owner?.ownerPid,
          ownerAppPid: owner?.ownerAppPid,
          ownerExecutable: owner?.ownerExecutable,
        };
      }
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
    handles: flags.handles ? String(flags.handles).split(',').map((handle) => handle.trim()).filter(Boolean) : [],
    dryRun: flags.dryRun,
  };
  const durationMs = flags.for == null ? Infinity : Number(flags.for) * 60_000;
  if (!(durationMs > 0)) throw new Error('--for requires a positive number of minutes');
  const deadline = Date.now() + durationMs;
  const intervalMs = Math.max(1_000, Number(flags.interval) || 5_000);
  // A dry run launches nothing, so only a live service takes the guard.
  const serviceLock = flags.dryRun ? null : (flags['service-lock'] ? path.resolve(flags['service-lock']) : DEFAULT_SERVICE_LOCK);
  if (serviceLock) {
    const lock = acquireServiceLock(serviceLock, { reclaimStaleToken: flags['reclaim-stale'] || '' });
    if (!lock.ok) {
      const holder = lock.holder ? ` (pid ${lock.holder.pid}, token ${lock.holder.token}, started ${lock.holder.startedAt})` : '';
      const repair = lock.reason === 'stale'
        ? `\n  The holder process is gone. If no other watchdog runs, rerun with --reclaim-stale ${lock.holder?.token}`
        : '';
      throw new Error(`watchdog service lock ${lock.lockPath} refused: ${lock.reason}${holder}${repair}`);
    }
    const owner = { pid: lock.pid, token: lock.token };
    process.once('exit', () => releaseServiceLock(serviceLock, owner));
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        releaseServiceLock(serviceLock, owner);
        process.exit(130);
      });
    }
  }
  do {
    try {
      const results = await runCycle(options);
      for (const result of results) console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`[watchdog] ${error.stack || error.message}`);
    }
    if (flags.once || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
  } while (true);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
