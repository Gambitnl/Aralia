import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { createAgoraServer } from './server.mjs';

import {
  buildWakePrompt,
  codexThreadDeepLink,
  codexThreadOpenSpec,
  expandTemplate,
  failureBackoffMs,
  isWakeWorthy,
  lifecycleSignal,
  openCodexThread,
  planTargetMessages,
  readSessionCliVersion,
  runCycle,
  selectCompatibleCodex,
  withCodexResumeModel,
} from './watchdog.mjs';

/**
 * This file proves the Agora wake watchdog reacts only to genuine wake requests.
 *
 * The focused checks cover message classification, lifecycle planning, adapter
 * selection, and end-to-end audit behavior against a temporary Agora daemon.
 * They protect dormant orchestrators from missed wakes, duplicate launches, and
 * repeated audit noise when a configured wake adapter cannot currently deliver.
 *
 * Exercises: watchdog.mjs planning and delivery helpers
 * Depends on: server.mjs for isolated message-bus integration tests
 */

// ============================================================================
// Shared Watchdog Fixtures
// ============================================================================
// These records model one orchestrator, its peers, and the human operator. Each
// planner test can then focus on the message sequence that changes behavior.
// ============================================================================

const target = {
  handle: 'codex-sol-56',
  callsign: 'sol',
  aliases: ['codex'],
  agentId: 'sol-id',
  sessionId: 'thread-1',
};

const agents = new Map([
  ['human-id', { id: 'human-id', role: 'human', status: 'online' }],
  ['peer-id', { id: 'peer-id', role: 'orchestrator', status: 'online' }],
  ['sol-id', { id: 'sol-id', role: 'orchestrator', status: 'online' }],
]);

// ============================================================================
// Message Classification and Wake Planning
// ============================================================================
// These checks prove which board messages can wake a target and how lifecycle,
// liveness, cooldown, grace, and retry state shape one delivery batch.
// ============================================================================

test('human, direct and exact callsign messages are wake-worthy', () => {
  assert.equal(isWakeWorthy({ from: 'human-id', to: 'all', body: 'hello' }, target, agents), true);
  assert.equal(isWakeWorthy({ from: 'peer-id', to: 'sol-id', body: 'direct' }, target, agents), true);
  assert.equal(isWakeWorthy({ from: 'peer-id', to: 'all', body: '@Sol please review' }, target, agents), true);
  assert.equal(isWakeWorthy({ from: 'peer-id', to: 'all', body: '@codex-sol-56 please review' }, target, agents), true);
  assert.equal(isWakeWorthy({ from: 'peer-id', to: 'all', body: '@solo is a different name' }, target, agents), false);
  assert.equal(isWakeWorthy({ from: 'peer-id', to: 'all', body: 'ordinary traffic' }, target, agents), false);
});

test('only the target can arm or clear its dormant lifecycle', () => {
  assert.equal(lifecycleSignal({ from: 'sol-id', body: 'SOL DORMANT — test armed' }, target), 'dormant');
  assert.equal(lifecycleSignal({ from: 'sol-id', body: 'SOL AWAKE seq 10' }, target), 'awake');
  assert.equal(lifecycleSignal({ from: 'peer-id', body: 'SOL DORMANT' }, target), '');
});

