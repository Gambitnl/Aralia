#!/usr/bin/env node

/**
 * wakeQualification.mjs — Read-only verification of Agora automated wake proof.
 *
 * This verifier inspects existing on-disk records and the live Agora message
 * journal to prove that an orchestrator (such as Codex) resumed its turn
 * automatically via the watchdog without human intervention.
 *
 * Requirements (ratified co-review with Codex and Claude):
 * 1. findSessionFile uses imported readdirSync (ESM safe).
 * 2. streamJsonLines fails closed on malformed complete records.
 * 3. Validates session_meta.id matches requested sessionId.
 * 4. Parses real transcript inputs: validates watchdog prompt header and peer seq/nonce;
 *    rejects interactive human prompt injections.
 * 5. Coalesces transcript records by turn_id; asserts baseline turn completed
 *    before first request; asserts exactly one clean resumed turn per wake request.
 * 6. Verifies exactly two configured rounds with exact target agentId, explicit
 *    peerAgentId, nonces, request references, and proper chronological ordering.
 * 7. Strict watchdog audit log validation: missing audit fails; outcome === 'launched'
 *    only; exactly one launch per wake request; zero duplicate launches; session/target/pid correlation.
 *
 * Verification only reads its evidence. The CLI can write one requested receipt;
 * it never changes coordination state, launches a model, or acquires a lock.
 */

import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DEFAULT_URL = process.env.AGORA_URL || 'http://127.0.0.1:4319';
const DEFAULT_AUDIT = path.join(REPO, '.agent', 'agora', 'watchdog-audit.jsonl');

/**
 * Convert an ISO string or numeric timestamp to epoch milliseconds.
 */
export function toEpochMs(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') {
    if (ts < 1e11) return ts * 1000;
    return ts;
  }
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Incrementally stream a JSONL file, failing closed on unparseable lines.
 * Only tolerates an empty trailing line.
 */
export function streamJsonLines(file, visitor) {
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  const fd = openSync(file, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    const decoder = new StringDecoder('utf8');
    let pending = '';
    let offset = 0;
    let lineNumber = 0;

    while (true) {
      const bytesRead = readSync(fd, chunk, 0, chunk.length, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
      pending += decoder.write(chunk.subarray(0, bytesRead));

      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        lineNumber++;
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) {
          try {
            visitor(JSON.parse(line), lineNumber);
          } catch (err) {
            throw new Error(`Malformed JSON at ${file}:${lineNumber}: ${err.message}`);
          }
        }
        newline = pending.indexOf('\n');
      }
    }

    pending += decoder.end();
    const finalLine = pending.trim();
    if (finalLine) {
      lineNumber++;
      try {
        visitor(JSON.parse(finalLine), lineNumber);
      } catch (err) {
        throw new Error(`Malformed JSON at ${file}:${lineNumber}: ${err.message}`);
      }
    }
  } finally {
    closeSync(fd);
  }
}

/**
 * Locate Codex session JSONL file by UUID suffix in a directory tree.
 */
export function findSessionFile(sessionId, codexHome) {
  if (!sessionId) return '';
  const root = path.join(codexHome, 'sessions');
  if (!existsSync(root)) return '';
  const queue = [root];
  while (queue.length) {
    const dir = queue.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(`${sessionId}.jsonl`)) {
        return fullPath;
      }
    }
  }
  return '';
}

/**
 * Extract turn input text from Codex transcript event records.
 */
function extractTurnInputText(record) {
  const type = record?.type;
  const payload = record?.payload;
  // User messages in Codex transcript
  if (type === 'event_msg' && payload?.type === 'user_message') {
    return String(payload.message || payload.text || '');
  }
  if (type === 'response_item' && payload?.role === 'user') {
    if (typeof payload.content === 'string') return payload.content;
    if (Array.isArray(payload.content)) {
      return payload.content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join(' ');
    }
    return '';
  }
  if (type === 'user_message') {
    return String(payload?.message || payload?.text || '');
  }
  return '';
}

/**
 * Fetch Agora messages since a given sequence ID.
 */
