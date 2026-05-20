import assert from 'node:assert/strict';
import {
  buildPullRequestNextAction,
  selectJulesApiPullRequestOutput,
  selectJulesPullRequestFallback,
} from '../dist/task-intake.js';

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

const setupBlockedChecksAction = buildPullRequestNextAction({
  ...base,
  checks: {
    ...base.checks,
    passing: 4,
    failing: 4,
    conclusion: 'failing',
    blockers: [{
      category: 'workflow_setup',
      severity: 'blocking',
      checkNames: ['🔨 Build', '🎨 Lint', '🧪 Tests', 'Quality Scan (advisory)'],
      evidence: ['🔨 Build: https://github.com/example/job/build'],
      summary: 'Build, lint, tests, and advisory quality scan failed together, which points first at a shared setup or dependency-install step.',
      nextAction: 'Inspect the failed check logs for the shared setup/install command before sending Jules implementation feedback.',
      mutatesExternalSystems: false,
    }],
  },
});
assert.equal(setupBlockedChecksAction.code, 'repair_failed_checks');
assert.equal(setupBlockedChecksAction.label, 'Resolve CI Setup Blocker');
assert.match(setupBlockedChecksAction.summary, /shared setup or dependency-install/i);
assert(setupBlockedChecksAction.steps.some(step => /before sending Jules implementation feedback/i.test(step)));

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

const apiDiscoveredAra6Pr = selectJulesApiPullRequestOutput({
  handoffId: 'handoff-1779226708033-v4ohk7',
  searchedAt: '2026-05-20T00:00:00.000Z',
  session: {
    id: '4101281510355198885',
    state: 'COMPLETED',
    outputs: [
      {
        changeSet: {
          gitPatch: {
            baseCommitId: 'd589d1f1b88c46111dcdcdf4431fc875684ab9b1',
          },
        },
      },
      {
        pullRequest: {
          url: 'https://github.com/Gambitnl/Aralia/pull/931',
          title: 'test: add regression coverage for non-proficient weapon attack penalties',
          baseRef: 'master',
          headRef: 'add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
        },
      },
    ],
  },
});
assert.equal(apiDiscoveredAra6Pr.status, 'matched');
assert.equal(apiDiscoveredAra6Pr.source, 'jules_api_session');
assert.equal(apiDiscoveredAra6Pr.url, 'https://github.com/Gambitnl/Aralia/pull/931');
assert.deepEqual(apiDiscoveredAra6Pr.matchedBy, ['jules_api_output']);
assert.equal(apiDiscoveredAra6Pr.mutatesExternalSystems, false);

const discoveredAra6Pr = selectJulesPullRequestFallback({
  handoffId: 'handoff-1779226708033-v4ohk7',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  julesSessionId: '4101281510355198885',
  linearIssueIdentifier: 'ARA-6',
  candidates: [
    {
      url: 'https://github.com/Gambitnl/Aralia/pull/900',
      title: 'unrelated historical Jules PR',
      headRefName: 'scout-conflict-learning',
      baseRefName: 'master',
      state: 'CLOSED',
    },
    {
      url: 'https://github.com/Gambitnl/Aralia/pull/931',
      title: 'test: add regression coverage for non-proficient weapon attack penalties',
      headRefName: 'add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
      baseRefName: 'master',
      state: 'OPEN',
    },
  ],
});
assert.equal(discoveredAra6Pr.status, 'matched');
assert.equal(discoveredAra6Pr.url, 'https://github.com/Gambitnl/Aralia/pull/931');
assert.equal(discoveredAra6Pr.mutatesExternalSystems, false);
assert.deepEqual(discoveredAra6Pr.matchedBy, ['jules_session_id']);

const ambiguousDiscovery = selectJulesPullRequestFallback({
  handoffId: 'handoff-ambiguous',
  title: 'Ambiguous Jules PR',
  julesSessionId: 'session-123',
  linearIssueIdentifier: null,
  candidates: [
    { url: 'https://github.com/example/repo/pull/1', title: 'one', headRefName: 'branch-session-123' },
    { url: 'https://github.com/example/repo/pull/2', title: 'two', headRefName: 'other-session-123' },
  ],
});
assert.equal(ambiguousDiscovery.status, 'ambiguous');
assert.equal(ambiguousDiscovery.url, null);
