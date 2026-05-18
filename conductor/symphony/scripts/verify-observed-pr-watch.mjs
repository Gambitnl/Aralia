import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HttpServer } from '../dist/server.js';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the "watch an existing PR" lane. Symphony needs to
// learn from real Jules/GitHub PRs such as #900 and #929 without pretending the
// current dashboard launched them or waiting for the local Git sync gate.

const root = await mkdtemp(join(tmpdir(), 'symphony-observed-pr-'));
const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};
const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'none' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8081';
  },
};

try {
  const store = new TaskIntakeStore({
    repoRoot: process.cwd(),
    storePath: join(root, 'task-drafts.json'),
  });

  const snapshot = await store.watchPullRequest({
    prUrl: 'https://github.com/Gambitnl/Aralia/pull/929',
    title: 'Observe PR #929 quality scan proof',
    expectedFiles: ['.github/workflows/ci.yml'],
    verificationCommands: ['gh pr checks 929 --repo Gambitnl/Aralia'],
  });

  assert.equal(snapshot.handoffs.length, 1);
  assert.equal(snapshot.handoffs[0].status, 'observed_pr');
  assert.equal(snapshot.handoffs[0].githubPullRequestUrl, 'https://github.com/Gambitnl/Aralia/pull/929');
  assert.equal(snapshot.handoffs[0].manifestPath, null);
  assert.equal(snapshot.handoffs[0].launchCommand, null);
  assert.equal(snapshot.handoffs[0].pullRequestViewCommand, 'gh pr view https://github.com/Gambitnl/Aralia/pull/929');
  assert.equal(snapshot.handoffs[0].pullRequestChecksCommand, 'gh pr checks https://github.com/Gambitnl/Aralia/pull/929');

  const serverInstance = new HttpServer(0, orchestrator, logger);
  const withTaskCapabilities = serverInstance.withTaskCapabilities.bind(serverInstance);
  const observedSnapshot = withTaskCapabilities(snapshot);
  assert.equal(observedSnapshot.handoffs[0].next_action.code, 'refresh_observed_pr');
  assert.equal(observedSnapshot.handoffs[0].next_action.label, 'Refresh Observed PR');
  assert.match(observedSnapshot.handoffs[0].next_action.url, /\/refresh-pr$/);

  const closedHistoricalSnapshot = withTaskCapabilities({
    ...snapshot,
    handoffs: [{
      ...snapshot.handoffs[0],
      status: 'observed_pr',
      githubPullRequestState: 'CLOSED',
      githubPullRequestMergeable: 'CONFLICTING',
      lastPullRequestRefreshAt: '2026-05-17T00:00:00.000Z',
      githubPullRequestNextAction: {
        code: 'reopen_or_replace_pr',
        tone: 'blocked',
        label: 'Replace Closed PR',
        command: null,
        feedbackCommand: null,
        url: 'http://127.0.0.1:8081/api/v1/jules-handoffs/observed/refresh-pr',
        summary: 'GitHub reports this PR closed before merge.',
        steps: ['Ask Jules for a replacement PR.'],
      },
    }],
  });
  assert.equal(closedHistoricalSnapshot.handoffs[0].next_action.code, 'record_observed_learning');
  assert.equal(closedHistoricalSnapshot.handoffs[0].next_action.label, 'Record Observed Learning');
  assert.doesNotMatch(
    closedHistoricalSnapshot.handoffs[0].next_action.summary,
    /replacement PR|repair/i,
  );

  const duplicate = await store.watchPullRequest({
    prUrl: 'https://github.com/Gambitnl/Aralia/pull/929',
    title: 'Updated PR #929 watch title',
  });

  assert.equal(duplicate.handoffs.length, 1);
  assert.equal(duplicate.handoffs[0].title, 'Updated PR #929 watch title');

  const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /id="observed-pr-form"/);
  assert.match(dashboard, /Watch Existing PR/);
  assert.match(dashboard, /Tracked Jules Handoffs and Observed PRs/);
  assert.match(dashboard, /Refresh Observed PR/);
  assert.match(dashboard, /Schedule Observed PR Refresh/);
  assert.match(dashboard, /data-nudge-phase="github_pr"/);
  assert.match(dashboard, /Observed closed PR/);
  assert.match(dashboard, /Observed PR/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /\/api\/v1\/observed-prs/);
} finally {
  await rm(root, { recursive: true, force: true });
}
