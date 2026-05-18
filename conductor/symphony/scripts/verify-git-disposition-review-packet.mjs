import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the Git disposition review packet.
//
// The packet sits between raw Git facts and the human execution plan. It must
// show evidence for each required disposition category, name the still-missing
// decisions, and keep the whole surface read-only so Symphony does not infer
// ownership of user work or mutate Git on the operator's behalf.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const preflight = {
  ok: false,
  checkedAt: '2026-05-17T00:00:00.000Z',
  repoRoot: 'F:\\Repos\\Aralia',
  baseBranch: 'master',
  remoteBranch: 'origin/master',
  currentBranch: 'master',
  localCommit: 'local-review',
  remoteCommit: 'remote-review',
  ahead: 1,
  behind: 2,
  dirtyFiles: 2,
  untrackedFiles: 3,
  blockers: [
    '2 tracked file(s) have uncommitted changes.',
    '3 untracked file(s) are present.',
    'master has 1 unpushed commit(s).',
    'master is behind origin/master by 2 commit(s).',
  ],
  summary: 'Blocked: local Git state is not ready for Jules.',
  details: [],
  dirtyFileSamples: ['src/example.ts', 'docs/example.md'],
  untrackedFileSamples: ['generated-proof.png', 'src/new-source.ts', '.jules/runs/example/manifest.json'],
  remediation: [],
  nextAction: {
    code: 'review_local_changes',
    tone: 'blocked',
    label: 'Review Local Changes',
    command: 'git status --short',
    summary: 'Resolve Git sync before Jules starts.',
    steps: ['Record Git disposition decisions.'],
  },
  commands: {
    status: 'git -C F:\\Repos\\Aralia status --short',
    fetch: 'git -C F:\\Repos\\Aralia fetch origin',
    inspectDivergence: 'git -C F:\\Repos\\Aralia log --oneline --left-right master...origin/master',
  },
  resolutionPacket: {
    generatedAt: '2026-05-17T00:00:00.000Z',
    mutatesGit: false,
    repoRoot: 'F:\\Repos\\Aralia',
    baseBranch: 'master',
    remoteBranch: 'origin/master',
    summary: 'Read-only Git resolution packet.',
    localCommits: [{ side: 'local', hash: 'abc1234', message: 'local-only feature work' }],
    remoteCommits: [
      { side: 'remote', hash: 'def5678', message: 'remote update one' },
      { side: 'remote', hash: 'fed9876', message: 'remote update two' },
    ],
    trackedFiles: [
      { status: 'M', path: 'src/example.ts' },
      { status: 'D', path: 'docs/example.md' },
    ],
    untrackedFiles: [
      { status: '??', path: 'generated-proof.png' },
      { status: '??', path: 'src/new-source.ts' },
      { status: '??', path: '.jules/runs/example/manifest.json' },
    ],
    details: ['Read-only packet.'],
    commands: {
      fullStatus: 'git -C F:\\Repos\\Aralia status --porcelain --untracked-files=all',
      inspectDivergence: 'git -C F:\\Repos\\Aralia log --oneline --left-right master...origin/master',
    },
  },
};

