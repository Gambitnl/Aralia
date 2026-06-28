// Tests for the Agora → cockpit activity bridge formatter + live mirror.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { formatActivityNote, attachActivityMirror } from './activityMirror.mjs';
import { createStore } from './store.mjs';

const handles = { a1: 'alice', a2: 'bob' };
const tasks = { t1: { id: 't1', title: 'wire economy panel' } };
const resolvers = {
  handleFor: (id) => handles[id],
  taskFor: (id) => tasks[id] || null,
};

test('agent.touch (heartbeat) is skipped', () => {
  assert.equal(
    formatActivityNote({ type: 'agent.touch', payload: { agentId: 'a1' }, ts: 1, seq: 2 }, resolvers),
    null,
  );
});

test('unknown event types are skipped', () => {
  assert.equal(formatActivityNote({ type: 'whatever', payload: {}, ts: 1, seq: 2 }), null);
});

test('agent.register → joined note with handle + note as detail', () => {
  const n = formatActivityNote(
    { type: 'agent.register', ts: 100, seq: 1, payload: { agent: { id: 'a1', handle: 'alice', note: 'refactor lane' } } },
    resolvers,
  );
  assert.equal(n.kind, 'note');
  assert.equal(n.agent, 'agora');
  assert.equal(n.at, 100);
  assert.match(n.title, /alice joined/);
  assert.equal(n.detail, 'refactor lane');
  assert.equal(n.eventType, 'agent.register');
});

test('lock.acquire resolves holder handle + tokens + reason', () => {
  const n = formatActivityNote(
    { type: 'lock.acquire', ts: 5, seq: 3, payload: { lock: { agentId: 'a1', paths: ['src/foo.ts'], globs: [], reason: 'refactor' } } },
    resolvers,
  );
  assert.match(n.title, /alice locked src\/foo\.ts/);
  assert.equal(n.detail, 'refactor');
});

test('lock.acquire summarizes many tokens', () => {
  const n = formatActivityNote(
    { type: 'lock.acquire', ts: 5, seq: 3, payload: { lock: { agentId: 'a2', paths: ['a', 'b', 'c', 'd'], globs: [] } } },
    resolvers,
  );
  assert.match(n.title, /bob locked a, b \+2 more/);
});

test('task.claim looks up title via taskFor', () => {
  const n = formatActivityNote(
    { type: 'task.claim', ts: 9, seq: 4, payload: { taskId: 't1', agentId: 'a2' } },
    resolvers,
  );
  assert.match(n.title, /bob claimed: wire economy panel/);
});

test('task.state carries the new state', () => {
  const n = formatActivityNote(
    { type: 'task.state', ts: 9, seq: 5, payload: { taskId: 't1', agentId: 'a1', state: 'in_progress' } },
    resolvers,
  );
  assert.match(n.title, /"wire economy panel" → in_progress/);
});

test('message.post broadcast vs direct routing in the title', () => {
  const bc = formatActivityNote(
    { type: 'message.post', ts: 1, seq: 6, payload: { message: { from: 'a1', to: 'all', body: 'hi' } } },
    resolvers,
  );
  assert.match(bc.title, /alice → all/);
  assert.equal(bc.detail, 'hi');
  const dm = formatActivityNote(
    { type: 'message.post', ts: 1, seq: 7, payload: { message: { from: 'a1', to: 'a2', body: 'psst' } } },
    resolvers,
  );
  assert.match(dm.title, /alice → @bob/);
});

test('unknown ids fall back to a short id slice, never throw', () => {
  const n = formatActivityNote(
    { type: 'lock.acquire', ts: 1, seq: 8, payload: { lock: { agentId: 'deadbeef-1234-5678', paths: ['x'], globs: [] } } },
    {},
  );
  assert.match(n.title, /deadbeef locked x/);
});

test('attachActivityMirror writes real notes to the feed file as a live store mutates', () => {
  const dir = path.join(os.tmpdir(), 'agora-mirror-' + crypto.randomUUID());
  const feed = path.join(dir, 'activity.jsonl');
  const store = createStore({ dir: path.join(dir, 'state') });
  const detach = attachActivityMirror({ store, file: feed });

  const alice = store.registerAgent({ handle: 'alice', note: '' });
  store.touch(alice.id); // heartbeat — must NOT appear in the feed
  store.acquireLock({ agentId: alice.id, paths: ['src/foo.ts'], reason: 'refactor' });
  const task = store.createTask({ agentId: alice.id, title: 'demo task' });
  store.claimTask({ taskId: task.id, agentId: alice.id });
  store.postMessage({ agentId: alice.id, to: 'all', body: 'hello fleet' });

  detach();
  store.close();

  const lines = fs.readFileSync(feed, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const types = lines.map((l) => l.eventType);
  assert.ok(types.includes('agent.register'));
  assert.ok(types.includes('lock.acquire'));
  assert.ok(types.includes('task.create'));
  assert.ok(types.includes('task.claim'));
  assert.ok(types.includes('message.post'));
  assert.ok(!types.includes('agent.touch'), 'heartbeat must be filtered out');
  // every line is in cockpit shape
  for (const l of lines) {
    assert.equal(l.kind, 'note');
    assert.equal(l.agent, 'agora');
    assert.equal(typeof l.at, 'number');
    assert.equal(typeof l.title, 'string');
  }
  // detach stops further writes
  const before = fs.readFileSync(feed, 'utf8');
  store.registerAgent({ handle: 'late', note: '' });
  assert.equal(fs.readFileSync(feed, 'utf8'), before, 'no writes after detach');

  fs.rmSync(dir, { recursive: true, force: true });
});
