import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isTransientWriteError, writeFileWithRetry } from './writeWithRetry.mjs';

test('WF-G235/WF-G301: retries UNKNOWN -4094, then writes the complete content', async () => {
  const busy = Object.assign(new Error('temporary sharing violation'), { code: 'UNKNOWN', errno: -4094 });
  const calls = [];
  const waits = [];
  const attempts = await writeFileWithRetry('owned.ts', 'complete replacement', {
    attempts: 3,
    delayMs: 7,
    writeFile: async (file, content) => {
      calls.push([file, content]);
      if (calls.length < 3) throw busy;
    },
    wait: async (ms) => { waits.push(ms); },
  });
  assert.equal(attempts, 3);
  assert.deepEqual(calls, Array(3).fill(null).map(() => ['owned.ts', 'complete replacement']));
  assert.deepEqual(waits, [7, 7]);
});

test('WF-G235/WF-G301: EBUSY retries, other UNKNOWN and permission errors do not', async () => {
  assert.equal(isTransientWriteError({ code: 'EBUSY' }), true);
  assert.equal(isTransientWriteError({ code: 'UNKNOWN', errno: -4094 }), true);
  assert.equal(isTransientWriteError({ code: 'UNKNOWN', errno: -1 }), false);
  assert.equal(isTransientWriteError({ code: 'EACCES' }), false);
  let calls = 0;
  const denied = Object.assign(new Error('not allowed'), { code: 'EACCES' });
  await assert.rejects(writeFileWithRetry('owned.ts', 'content', {
    writeFile: async () => { calls++; throw denied; },
    wait: async () => { throw new Error('must not wait'); },
  }), (error) => error === denied);
  assert.equal(calls, 1);
});

test('WF-G235/WF-G301: bounded retry gives back the original error at exhaustion', async () => {
  const busy = Object.assign(new Error('still busy'), { code: 'EBUSY' });
  let calls = 0;
  await assert.rejects(writeFileWithRetry('owned.ts', 'content', {
    attempts: 3,
    delayMs: 0,
    writeFile: async () => { calls++; throw busy; },
    wait: async () => {},
  }), (error) => error === busy);
  assert.equal(calls, 3);
  await assert.rejects(writeFileWithRetry('owned.ts', 'content', { attempts: 0 }), RangeError);
});

test('WF-G235/WF-G301: the default writer writes a real file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'write-retry-'));
  try {
    const target = path.join(root, 'owned.ts');
    assert.equal(await writeFileWithRetry(target, Buffer.from('complete\n')), 1);
    assert.equal(fs.readFileSync(target, 'utf8'), 'complete\n');
  } finally {
    if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
  }
});
