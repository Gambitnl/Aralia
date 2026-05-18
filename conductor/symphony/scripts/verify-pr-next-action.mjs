import assert from 'node:assert/strict';
import { buildPullRequestNextAction } from '../dist/task-intake.js';

// This verifier protects the GitHub PR review decision table. Once Jules opens
// a PR, Symphony should give the worker and dashboard one safe next action:
// refresh missing data, wait for checks, route conflicts/risky files through
// Scout, let Core validate/merge, or move to local sync after merge.

const base = {
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  checks: {
    total: 2,
    passing: 2,
    failing: 0,
    pending: 0,
    skipped: 0,
    unknown: 0,
    conclusion: 'passing',
  },
  files: {
    risk: 'low',
    riskReasons: [],
    outOfScopeFiles: [],
  },
  scoutReviewCommand: 'gh pr view 5 --comments',
  julesFeedbackCommand: 'gh pr comment 5 --body-file .jules/feedback/handoff-1-pr-feedback.md',
  coreValidationCommand: 'npm.cmd run build',
  coreMergeCommand: 'gh pr merge 5 --squash',
  refreshPullRequestUrl: 'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-1/refresh-pr',
};

assert.equal(
  buildPullRequestNextAction({ ...base, state: null }).code,
  'refresh_pull_request',
);

assert.equal(
  buildPullRequestNextAction({ ...base, state: 'MERGED' }).code,
  'check_local_sync',
);

const closedAction = buildPullRequestNextAction({ ...base, state: 'CLOSED' });
assert.equal(closedAction.code, 'reopen_or_replace_pr');
assert.equal(closedAction.tone, 'blocked');

const draftAction = buildPullRequestNextAction({ ...base, isDraft: true });
assert.equal(draftAction.code, 'refresh_pull_request');
assert.equal(draftAction.tone, 'waiting');

const conflictAction = buildPullRequestNextAction({ ...base, mergeable: 'CONFLICTING' });
assert.equal(conflictAction.code, 'resolve_conflicts');
assert.equal(conflictAction.command, 'gh pr view 5 --comments');

const failedChecksAction = buildPullRequestNextAction({
  ...base,
  checks: { ...base.checks, passing: 1, failing: 1, conclusion: 'failing' },
});
assert.equal(failedChecksAction.code, 'repair_failed_checks');
assert.equal(failedChecksAction.tone, 'blocked');
assert.equal(failedChecksAction.feedbackCommand, 'gh pr comment 5 --body-file .jules/feedback/handoff-1-pr-feedback.md');
assert(failedChecksAction.steps.some(step => /PR comment/i.test(step) && /Jules/i.test(step)));

const pendingChecksAction = buildPullRequestNextAction({
  ...base,
  checks: { ...base.checks, passing: 1, pending: 1, conclusion: 'pending' },
});
assert.equal(pendingChecksAction.code, 'wait_for_checks');
assert.equal(pendingChecksAction.tone, 'waiting');

const riskAction = buildPullRequestNextAction({
  ...base,
  files: {
    risk: 'high',
    riskReasons: ['Out-of-scope files changed: 1 file outside declared Jules write scope.'],
    outOfScopeFiles: ['package-lock.json'],
  },
});
assert.equal(riskAction.code, 'scout_bridge_risk');
assert.equal(riskAction.tone, 'blocked');
assert.equal(riskAction.command, 'gh pr view 5 --comments');
assert.equal(riskAction.feedbackCommand, 'gh pr comment 5 --body-file .jules/feedback/handoff-1-pr-feedback.md');

const readyAction = buildPullRequestNextAction(base);
assert.equal(readyAction.code, 'core_validate_and_merge');
assert.equal(readyAction.tone, 'ready');
assert.equal(readyAction.command, 'npm.cmd run build');