const snapshot = {
  drafts: [],
  handoffs: [],
  preflight,
  gitDisposition: {
    categories: [
      {
        category: 'local_commits',
        label: 'Local-only commits',
        decision: 'needs_review',
        decisionLabel: 'Needs review',
        note: 'Operator has not decided whether this commit belongs in the Jules base.',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      {
        category: 'tracked_changes',
        label: 'Tracked edits and deletions',
        decision: null,
        decisionLabel: 'Not decided',
        note: '',
        updatedAt: null,
      },
      {
        category: 'untracked_artifacts',
        label: 'Untracked artifacts',
        decision: null,
        decisionLabel: 'Not decided',
        note: '',
        updatedAt: null,
      },
      {
        category: 'remote_commits',
        label: 'Remote-only commits',
        decision: 'integrate_after_local_safe',
        decisionLabel: 'Integrate after local work is safe',
        note: 'Fast-forward after local work is preserved.',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ],
    decidedCount: 2,
    totalRequired: 4,
    readyForHumanSync: false,
    summary: '2 of 4 Git disposition categories have decisions recorded.',
    updatedAt: '2026-05-17T00:00:00.000Z',
  },
  gitSyncPlan: {
    generatedAt: '2026-05-17T00:00:00.000Z',
    status: 'blocked_by_review',
    mutatesGit: false,
    canExecute: false,
    summary: 'Local-only commits still needs review before any sync execution plan is safe.',
    requiredDispositions: [],
    blockers: ['Local-only commits is marked needs review.'],
    steps: [],
    executionPacket: {
      packageId: 'git-sync-review',
      generatedAt: '2026-05-17T00:00:00.000Z',
      status: 'blocked_by_review',
      mutatesGit: false,
      canExecute: false,
      requiresHumanConfirmation: true,
      summary: 'Execution packet is blocked.',
      requiredDispositions: [],
      blockedReasons: ['Local-only commits is marked needs review.'],
      readOnlyCommands: ['git status --short'],
      mutatingCommands: [],
      verificationCommands: ['git fetch origin'],
      expectedNextProof: 'Record concrete dispositions.',
    },
  },
  taskRouting: {
    generatedAt: '2026-05-17T00:00:00.000Z',
    route: 'blocked',
    subjectId: null,
    subjectTitle: null,
    summary: 'GitHub sync gate is blocked.',
    reasons: ['Blocked by Git.'],
    nextAction: { code: 'wait', label: 'Wait for Git disposition', detail: 'Resolve sync first.', pauseSeconds: 0, nextNudgeAt: null },
    candidates: [],
  },
  taskNudges: {
    total: 0,
    summary: 'No nudges recorded.',
    latest: null,
    recent: [],
    nextNudgeAt: null,
    scheduler: {
      checkedAt: '2026-05-17T00:00:00.000Z',
      status: 'waiting',
      summary: 'No due nudges.',
      dueCount: 0,
      waitingCount: 0,
      blockedCount: 0,
      nextDueAt: null,
      mutatesExternalSystems: false,
      due: [],
      waiting: [],
      blocked: [],
    },
  },
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'linear-test-key', projectSlug: 'aralia-jules' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8198';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8198' },
    };
  },
};

const server = new HttpServer(8198, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return snapshot;
  },
};

try {
  await server.start();

  const review = await getJson('http://127.0.0.1:8198/api/v1/git-disposition/review');
  assert.equal(review.status, 'blocked_by_review');
  assert.equal(review.mutatesGit, false);
  assert.equal(review.canRecordDispositions, true);
  assert.equal(review.recordDispositionUrl, 'http://127.0.0.1:8198/api/v1/git-disposition');
  assert.equal(review.summary, 'Git disposition review is blocked by 3 category decision(s).');
  assert.deepEqual(review.requiredCategories, ['local_commits', 'tracked_changes', 'untracked_artifacts']);
  assert.deepEqual(review.blockers, [
    'Local-only commits is marked needs review.',
    'Tracked edits and deletions is not decided.',
    'Untracked artifacts is not decided.',
  ]);

  const categoriesById = new Map(review.categories.map(category => [category.category, category]));
  assert.equal(categoriesById.get('local_commits').status, 'needs_review');
  assert.equal(categoriesById.get('local_commits').evidenceCount, 1);
  assert.match(categoriesById.get('local_commits').evidence[0], /abc1234 local-only feature work/);
  assert.equal(categoriesById.get('tracked_changes').status, 'missing_decision');
  assert.equal(categoriesById.get('tracked_changes').evidenceCount, 2);
  assert.match(categoriesById.get('tracked_changes').evidence.join('\n'), /M src\/example\.ts/);
  assert.equal(categoriesById.get('untracked_artifacts').status, 'missing_decision');
  assert.equal(categoriesById.get('untracked_artifacts').evidenceCount, 3);
  assert.equal(categoriesById.get('untracked_artifacts').sourceCandidates, 1);
  assert.equal(categoriesById.get('untracked_artifacts').generatedCandidates, 2);
  assert.equal(categoriesById.get('remote_commits').status, 'resolved');
  assert.equal(categoriesById.get('remote_commits').evidenceCount, 2);
  assert(categoriesById.get('tracked_changes').allowedDecisions.includes('commit_for_jules_base'));
  assert(categoriesById.get('remote_commits').allowedDecisions.includes('integrate_after_local_safe'));
  assert.match(review.safetyNote, /does not run Git/);

  const taskState = await getJson('http://127.0.0.1:8198/api/v1/task-drafts');
  assert.equal(taskState.links.gitDispositionReview, 'http://127.0.0.1:8198/api/v1/git-disposition/review');
  assert.equal(taskState.git_disposition_review.status, 'blocked_by_review');

  const html = await getText('http://127.0.0.1:8198/proof');
  assert.match(html, /Git Disposition Review/);
  assert.match(html, /blocked_by_review/);
  assert.match(html, /Required decisions: local_commits, tracked_changes, untracked_artifacts/);
  assert.match(html, /Mutates Git: no/);
} finally {
  await server.stop();
}

async function getJson(url) {
  const body = await getText(url);
  return JSON.parse(body);
}

async function getText(url) {
  return await new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}