async function fetchAgoraMessages(baseUrl, since = 0) {
  const url = `${baseUrl}/messages?since=${since}&channel=all`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GET /messages returned HTTP ${res.status}`);
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    throw new Error(`Failed to fetch Agora messages from ${baseUrl}: ${err.message}`);
  }
}

/**
 * Core verification function for wake qualification.
 */
export async function verifyWakeQualification(options = {}) {
  const { sessionId, handle, agentId, baselineTurnId, wakes = [],
    codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || '', '.codex'),
    sessionFilePath, auditPath = DEFAULT_AUDIT, baseUrl = DEFAULT_URL,
    messages: suppliedMessages, auditRecords: suppliedAudit } = options;
  for (const [key, value] of Object.entries({ sessionId, handle, agentId, baselineTurnId })) {
    if (!value) throw new Error(`${key} is required for wake qualification`);
  }
  if (!Array.isArray(wakes) || wakes.length !== 2) throw new Error('wakes must contain exactly 2 rounds');
  const checks = [];
  const errors = [];
  const rounds = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass: Boolean(pass), detail });
    if (!pass) errors.push(`${name}: ${detail}`);
    return Boolean(pass);
  };
  const result = () => ({ ok: errors.length === 0,
    summary: errors.length ? `Wake qualification failed with ${errors.length} error(s)`
      : `Wake qualification verified: 2 completed peer-driven rounds in thread ${sessionId}`,
    deliveryMode: options.deliveryMode || 'cli-resume', checks, errors, rounds });
  const nativeQueue = options.deliveryMode === 'native-queue';
  check('delivery-mode', options.deliveryMode === undefined || nativeQueue,
    'Only the default CLI mode or explicit native-queue mode is supported');
  if (nativeQueue) {
    check('native-owner-binding', Number.isInteger(options.expectedOwnerPid) && options.expectedOwnerPid > 0
      && Number.isInteger(options.expectedAppPid) && options.expectedAppPid > 0
      && typeof options.expectedOwnerExecutable === 'string' && options.expectedOwnerExecutable.length > 0
      && typeof options.callsign === 'string' && options.callsign.length > 0,
    'Native proof must bind the existing desktop app, owner PID, executable and callsign');
  }
  const time = (value) => typeof value === 'number' ? value : Date.parse(value);
  const validTime = (value) => Number.isFinite(value) && value > 0;
  for (const [i, wake] of wakes.entries()) {
    check(`round-${i + 1}-inputs`, Number.isSafeInteger(wake.requestSeq) && wake.requestSeq > 0
      && Number.isSafeInteger(wake.ackSeq) && wake.ackSeq > wake.requestSeq
      && typeof wake.peerAgentId === 'string' && wake.peerAgentId !== agentId && wake.peerAgentId.length > 0
      && typeof wake.requestNonce === 'string' && wake.requestNonce.length > 0
      && typeof wake.ackNonce === 'string' && wake.ackNonce.length > 0,
    'Require exact peer identity, request/ACK sequence and nonempty nonces');
  }
  check('distinct-rounds', wakes[0].requestSeq !== wakes[1].requestSeq
    && wakes[0].ackSeq < wakes[1].requestSeq && wakes[0].requestNonce !== wakes[1].requestNonce,
  'Two distinct peer requests must be in sequence');
  if (errors.length) return result();

  const transcriptPath = sessionFilePath || findSessionFile(sessionId, codexHome);
  const turns = new Map();
  let currentId = '';
  let meta;
  // Real transcripts emit task_started before turn_context. Build the turn on
  // either event and always prefer an explicit turn id over the current turn.
  const turnFor = (id) => {
    if (!turns.has(id)) turns.set(id, { id, inputs: [], startedAt: NaN, completedAt: NaN, aborted: false });
    return turns.get(id);
  };
  try {
    streamJsonLines(transcriptPath, (record) => {
      const payload = record.payload || {};
      if (record.type === 'session_meta') {
        if (meta) throw new Error('Duplicate session metadata');
        meta = payload;
        return;
      }
      const event = record.type === 'event_msg' ? payload.type : '';
      const id = typeof payload.turn_id === 'string' ? payload.turn_id : '';
      if (id && (event === 'task_started' || record.type === 'turn_context')) {
        currentId = id;
        const turn = turnFor(id);
        if (event === 'task_started') {
          turn.startedAt = time(record.timestamp);
          // The app records the source of a turn. Matching prompt text alone
          // cannot distinguish a queued wake from a manually pasted restart.
          turn.trigger = payload.turn_attribution?.turn_trigger;
        }
        if (record.type === 'turn_context') turn.model = payload.model;
      }
      const turn = turns.get(id || currentId);
      if (!turn) return;
      if (event === 'task_complete') turn.completedAt = time(record.timestamp);
      if (event === 'turn_aborted') turn.aborted = true;
      const text = extractTurnInputText(record);
      if (text) turn.inputs.push(text);
    });
  } catch (error) {
    check('transcript-parse-clean', false, error.message);
    return result();
  }
  check('session-id-validation', meta?.id === sessionId, 'Transcript session_meta.id must match the exact requested chat');
  if (options.expectedVersion) check('saved-version', meta?.cli_version === options.expectedVersion, 'Saved engine version must stay unchanged');
  const baseline = turns.get(baselineTurnId);
  check('baseline-turn-idle', baseline && validTime(baseline.completedAt) && !baseline.aborted,
    'Original turn must have a matching clean completion timestamp');
  if (errors.length) return result();

  let messages;
  let audit;
  try {
    messages = suppliedMessages ?? await fetchAgoraMessages(baseUrl, wakes[0].requestSeq - 1);
    audit = suppliedAudit;
    if (!audit) {
      audit = [];
      streamJsonLines(auditPath, (entry) => audit.push(entry));
    }
  } catch (error) {
    check('proof-records-readable', false, error.message);
    return result();
  }
  const bySeq = new Map(messages.map((message) => [Number(message.seq), message]));
  const orderedTurns = [...turns.values()];
  const afterBaseline = orderedTurns.slice(orderedTurns.findIndex((turn) => turn.id === baselineTurnId) + 1);
  let previousCompletion = baseline.completedAt;
  let previousTurnId = baselineTurnId;
  const measuredLaunches = [];
  let proofEnd = baseline.completedAt;
  for (const [i, wake] of wakes.entries()) {
    const label = `round-${i + 1}`;
    const beforeErrors = errors.length;
    const request = bySeq.get(wake.requestSeq);
    const ack = bySeq.get(wake.ackSeq);
    const requestAt = time(request?.createdAt);
    const ackAt = time(ack?.createdAt);
    check(`${label}-peer-request`, request?.from === wake.peerAgentId
      && String(request?.body || '').includes(wake.requestNonce), 'Request must come from the named peer and contain its nonce');
    check(`${label}-target-ack`, ack?.from === agentId && String(ack?.body || '').includes(wake.ackNonce)
      && new RegExp(`(?:^|[^0-9])${wake.requestSeq}(?:[^0-9]|$)`).test(String(ack?.body || '')),
    'ACK must come from the exact target UUID and cite the request and ACK nonce');
    if (nativeQueue) check(`${label}-native-awake-ack`, wake.requestNonce === wake.ackNonce
      && String(ack?.body || '').toUpperCase().includes(`${options.callsign.toUpperCase()} AWAKE`),
    'The target must acknowledge the cycle nonce and its actual AWAKE lifecycle');
    const turn = afterBaseline[i];
    check(`${label}-completed-turn`, turn && validTime(turn.startedAt) && validTime(turn.completedAt)
      && !turn.aborted && turn.completedAt >= turn.startedAt, 'A distinct resumed turn must start and finish cleanly');
    if (!turn) continue;
    const header = options.callsign ? `Agora wake for ${options.callsign} (${handle}).` : null;
    const validPrompt = (text) => {
      const line = text.split(/\r?\n/)[0];
      return (header ? line === header : line.startsWith('Agora wake for ') && line.endsWith(` (${handle}).`))
        && text.includes(`[seq ${wake.requestSeq} from ${wake.peerAgentId}]`) && text.includes(wake.requestNonce);
    };
    check(`${label}-watchdog-input`, turn.inputs.length > 0 && turn.inputs.every(validPrompt),
      'Every resumed-turn input must be the exact watchdog header and peer request, with no human restart');
    if (options.expectedModel) check(`${label}-saved-model`, turn.model === options.expectedModel, 'Resume must preserve the saved model');
    if (nativeQueue) check(`${label}-native-queue-trigger`, turn.trigger === 'queue',
      'The app must attribute this turn to its queue, not a composer or other executor');
    check(`${label}-time-order`, validTime(requestAt) && validTime(ackAt)
      && previousCompletion < requestAt && requestAt <= turn.startedAt
      && turn.startedAt <= ackAt && ackAt <= turn.completedAt,
    'Previous completion < peer request <= new turn start <= ACK <= new turn completion');

    const launches = audit.filter((entry) => entry.outcome === 'launched' && entry.target === handle
      && Array.isArray(entry.seqs) && entry.seqs.includes(wake.requestSeq));
    check(`${label}-one-launch`, launches.length === 1, `Expected exactly one launch for request ${wake.requestSeq}; found ${launches.length}`);
    const launch = launches[0];
    if (launch) {
      const launchAt = time(launch.at);
      check(`${label}-launch-identity`, launch.sessionId === sessionId && launch.agentId === agentId
        && Number.isInteger(launch.pid) && launch.pid > 0, 'Launch must name this session, target UUID and child PID');
      check(`${label}-launch-order`, validTime(launchAt) && requestAt <= launchAt && launchAt <= turn.startedAt,
        'Launch must follow the peer request and precede the resumed turn');
      if (nativeQueue) {
        // A queue client exits before the app finishes its turn. Keep enqueue
        // receipt, real app completion and original owner identity separate.
        const sameOwner = (entry) => entry.deliveryMode === 'native-queue'
          && entry.ownerPid === options.expectedOwnerPid && entry.ownerAppPid === options.expectedAppPid
          && entry.ownerExecutable === options.expectedOwnerExecutable;
        check(`${label}-native-launch-owner`, sameOwner(launch)
          && launch.baselineTurnId === previousTurnId && typeof launch.launchId === 'string' && launch.launchId.length > 0,
        'Launch must bind the unchanged existing owner and previous completed turn');
        const matches = (entry) => entry.target === handle && entry.sessionId === sessionId
          && entry.agentId === agentId && entry.pid === launch.pid && entry.launchId === launch.launchId
          && Array.isArray(entry.seqs) && entry.seqs.length === 1 && entry.seqs[0] === wake.requestSeq;
        check(`${label}-native-single-request`, launch.seqs.length === 1 && launch.seqs[0] === wake.requestSeq,
          'Each measured native enqueue must carry exactly its configured peer request');
        const queued = audit.filter((entry) => entry.outcome === 'queued' && matches(entry));
        check(`${label}-native-enqueued`, queued.length === 1 && queued[0].exitCode === 0
          && typeof queued[0].queuedMessageId === 'string' && queued[0].queuedMessageId.length > 0
          && sameOwner(queued[0]) && validTime(time(queued[0].at)) && time(queued[0].at) >= launchAt,
        'Require one successful queue receipt from this launch; it is not delivery proof');
        const completed = audit.filter((entry) => entry.outcome === 'app-turn-completed' && matches(entry));
        check(`${label}-native-app-completion`, completed.length === 1 && sameOwner(completed[0])
          && completed[0].turnId === turn.id && completed[0].turnTrigger === 'queue'
          && validTime(time(completed[0].at)) && time(completed[0].at) >= turn.completedAt
          && time(completed[0].at) >= time(queued[0]?.at),
        'Require real matching app task completion after enqueue, under the original owner');
        const completionAt = time(completed[0]?.at);
        previousCompletion = validTime(completionAt) ? completionAt : turn.completedAt;
      } else {
        const completions = audit.filter((entry) => entry.outcome === 'child-completed' && entry.target === handle
          && entry.sessionId === sessionId && entry.agentId === agentId && entry.pid === launch.pid
          && (!launch.launchId || entry.launchId === launch.launchId)
          && Array.isArray(entry.seqs) && entry.seqs.includes(wake.requestSeq) && time(entry.at) >= launchAt);
        check(`${label}-clean-child-exit`, completions.length === 1 && completions[0].exitCode === 0
          && time(completions[0].at) >= turn.completedAt, 'One matching clean child-completion audit is required after turn completion');
        const completionAt = time(completions[0]?.at);
        previousCompletion = validTime(completionAt) ? completionAt : turn.completedAt;
      }
      previousTurnId = turn.id;
      proofEnd = Math.max(proofEnd, previousCompletion);
      measuredLaunches.push(launch);
    }
    rounds.push({ round: i + 1, requestSeq: wake.requestSeq, ackSeq: wake.ackSeq,
      turnId: turn.id, pass: beforeErrors === errors.length });
  }
  // A third peer wake may run this verifier. It lies outside the two completed
  // cycles; unrelated or duplicate launches inside the measured window fail.
  const windowLaunches = audit.filter((entry) => entry.outcome === 'launched'
    && entry.target === handle && time(entry.at) > baseline.completedAt && time(entry.at) <= proofEnd);
  check('audit-no-duplicate-launches', windowLaunches.length === 2 && measuredLaunches.length === 2
    && new Set(measuredLaunches.map((entry) => `${entry.pid}:${entry.at}`)).size === 2
    && windowLaunches.every((entry) => measuredLaunches.includes(entry)),
  'Exactly two non-overlapping launches may occur during the measured continuation');
  check('no-extra-turns', afterBaseline.filter((turn) => validTime(turn.startedAt) && turn.startedAt <= proofEnd).length === 2,
    'No extra manual or duplicate turn may occur inside the measured two-round window');
  return result();
}


/**
 * CLI Entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  if (flags.help || (!flags.proof && (!flags.session || !flags.handle || !flags.agent || !flags['baseline-turn']))) {
    console.log(`wakeQualification — Read-only verification of Agora automated wake proof

Usage:
  node tools/agora/wakeQualification.mjs --session <sessionId> --handle <handle> --baseline-turn <id> [options]

Options:
  --session <id>         Codex thread/session UUID (required)
  --handle <handle>      Target handle (required)
  --agent <agentId>      Exact target Agora agent UUID (required)
  --baseline-turn <id>   Last completed turn ID before the test (required)
  --proof <path>        Read all verification inputs from a JSON handoff file
                        Native proof uses deliveryMode: native-queue and requires
                        expectedOwnerPid, expectedAppPid and expectedOwnerExecutable
  --pairs <r1:a1,r2:a2>  Diagnostic shorthand; cannot qualify without peer identities and nonces
  --wakes <json>         JSON string of wake rounds: [{"requestSeq":1,"requestNonce":"...","ackSeq":2,"ackNonce":"...","peerAgentId":"..."}]
  --transcript <path>    Explicit path to session transcript jsonl (optional override)
  --audit <path>         Path to watchdog audit jsonl (default: .agent/agora/watchdog-audit.jsonl)
  --output <path>        Write formatted JSON receipt to file (e.g. .agent/scratch/.../receipt.json)
  --url <url>            Agora daemon base URL (default: http://127.0.0.1:4319)
`);
    return;
  }

  let wakes = [];
  if (flags.pairs) {
    const pairTokens = String(flags.pairs).split(',').map((p) => p.trim()).filter(Boolean);
    for (const pair of pairTokens) {
      const [reqStr, ackStr] = pair.split(':').map((s) => s.trim());
      const requestSeq = Number(reqStr);
      const ackSeq = Number(ackStr);
      if (!Number.isFinite(requestSeq) || !Number.isFinite(ackSeq)) {
        console.error(`Invalid pair token in --pairs: "${pair}" (expected format: <requestSeq>:<ackSeq>)`);
        process.exitCode = 1;
        return;
      }
      wakes.push({ requestSeq, ackSeq });
    }
  } else if (flags.wakes) {
    try {
      wakes = JSON.parse(flags.wakes);
    } catch (e) {
      console.error(`Invalid JSON in --wakes: ${e.message}`);
      process.exitCode = 1;
      return;
    }
  }

  const proof = flags.proof ? JSON.parse(readFileSync(path.resolve(flags.proof), 'utf8')) : {};
  const result = await verifyWakeQualification(flags.proof ? {
    ...proof,
    sessionFilePath: proof.sessionFilePath || proof.transcriptPath,
  } : {
    sessionId: flags.session,
    handle: flags.handle,
    agentId: flags.agent,
    baselineTurnId: flags['baseline-turn'],
    wakes,
    sessionFilePath: flags.transcript,
    auditPath: flags.audit,
    baseUrl: flags.url,
  });

  const formatted = JSON.stringify(result, null, 2);
  console.log(formatted);

  if (flags.output) {
    try {
      const outPath = path.resolve(flags.output);
      const fsMod = await import('node:fs');
      fsMod.mkdirSync(path.dirname(outPath), { recursive: true });
      fsMod.writeFileSync(outPath, `${formatted}\n`, 'utf8');
      console.log(`[wakeQualification] Receipt written to ${outPath}`);
    } catch (err) {
      console.error(`[wakeQualification] Failed to write --output receipt: ${err.message}`);
      process.exitCode = 1;
    }
  }

  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`[wakeQualification error] ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
