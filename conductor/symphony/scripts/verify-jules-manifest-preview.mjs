import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the read-only Jules manifest rehearsal. The dashboard
// should show the exact .jules/orchestrator-shaped manifest it will stage later,
// but blocked Git/Linear state must keep the action non-mutating.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const blockedPreflight = {
  ok: false,
  checkedAt: '2026-05-17T00:00:00.000Z',
  repoRoot: 'F:\\Repos\\Aralia',
  baseBranch: 'master',
  remoteBranch: 'origin/master',
  currentBranch: 'master',
  localCommit: 'local-preview',
  remoteCommit: 'remote-preview',
  ahead: 1,
  behind: 7,
  dirtyFiles: 2,
  untrackedFiles: 4,
  blockers: [
    '2 tracked file(s) have uncommitted changes.',
    'master is behind origin/master by 7 commit(s).',
  ],
  summary: 'Blocked: local Git state is not ready for Jules.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  remediation: [],
  nextAction: {
    code: 'review_local_changes',
    tone: 'blocked',
    label: 'Review Local Changes',
    command: 'git status --short',
    summary: 'Resolve Git sync before Jules manifest staging.',
    steps: ['Record Git disposition decisions.'],
  },
  commands: {},
};

const draft = {
  id: 'draft-manifest-preview',
  title: 'Manifest preview proof',
  body: 'Show the Jules manifest packet before writing .jules files.',
  expectedFiles: ['conductor/symphony/src/task-intake.ts', 'conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'blocked_by_git_sync',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'linear-test-key', projectSlug: 'aralia-jules' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8196';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8196' },
    };
  },
};

const server = new HttpServer(8196, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [draft],
      handoffs: [],
      preflight: blockedPreflight,
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 4,
        readyForHumanSync: false,
        summary: 'No Git disposition decisions recorded.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        status: 'blocked_by_disposition',
        mutatesGit: false,
        canExecute: false,
        summary: 'Human execution plan is blocked.',
        requiredDispositions: ['local_commits', 'tracked_changes', 'untracked_artifacts', 'remote_commits'],
        blockers: ['Local-only commits is not decided.'],
        steps: [],
        executionPacket: {
          packageId: 'git-sync-proof',
          generatedAt: '2026-05-17T00:00:00.000Z',
          status: 'blocked_by_disposition',
          mutatesGit: false,
          canExecute: false,
          requiresHumanConfirmation: true,
          summary: 'Execution packet is blocked.',
          requiredDispositions: ['local_commits'],
          blockedReasons: ['Local-only commits is not decided.'],
          readOnlyCommands: ['git status --short'],
          mutatingCommands: [],
          verificationCommands: ['git fetch origin'],
          expectedNextProof: 'Record dispositions.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'blocked',
        subjectId: draft.id,
        subjectTitle: draft.title,
        summary: 'GitHub sync gate is blocked.',
        reasons: ['Blocked: tracked changes.'],
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
  },
};

try {
  await server.start();

  const preview = await getJson('http://127.0.0.1:8196/api/v1/task-drafts/draft-manifest-preview/jules-manifest-preview');
  assert.equal(preview.draftId, 'draft-manifest-preview');
  assert.equal(preview.canStageNow, false);
  assert.equal(preview.wouldStageJulesManifest, true);
  assert.equal(preview.mutatesLocalFiles, false);
  assert.equal(preview.manifestPath, '.jules/runs/symphony-preview-draft-manifest-preview/manifest.json');
  assert.equal(preview.stageManifestUrl, 'http://127.0.0.1:8196/api/v1/task-drafts/draft-manifest-preview/promote');
  assert.deepEqual(preview.blockers, [
    'Create Linear Issue before preparing a Jules handoff.',
    ...blockedPreflight.blockers,
  ]);
  assert.equal(preview.manifest.runId, 'symphony-preview-draft-manifest-preview');
  assert.equal(preview.manifest.source, 'sources/github/Gambitnl/Aralia');
  assert.equal(preview.manifest.startingBranch, 'master');
  assert.equal(preview.manifest.startingCommit, 'remote-preview');
  assert.equal(preview.manifest.requirePlanApproval, true);
  assert.equal(preview.manifest.automationMode, 'AUTO_CREATE_PR');
  assert.deepEqual(preview.manifest.tasks[0].writeScopes, draft.expectedFiles);
  assert(preview.manifest.tasks[0].forbiddenFiles.includes('package-lock.json'));
  assert(preview.manifest.tasks[0].verification.some(line => line.includes('npm.cmd run verify:jules-contract')));
  assert.match(preview.manifest.tasks[0].prompt, /Show the Jules manifest packet before writing \.jules files/);
  assert.match(preview.manifest.tasks[0].prompt, /Treat `origin\/master` at commit/);
  assert.match(preview.safetyNote, /does not write/);

  const html = await getText('http://127.0.0.1:8196/proof');
  assert.match(html, /Jules Manifest Preview/);
  assert.match(html, /Manifest preview proof/);
  assert.match(html, /Can stage now: no/);
  assert.match(html, /Mutates local files: no/);
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
