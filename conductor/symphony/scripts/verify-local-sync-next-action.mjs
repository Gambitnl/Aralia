import assert from 'node:assert/strict';
import { buildLocalSyncNextAction } from '../dist/task-intake.js';

// This verifier protects the Jules return path. After GitHub merges a Jules PR,
// Symphony must only mutate local master when the checkout is on the right
// branch, clean, not ahead, and able to fast-forward. Every blocked condition
// should produce one readable next action for the dashboard and foreman worker.

const base = {
  prMerged: true,
  safeToPull: false,
  upToDate: false,
  currentBranch: 'master',
  baseBranch: 'master',
  dirtyFiles: 0,
  untrackedFiles: 0,
  ahead: 0,
  behind: 0,
  pullCommand: 'git pull --ff-only origin master',
};

assert.deepEqual(
  buildLocalSyncNextAction({
    ...base,
    prMerged: false,
  }),
  {
    code: 'wait_for_pr_merge',
    tone: 'waiting',
    label: 'Wait for PR Merge',
    command: null,
    summary: 'The Jules PR is not marked merged yet, so local master must not pull it.',
    steps: [
      'Refresh PR checks until GitHub reports the Jules PR as merged.',
      'Do not run local sync before the merge is confirmed.',
      'Re-run Check Local Sync after merge.',
    ],
  },
);

const dirtyAction = buildLocalSyncNextAction({
  ...base,
  dirtyFiles: 1,
});

assert.equal(dirtyAction.code, 'review_local_changes');
assert.equal(dirtyAction.tone, 'blocked');
assert.equal(dirtyAction.command, null);

const aheadAction = buildLocalSyncNextAction({
  ...base,
  ahead: 2,
});

assert.equal(aheadAction.code, 'handle_local_commits');
assert.equal(aheadAction.tone, 'blocked');

const safeAction = buildLocalSyncNextAction({
  ...base,
  safeToPull: true,
  behind: 1,
});

assert.equal(safeAction.code, 'sync_local_master');
assert.equal(safeAction.tone, 'ready');
assert.equal(safeAction.command, 'git pull --ff-only origin master');

const currentAction = buildLocalSyncNextAction({
  ...base,
  upToDate: true,
});

assert.equal(currentAction.code, 'local_master_current');
assert.equal(currentAction.tone, 'ready');
assert.equal(currentAction.command, null);

const unknownAction = buildLocalSyncNextAction(base);

assert.equal(unknownAction.code, 'inspect_local_sync');
assert.equal(unknownAction.tone, 'blocked');

