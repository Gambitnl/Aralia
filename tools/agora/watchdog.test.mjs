import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { createAgoraServer } from './server.mjs';

import {
  acquireServiceLock,
  findQueuedTurn,
  pickCodexAppOwner,
  processIsAlive,
  queueMarkers,
  releaseServiceLock,
  buildWakePrompt,
  codexThreadDeepLink,
  codexThreadOpenSpec,
  expandTemplate,
  failureBackoffMs,
  isWakeWorthy,
  lifecycleSignal,
  openCodexThread,
  planTargetMessages,
  anchoredAckSeqs,
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

test('saved Codex lifecycle stays active until the matching turn completes', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-lifecycle-'));
  try {
    const sessions = path.join(tmpDir, 'sessions');
    mkdirSync(sessions);
    const file = path.join(sessions, 'rollout-thread-test.jsonl');
    const records = [
      { type: 'session_meta', payload: { cli_version: 'test-version' } },
      { type: 'turn_context', payload: { turn_id: 'previous', model: 'saved-model' } },
      { type: 'event_msg', payload: { type: 'task_complete', turn_id: 'previous', last_agent_message: 'done' } },
      { type: 'event_msg', payload: { type: 'task_started', turn_id: 'current' } },
      { type: 'event_msg', payload: { type: 'task_complete', turn_id: 'previous', last_agent_message: 'late old event' } },
    ];
    const save = () => writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
    save();
    assert.equal(readSessionCliVersion('thread-test', tmpDir).turnState, 'active');
    records.push({ type: 'event_msg', payload: { type: 'task_complete', turn_id: 'current', last_agent_message: 'finished' } });
    save();
    assert.equal(readSessionCliVersion('thread-test', tmpDir).turnState, 'idle');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('selected Codex target waits for idle proof, retains its wake and leaves other targets alone', async () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-idle-'));
  const app = createAgoraServer({ dir: path.join(tmpDir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const registered = await fetch(`${baseUrl}/agents/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'human.test', role: 'human', petSlug: 'dream-girl' }),
    }).then((response) => response.json());
    const wake = await fetch(`${baseUrl}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${registered.token}` },
      body: JSON.stringify({ channel: 'command', body: 'wake both targets' }),
    }).then((response) => response.json());
    const registryPath = path.join(tmpDir, 'registry.json');
    const targetsPath = path.join(tmpDir, 'targets.json');
    const statePath = path.join(tmpDir, 'state.json');
    const auditPath = path.join(tmpDir, 'audit.jsonl');
    const otherState = { cursor: 0, dormant: true, outcome: 'must-not-change' };
    // The disposable child proves launch and completion without starting a real
    // model. The old target would also launch if target selection were ignored.
    writeFileSync(registryPath, JSON.stringify({ wakeAdapters: {
      'codex-session-turn-once': { status: 'ready', command: process.execPath, args: ['-e', 'process.exit(0)'] },
      old: { status: 'ready', command: process.execPath, args: ['-e', 'process.exit(9)'] },
    } }));
    writeFileSync(targetsPath, JSON.stringify({ targets: [
      { handle: 'selected', callsign: 'selected', agentId: 'stale-id', sessionId: 'thread-test', adapter: 'codex-session-turn-once', cwd: tmpDir },
      { handle: 'old', callsign: 'old', agentId: 'old-id', sessionId: 'other-thread', adapter: 'old', cwd: tmpDir },
    ] }));
    writeFileSync(statePath, JSON.stringify({ version: 1, targets: {
      selected: { cursor: 0, dormant: true, lastLaunchAt: 0 }, old: otherState,
    } }));
    const options = { baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), handles: ['selected'], codexHome: tmpDir, processList: '' };
    await assert.rejects(runCycle({ ...options, handles: ['missing'] }), /Unknown wake target/);
    // Missing transcript must retain the exact wake, even with stale presence.
    assert.equal((await runCycle(options))[0].outcome, 'session-state-unavailable');
    const sessions = path.join(tmpDir, 'sessions');
    mkdirSync(sessions);
    const file = path.join(sessions, 'rollout-thread-test.jsonl');
    const records = [
      { type: 'session_meta', payload: { cli_version: 'test' } },
      { type: 'turn_context', payload: { turn_id: 'current', model: 'saved-model' } },
    ];
    const save = () => writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
    save();
    assert.equal((await runCycle(options))[0].outcome, 'active-turn');
    let saved = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(saved.targets.selected.cursor, 0);
    assert.deepEqual(saved.targets.old, otherState);
    records.push({ type: 'event_msg', payload: { type: 'task_complete', turn_id: 'current', last_agent_message: 'done' } });
    save();
    const launched = await runCycle(options);
    assert.equal(launched.length, 1);
    assert.equal(launched[0].outcome, 'launched');
    assert.deepEqual(launched[0].seqs, [wake.message.seq]);
    // The launch audit names the exact chat, so a verifier can match it to one
    // saved session rather than to a handle.
    const launchAudit = readFileSync(auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
      .find((entry) => entry.outcome === 'launched');
    assert.equal(launchAudit.sessionId, 'thread-test');
    const deadline = Date.now() + 3000;
    do {
      await new Promise((resolve) => setTimeout(resolve, 20));
      saved = JSON.parse(readFileSync(statePath, 'utf8'));
    } while (saved.targets.selected.pending && Date.now() < deadline);
    assert.equal(saved.targets.selected.pending, undefined);
    assert.equal(saved.targets.selected.outcome, 'child-completed');
    assert.ok(saved.targets.selected.cursor >= wake.message.seq);
    assert.deepEqual(saved.targets.old, otherState);
  } finally {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
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

// WF-G358: two live services could each resume the same chat from one wake,
// because per-target pending state only guards a single service. These checks
// pin the exclusive service lock that `run` holds for its lifetime.
test('acquireServiceLock: takes a free lock and refuses a live holder', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-lock-'));
  const lockPath = path.join(dir, 'watchdog-service.lock');
  try {
    const first = acquireServiceLock(lockPath, { pid: 1111, isAlive: () => true });
    assert.equal(first.ok, true);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, 1111);

    const second = acquireServiceLock(lockPath, { pid: 2222, isAlive: () => true });
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'held');
    assert.equal(second.holder.pid, 1111);
    // The refused service must not overwrite the live holder's record.
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, 1111);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acquireServiceLock: a dead holder refuses by default and needs an owned repair', () => {
  // Automatic replacement had an ABA race: two services that both judged one
  // holder stale could each delete the other's fresh lock. Only an explicit
  // repair that names the dead holder's token may remove it.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-lock-'));
  const lockPath = path.join(dir, 'watchdog-service.lock');
  const dead = { pid: 3333, token: 'dead-token', startedAt: '2026-10-22T00:00:00.000Z' };
  const isAlive = (pid) => pid !== 3333;
  try {
    writeFileSync(lockPath, `${JSON.stringify(dead)}\n`);
    const refused = acquireServiceLock(lockPath, { pid: 4444, isAlive });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'stale');
    assert.equal(refused.holder.token, 'dead-token');

    const wrongToken = acquireServiceLock(lockPath, { pid: 4444, isAlive, reclaimStaleToken: 'other-token' });
    assert.equal(wrongToken.ok, false);
    assert.equal(wrongToken.reason, 'stale');
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).token, 'dead-token');

    const repaired = acquireServiceLock(lockPath, { pid: 4444, isAlive, reclaimStaleToken: 'dead-token' });
    assert.equal(repaired.ok, true);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, 4444);

    // The repair token is single-use: it cannot remove the new live holder.
    const replay = acquireServiceLock(lockPath, { pid: 5555, isAlive: () => true, reclaimStaleToken: 'dead-token' });
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'held');
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, 4444);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acquireServiceLock: an unreadable lock file refuses instead of guessing stale', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-lock-'));
  const lockPath = path.join(dir, 'watchdog-service.lock');
  try {
    writeFileSync(lockPath, '{not json');
    const result = acquireServiceLock(lockPath, { pid: 5555, isAlive: () => false });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unreadable');
    assert.equal(readFileSync(lockPath, 'utf8'), '{not json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acquireServiceLock: a holder with no valid pid refuses instead of guessing stale', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-lock-'));
  const lockPath = path.join(dir, 'watchdog-service.lock');
  try {
    writeFileSync(lockPath, `${JSON.stringify({ token: 'orphan', startedAt: '2026-10-22T00:00:00.000Z' })}\n`);
    const result = acquireServiceLock(lockPath, { pid: 5656, isAlive: () => false });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown-holder');
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).token, 'orphan');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('releaseServiceLock: releases only its own lock, never a successor', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-lock-'));
  const lockPath = path.join(dir, 'watchdog-service.lock');
  try {
    const mine = acquireServiceLock(lockPath, { pid: 6666, isAlive: () => true });
    assert.equal(typeof mine.token, 'string');
    // A different pid, a reused pid with another token, or no token all fail.
    assert.equal(releaseServiceLock(lockPath, { pid: 7777, token: mine.token }), false);
    assert.equal(releaseServiceLock(lockPath, { pid: 6666, token: 'reused-pid-other-owner' }), false);
    assert.equal(releaseServiceLock(lockPath, { pid: 6666 }), false);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, 6666);
    assert.equal(releaseServiceLock(lockPath, { pid: 6666, token: mine.token }), true);
    assert.equal(acquireServiceLock(lockPath, { pid: 8888, isAlive: () => true }).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('processIsAlive: this process is alive and a non-positive pid is not', () => {
  assert.equal(processIsAlive(process.pid), true);
  assert.equal(processIsAlive(0), false);
  assert.equal(processIsAlive(-1), false);
});

test('one-shot completion re-arms dormancy after AWAKE, so the next peer wake launches once', async () => {
  // WF-G358: a one-shot child ends its harness turn when it exits. If AWAKE
  // already cleared pending and the model never posts DORMANT, the target must
  // still go dormant again, or the next peer message is consumed silently.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-oneshot-'));
  const app = createAgoraServer({ dir: path.join(tmpDir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const post = (route, body, token) => fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then((response) => response.json());
  try {
    const targetAgent = await post('/agents/register', { handle: 'orch.oneshot', role: 'orchestrator', sessionId: 'thread-oneshot', petSlug: 'gf-sd' });
    const human = await post('/agents/register', { handle: 'human.test', role: 'human', petSlug: 'dream-girl' });
    const registryPath = path.join(tmpDir, 'registry.json');
    const targetsPath = path.join(tmpDir, 'targets.json');
    const statePath = path.join(tmpDir, 'state.json');
    const auditPath = path.join(tmpDir, 'audit.jsonl');
    // The child stays alive long enough for AWAKE to arrive first, then exits 0.
    writeFileSync(registryPath, JSON.stringify({ wakeAdapters: { oneshot: {
      status: 'ready', command: process.execPath, args: ['-e', 'setTimeout(() => process.exit(0), 400)'],
      processNames: [], capabilities: { stop: 'child-process-exits-after-one-turn' },
    } } }));
    writeFileSync(targetsPath, JSON.stringify({ targets: [{
      handle: 'orch.oneshot', callsign: 'oneshot', agentId: targetAgent.agentId,
      adapter: 'oneshot', sessionId: 'thread-oneshot', cwd: tmpDir,
    }] }));
    writeFileSync(statePath, JSON.stringify({ version: 1, targets: { 'orch.oneshot': { cursor: 0, dormant: true, lastLaunchAt: 0 } } }));
    const options = { baseUrl, registryPath, targetsPath, statePath, auditPath,
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10, processList: '' };
    const readState = () => JSON.parse(readFileSync(statePath, 'utf8')).targets['orch.oneshot'];

    const firstWake = await post('/messages', { channel: 'command', body: 'first wake' }, human.token);
    const first = await runCycle(options);
    assert.equal(first[0].outcome, 'launched');
    assert.deepEqual(first[0].seqs, [firstWake.message.seq]);

    // The resumed turn answers AWAKE, which clears pending before the child exits.
    await post('/messages', { channel: 'command', body: `ONESHOT AWAKE seq ${firstWake.message.seq}` }, targetAgent.token);
    await runCycle(options);
    assert.equal(readState().pending, undefined);
    assert.equal(readState().dormant, false);

    // The child exits without any DORMANT line; the tool re-arms dormancy.
    const deadline = Date.now() + 3000;
    while (readState().dormant !== true && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(readState().dormant, true);
    assert.equal(readState().outcome, 'child-completed');

    // The next peer wake launches exactly once, with only the new sequence.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const secondWake = await post('/messages', { channel: 'command', body: 'second wake' }, human.token);
    const second = await runCycle(options);
    const launches = second.filter((result) => result.outcome === 'launched');
    assert.equal(launches.length, 1);
    assert.deepEqual(launches[0].seqs, [secondWake.message.seq]);
    assert.notEqual(launches[0].launchId, first[0].launchId);

    // Let the second child exit before cleanup: on Windows its working
    // directory stays busy while it runs. Its exit also re-arms dormancy.
    const exitDeadline = Date.now() + 3000;
    while (readState().pending && Date.now() < exitDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(readState().pending, undefined);
    assert.equal(readState().dormant, true);
  } finally {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});

// ============================================================================
// Native Desktop Queue Delivery (WF-G358)
// ============================================================================
// The desktop app owns its chat through a private app-server, so the only
// native wake is `codex queue`: it stores one item, and the owner runs the
// turn itself. These checks pin owner selection, the transcript proof, and the
// lifecycle: stored is not delivered, an unresolved send is never repeated,
// and only the owner's completed queue turn re-arms dormancy.
// ============================================================================

const OWNER_EXE = 'C:/apps/Codex/bin/abc/codex.exe';
const desktopTree = () => [
  { pid: 2020, parent: 1, name: 'ChatGPT.exe', cmd: 'ChatGPT.exe', exe: 'C:/Program Files/WindowsApps/OpenAI.Codex_1/app/ChatGPT.exe' },
  { pid: 20336, parent: 2020, name: 'codex.exe', cmd: `${OWNER_EXE} -c x=1 app-server --analytics-default-enabled`, exe: OWNER_EXE },
  { pid: 11748, parent: 2020, name: 'codex.exe', cmd: `${OWNER_EXE} exec-server --remote https://x`, exe: OWNER_EXE },
];

test('pickCodexAppOwner: only one desktop app-server child is an owner', () => {
  assert.deepEqual(pickCodexAppOwner(desktopTree()), {
    ok: true, ownerPid: 20336, ownerAppPid: 2020, ownerExecutable: OWNER_EXE,
  });
  // Two owners is ambiguous, never a guess.
  const two = [...desktopTree(), { pid: 30000, parent: 2020, name: 'codex.exe', cmd: `${OWNER_EXE} app-server`, exe: OWNER_EXE }];
  assert.equal(pickCodexAppOwner(two).ok, false);
  // A daemon, or an app-server that the desktop app did not start, is not an owner.
  const daemonOnly = [desktopTree()[0], { pid: 40000, parent: 2020, name: 'codex.exe', cmd: `${OWNER_EXE} app-server daemon start`, exe: OWNER_EXE }];
  assert.equal(pickCodexAppOwner(daemonOnly).ok, false);
  const foreign = [{ pid: 50000, parent: 7, name: 'codex.exe', cmd: `${OWNER_EXE} app-server`, exe: OWNER_EXE }, { pid: 7, parent: 1, name: 'node.exe', cmd: 'node', exe: 'node.exe' }];
  assert.equal(pickCodexAppOwner(foreign).ok, false);
  assert.equal(pickCodexAppOwner([]).ok, false);
});

// Transcript records in the shapes the real desktop session writes.
const started = (turnId, trigger, timestamp) => ({ type: 'event_msg', timestamp,
  payload: { type: 'task_started', turn_id: turnId, turn_attribution: { turn_id: turnId, turn_trigger: trigger } } });
const userText = (text, timestamp) => ({ type: 'response_item', timestamp,
  payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
const completed = (turnId, timestamp) => ({ type: 'event_msg', timestamp, payload: { type: 'task_complete', turn_id: turnId } });
const writeSession = (home, threadId, records) => {
  const dir = path.join(home, 'sessions', '2026', '10', '23');
  mkdirSync(dir, { recursive: true });
  const all = [{ type: 'session_meta', payload: { id: threadId, cli_version: 'test' } },
    { type: 'turn_context', payload: { turn_id: 'base', model: 'saved-model' } }, ...records];
  writeFileSync(path.join(dir, `rollout-x-${threadId}.jsonl`), `${all.map((r) => JSON.stringify(r)).join('\n')}\n`);
};

test('findQueuedTurn: only a completed queue-triggered turn with the exact markers proves delivery', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-queue-turn-'));
  try {
    const marker = '[seq 41 from peer-uuid]';
    writeSession(home, 'thread-a', [
      started('base', 'composer', 't0'), completed('base', 't1'),
      // A human prompt after the baseline, even one that quotes the marker, is not delivery.
      started('human', 'composer', 't2'), userText(`typed by hand ${marker}`, 't2'), completed('human', 't3'),
      started('woken', 'queue', 't4'), userText(`Agora wake for q. ${marker} nonce`, 't4'),
    ]);
    const open = findQueuedTurn('thread-a', { baselineTurnId: 'base', markers: [marker], codexHome: home });
    assert.equal(open.found, true);
    assert.equal(open.turnId, 'woken');
    assert.equal(open.trigger, 'queue');
    assert.equal(open.completed, false);
    assert.equal(open.markersMatched, true);

    writeSession(home, 'thread-a', [
      started('base', 'composer', 't0'), completed('base', 't1'),
      started('woken', 'queue', 't4'), userText('Agora wake for q. other request', 't4'), completed('woken', 't5'),
    ]);
    const wrongMarker = findQueuedTurn('thread-a', { baselineTurnId: 'base', markers: [marker], codexHome: home });
    assert.equal(wrongMarker.completed, true);
    assert.equal(wrongMarker.markersMatched, false);

    assert.equal(findQueuedTurn('thread-a', { baselineTurnId: 'missing', markers: [marker], codexHome: home }).found, false);
    assert.deepEqual(queueMarkers([{ seq: 41, from: 'peer-uuid' }]), [marker]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// One disposable daemon plus registry, target and session for each queue test.
async function queueHarness(queueScript) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-wd-native-'));
  const app = createAgoraServer({ dir: path.join(tmpDir, 'daemon') });
  await new Promise((resolve) => app.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const post = (route, body, token) => fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then((response) => response.json());
  const targetAgent = await post('/agents/register', { handle: 'orch.q', role: 'orchestrator', sessionId: 'thread-q', petSlug: 'gf-sd' });
  const human = await post('/agents/register', { handle: 'human.test', role: 'human', petSlug: 'dream-girl' });
  const paths = {
    registryPath: path.join(tmpDir, 'registry.json'), targetsPath: path.join(tmpDir, 'targets.json'),
    statePath: path.join(tmpDir, 'state.json'), auditPath: path.join(tmpDir, 'audit.jsonl'), logDir: path.join(tmpDir, 'logs'),
  };
  writeFileSync(paths.registryPath, JSON.stringify({ wakeAdapters: { 'codex-app-queue': {
    status: 'ready', command: '{ownerExecutable}', args: ['-e', queueScript], processNames: [],
    deliveryMode: 'native-queue', ownerResolver: 'codex-desktop-app-server', requiresIdleTranscript: true,
    capabilities: { stop: 'queued-turn-completes-in-owner' },
  } } }));
  writeFileSync(paths.targetsPath, JSON.stringify({ targets: [{
    handle: 'orch.q', callsign: 'q', agentId: targetAgent.agentId, adapter: 'codex-app-queue', sessionId: 'thread-q', cwd: tmpDir,
  }] }));
  writeFileSync(paths.statePath, JSON.stringify({ version: 1, targets: { 'orch.q': { cursor: 0, dormant: true, lastLaunchAt: 0 } } }));
  // The queue client is this test's node binary, standing in for the owner's executable.
  let owner = { ok: true, ownerPid: 20336, ownerAppPid: 2020, ownerExecutable: process.execPath };
  const options = { baseUrl, ...paths, cooldownMs: 10, processList: String(), codexHome: tmpDir,
    resolveOwner: () => owner };
  const readState = () => JSON.parse(readFileSync(paths.statePath, 'utf8')).targets['orch.q'];
  const audit = () => readFileSync(paths.auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const waitFor = async (check) => {
    const deadline = Date.now() + 3000;
    while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    return check();
  };
  return {
    tmpDir, app, post, targetAgent, human, options, readState, audit, waitFor,
    setOwner: (next) => { owner = next; },
    session: (records) => writeSession(tmpDir, 'thread-q', records),
    close: async () => { await app.close(); rmSync(tmpDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); },
  };
}

test('native queue: stored is not delivered, no requeue, and only the owner queue turn re-arms', async () => {
  const h = await queueHarness("console.log('Queued message q-1 for thread thread-q.')");
  try {
    h.session([started('base', 'composer', 't0'), completed('base', 't1')]);
    const wake = await h.post('/messages', { channel: 'command', body: 'first wake' }, h.human.token);
    const launched = await runCycle(h.options);
    assert.equal(launched[0].outcome, 'launched');
    assert.equal(launched[0].deliveryMode, 'native-queue');
    assert.equal(launched[0].ownerPid, 20336);
    assert.equal(launched[0].ownerAppPid, 2020);
    assert.equal(launched[0].ownerExecutable, process.execPath);
    assert.equal(launched[0].baselineTurnId, 'base');
    assert.ok(launched[0].launchId);

    // Exit 0 with the client's queued line is STORED only: still inflight, still dormant.
    assert.ok(await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued'));
    assert.equal(h.readState().inflight.queuedMessageId, 'q-1');
    assert.equal(h.readState().dormant, true);
    const queuedAudit = h.audit().find((entry) => entry.outcome === 'queued');
    assert.equal(queuedAudit.exitCode, 0);
    assert.equal(queuedAudit.queuedMessageId, 'q-1');
    assert.equal(queuedAudit.launchId, launched[0].launchId);

    // Even after the pending window is gone, an unresolved send is never queued again.
    const state = JSON.parse(readFileSync(h.options.statePath, 'utf8'));
    delete state.targets['orch.q'].pending;
    writeFileSync(h.options.statePath, JSON.stringify(state));
    const held = await runCycle(h.options);
    assert.equal(held[0].outcome, 'queue-inflight');
    assert.equal(h.audit().filter((entry) => entry.outcome === 'launched').length, 1);

    // AWAKE alone is acknowledgment, not completion: inflight stays.
    await h.post('/messages', { channel: 'command', body: `Q AWAKE seq ${wake.message.seq}` }, h.targetAgent.token);
    await runCycle(h.options);
    assert.ok(h.readState().inflight);

    // The owner's completed queue turn with the exact marker re-arms dormancy.
    const marker = queueMarkers([{ seq: wake.message.seq, from: h.human.agentId }])[0];
    h.session([started('base', 'composer', 't0'), completed('base', 't1'),
      started('woken', 'queue', 't2'), userText(`Agora wake for q. ${marker}`, 't2'), completed('woken', 't3')]);
    const done = await runCycle(h.options);
    assert.equal(done[0].outcome, 'app-turn-completed');
    assert.equal(done[0].turnId, 'woken');
    assert.equal(done[0].turnTrigger, 'queue');
    assert.equal(done[0].liveOwnerPid, 20336);
    assert.equal(done[0].launchId, launched[0].launchId);
    assert.equal(h.readState().dormant, true);
    assert.equal(h.readState().inflight, undefined);
    assert.equal(h.readState().pending, undefined);
    assert.ok(h.readState().cursor >= wake.message.seq);

    // The next peer wake queues once more, from the completed turn as its baseline.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await h.post('/messages', { channel: 'command', body: 'second wake' }, h.human.token);
    const again = await runCycle(h.options);
    const relaunch = again.find((entry) => entry.outcome === 'launched');
    assert.ok(relaunch);
    assert.equal(relaunch.baselineTurnId, 'woken');
    assert.notEqual(relaunch.launchId, launched[0].launchId);
    await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued');
  } finally {
    await h.close();
  }
});

test('native queue: the completion audit is stamped after the observed completion, not at cycle start', async () => {
  // Q3 clean pair 3 failed its strict check because the completion audit reused
  // the cycle-start clock: the turn completed during the cycle, so the audit
  // time came 472 ms BEFORE the transcript's own task_complete (Agora 8102).
  // Here the transcript completion is stamped after the cycle starts, and the
  // owner recheck takes long enough that only a fresh clock can pass.
  const h = await queueHarness("console.log('Queued message q-9 for thread thread-q.')");
  try {
    h.session([started('base', 'composer', 't0'), completed('base', 't1')]);
    const wake = await h.post('/messages', { channel: 'command', body: 'timed wake' }, h.human.token);
    await runCycle(h.options);
    assert.ok(await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued'));

    const cycleStart = Date.now();
    const turnCompletedAt = new Date(cycleStart + 40).toISOString();
    const marker = queueMarkers([{ seq: wake.message.seq, from: h.human.agentId }])[0];
    h.session([started('base', 'composer', 't0'), completed('base', 't1'),
      started('timed', 'queue', new Date(cycleStart).toISOString()),
      userText(`Agora wake for q. ${marker}`, new Date(cycleStart).toISOString()),
      completed('timed', turnCompletedAt)]);
    // A slow owner recheck stands in for the host process scan between the
    // cycle's first clock read and the completion audit.
    h.setOwner({ ok: true, ownerPid: 20336, ownerAppPid: 2020, ownerExecutable: process.execPath });
    const resolveOwner = h.options.resolveOwner;
    h.options.resolveOwner = () => {
      const until = Date.now() + 80;
      while (Date.now() < until) { /* busy wait: the recheck is synchronous */ }
      return resolveOwner();
    };
    const done = await runCycle(h.options);
    assert.equal(done[0].outcome, 'app-turn-completed');
    assert.equal(done[0].turnCompletedAt, turnCompletedAt);
    const entry = h.audit().find((record) => record.outcome === 'app-turn-completed');
    assert.ok(Date.parse(entry.at) >= Date.parse(turnCompletedAt),
      `audit ${entry.at} must not predate the observed completion ${turnCompletedAt}`);
    const queued = h.audit().find((record) => record.outcome === 'queued');
    assert.ok(Date.parse(entry.at) >= Date.parse(queued.at));
  } finally {
    await h.close();
  }
});

test('native queue: a human post during an inflight wake survives the AWAKE and gets its own launch (WF-G361)', async () => {
  // Live Q3 sequence on 2026-10-24: peer wake 8091 was queued, Remy posted 8094
  // while that turn ran, the target then posted AWAKE for 8091, and 8094 never
  // launched. The queued turn's input predates 8094, so only a later queue turn
  // can deliver it.
  const h = await queueHarness("console.log('Queued message q-7 for thread thread-q.')");
  try {
    h.session([started('base', 'composer', 't0'), completed('base', 't1')]);
    const first = await h.post('/messages', { channel: 'command', body: 'peer wake' }, h.human.token);
    const launched = await runCycle(h.options);
    assert.equal(launched[0].outcome, 'launched');
    assert.deepEqual(launched[0].seqs, [first.message.seq]);
    assert.ok(await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued'));

    const second = await h.post('/messages', { channel: 'command', body: 'human post during the inflight turn' }, h.human.token);
    await h.post('/messages', { channel: 'command', body: `Q AWAKE seq ${first.message.seq}` }, h.targetAgent.token);
    const held = await runCycle(h.options);
    // Held, never relaunched: inside the pending window the live service also
    // reported launch-pending [8091, 8094]; after it, queue-inflight.
    assert.ok(['launch-pending', 'queue-inflight'].includes(held[0].outcome), held[0].outcome);
    assert.ok(held[0].seqs.includes(second.message.seq), 'the AWAKE must not erase the later human wake');
    assert.equal(h.audit().filter((entry) => entry.outcome === 'launched').length, 1);

    const marker = queueMarkers([{ seq: first.message.seq, from: h.human.agentId }])[0];
    h.session([started('base', 'composer', 't0'), completed('base', 't1'),
      started('woken', 'queue', 't2'), userText(`Agora wake for q. ${marker}`, 't2'), completed('woken', 't3')]);
    const done = await runCycle(h.options);
    assert.equal(done[0].outcome, 'app-turn-completed');
    assert.deepEqual(done[0].seqs, [first.message.seq]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const next = await runCycle(h.options);
    const relaunch = next.find((entry) => entry.outcome === 'launched');
    assert.ok(relaunch, `expected a launch for ${second.message.seq}; got ${JSON.stringify(next)}`);
    assert.deepEqual(relaunch.seqs, [second.message.seq]);
    assert.equal(relaunch.baselineTurnId, 'woken');
    await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued');
  } finally {
    await h.close();
  }
});

test('planner: AWAKE still cancels a pending fallback wake for a non-native target', () => {
  // The native-queue rule above must not change the activation watchdog: there,
  // an explicit AWAKE remains delivery proof for the wake it answers.
  const agentsById = new Map([['human-1', { id: 'human-1', role: 'human' }], ['target-1', { id: 'target-1', status: 'online' }]]);
  const target = { handle: 'orch.t', callsign: 't', agentId: 'target-1' };
  const messages = [
    { seq: 11, from: 'human-1', to: 'all', body: 'wake please', createdAt: 1 },
    { seq: 12, from: 'target-1', to: 'all', body: 'T AWAKE seq 11', createdAt: 2 },
  ];
  const base = { messages, target, agentsById, targetState: { cursor: 10, dormant: true, lastLaunchAt: 0 }, now: 10, cooldownMs: 0 };
  const classic = planTargetMessages(base);
  assert.equal(classic.kind, 'active');
  assert.deepEqual(classic.wakes, []);
  const native = planTargetMessages({ ...base, nativeQueue: true });
  assert.notEqual(native.kind, 'active');
  assert.deepEqual(native.wakes.map((message) => message.seq), [11]);
});

test('planner: an anchored target ACK clears only the named seq; quotes, mentions and other senders clear nothing', () => {
  // Codex review (Agora 8144): a per-seq read acknowledgment may skip a wake,
  // but only from an anchored header owned by the target itself.
  const agentsById = new Map([['human-1', { id: 'human-1', role: 'human' }], ['peer-1', { id: 'peer-1', role: 'orchestrator' }],
    ['target-1', { id: 'target-1', status: 'online' }]]);
  const target = { handle: 'orch.t', callsign: 'codex-review', agentId: 'target-1' };
  const plan = (extra) => planTargetMessages({
    messages: [
      { seq: 11, from: 'human-1', to: 'all', body: 'first post', createdAt: 1 },
      { seq: 12, from: 'human-1', to: 'all', body: 'second post', createdAt: 2 },
      ...extra,
    ],
    target, agentsById, targetState: { cursor: 10, dormant: true, lastLaunchAt: 0 }, now: 10, cooldownMs: 0, nativeQueue: true,
  }).wakes.map((message) => message.seq);

  assert.deepEqual(anchoredAckSeqs('CODEX-REVIEW AWAKE; ACK seq8091 nonce x', target), [8091]);
  assert.deepEqual(anchoredAckSeqs('ACK 8094, 8095. Done.', target), [8094, 8095]);
  assert.deepEqual(anchoredAckSeqs('Status: ACK seq 8094 later', target), []);
  assert.deepEqual(anchoredAckSeqs('> ACK seq 8094', target), []);

  assert.deepEqual(plan([{ seq: 13, from: 'target-1', to: 'all', body: 'CODEX-REVIEW AWAKE; ACK seq 11 nonce n' }]), [12]);
  assert.deepEqual(plan([{ seq: 13, from: 'target-1', to: 'all', body: 'ACK 11 and 12' }]), []);
  assert.deepEqual(plan([{ seq: 13, from: 'target-1', to: 'all', body: 'I saw post 11 earlier; ACK seq 11 was quoted' }]), [11, 12]);
  assert.deepEqual(plan([{ seq: 13, from: 'target-1', to: 'all', body: '> ACK seq 11' }]), [11, 12]);
  assert.deepEqual(plan([{ seq: 13, from: 'peer-1', to: 'all', body: 'ACK seq 11' }]), [11, 12]);
});

test('planner: a native target with an inflight send plans as dormant even if a carried state says awake', () => {
  // The Q3 gap-work service started from state written by pre-WF-G361 code,
  // with dormant=false during the inflight 8130 turn, and skipped direct
  // message 8147 as if the target could still read it in that turn.
  const agentsById = new Map([['peer-1', { id: 'peer-1', role: 'orchestrator' }], ['target-1', { id: 'target-1', status: 'online' }]]);
  const target = { handle: 'orch.t', callsign: 't', agentId: 'target-1' };
  const base = {
    messages: [{ seq: 21, from: 'peer-1', to: 'target-1', body: 'next task', createdAt: 1 }],
    target, agentsById, now: 10, cooldownMs: 0,
    targetState: { cursor: 20, dormant: false, lastLaunchAt: 0, inflight: { seqs: [20], launchId: 'l-1' } },
  };
  assert.deepEqual(planTargetMessages({ ...base, nativeQueue: true }).wakes.map((message) => message.seq), [21]);
  // A classic target that is really awake still reads it in its own turn.
  assert.equal(planTargetMessages(base).kind, 'active');
});

test('native queue: a changed owner holds, and a composer turn never completes delivery', async () => {
  const h = await queueHarness("console.log('Queued message q-2 for thread thread-q.')");
  try {
    h.session([started('base', 'composer', 't0'), completed('base', 't1')]);
    const wake = await h.post('/messages', { channel: 'command', body: 'wake' }, h.human.token);
    await runCycle(h.options);
    await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queued');
    const marker = queueMarkers([{ seq: wake.message.seq, from: h.human.agentId }])[0];

    // A human prompt that carries the marker is not the owner's queue turn.
    h.session([started('base', 'composer', 't0'), completed('base', 't1'),
      started('typed', 'composer', 't2'), userText(`pasted ${marker}`, 't2'), completed('typed', 't3')]);
    await runCycle(h.options);
    assert.ok(h.readState().inflight);

    // The real queue turn completes, but the owner process changed: hold, no re-arm.
    h.session([started('base', 'composer', 't0'), completed('base', 't1'),
      started('woken', 'queue', 't2'), userText(`Agora wake for q. ${marker}`, 't2'), completed('woken', 't3')]);
    h.setOwner({ ok: true, ownerPid: 99999, ownerAppPid: 2020, ownerExecutable: process.execPath });
    const changed = await runCycle(h.options);
    assert.equal(changed[0].outcome, 'queue-owner-changed');
    assert.equal(changed[0].liveOwnerPid, 99999);
    assert.ok(h.readState().inflight);
    assert.equal(h.readState().outcome, 'queue-owner-changed');
    assert.equal(h.audit().filter((entry) => entry.outcome === 'launched').length, 1);
  } finally {
    await h.close();
  }
});

test('native queue: no owner means no send, and an unclear send is never repeated', async () => {
  const h = await queueHarness('process.exit(0)');
  try {
    h.session([started('base', 'composer', 't0'), completed('base', 't1')]);
    await h.post('/messages', { channel: 'command', body: 'wake' }, h.human.token);

    h.setOwner({ ok: false, reason: 'no desktop app-server owner' });
    const unavailable = await runCycle(h.options);
    assert.equal(unavailable[0].outcome, 'wake-unavailable');
    assert.equal(unavailable[0].ownerError, 'no desktop app-server owner');
    assert.equal(h.readState().inflight, undefined);

    // The client exits 0 but prints no queued line: indeterminate, held, not resent.
    h.setOwner({ ok: true, ownerPid: 20336, ownerAppPid: 2020, ownerExecutable: process.execPath });
    await h.post('/messages', { channel: 'command', body: 'wake again' }, h.human.token);
    const launched = await runCycle(h.options);
    assert.equal(launched[0].outcome, 'launched');
    assert.ok(await h.waitFor(() => h.readState().inflight?.queueOutcome === 'queue-indeterminate'));
    const state = JSON.parse(readFileSync(h.options.statePath, 'utf8'));
    delete state.targets['orch.q'].pending;
    writeFileSync(h.options.statePath, JSON.stringify(state));
    const held = await runCycle(h.options);
    assert.equal(held[0].outcome, 'queue-inflight');
    assert.equal(h.audit().filter((entry) => entry.outcome === 'launched').length, 1);
  } finally {
    await h.close();
  }
});
