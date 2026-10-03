/** Real disposable histories prove common-base merging and preservation of local state. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gitCommand, mergeConflicts, conflictComment, runScout } from './scout.mjs';

function history(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-scout-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = args => gitCommand(args, cwd);
  git(['init', '-b', 'master']); git(['config', 'user.name', 'Scout fixture']); git(['config', 'user.email', 'scout@example.invalid']);
  const write = (name, contents) => fs.writeFileSync(path.join(cwd, name), contents);
  const commit = () => { git(['add', '-A']); git(['commit', '-m', 'fixture']); return git(['rev-parse', 'HEAD']).stdout.trim(); };
  return { cwd, git, write, commit };
}

test('shifted branch coordinates do not create a false conflict or alter staging', t => {
  const f = history(t); f.write('source.txt', 'a\nb\nc\nd\ne\nf\ng\nh\n'); const base = f.commit();
  f.git(['checkout', '-b', 'left']); f.write('source.txt', 'inserted\na\nb\nc\nd\ne\nf\ng\nh\n'); const left = f.commit();
  f.git(['checkout', '-b', 'right', base]); f.write('source.txt', 'a\nb\nc\nd\ne\nf\ng\nchanged\n'); const right = f.commit();
  f.write('pending.txt', 'preserve me'); f.git(['add', 'pending.txt']);
  const before = fs.readFileSync(path.join(f.cwd, '.git/index'));
  assert.deepEqual(mergeConflicts(left, right, f.git), { conflicted: false, files: [] });
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git/index')), before);
  assert.equal(fs.readFileSync(path.join(f.cwd, 'pending.txt'), 'utf8'), 'preserve me');
});

test('conflicts beyond the first hundred files and insertion conflicts are retained', t => {
  const f = history(t);
  for (let i = 0; i < 151; i++) f.write(`file-${String(i).padStart(3, '0')}.txt`, 'base\n');
  const base = f.commit(); f.git(['checkout', '-b', 'left']);
  for (let i = 0; i < 151; i++) f.write(`file-${String(i).padStart(3, '0')}.txt`, 'left\nbase\n');
  const left = f.commit(); f.git(['checkout', '-b', 'right', base]); f.write('file-150.txt', 'right\nbase\n'); const right = f.commit();
  assert.deepEqual(mergeConflicts(left, right, f.git), { conflicted: true, files: ['file-150.txt'] });
});

test('comments retain both implementations and explain clean resolutions', () => {
  const left = { number: 1, head: { sha: 'a'.repeat(40) } }, right = { number: 2, head: { sha: 'b'.repeat(40) } };
  const body = conflictComment(left, right, { conflicted: true, files: ['a.ts'] });
  assert.match(body, /Preserve useful work on both sides/);
  assert.doesNotMatch(body, /git checkout|keeper|yielder/);
  assert.match(conflictComment(left, right, { conflicted: false, files: [] }), /no longer reproduces/);
});

test('all PR and comment pages are read, and bot comments are updated once', async () => {
  const prs = [{ number: 1, head: { sha: 'a'.repeat(40) } }, { number: 101, head: { sha: 'b'.repeat(40) } }];
  const calls = [], updates = [];
  const github = { rest: { pulls: { list: 'pulls' }, issues: { listComments: 'comments', updateComment: async value => updates.push(value), createComment: async () => assert.fail('must update the existing bot comment') } }, paginate: async (method, args) => { calls.push([method, args]); return method === 'pulls' ? prs : [{ id: 120, user: { login: 'github-actions[bot]', type: 'Bot' }, body: '<!-- aralia-scout:1:101 --> old' }]; } };
  const git = args => args[0] === 'rev-parse' ? { status: 0, stdout: args[1].endsWith('/101') ? prs[1].head.sha : prs[0].head.sha } : args[0] === 'merge-tree' ? { status: 1, stdout: 'c'.repeat(40) + '\0late.ts\0' } : { status: 0, stdout: '' };
  const result = await runScout({ github, context: { repo: { owner: 'fixture', repo: 'fixture' } }, git });
  assert.equal(result.conflicts, 1); assert.equal(updates.length, 1);
  assert.deepEqual(calls.map(([method]) => method), ['pulls', 'comments']);
  assert.equal(calls[1][1].per_page, 100);
});
