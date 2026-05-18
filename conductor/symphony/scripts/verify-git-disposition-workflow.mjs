import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the non-mutating Git disposition workflow.
//
// The real Aralia checkout can contain user-owned tracked edits, untracked
// artifacts, local-only commits, and remote-only commits at the same time.
// Symphony must let the operator record intent for those categories without
// stashing, deleting, pulling, pushing, or pretending the hard Git preflight
// has passed.

const root = await mkdtemp(join(tmpdir(), 'symphony-git-disposition-'));

try {
  const store = new TaskIntakeStore({
    repoRoot: root,
    storePath: join(root, 'task-drafts.json'),
  });

  const initial = await store.snapshot();
  assert.equal(initial.gitDisposition.summary, 'No Git disposition decisions recorded yet.');
  assert.equal(initial.gitDisposition.readyForHumanSync, false);
  assert.equal(initial.gitDisposition.categories.length, 4);
  assert.deepEqual(
    initial.gitDisposition.categories.map(category => category.category),
    ['local_commits', 'tracked_changes', 'untracked_artifacts', 'remote_commits'],
  );

  const afterTracked = await store.recordGitDisposition({
    category: 'tracked_changes',
    decision: 'commit_for_jules_base',
    note: 'Armor icon wiring should be reviewed and committed with its SVG assets before Jules starts.',
  });

  const tracked = afterTracked.gitDisposition.categories.find(category => category.category === 'tracked_changes');
  assert.equal(tracked.decision, 'commit_for_jules_base');
  assert.equal(tracked.note, 'Armor icon wiring should be reviewed and committed with its SVG assets before Jules starts.');
  assert.equal(afterTracked.gitDisposition.readyForHumanSync, false);
  assert.match(afterTracked.preflight.summary, /Blocked:/);

  await store.recordGitDisposition({
    category: 'local_commits',
    decision: 'commit_for_jules_base',
    note: 'Existing encounter-generator commit should remain part of the base if this is the intended Jules starting point.',
  });
  await store.recordGitDisposition({
    category: 'untracked_artifacts',
    decision: 'needs_review',
    note: 'Separate source artifacts from generated proof before committing or ignoring anything.',
  });
  const reviewStillBlocked = await store.snapshot();
  assert.equal(reviewStillBlocked.gitDisposition.readyForHumanSync, false);

  await store.recordGitDisposition({
    category: 'untracked_artifacts',
    decision: 'generated_proof',
    note: 'Generated proof can be moved or ignored after source artifacts are separated.',
  });
  const complete = await store.recordGitDisposition({
    category: 'remote_commits',
    decision: 'integrate_after_local_safe',
    note: 'Fast-forward only after the local commit and working tree have been intentionally handled.',
  });

  assert.equal(complete.gitDisposition.readyForHumanSync, true);
  assert.match(complete.gitDisposition.summary, /4 of 4 Git disposition categories have decisions recorded; 4 are resolved enough for a human sync attempt/);
  assert.match(complete.gitDisposition.categories[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  await assert.rejects(
    () => store.recordGitDisposition({
      category: 'tracked_changes',
      decision: 'delete_without_review',
      note: 'bad',
    }),
    /Unsupported Git disposition decision/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
