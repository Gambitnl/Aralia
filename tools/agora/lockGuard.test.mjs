import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkAgoraLock } from './lockGuard.mjs';

const fetchWith = (locks) => async () => ({ json: async () => ({ locks }) });
const lock = (over = {}) => ({
  id: 'lock-1', paths: ['public/planmap/topics.json'], globs: [],
  agentId: 'agent-other', reason: 'test lock', ...over,
});

const identityEnv = (agentId) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-id-'));
  fs.writeFileSync(path.join(dir, 'client-identity.json'), JSON.stringify({ agentId }));
  return { AGORA_DIR: dir };
};

// PM-G1: client.mjs writes the identity keyed by daemon URL, not flat.
const keyedIdentityEnv = (agentId, agentKey, base = 'http://localhost:4319') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-id-'));
  const name = agentKey ? `client-identity.${agentKey}.json` : 'client-identity.json';
  fs.writeFileSync(path.join(dir, name), JSON.stringify({ [base]: { agentId, handle: agentKey || 'me', token: 't' } }));
  return { AGORA_DIR: dir, ...(agentKey ? { AGORA_AGENT_ID: agentKey } : {}) };
};

test('PM-G1: lock held by my URL-keyed identity (the shape client.mjs writes) is writable', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock({ agentId: 'agent-me' })]), env: keyedIdentityEnv('agent-me', 'orch-x'),
  });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'held-by-me');
});

test('PM-G1: URL-keyed identity is read from the AGORA_URL entry when several daemons are stored', async () => {
  const env = keyedIdentityEnv('agent-me', 'orch-y', 'http://localhost:9999');
  const file = path.join(env.AGORA_DIR, 'client-identity.orch-y.json');
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  all['http://localhost:4319'] = { agentId: 'agent-other-daemon', handle: 'x', token: 't' };
  fs.writeFileSync(file, JSON.stringify(all));
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock({ agentId: 'agent-me' })]), env: { ...env, AGORA_URL: 'http://localhost:9999' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'held-by-me');
});

test('unlocked file is writable', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', { fetchImpl: fetchWith([]), env: {} });
  assert.deepEqual(r, { ok: true, reason: 'unlocked' });
});

test('lock held by another agent refuses, naming the holder', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock()]), env: identityEnv('agent-me'),
  });
  assert.equal(r.ok, false);
  assert.equal(r.holderAgentId, 'agent-other');
  assert.equal(r.lockReason, 'test lock');
});

test('lock held by my stored identity is writable', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock({ agentId: 'agent-me' })]), env: identityEnv('agent-me'),
  });
  assert.deepEqual(r, { ok: true, reason: 'held-by-me' });
});

test('backslash and ./ path spellings still match the lock', async () => {
  const r = await checkAgoraLock('.\\public\\planmap\\topics.json', {
    fetchImpl: fetchWith([lock()]), env: {},
  });
  assert.equal(r.ok, false);
});

test('glob locks cover the file', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock({ paths: [], globs: ['public/planmap/*'] })]), env: {},
  });
  assert.equal(r.ok, false);
});

test('daemon unreachable proceeds (advisory system offline)', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); }, env: {},
  });
  assert.deepEqual(r, { ok: true, reason: 'daemon-unreachable' });
});

test('AGORA_HELD_LOCK matching the covering lock id is writable (abbdc943)', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock()]), env: { AGORA_HELD_LOCK: 'lock-1' },
  });
  assert.deepEqual(r, { ok: true, reason: 'held-lock-id' });
});

test('AGORA_HELD_LOCK with a WRONG id still refuses', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock()]), env: { AGORA_HELD_LOCK: 'lock-999', ...identityEnv('agent-me') },
  });
  assert.equal(r.ok, false);
  assert.equal(r.holderAgentId, 'agent-other');
});

test('refusal reports which identity the guard read (missed-prefix debugging)', async () => {
  const r = await checkAgoraLock('public/planmap/topics.json', {
    fetchImpl: fetchWith([lock()]), env: identityEnv('agent-me'),
  });
  assert.equal(r.identityRead, 'agent-me');
});
