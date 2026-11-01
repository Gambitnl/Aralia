import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  isTransientWriteError,
  writeFilesWithRetry,
  writeFileWithRetry,
} from './writeWithRetry.mjs';

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

test('WF-G329: writeFilesWithRetry writes a multi-file batch and rolls back earlier files if a later write fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'write-batch-retry-'));
  try {
    const fileA = path.join(root, 'a.ts');
    const fileB = path.join(root, 'b.ts');
    const fileC = path.join(root, 'c.ts');
    fs.writeFileSync(fileA, 'original-a\n', 'utf8');

    const busy = Object.assign(new Error('watcher handle'), { code: 'UNKNOWN', errno: -4094 });
    await assert.rejects(
      writeFilesWithRetry(
        [
          [fileA, 'updated-a\n'],
          [fileB, 'created-b\n'],
          [fileC, 'unreached-c\n'],
        ],
        {
          attempts: 2,
          delayMs: 0,
          writeFile: async (target, content) => {
            if (target === fileC) throw busy;
            fs.writeFileSync(target, content);
          },
          wait: async () => {},
        },
      ),
      (error) => error === busy,
    );

    // Both fileA (existing) and fileB (newly created) must be rolled back so
    // the checkout is never left half-patched.
    assert.equal(fs.readFileSync(fileA, 'utf8'), 'original-a\n');
    assert.equal(fs.existsSync(fileB), false);
    assert.equal(fs.existsSync(fileC), false);

    // When a transient error clears within the retry budget, the entire batch lands.
    let cCalls = 0;
    const result = await writeFilesWithRetry(
      [
        [fileA, 'updated-a\n'],
        [fileB, 'created-b\n'],
        [fileC, 'created-c\n'],
      ],
      {
        attempts: 3,
        delayMs: 0,
        writeFile: async (target, content) => {
          if (target === fileC && ++cCalls < 2) throw busy;
          fs.writeFileSync(target, content);
        },
        wait: async () => {},
      },
    );
    assert.equal(result.totalAttempts, 4);
    assert.equal(result.attemptsByFile[fileC], 2);
    assert.equal(fs.readFileSync(fileA, 'utf8'), 'updated-a\n');
    assert.equal(fs.readFileSync(fileB, 'utf8'), 'created-b\n');
    assert.equal(fs.readFileSync(fileC, 'utf8'), 'created-c\n');
  } finally {
    if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF-G329: Python write_with_retry.py selftest covers Errno 22 recovery, non-transient rejection, and batch rollback', () => {
  const scriptPath = path.resolve(import.meta.dirname, 'write_with_retry.py');
  const output = execFileSync('python', [scriptPath, '--selftest'], { encoding: 'utf8' });
  assert.match(output, /write_with_retry\.py selftest passed/);
});
