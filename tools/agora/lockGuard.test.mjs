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
