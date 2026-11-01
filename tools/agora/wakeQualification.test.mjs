import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyWakeQualification, streamJsonLines, findSessionFile } from './wakeQualification.mjs';

function createTempDir(prefix = 'wake-qual-test-') {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

// Fictional test identities (WF-G358: keep real machine/session UUIDs out of tracked tests)
const TARGET_AGENT = '00000000-0000-4000-8000-000000000001';
const PEER_AGENT = '00000000-0000-4000-8000-000000000002';
const HANDLE = 'codex-test-target';
const CALLSIGN = 'codex-test';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';

/**
 * Builds a realistic transcript and proof fixture adhering to:
 * baseline complete < req1 <= launch1 <= start1 <= ack1 <= complete1 <= childExit1 < req2 <= launch2 <= start2 <= ack2 <= complete2 <= childExit2
 */
function buildRealisticFixture(overrides = {}) {
  const tBaselineStart = '2026-10-22T19:00:00.000Z';
  const tBaselineComplete = '2026-10-22T19:05:00.000Z';

  const tReq1 = new Date('2026-10-22T19:10:00.000Z').getTime();
  const tLaunch1 = '2026-10-22T19:10:01.000Z';
  const tStart1 = '2026-10-22T19:10:02.000Z';
  const tAck1 = new Date('2026-10-22T19:10:05.000Z').getTime();
  const tComplete1 = '2026-10-22T19:10:10.000Z';
  const tChildExit1 = '2026-10-22T19:10:11.000Z';

  const tReq2 = new Date('2026-10-22T19:20:00.000Z').getTime();
  const tLaunch2 = '2026-10-22T19:20:01.000Z';
  const tStart2 = '2026-10-22T19:20:02.000Z';
  const tAck2 = new Date('2026-10-22T19:20:05.000Z').getTime();
  const tComplete2 = '2026-10-22T19:20:10.000Z';
  const tChildExit2 = '2026-10-22T19:20:11.000Z';

  // Real Codex transcript ordering: task_started precedes turn_context
  const transcriptLines = [
    { type: 'session_meta', payload: { id: SESSION_ID, session_id: SESSION_ID, cli_version: '0.163.0-alpha.10.2' } },
    // Baseline turn
    { timestamp: tBaselineStart, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-base' } },
    { timestamp: tBaselineStart, type: 'turn_context', payload: { turn_id: 'turn-base', model: 'gpt-6.1-sol' } },
    { timestamp: tBaselineComplete, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-base' } },
    // Round 1 resumed turn via watchdog prompt
    { timestamp: tStart1, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-wake-1' } },
    { timestamp: tStart1, type: 'turn_context', payload: { turn_id: 'turn-wake-1', model: 'gpt-6.1-sol' } },
    {
      timestamp: tStart1,
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume this existing orchestration session.\nWake messages:\n[seq 7770 from ${PEER_AGENT}] WAKE-TEST-C1 @codex nonce-alpha-123`,
      },
    },
    { timestamp: tComplete1, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-wake-1' } },
    // Round 2 resumed turn via watchdog prompt
    { timestamp: tStart2, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-wake-2' } },
    { timestamp: tStart2, type: 'turn_context', payload: { turn_id: 'turn-wake-2', model: 'gpt-6.1-sol' } },
    {
      timestamp: tStart2,
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume this existing orchestration session.\nWake messages:\n[seq 7775 from ${PEER_AGENT}] WAKE-TEST-C2 @codex nonce-beta-456`,
      },
    },
    { timestamp: tComplete2, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-wake-2' } },
  ];

  const messages = [
    { seq: 7770, from: PEER_AGENT, body: 'WAKE-TEST-C1 @codex nonce-alpha-123', createdAt: tReq1 },
    { seq: 7771, from: TARGET_AGENT, body: 'codex AWAKE: WAKE-ACK-C1 7770 nonce-ack-123', createdAt: tAck1 },
    { seq: 7775, from: PEER_AGENT, body: 'WAKE-TEST-C2 @codex nonce-beta-456', createdAt: tReq2 },
    { seq: 7776, from: TARGET_AGENT, body: 'codex AWAKE: WAKE-ACK-C2 7775 nonce-ack-456', createdAt: tAck2 },
  ];

  const auditRecords = [
    { at: tLaunch1, target: HANDLE, outcome: 'launched', pid: 12345, seqs: [7770], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-uuid-1' },
    { at: tChildExit1, target: HANDLE, outcome: 'child-completed', pid: 12345, seqs: [7770], exitCode: 0, sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-uuid-1' },
    { at: tLaunch2, target: HANDLE, outcome: 'launched', pid: 12346, seqs: [7775], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-uuid-2' },
    { at: tChildExit2, target: HANDLE, outcome: 'child-completed', pid: 12346, seqs: [7775], exitCode: 0, sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-uuid-2' },
  ];

  const wakes = [
    { requestSeq: 7770, requestNonce: 'nonce-alpha-123', ackSeq: 7771, ackNonce: 'nonce-ack-123', peerAgentId: PEER_AGENT },
    { requestSeq: 7775, requestNonce: 'nonce-beta-456', ackSeq: 7776, ackNonce: 'nonce-ack-456', peerAgentId: PEER_AGENT },
  ];

  return {
    transcriptLines,
    messages,
    auditRecords,
    wakes,
    options: {
      sessionId: SESSION_ID,
      handle: HANDLE,
      agentId: TARGET_AGENT,
      callsign: CALLSIGN,
      baselineTurnId: 'turn-base',
      expectedVersion: '0.163.0-alpha.10.2',
      expectedModel: 'gpt-6.1-sol',
      wakes,
      messages,
      auditRecords,
      ...overrides,
    },
  };
}

test('wakeQualification passes with realistic two-cycle fixture, matching journal, and clean child exits', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-test-01.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.rounds.length, 2);
    assert.ok(result.rounds[0].pass);
    assert.ok(result.rounds[1].pass);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('streamJsonLines fails closed on malformed complete JSON records', () => {
  const dir = createTempDir();
  try {
    const file = path.join(dir, 'bad.jsonl');
    writeFileSync(file, '{"valid":1}\n{not-json}\n', 'utf8');

    assert.throws(() => {
      streamJsonLines(file, () => {});
    }, /Malformed JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('findSessionFile finds nested session files with readdirSync', () => {
  const dir = createTempDir();
  try {
    const nested = path.join(dir, 'sessions', '2026', '10', '22');
    mkdirSync(nested, { recursive: true });
    const target = path.join(nested, 'rollout-12345-00000000-test.jsonl');
    writeFileSync(target, '{"test":1}\n', 'utf8');

    const found = findSessionFile('00000000-test', dir);
    assert.equal(found, target);

    const notFound = findSessionFile('non-existent-uuid', dir);
    assert.equal(notFound, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when required identity or wake input fields are missing', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-reqs.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Missing agentId
    await assert.rejects(async () => {
      await verifyWakeQualification({
        ...fixture.options,
        agentId: undefined,
        sessionFilePath: sessionFile,
      });
    }, /agentId is required/);

    // Missing peerAgentId in wake round
    const badWakes = [
      { requestSeq: 7770, requestNonce: 'nonce-alpha-123', ackSeq: 7771, ackNonce: 'nonce-ack-123' },
      fixture.wakes[1],
    ];
    const result = await verifyWakeQualification({
      ...fixture.options,
      wakes: badWakes,
      sessionFilePath: sessionFile,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('round-1-inputs')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when session_meta id does not match requested sessionId', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-mismatch.jsonl');
    const lines = fixture.transcriptLines.map((l) =>
      l.type === 'session_meta' ? { type: 'session_meta', payload: { id: 'wrong-uuid-1111' } } : l
    );
    writeFileSync(sessionFile, lines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('session-id-validation')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification accepts response_item message role=user input format', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-response-item.jsonl');
    // Replace round 1 user_message with response_item format
    const lines = fixture.transcriptLines.map((l) =>
      l.payload?.type === 'user_message' && l.payload?.message.includes('7770')
        ? {
            timestamp: l.timestamp,
            type: 'response_item',
            payload: {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume this existing orchestration session.\nWake messages:\n[seq 7770 from ${PEER_AGENT}] WAKE-TEST-C1 @codex nonce-alpha-123`,
                },
              ],
            },
          }
        : l
    );
    writeFileSync(sessionFile, lines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.ok(result.rounds[0].pass);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when human prompt injection occurs in resumed turn', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-human.jsonl');
    // Replace watchdog prompt in round 1 with an interactive human prompt
    const lines = fixture.transcriptLines.map((l) =>
      l.payload?.type === 'user_message' && l.payload?.message.includes('Agora wake for')
        ? { timestamp: l.timestamp, type: 'event_msg', payload: { type: 'user_message', message: 'hey codex please resume now' } }
        : l
    );
    writeFileSync(sessionFile, lines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('watchdog-input')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when peer request comes from unexpected sender or misses nonce', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-peer-fail.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Request from unknown sender
    const messages = fixture.messages.map((m) =>
      m.seq === 7770 ? { ...m, from: 'unknown-intruder-uuid' } : m
    );

    const result = await verifyWakeQualification({
      ...fixture.options,
      messages,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('round-1-peer-request')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when child-completed audit is missing or reports non-zero exit code', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-child-fail.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Child exit code = 1 for round 1
    const auditRecords = fixture.auditRecords.map((a) =>
      a.outcome === 'child-completed' && a.pid === 12345 ? { ...a, exitCode: 1 } : a
    );

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('clean-child-exit')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when child-completed audit has mismatched launchId', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-launchid-fail.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Mismatched launchId on child completion
    const auditRecords = fixture.auditRecords.map((a) =>
      a.outcome === 'child-completed' && a.pid === 12345 ? { ...a, launchId: 'wrong-mismatched-launch-id' } : a
    );

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('clean-child-exit')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when chronological ordering is violated (request before previous completion)', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-chrono-fail.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Request 1 sent at 19:04:00 (before baseline completed at 19:05:00)
    const messages = fixture.messages.map((m) =>
      m.seq === 7770 ? { ...m, createdAt: new Date('2026-10-22T19:04:00.000Z').getTime() } : m
    );

    const result = await verifyWakeQualification({
      ...fixture.options,
      messages,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('time-order')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails when duplicate launch occurs in measured continuation', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-dup.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Extra launch during measured window
    const auditRecords = [
      ...fixture.auditRecords,
      {
        at: '2026-10-22T19:10:03.000Z',
        target: HANDLE,
        outcome: 'launched',
        pid: 99999,
        seqs: [7770],
        sessionId: SESSION_ID,
        agentId: TARGET_AGENT,
      },
    ];

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('one-launch') || e.includes('audit-no-duplicate-launches')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification passes when a third verification turn and launch exist after the two-cycle proof window', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-third-turn.jsonl');

    // Third turn in transcript at 19:30:00 (after cycle 2 child exit at 19:20:11)
    const lines = [
      ...fixture.transcriptLines,
      { timestamp: '2026-10-22T19:30:00.000Z', type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-verif-3' } },
      { timestamp: '2026-10-22T19:30:00.000Z', type: 'turn_context', payload: { turn_id: 'turn-verif-3', model: 'gpt-6.1-sol' } },
      {
        timestamp: '2026-10-22T19:30:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          message: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume to run verifier.\nWake messages:\n[seq 7780 from ${PEER_AGENT}] RUN-VERIFIER`,
        },
      },
      { timestamp: '2026-10-22T19:30:10.000Z', type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-verif-3' } },
    ];
    writeFileSync(sessionFile, lines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    // Third launch in audit log at 19:29:55 (after cycle 2 completion)
    const auditRecords = [
      ...fixture.auditRecords,
      {
        at: '2026-10-22T19:29:55.000Z',
        target: HANDLE,
        outcome: 'launched',
        pid: 12347,
        seqs: [7780],
        sessionId: SESSION_ID,
        agentId: TARGET_AGENT,
      },
    ];

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.rounds.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification passes via CLI --proof handoff.json and writes receipt file', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticFixture();
    const sessionFile = path.join(dir, 'session-proof.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const auditFile = path.join(dir, 'watchdog-audit.jsonl');
    writeFileSync(auditFile, fixture.auditRecords.map((a) => JSON.stringify(a)).join('\n'), 'utf8');

    const handoffPath = path.join(dir, 'handoff.json');
    const handoff = {
      sessionId: SESSION_ID,
      handle: HANDLE,
      agentId: TARGET_AGENT,
      callsign: CALLSIGN,
      baselineTurnId: 'turn-base',
      expectedVersion: '0.163.0-alpha.10.2',
      expectedModel: 'gpt-6.1-sol',
      transcriptPath: sessionFile,
      auditPath: auditFile,
      wakes: fixture.wakes,
      messages: fixture.messages,
    };
    writeFileSync(handoffPath, JSON.stringify(handoff, null, 2), 'utf8');

    const receiptPath = path.join(dir, 'receipt.json');

    const { execFileSync } = await import('node:child_process');
    execFileSync(
      process.execPath,
      ['tools/agora/wakeQualification.mjs', '--proof', handoffPath, '--output', receiptPath],
      { encoding: 'utf8' }
    );

    const { readFileSync } = await import('node:fs');
    const savedReceipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(savedReceipt.ok, true, JSON.stringify(savedReceipt.errors));
    assert.equal(savedReceipt.rounds.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// Native Queue Qualification Test Fixtures & Assertions
//
// What this does:
//   These fixtures simulate the in-process native queue delivery path where
//   a running desktop application (e.g. Codex Desktop app-server under ChatGPT.exe)
//   drains items from queue_1.sqlite without spawning a secondary CLI process.
//
// Why it was built that way:
//   Remy explicitly required visibility in the desktop window and zero manual
//   restarts. Pure CLI resume attempts cause a process mutex lock collision
//   (-32600). The native queue watchdog adapter injects via 'codex queue',
//   yielding an initial 'queued' audit, followed by an 'app-turn-completed'
//   audit when the in-process turn finishes. The transcript attributes the turn
//   to 'queue' rather than 'composer' (interactive human prompt).
//
// What was preserved:
//   All strict ordering, peer identity matching, and baseline completion
//   checks from the CLI qualification mode are retained.
//
// What problems were left behind:
//   Live visual verification in the OS window cannot be checked headlessly in
//   unit tests and must be attested during live qualifications by the human/operator.
// ============================================================================

const NATIVE_OWNER_PID = 20336;
const NATIVE_APP_PID = 2020;
const NATIVE_OWNER_EXECUTABLE = 'C:\\Users\\Gambit\\AppData\\Local\\OpenAI\\Codex\\bin\\codex.exe';

function buildRealisticNativeQueueFixture(overrides = {}) {
  const tBaselineStart = '2026-10-22T19:00:00.000Z';
  const tBaselineComplete = '2026-10-22T19:05:00.000Z';

  const tReq1 = new Date('2026-10-22T19:10:00.000Z').getTime();
  const tLaunch1 = '2026-10-22T19:10:01.000Z';
  const tQueued1 = '2026-10-22T19:10:01.500Z';
  const tStart1 = '2026-10-22T19:10:02.000Z';
  const tAck1 = new Date('2026-10-22T19:10:05.000Z').getTime();
  const tComplete1 = '2026-10-22T19:10:10.000Z';
  const tAppCompleteAudit1 = '2026-10-22T19:10:11.000Z';

  const tReq2 = new Date('2026-10-22T19:20:00.000Z').getTime();
  const tLaunch2 = '2026-10-22T19:20:01.000Z';
  const tQueued2 = '2026-10-22T19:20:01.500Z';
  const tStart2 = '2026-10-22T19:20:02.000Z';
  const tAck2 = new Date('2026-10-22T19:20:05.000Z').getTime();
  const tComplete2 = '2026-10-22T19:20:10.000Z';
  const tAppCompleteAudit2 = '2026-10-22T19:20:11.000Z';

  const transcriptLines = [
    { type: 'session_meta', payload: { id: SESSION_ID, session_id: SESSION_ID, cli_version: '0.163.0-alpha.10.2' } },
    // Baseline turn (human/initial)
    { timestamp: tBaselineStart, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-base', turn_attribution: { turn_trigger: 'composer' } } },
    { timestamp: tBaselineStart, type: 'turn_context', payload: { turn_id: 'turn-base', model: 'gpt-6.1-sol' } },
    { timestamp: tBaselineComplete, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-base' } },
    // Round 1 resumed turn via native queue
    { timestamp: tStart1, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-wake-1', turn_attribution: { turn_trigger: 'queue' } } },
    { timestamp: tStart1, type: 'turn_context', payload: { turn_id: 'turn-wake-1', model: 'gpt-6.1-sol' } },
    {
      timestamp: tStart1,
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume this existing orchestration session.\nWake messages:\n[seq 7770 from ${PEER_AGENT}] WAKE-TEST-C1 @codex nonce-alpha-123`,
      },
    },
    { timestamp: tComplete1, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-wake-1' } },
    // Round 2 resumed turn via native queue
    { timestamp: tStart2, type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-wake-2', turn_attribution: { turn_trigger: 'queue' } } },
    { timestamp: tStart2, type: 'turn_context', payload: { turn_id: 'turn-wake-2', model: 'gpt-6.1-sol' } },
    {
      timestamp: tStart2,
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: `Agora wake for ${CALLSIGN} (${HANDLE}).\nResume this existing orchestration session.\nWake messages:\n[seq 7775 from ${PEER_AGENT}] WAKE-TEST-C2 @codex nonce-beta-456`,
      },
    },
    { timestamp: tComplete2, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-wake-2' } },
  ];

  const messages = [
    { seq: 7770, from: PEER_AGENT, body: 'WAKE-TEST-C1 @codex nonce-alpha-123', createdAt: tReq1 },
    { seq: 7771, from: TARGET_AGENT, body: `${CALLSIGN.toUpperCase()} AWAKE: ACK 7770 nonce-alpha-123`, createdAt: tAck1 },
    { seq: 7775, from: PEER_AGENT, body: 'WAKE-TEST-C2 @codex nonce-beta-456', createdAt: tReq2 },
    { seq: 7776, from: TARGET_AGENT, body: `${CALLSIGN.toUpperCase()} AWAKE: ACK 7775 nonce-beta-456`, createdAt: tAck2 },
  ];

  const auditRecords = [
    // Round 1 audits
    { at: tLaunch1, target: HANDLE, outcome: 'launched', pid: 30001, seqs: [7770], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-1', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, baselineTurnId: 'turn-base' },
    { at: tQueued1, target: HANDLE, outcome: 'queued', pid: 30001, seqs: [7770], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-1', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, exitCode: 0, queuedMessageId: 'q-msg-1' },
    { at: tAppCompleteAudit1, target: HANDLE, outcome: 'app-turn-completed', pid: 30001, seqs: [7770], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-1', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, turnId: 'turn-wake-1', turnTrigger: 'queue' },
    // Round 2 audits
    { at: tLaunch2, target: HANDLE, outcome: 'launched', pid: 30002, seqs: [7775], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-2', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, baselineTurnId: 'turn-wake-1' },
    { at: tQueued2, target: HANDLE, outcome: 'queued', pid: 30002, seqs: [7775], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-2', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, exitCode: 0, queuedMessageId: 'q-msg-2' },
    { at: tAppCompleteAudit2, target: HANDLE, outcome: 'app-turn-completed', pid: 30002, seqs: [7775], sessionId: SESSION_ID, agentId: TARGET_AGENT, launchId: 'launch-native-2', deliveryMode: 'native-queue', ownerPid: NATIVE_OWNER_PID, ownerAppPid: NATIVE_APP_PID, ownerExecutable: NATIVE_OWNER_EXECUTABLE, turnId: 'turn-wake-2', turnTrigger: 'queue' },
  ];

  const wakes = [
    { requestSeq: 7770, requestNonce: 'nonce-alpha-123', ackSeq: 7771, ackNonce: 'nonce-alpha-123', peerAgentId: PEER_AGENT },
    { requestSeq: 7775, requestNonce: 'nonce-beta-456', ackSeq: 7776, ackNonce: 'nonce-beta-456', peerAgentId: PEER_AGENT },
  ];

  return {
    transcriptLines,
    messages,
    auditRecords,
    wakes,
    options: {
      sessionId: SESSION_ID,
      handle: HANDLE,
      agentId: TARGET_AGENT,
      callsign: CALLSIGN,
      baselineTurnId: 'turn-base',
      expectedVersion: '0.163.0-alpha.10.2',
      expectedModel: 'gpt-6.1-sol',
      deliveryMode: 'native-queue',
      expectedOwnerPid: NATIVE_OWNER_PID,
      expectedAppPid: NATIVE_APP_PID,
      expectedOwnerExecutable: NATIVE_OWNER_EXECUTABLE,
      wakes,
      messages,
      auditRecords,
      ...overrides,
    },
  };
}

test('wakeQualification passes with realistic native-queue two-cycle fixture', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    const sessionFile = path.join(dir, 'session-native-01.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.rounds.length, 2);
    assert.ok(result.rounds[0].pass);
    assert.ok(result.rounds[1].pass);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails in native-queue mode when turn_trigger is composer instead of queue', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    // Simulate interactive human prompt injection instead of queue consumption
    for (const line of fixture.transcriptLines) {
      if (line.payload?.turn_id === 'turn-wake-1' && line.payload.turn_attribution) {
        line.payload.turn_attribution.turn_trigger = 'composer';
      }
    }
    const sessionFile = path.join(dir, 'session-native-composer.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('native-queue-trigger')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails in native-queue mode when app-turn-completed audit is missing', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    // Drop the app-turn-completed audit for round 1 (e.g. stalled or undrained queue item)
    const auditRecords = fixture.auditRecords.filter(
      (entry) => !(entry.outcome === 'app-turn-completed' && entry.turnId === 'turn-wake-1')
    );
    const sessionFile = path.join(dir, 'session-native-no-complete.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('native-app-completion')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails in native-queue mode when owner PID or executable drifts', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    // Simulate launch under unexpected owner PID
    const auditRecords = fixture.auditRecords.map((entry) => ({
      ...entry,
      ownerPid: entry.ownerPid ? 99999 : undefined,
    }));
    const sessionFile = path.join(dir, 'session-native-drift.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('native-launch-owner')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails in native-queue mode when queue command exitCode is non-zero', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    // Simulate failed queue insertion
    const auditRecords = fixture.auditRecords.map((entry) => ({
      ...entry,
      exitCode: entry.outcome === 'queued' ? 1 : entry.exitCode,
    }));
    const sessionFile = path.join(dir, 'session-native-bad-exit.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      auditRecords,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('native-enqueued')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wakeQualification fails in native-queue mode when target ACK body omits CALLSIGN AWAKE', async () => {
  const dir = createTempDir();
  try {
    const fixture = buildRealisticNativeQueueFixture();
    // Omit the required CALLSIGN AWAKE line from the peer ACK body
    const messages = fixture.messages.map((m) => {
      if (m.seq === 7771) {
        return { ...m, body: 'ACK 7770 nonce-alpha-123' };
      }
      return m;
    });
    const sessionFile = path.join(dir, 'session-native-no-awake.jsonl');
    writeFileSync(sessionFile, fixture.transcriptLines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');

    const result = await verifyWakeQualification({
      ...fixture.options,
      messages,
      sessionFilePath: sessionFile,
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('native-awake-ack')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

