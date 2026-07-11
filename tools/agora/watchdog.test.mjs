import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';

import {
  buildWakePrompt,
  expandTemplate,
  failureBackoffMs,
  isWakeWorthy,
  lifecycleSignal,
  planTargetMessages,
  readSessionCliVersion,
  runCycle,
  selectCompatibleCodex,
} from './watchdog.mjs';

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

test('one-shot Codex adapter selects the engine version stored in session metadata', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agora-watchdog-session-'));
  try {
    const sessions = path.join(tmpDir, 'sessions', '2026', '07', '10');
    mkdirSync(sessions, { recursive: true });
    writeFileSync(path.join(sessions, 'rollout-test-thread-1.jsonl'), `${JSON.stringify({
      type: 'session_meta', payload: { cli_version: '0.144.0-alpha.4' },
    })}\n${JSON.stringify({ type: 'turn_context' })}\n`);
    assert.equal(readSessionCliVersion('thread-1', tmpDir).version, '0.144.0-alpha.4');
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
  assert.equal(codexApp.capabilities.resume, 'app-owned-thread');
  assert.equal(codexApp.status, 'paused');
  assert.equal(claudeDesktop.capabilities.resume, 'native-watcher-only');
  assert.equal(claudeDesktop.status, 'paused');
  assert.equal(claude.desktopInjection, 'wake-unavailable');
  assert.equal(codex.capabilities.stop, 'wake-unavailable');
});

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
      method: 'POST', body: { handle: 'orch.test', role: 'orchestrator' },
    });
    const human = await request('/agents/register', {
      method: 'POST', body: { handle: 'human.test', role: 'human' },
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
      logDir: path.join(tmpDir, 'logs'), cooldownMs: 10,
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
