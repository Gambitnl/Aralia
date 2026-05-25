import assert from 'node:assert/strict';
import { buildPullRequestNextAction } from '../src/task-intake.ts';
import { HttpServer } from '../src/server.ts';

// This verifier protects the dashboard state after the foreman posts bounded
// Jules feedback on a PR. GitHub can update a PR timestamp for comments,
// reviews, or checks without Jules pushing code. The dashboard should keep
// saying "wait for Jules repair" until a newer PR commit proves Jules actually
// changed the branch.

const baseInput = {
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  updatedAt: '2026-05-25T17:14:31Z',
  checks: { conclusion: 'passing', pending: 0, failed: 0, blockers: [] },
  files: {
    risk: 'high',
    riskReasons: ['Out-of-scope files changed.'],
    outOfScopeFiles: ['.github/workflows/gemini-review.yml'],
  },
  feedback: {
    julesFeedback: [{
      author: 'Gambitnl',
      body: '[Jules feedback]\nRemove the out-of-scope workflow edit.',
      url: 'https://github.com/Gambitnl/Aralia/pull/1059#issuecomment-4535874478',
      createdAt: '2026-05-25T17:00:04Z',
      source: 'comment',
    }],
  },
  scoutReviewCommand: null,
  julesFeedbackCommand: null,
  coreValidationCommand: null,
  coreMergeCommand: null,
  refreshPullRequestUrl: '/api/v1/jules-handoffs/handoff-1779725875825-gybpb1/refresh-pr',
};

const unchangedBranchAction = buildPullRequestNextAction({
  ...baseInput,
  latestCommitAt: '2026-05-25T16:54:01Z',
});

assert.equal(unchangedBranchAction.code, 'wait_for_checks');
assert.equal(unchangedBranchAction.label, 'Wait for Jules Repair');
assert.match(unchangedBranchAction.summary, /Jules feedback is already posted|Scout feedback is already posted/);

const repairedBranchAction = buildPullRequestNextAction({
  ...baseInput,
  latestCommitAt: '2026-05-25T17:06:30Z',
});

assert.equal(repairedBranchAction.code, 'scout_bridge_risk');
assert.equal(repairedBranchAction.label, 'Scout Bridge Risk');

const logger = {
  child() {
    return {
      error() {},
      info() {},
      warn() {},
      debug() {},
    };
  },
};
const server = new HttpServer(0, {}, logger);
const middlemanPath = server.buildMiddlemanPathPacket(
  'http://localhost:8139',
  {
    preflight: {
      ok: true,
      summary: 'GitHub sync gate passes.',
      blockers: [],
      remoteBranch: 'origin/master',
      remoteCommit: 'abc123',
      checkedAt: '2026-05-25T17:20:00Z',
    },
  },
  [],
  [{
    id: 'handoff-repair-wait',
    title: 'Package 10 repair wait',
    status: 'sent_to_jules',
    julesSessionId: '344957924579130899',
    julesState: 'IN_PROGRESS',
    githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/1059',
    githubPullRequestState: 'OPEN',
    githubPullRequestChecks: { conclusion: 'passing', pending: 0, failed: 0 },
    githubPullRequestNextAction: unchangedBranchAction,
  }],
  { status: 'attention', summary: 'Out-of-scope files changed.' },
);

assert.equal(middlemanPath.currentBoundary, 'github_pr');
assert.equal(middlemanPath.currentBoundaryLabel, 'Wait for Jules Repair');
assert.equal(middlemanPath.foremanAction.label, 'Refresh GitHub PR');
assert.match(middlemanPath.summary, /Wait for Jules Repair/);

console.log('PR next-action repair-head routing verifier passed.');
