// Tests for the destructive-git guard (Claude Code PreToolUse hook).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './guardGit.mjs';

const blocked = (cmd) => decide(cmd).deny === true;

test('guard blocks the clobber commands', () => {
  assert.ok(blocked('git reset --hard'));
  assert.ok(blocked('git reset --hard HEAD~1'));
  assert.ok(blocked('git reset --merge'));
  assert.ok(blocked('git checkout master'));
  assert.ok(blocked('git checkout -- src/foo.ts'));
  assert.ok(blocked('git checkout -b feature'));
  assert.ok(blocked('git switch other-branch'));
  assert.ok(blocked('git restore src/foo.ts'));
  assert.ok(blocked('git clean -fd'));
  assert.ok(blocked('git stash'));
  assert.ok(blocked('git stash pop'));
});

test('guard blocks them inside compound commands', () => {
  assert.ok(blocked('cd /f/Repos/Aralia && git reset --hard && npm test'));
  assert.ok(blocked('git fetch; git checkout origin/master'));
  assert.ok(blocked('cd x && git -C /f/Repos/Aralia reset --hard'));
});

test('guard allows safe git and non-git commands', () => {
  assert.ok(!blocked('git status'));
  assert.ok(!blocked('git diff HEAD'));
  assert.ok(!blocked('git add -A && git commit -m "x"'));
  assert.ok(!blocked('git reset HEAD~1'));        // soft/mixed reset keeps the worktree
  assert.ok(!blocked('git reset --soft HEAD~1'));
  assert.ok(!blocked('git log --oneline'));
  assert.ok(!blocked('npm test'));
  assert.ok(!blocked('node tools/agora/client.mjs say "done"'));
});

test('guard honors the explicit human-authorized override', () => {
  assert.ok(!blocked('GIT_GUARD_ALLOW=1 git reset --hard'));
  const d = decide('git reset --hard');
  assert.match(d.reason, /GIT_GUARD_ALLOW=1/); // the deny explains the escape hatch
  assert.match(d.reason, /Agora/i);            // and points at coordination
});
