// Tests for the destructive-git guard (Claude Code PreToolUse hook).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decide } from './guardGit.mjs';

const mkLocks = (locks) => async () => ({
  json: async () => ({ locks }),
});

const blocked = async (cmd, opts = {}) => (await decide(cmd, opts)).deny === true;
const allowed = async (cmd, opts = {}) => (await decide(cmd, opts)).deny === false;

const defaultOpts = {
  baseUrl: 'http://localhost:4319',
  fetchImpl: mkLocks([]),
  env: {},
};

const identityEnv = (agentId) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-guard-id-'));
  fs.writeFileSync(
    path.join(dir, 'client-identity.json'),
    JSON.stringify({
      'http://localhost:4319': { agentId },
    }),
  );
  return { AGORA_DIR: dir };
};

const lockFor = (filePath, agentId = 'agent-me') => ({
  id: `lock-${filePath.replace(/[^A-Za-z0-9_-]/g, '-')}`,
  paths: [filePath],
  globs: [],
  agentId,
  reason: `owned by ${agentId}`,
});

test('guard blocks the clobber commands', async () => {
  assert.ok(await blocked('git reset --hard', defaultOpts));
  assert.ok(await blocked('git reset --hard HEAD~1', defaultOpts));
  assert.ok(await blocked('git reset --merge', defaultOpts));
  assert.ok(await blocked('git checkout master', defaultOpts));
  assert.ok(await blocked('git checkout -- src/foo.ts', defaultOpts));
  assert.ok(await blocked('git checkout -b feature', defaultOpts));
  assert.ok(await blocked('git switch other-branch', defaultOpts));
  assert.ok(await blocked('git restore src/foo.ts', defaultOpts));
  assert.ok(await blocked('git clean -fd', defaultOpts));
  assert.ok(await blocked('git stash', defaultOpts));
  assert.ok(await blocked('git stash pop', defaultOpts));
});

test('guard blocks them inside compound commands', async () => {
  assert.ok(await blocked('cd /f/Repos/Aralia && git reset --hard && npm test', defaultOpts));
  assert.ok(await blocked('git fetch; git checkout origin/master', defaultOpts));
  assert.ok(await blocked('cd x && git -C /f/Repos/Aralia reset --hard', defaultOpts));
});

test('guard ignores git words in non-git payloads', async () => {
  assert.ok(await allowed('echo "git reset --hard should not block"', defaultOpts));
  assert.ok(await allowed('node -e "console.log(\\"git checkout -- src/foo\\")"', defaultOpts));
  assert.ok(await allowed('printf foo && git status', defaultOpts));
});

test('guard allows safe git and non-git commands', async () => {
  assert.ok(await allowed('git status', defaultOpts));
  assert.ok(await allowed('git diff HEAD', defaultOpts));
  assert.ok(await allowed('git add -A && git commit -m "x"', defaultOpts));
  assert.ok(await allowed('git reset HEAD~1', defaultOpts)); // soft/mixed reset keeps the worktree
  assert.ok(await allowed('git reset --soft HEAD~1', defaultOpts));
  assert.ok(await allowed('git log --oneline', defaultOpts));
  assert.ok(await allowed('npm test', defaultOpts));
  assert.ok(await allowed('node tools/agora/client.mjs say "done"', defaultOpts));
});

test('guard honors the explicit human-authorized override', async () => {
  assert.ok(await allowed('GIT_GUARD_ALLOW=1 git reset --hard', defaultOpts));
});

test('restore permits only self-owned exact targets', async () => {
  const selfLock = [lockFor('tools/agora/guardGit.mjs', 'agent-me')];
  const foreignLock = [lockFor('tools/agora/guardGit.mjs', 'agent-other')];
  const selfEnv = identityEnv('agent-me');

  assert.ok(await allowed('git restore tools/agora/guardGit.mjs', {
    baseUrl: 'http://localhost:4319',
    fetchImpl: mkLocks(selfLock),
    env: selfEnv,
  }));
  assert.ok(await blocked('git restore tools/agora/guardGit.mjs', {
    baseUrl: 'http://localhost:4319',
    fetchImpl: mkLocks(foreignLock),
    env: selfEnv,
  }));
  assert.ok(await blocked('git restore tools/agora/guardGit.mjs', {
    baseUrl: 'http://localhost:4319',
    fetchImpl: mkLocks([]),
    env: selfEnv,
  }));
  const mixed = [
    lockFor('tools/agora/guardGit.test.mjs', 'agent-me'),
    lockFor('tools/agora/server.test.mjs', 'agent-other'),
  ];
  assert.ok(await blocked('git restore tools/agora/guardGit.mjs tools/agora/server.test.mjs', {
    baseUrl: 'http://localhost:4319',
    fetchImpl: mkLocks(mixed),
    env: selfEnv,
  }));
});