test('dormant target batches pending wakes into one launch plan', () => {
  const messages = [
    { seq: 11, from: 'sol-id', to: 'all', body: 'SOL DORMANT — armed' },
    { seq: 12, from: 'peer-id', to: 'all', body: 'ordinary' },
    { seq: 13, from: 'peer-id', to: 'all', body: '@sol first wake' },
    { seq: 14, from: 'human-id', to: 'all', body: 'second wake' },
  ];
  const plan = planTargetMessages({
    messages, target, agentsById: agents,
    targetState: { cursor: 10, dormant: false, lastLaunchAt: 0 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(plan.kind, 'launch');
  assert.equal(plan.safeCursor, 12);
  assert.equal(plan.cursor, 14);
  assert.equal(plan.dormant, true);
  assert.deepEqual(plan.wakes.map((message) => message.seq), [13, 14]);
});

test('own dormancy announcement with a callsign example is never its own wake', () => {
  // Dormancy posts often explain how peers can wake the target. The watchdog
  // must consume that lifecycle message even though the explanation includes
  // the same exact @callsign syntax that ordinary peer messages use to wake it.
  const plan = planTargetMessages({
    messages: [{
      seq: 11,
      from: 'sol-id',
      to: 'all',
      body: 'SOL DORMANT — peers can use @sol to wake me',
    }],
    target,
    agentsById: agents,
    targetState: { cursor: 10, dormant: false, lastLaunchAt: 0 },
    now: 100_000,
    cooldownMs: 30_000,
  });

  // The message arms dormancy and advances safely, but creates no launch batch.
  assert.equal(plan.kind, 'active');
  assert.equal(plan.cursor, 11);
  assert.equal(plan.safeCursor, 11);
  assert.equal(plan.dormant, true);
  assert.deepEqual(plan.wakes, []);
});

test('online non-dormant target advances without a duplicate launch', () => {
  const plan = planTargetMessages({
    messages: [{ seq: 2, from: 'human-id', to: 'all', body: 'steer' }],
    target, agentsById: agents,
    targetState: { cursor: 1, dormant: false, lastLaunchAt: 0 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(plan.kind, 'active');
  assert.equal(plan.cursor, 2);
});

test('gone target launches, while cooldown retains the wake for retry', () => {
  const goneAgents = new Map([...agents].filter(([id]) => id !== 'sol-id'));
  const message = { seq: 5, from: 'human-id', to: 'all', body: 'wake everyone' };
  const launch = planTargetMessages({
    messages: [message], target, agentsById: goneAgents,
    targetState: { cursor: 4, dormant: false, lastLaunchAt: 0 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(launch.kind, 'launch');
  assert.equal(launch.presence, 'gone');
  const cooldown = planTargetMessages({
    messages: [message], target, agentsById: goneAgents,
    targetState: { cursor: 4, dormant: false, lastLaunchAt: 90_000 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(cooldown.kind, 'cooldown');
  assert.equal(cooldown.safeCursor, 4);
});

test('stale target restores its harness after the native grace window', () => {
  const staleAgents = new Map(agents);
  staleAgents.set('sol-id', { ...staleAgents.get('sol-id'), status: 'stale' });
  const message = { seq: 6, from: 'peer-id', to: 'sol-id', body: 'review', createdAt: 60_000 };
  const graceTarget = { ...target, nativeGraceMs: 20_000 };
  const plan = planTargetMessages({
    messages: [message], target: graceTarget, agentsById: staleAgents,
    targetState: { cursor: 5, dormant: false, lastLaunchAt: 0 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(plan.kind, 'launch');
  assert.equal(plan.presence, 'stale');
  assert.deepEqual(plan.wakes.map((item) => item.seq), [6]);
});

test('pending child and failed-child backoff prevent launch storms', () => {
  const message = { seq: 8, from: 'human-id', to: 'all', body: 'wake', createdAt: 99_000 };
  const pending = planTargetMessages({
    messages: [message], target, agentsById: agents,
    targetState: {
      cursor: 7,
      dormant: true,
      lastLaunchAt: 10_000,
      pending: { pid: 99, startedAt: 90_000 },
    },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(pending.kind, 'launch-pending');

  const backoff = planTargetMessages({
    messages: [message], target, agentsById: agents,
    targetState: { cursor: 7, dormant: true, lastLaunchAt: 10_000, backoffUntil: 110_000 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(backoff.kind, 'failure-backoff');
  assert.equal(failureBackoffMs(1), 30_000);
  assert.equal(failureBackoffMs(3), 120_000);
  assert.equal(failureBackoffMs(20), 15 * 60_000);
});

test('native watcher gets a grace window and AWAKE cancels fallback launch', () => {
  const graceTarget = { ...target, nativeGraceMs: 20_000 };
  const dormant = { seq: 20, from: 'sol-id', to: 'all', body: 'SOL DORMANT', createdAt: 90_000 };
  const wake = { seq: 21, from: 'human-id', to: 'all', body: 'wake', createdAt: 95_000 };
  const grace = planTargetMessages({
    messages: [dormant, wake], target: graceTarget, agentsById: agents,
    targetState: { cursor: 19, dormant: false, lastLaunchAt: 0 },
    now: 100_000, cooldownMs: 30_000,
  });
  assert.equal(grace.kind, 'native-grace');
  assert.equal(grace.safeCursor, 20);

  const awake = { seq: 22, from: 'sol-id', to: 'all', body: 'SOL AWAKE seq 21', createdAt: 101_000 };
  const delivered = planTargetMessages({
    messages: [dormant, wake, awake], target: graceTarget, agentsById: agents,
    targetState: { cursor: 19, dormant: false, lastLaunchAt: 0 },
    now: 102_000, cooldownMs: 30_000,
  });
  assert.equal(delivered.kind, 'active');
  assert.equal(delivered.cursor, 22);
  assert.equal(delivered.dormant, false);
});

// ============================================================================
// Adapter and Session Configuration
// ============================================================================
// These checks keep generated handoffs tied to the correct conversation engine
// and ensure unavailable capabilities remain explicit instead of being faked.
// ============================================================================

test('template and prompt include the exact session handoff facts', () => {
  assert.equal(
    expandTemplate('{handle}:{sessionId}:{prompt}:{script}', {
      handle: 'codex-sol-56', sessionId: 'thread-1', prompt: 'wake', script: 'watchdog.mjs',
    }),
    'codex-sol-56:thread-1:wake:watchdog.mjs',
  );
  const prompt = buildWakePrompt(target, [{ seq: 42, from: 'human-id', body: 'check the board' }]);
  assert.match(prompt, /SOL AWAKE/);
  assert.match(prompt, /seq 42/);
  assert.match(prompt, /does not broaden/);
});

test('Codex adapters preserve the last successfully completed session model', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-session-'));
  try {
    const sessions = path.join(tmpDir, 'sessions', '2026', '07', '10');
    mkdirSync(sessions, { recursive: true });
    const records = [
      { type: 'session_meta', payload: { cli_version: '0.144.0-alpha.4' } },
      { type: 'turn_context', payload: { turn_id: 'good-turn', model: 'gpt-5.3-codex-spark' } },
      { type: 'event_msg', payload: { type: 'task_complete', turn_id: 'good-turn', last_agent_message: 'done' } },
      { type: 'turn_context', payload: { turn_id: 'failed-turn', model: 'gpt-5.6-sol' } },
      { type: 'event_msg', payload: { type: 'task_complete', turn_id: 'failed-turn', last_agent_message: null } },
    ];
    writeFileSync(
      path.join(sessions, 'rollout-test-thread-1.jsonl'),
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    );

    // The failed newer-model attempt must not replace the model from the last
    // turn that actually completed and produced an answer.
    const metadata = readSessionCliVersion('thread-1', tmpDir);
    assert.equal(metadata.version, '0.144.0-alpha.4');
    assert.equal(metadata.model, 'gpt-5.3-codex-spark');
    assert.deepEqual(
      withCodexResumeModel(
        'codex.exe',
        ['exec', 'resume', '--skip-git-repo-check', 'thread-1', 'wake'],
        metadata.model,
      ),
      ['exec', 'resume', '-m', 'gpt-5.3-codex-spark', '--skip-git-repo-check', 'thread-1', 'wake'],
    );

    // Version matching remains independent: the saved engine version still
    // selects the executable that can understand this transcript format.
    const selected = selectCompatibleCodex(
      '0.144.0-alpha.4',
      ['old-codex', 'desktop-codex'],
      (candidate) => candidate === 'desktop-codex' ? '0.144.0-alpha.4' : '0.140.0',
    );
    assert.equal(selected.executable, 'desktop-codex');
    assert.throws(
      () => selectCompatibleCodex('0.145.0', ['old-codex'], () => '0.140.0'),
      /No Codex engine matches session version 0\.145\.0/,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('tracked adapter registry is explicit about verified and unavailable capabilities', () => {
  const registry = JSON.parse(readFileSync(new URL('./agents.json', import.meta.url), 'utf8'));
  const codex = registry.wakeAdapters['codex-cli-resume'];
  const codexOnce = registry.wakeAdapters['codex-session-turn-once'];
  const codexApp = registry.wakeAdapters['codex-app-heartbeat'];
  const claudeDesktop = registry.wakeAdapters['claude-desktop-native'];
  const claude = registry.wakeAdapters['claude-cli-resume'];
  assert.deepEqual(codex.args.slice(0, 4), ['exec', 'resume', '--skip-git-repo-check', '{sessionId}']);
  assert.deepEqual(claude.args.slice(0, 3), ['--print', '--resume', '{sessionId}']);
  assert.equal(codex.compatibleSessionSurface, 'cli-native-only');
  assert.deepEqual(codexOnce.args.slice(0, 4), ['{script}', 'codex-turn-once', '--session', '{sessionId}']);
  assert.equal(codexOnce.capabilities.start, 'event-driven-single-turn');
  assert.equal(codexOnce.completionAction.type, 'codex-thread-deep-link');
  assert.equal(codexApp.capabilities.resume, 'app-owned-thread');
  assert.equal(codexApp.status, 'paused');
  assert.equal(claudeDesktop.capabilities.resume, 'native-watcher-only');
  assert.equal(claudeDesktop.status, 'paused');
  assert.equal(claude.desktopInjection, 'wake-unavailable');
  assert.equal(codex.capabilities.stop, 'wake-unavailable');
});

test('Codex completion surfacing uses only the documented technical-thread deep link', async () => {
  const threadId = '019f75de-f721-7e11-91a7-66dc63fc7439';
  assert.equal(codexThreadDeepLink(threadId), `codex://threads/${threadId}`);
  assert.deepEqual(codexThreadOpenSpec(threadId, 'win32'), {
    command: 'explorer.exe',
    args: [`codex://threads/${threadId}`],
    uri: `codex://threads/${threadId}`,
  });
  assert.throws(() => codexThreadDeepLink('friendly-thread-name'), /technical thread UUID/);

  // Replace the operating-system launcher with a tiny event source. This proves
  // the exact command without opening or focusing the real desktop app in tests.
  let captured;
  const child = new EventEmitter();
  child.unref = () => { child.unreferenced = true; };
  const opened = openCodexThread(threadId, {
    platform: 'win32',
    spawnProcess(command, args, options) {
      captured = { command, args, options };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });
  assert.equal((await opened).outcome, 'desktop-thread-opened');
  assert.equal(captured.command, 'explorer.exe');
  assert.deepEqual(captured.args, [`codex://threads/${threadId}`]);
  assert.equal(captured.options.shell, false);
  assert.equal(child.unreferenced, true);
});

// ============================================================================
// End-to-End Delivery and Audit Behavior
// ============================================================================
// Temporary Agora daemons prove cursor, retry, child-exit, and visible audit
// behavior together while keeping the live coordination board untouched.
// ============================================================================

test('child exit failure keeps the wake pending, backs off and posts a follow-up audit', async () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-exit-'));
  const app = createAgoraServer({ dir: path.join(tmpDir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const request = async (route, { method = 'GET', token, body } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  };

  try {
    const targetAgent = await request('/agents/register', {
      method: 'POST', body: { handle: 'orch.test', role: 'orchestrator', sessionId: 'thread-orch-test', petSlug: 'gf-sd' },
    });
    const human = await request('/agents/register', {
      method: 'POST', body: { handle: 'human.test', role: 'human', petSlug: 'dream-girl' },
    });
    await request('/messages', {
      method: 'POST', token: human.token,
      body: { channel: 'command', body: 'wake the orchestrators' },
    });

    const registryPath = path.join(tmpDir, 'registry.json');
    const targetsPath = path.join(tmpDir, 'targets.json');
    const statePath = path.join(tmpDir, 'state.json');
    const auditPath = path.join(tmpDir, 'audit.jsonl');
    writeFileSync(registryPath, JSON.stringify({
      wakeAdapters: {
        failing: {
          status: 'ready',
          command: process.execPath,
          args: ['-e', "console.error('adapter-boom'); process.exit(7)"],
          processNames: [],
        },
      },
    }));
    writeFileSync(targetsPath, JSON.stringify({
      targets: [{
        handle: 'orch.test', callsign: 'test', agentId: targetAgent.agentId,
        adapter: 'failing', sessionId: 'session-test', cwd: tmpDir,
      }],
    }));
    writeFileSync(statePath, JSON.stringify({
      version: 1,
      targets: { 'orch.test': { cursor: 0, dormant: true, lastLaunchAt: 0 } },
    }));

    const launched = await runCycle({
      baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '',
    });
    assert.equal(launched[0].outcome, 'launched');

    let stored;
    const deadline = Date.now() + 3000;
    do {
      await new Promise((resolve) => setTimeout(resolve, 25));
      stored = JSON.parse(readFileSync(statePath, 'utf8'));
    } while (stored.targets['orch.test'].outcome !== 'child-failed' && Date.now() < deadline);

    const failed = stored.targets['orch.test'];
    assert.equal(failed.outcome, 'child-failed');
    assert.equal(failed.cursor, 0);
    assert.equal(failed.failureCount, 1);
    assert.ok(failed.backoffUntil > Date.now());
    assert.equal(failed.pending, undefined);

    const messages = await request('/messages?channel=all');
    const audits = messages.messages.filter((message) => message.body.startsWith('WAKE-AUDIT'));
    assert.equal(audits.length, 2);
    assert.match(audits[0].body, /outcome=launched/);
    assert.match(audits[1].body, /outcome=child-failed/);
    assert.match(audits[1].body, /adapter-boom/);
  } finally {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('unavailable adapter audits once and retries the original wakes after recovery', async () => {
  // Run against an isolated daemon so both durable cursor movement and visible
  // WAKE-AUDIT messages are proven together without touching the live board.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-unavailable-'));
  const app = createAgoraServer({ dir: path.join(tmpDir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const request = async (route, { method = 'GET', token, body } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  };
  const surfacedThreads = [];
  const resumedThreadId = '019f75de-f721-7e11-91a7-66dc63fc7439';

  try {
    // A paused adapter truthfully reports that delivery is unavailable. It has
    // no launch command because the watchdog must not pretend it can wake this
    // harness until a supported adapter is configured.
    const targetAgent = await request('/agents/register', {
      method: 'POST', body: { handle: 'orch.paused', role: 'orchestrator', sessionId: 'thread-orch-paused', petSlug: 'gf-sd' },
    });
    const human = await request('/agents/register', {
      method: 'POST', body: { handle: 'human.test', role: 'human', petSlug: 'dream-girl' },
    });
    const firstWake = await request('/messages', {
      method: 'POST', token: human.token,
      body: { channel: 'command', body: 'first wake batch' },
    });

    const registryPath = path.join(tmpDir, 'registry.json');
    const targetsPath = path.join(tmpDir, 'targets.json');
    const statePath = path.join(tmpDir, 'state.json');
    const auditPath = path.join(tmpDir, 'audit.jsonl');
    writeFileSync(registryPath, JSON.stringify({
      wakeAdapters: { paused: { status: 'paused', processNames: [] } },
    }));
    writeFileSync(targetsPath, JSON.stringify({
      targets: [{
        handle: 'orch.paused', callsign: 'paused', agentId: targetAgent.agentId,
        adapter: 'paused', sessionId: resumedThreadId, cwd: tmpDir,
      }],
    }));
    writeFileSync(statePath, JSON.stringify({
      version: 1,
      targets: { 'orch.paused': { cursor: 0, dormant: true, lastLaunchAt: 0 } },
    }));

    // The first cycle reports the unavailable adapter without moving the
    // delivery cursor past the human wake. A separate receipt suppresses audit
    // repeats while leaving that exact message available for later delivery.
    const firstCycle = await runCycle({
      baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '',
    });
    assert.equal(firstCycle[0].outcome, 'wake-unavailable');
    const afterFirstCycle = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(afterFirstCycle.targets['orch.paused'].cursor, 0);
    assert.deepEqual(
      afterFirstCycle.targets['orch.paused'].auditedUndelivered.seqs,
      [firstWake.message.seq],
    );
    assert.equal(afterFirstCycle.targets['orch.paused'].failureCount, 0);
    assert.equal(afterFirstCycle.targets['orch.paused'].backoffUntil, 0);

    const repeatedCycle = await runCycle({
      baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '',
    });
    assert.equal(repeatedCycle[0].outcome, 'wake-unavailable-audited');
    let messages = await request('/messages?channel=all');
    let audits = messages.messages.filter((message) => message.body.startsWith('WAKE-AUDIT'));
    assert.equal(audits.length, 1);
    assert.match(audits[0].body, /outcome=wake-unavailable/);

    // A later operator message adds one genuinely new wake id. It receives one
    // fresh audit, while the earlier request remains pending without re-audit.
    const secondWake = await request('/messages', {
      method: 'POST', token: human.token,
      body: { channel: 'command', body: 'second wake batch' },
    });
    const secondCycle = await runCycle({
      baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '',
    });
    assert.equal(secondCycle[0].outcome, 'wake-unavailable');
    assert.deepEqual(secondCycle[0].seqs, [secondWake.message.seq]);
    messages = await request('/messages?channel=all');
    audits = messages.messages.filter((message) => message.body.startsWith('WAKE-AUDIT'));
    assert.equal(audits.length, 2);

    // Recover the same adapter in place. The next cycle must launch with both
    // original human wake sequences, proving audit suppression never consumed
    // delivery. A clean child exit then advances the cursor and clears receipt.
    writeFileSync(registryPath, JSON.stringify({
      wakeAdapters: {
        paused: {
          status: 'ready',
          command: process.execPath,
          args: ['-e', 'process.exit(0)'],
          processNames: [],
          completionAction: { type: 'codex-thread-deep-link' },
        },
      },
    }));
    const recoveredCycle = await runCycle({
      baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '',
      openThread: async (threadId) => {
        surfacedThreads.push(threadId);
        return { ok: true, outcome: 'desktop-thread-opened', uri: `codex://threads/${threadId}` };
      },
    });
    assert.equal(recoveredCycle[0].outcome, 'launched');
    assert.deepEqual(recoveredCycle[0].seqs, [firstWake.message.seq, secondWake.message.seq]);

    let recoveredState;
    const deadline = Date.now() + 3000;
    do {
      await new Promise((resolve) => setTimeout(resolve, 25));
      recoveredState = JSON.parse(readFileSync(statePath, 'utf8'));
    } while (recoveredState.targets['orch.paused'].outcome !== 'child-completed' && Date.now() < deadline);
    assert.equal(recoveredState.targets['orch.paused'].outcome, 'child-completed');
    assert.equal(recoveredState.targets['orch.paused'].surfaceOutcome, 'desktop-thread-opened');
    assert.deepEqual(surfacedThreads, [resumedThreadId]);
    assert.ok(recoveredState.targets['orch.paused'].cursor >= secondWake.message.seq);
    assert.equal(recoveredState.targets['orch.paused'].auditedUndelivered, undefined);
  } finally {
    // The temporary daemon and files are always removed so the focused test
    // cannot leak processes or local state into later Agora work.
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
