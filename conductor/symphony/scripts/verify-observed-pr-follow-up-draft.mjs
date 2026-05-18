import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the "historical PR lesson becomes new work" bridge.
// Observed PRs such as #900 are read-only evidence; if Symphony learns
// something actionable from them, it must create a separate dashboard draft
// instead of pretending it can repair, reopen, or mutate the old PR.

const root = await mkdtemp(join(tmpdir(), 'symphony-observed-pr-follow-up-'));
const storePath = join(root, 'task-drafts.json');

try {
  const store = new TaskIntakeStore({
    repoRoot: process.cwd(),
    storePath,
  });

  const watched = await store.watchPullRequest({
    prUrl: 'https://github.com/Gambitnl/Aralia/pull/900',
    title: 'Observe PR #900 as historical conflict learning',
    expectedFiles: ['.github/workflows/ci.yml'],
    verificationCommands: ['gh pr view 900 --repo Gambitnl/Aralia'],
  });
  const observed = watched.handoffs[0];

  await writeFile(storePath, `${JSON.stringify({
    drafts: [],
    handoffs: [{
      ...observed,
      githubPullRequestState: 'CLOSED',
      githubPullRequestMergeable: 'CONFLICTING',
      githubPullRequestFiles: {
        total: 41,
        additions: 912,
        deletions: 284,
        risk: 'high',
        riskReasons: ['conflict-prone workflow files changed'],
        scopeFiles: ['.github/workflows/ci.yml'],
        outOfScopeFiles: ['src/legacy/unrelated.ts'],
        files: [{
          path: '.github/workflows/ci.yml',
          additions: 12,
          deletions: 4,
          risk: 'high',
          reason: 'workflow edits need granular CI learning',
        }],
      },
      githubPullRequestFeedback: {
        totalComments: 257,
        julesFeedback: [],
        scoutConflictComments: [{
          author: 'scout',
          body: 'Scout conflict note',
          url: 'https://github.com/Gambitnl/Aralia/pull/900#discussion_r1',
          createdAt: '2026-05-17T00:00:00.000Z',
          source: 'comment',
          conflictFile: '.github/workflows/ci.yml',
          priorityPullRequest: 900,
        }],
        externalReviewComments: [{
          author: 'reviewer',
          body: 'External review note',
          url: 'https://github.com/Gambitnl/Aralia/pull/900#discussion_r2',
          createdAt: '2026-05-17T00:00:00.000Z',
          source: 'review',
        }],
        summary: '0 Jules feedback comment(s), 256 Scout conflict comment(s), 1 external review comment(s).',
      },
    }],
    gitDisposition: [],
    taskNudges: [],
  }, null, 2)}\n`, 'utf8');

  const followedUp = await store.createObservedPullRequestFollowUp({
    handoffId: observed.id,
    title: 'Follow-up from observed PR #900: CI learning',
  });
  const sourceHandoff = followedUp.handoffs.find(item => item.id === observed.id);
  const draft = followedUp.drafts.find(item => item.title === 'Follow-up from observed PR #900: CI learning');

  assert.ok(draft, 'expected a new dashboard draft from the observed PR');
  assert.equal(sourceHandoff?.status, 'observed_pr');
  assert.equal(sourceHandoff?.manifestPath, null);
  assert.equal(sourceHandoff?.launchCommand, null);
  assert.equal(draft?.expectedFiles.includes('.github/workflows/ci.yml'), true);
  assert.equal(draft?.verificationCommands.includes('gh pr view 900 --repo Gambitnl/Aralia'), true);
  assert.match(draft?.body ?? '', /https:\/\/github\.com\/Gambitnl\/Aralia\/pull\/900/);
  assert.match(draft?.body ?? '', /new bounded task/i);
  assert.match(draft?.body ?? '', /do not repair, reopen, or comment on the historical PR/i);
  assert.match(draft?.body ?? '', /0 Jules feedback comment\(s\), 256 Scout conflict comment\(s\), 1 external review comment\(s\)\./);
  assert.match(draft?.body ?? '', /CLOSED/);
  assert.match(draft?.body ?? '', /CONFLICTING/);
  assert.match(draft?.body ?? '', /41 changed file/);

  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /create-follow-up-draft/);
  assert.match(server, /createObservedPullRequestFollowUp/);

  const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /Create Follow-up Draft/);
  assert.match(dashboard, /create-observed-follow-up/);
} finally {
  await rm(root, { recursive: true, force: true });
}
