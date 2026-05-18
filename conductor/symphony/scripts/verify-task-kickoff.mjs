import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HttpServer } from '../dist/server.js';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the dashboard-first kickoff path. The user should be
// able to read /api/v1/task-drafts and learn the task flow without already
// knowing Linear, Jules manifests, or Symphony's internal route names.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const config = {
  tracker: {
    kind: 'linear',
    apiKey: 'linear-test-key',
    projectSlug: 'aralia-jules',
  },
};

const orchestrator = {
  getConfig() {
    return config;
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8081';
  },
};

const server = new HttpServer(0, orchestrator, logger);
const withTaskCapabilities = server.withTaskCapabilities.bind(server);

const preflight = {
  ok: true,
  checkedAt: '2026-05-17T00:00:00.000Z',
  repoRoot: 'F:\\Repos\\Aralia',
  baseBranch: 'master',
  remoteBranch: 'origin/master',
  currentBranch: 'master',
  localCommit: 'abc1234',
  remoteCommit: 'abc1234',
  ahead: 0,
  behind: 0,
  dirtyFiles: 0,
  untrackedFiles: 0,
  blockers: [],
  summary: 'Ready: master matches origin/master and the working tree is clean.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  remediation: [],
  nextAction: {
    code: 'ready_for_jules',
    tone: 'ready',
    label: 'GitHub Sync Ready',
    command: null,
    summary: 'master matches origin/master and the working tree is clean enough for Jules.',
    steps: ['Create the Linear issue if this workflow requires one.'],
  },
  commands: {
    status: 'git status --short',
    fetch: 'git fetch origin',
    showLocalCommit: 'git rev-parse master',
    showRemoteCommit: 'git rev-parse origin/master',
    inspectDivergence: 'git log --oneline --left-right master...origin/master',
    pullFastForward: 'git pull --ff-only origin master',
    pushBase: 'git push origin master',
  },
};

const draft = {
  id: 'draft-widget',
  title: 'Widget task',
  body: 'Ask Jules to make a bounded widget change.',
  expectedFiles: ['src/components/Widget'],
  verificationCommands: ['npm.cmd run build'],
  executor: 'jules',
  status: 'ready_for_handoff',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

const linearSnapshot = withTaskCapabilities({
  drafts: [draft],
  handoffs: [],
  preflight,
});

assert.equal(linearSnapshot.capabilities.canCreateLinearIssue, true);
assert.equal(linearSnapshot.capabilities.requiresLinearIssueForHandoff, true);
assert.equal(linearSnapshot.capabilities.linearProjectSlug, 'aralia-jules');
assert.equal(linearSnapshot.capabilities.kickoffGuide.title, 'How to start a Jules task');
assert.deepEqual(
  linearSnapshot.capabilities.kickoffGuide.steps.map(step => step.label),
  [
    'Check GitHub Sync',
    'Save Draft',
    'Create Linear Issue',
    'Prepare Handoff',
    'Stage Jules Manifest',
    'Launch Jules',
  ],
);
assert.equal(
  linearSnapshot.capabilities.kickoffGuide.fields.expectedFiles,
  'Expected files / write scope. Required so Jules, Scout, and Core can detect scope drift.',
);
assert.equal(
  linearSnapshot.capabilities.kickoffGuide.fields.verificationCommands,
  'Required verification commands Jules, Scout, or Core should run or report before merge.',
);
assert.equal(linearSnapshot.drafts[0].next_action.code, 'create_linear_issue');
assert.equal(linearSnapshot.drafts[0].next_action.method, 'POST');
assert.equal(linearSnapshot.next_action.source_type, 'draft');
assert.equal(linearSnapshot.next_action.code, 'create_linear_issue');

config.tracker = {
  kind: 'local',
};

const localSnapshot = withTaskCapabilities({
  drafts: [draft],
  handoffs: [],
  preflight,
});

// In local/mock mode the guide still explains the path, but the API must also
// say that Linear issue creation is unavailable so the dashboard does not offer
// a button that cannot work.
assert.equal(localSnapshot.capabilities.canCreateLinearIssue, false);
assert.equal(localSnapshot.capabilities.requiresLinearIssueForHandoff, false);
assert.equal(localSnapshot.capabilities.linearIssueCreationBlocker, 'Symphony is not running with a Linear tracker workflow.');
assert.equal(localSnapshot.drafts[0].next_action.code, 'prepare_handoff');
assert.equal(localSnapshot.next_action.code, 'prepare_handoff');

const blockedDraftSnapshot = withTaskCapabilities({
  drafts: [
    {
      ...draft,
      status: 'blocked_by_git_sync',
    },
  ],
  handoffs: [],
  preflight: {
    ...preflight,
    ok: false,
    blockers: ['master has local changes.'],
    nextAction: {
      code: 'review_local_changes',
      tone: 'blocked',
      label: 'Review Local Changes',
      command: 'git status --short',
      summary: 'Local changes are present.',
      steps: ['Resolve local changes.'],
    },
  },
});

assert.equal(blockedDraftSnapshot.drafts[0].next_action.code, 'check_git_sync');
assert.equal(blockedDraftSnapshot.drafts[0].next_action.method, 'POST');
assert.equal(blockedDraftSnapshot.next_action.source_type, 'git_preflight');
assert.equal(blockedDraftSnapshot.next_action.method, 'POST');

const buildLinearTaskDescription = server.buildLinearTaskDescription.bind(server);
const issueDescription = buildLinearTaskDescription(
  'Widget task',
  'Ask Jules to make a bounded widget change.',
  ['src/components/Widget'],
  ['npm.cmd run build'],
  'origin/master',
  'abc1234',
  'http://127.0.0.1:8081',
);

// The Linear issue is the receipt a foreman worker sees before babysitting
// Jules. It must include the exact GitHub commit that passed preflight so the
// worker can compare Linear, the Jules manifest, the cloud run, and the PR
// against one concrete base instead of a branch name that may have moved.
assert(issueDescription.includes('GitHub sync receipt:'));
assert(issueDescription.includes('Synced base: `origin/master @ abc1234`'));
assert(issueDescription.includes('Verify the Jules starting point is origin/master at commit abc1234.'));
assert(issueDescription.includes('Expected files / write scopes:'));
assert(issueDescription.includes('- `src/components/Widget`'));

const validationStore = new TaskIntakeStore({
  repoRoot: 'F:\\Repos\\Aralia',
  storePath: 'F:\\Repos\\Aralia\\conductor\\symphony\\.symphony\\verify-task-kickoff-unused.json',
});

// These validation checks close the spec's "draft blocker" cases before any
// Git preflight or disk write occurs. A malformed dashboard draft should explain
// the missing field instead of becoming a vague blocked handoff later.
await assert.rejects(
  () => validationStore.createDraft({
    title: '',
    body: 'Body',
    expectedFiles: ['src/components/Widget'],
    verificationCommands: ['npm.cmd run build'],
  }),
  /Task title is required\./,
);

await assert.rejects(
  () => validationStore.createDraft({
    title: 'Widget task',
    body: '',
    expectedFiles: ['src/components/Widget'],
    verificationCommands: ['npm.cmd run build'],
  }),
  /Task body is required\./,
);

await assert.rejects(
  () => validationStore.createDraft({
    title: 'Widget task',
    body: 'Body',
    expectedFiles: [],
    verificationCommands: ['npm.cmd run build'],
  }),
  /Expected files or write scopes are required\./,
);

await assert.rejects(
  () => validationStore.createDraft({
    title: 'Widget task',
    body: 'Body',
    expectedFiles: ['src/components/Widget'],
    verificationCommands: [],
  }),
  /Verification commands are required\./,
);

const duplicateTempDir = await mkdtemp(join(tmpdir(), 'symphony-duplicate-draft-'));
try {
  const duplicateStorePath = join(duplicateTempDir, 'drafts.json');
  await writeFile(duplicateStorePath, `${JSON.stringify({
    drafts: [draft],
    handoffs: [
      {
        id: 'handoff-widget',
        draftId: 'draft-widget-handoff',
        title: 'Promoted widget task',
        executor: 'jules',
        status: 'ready_for_jules',
        prompt: 'Ask Jules to make a bounded widget change.',
        expectedFiles: ['src/components/Widget'],
        verificationCommands: ['npm.cmd run build'],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ],
  }, null, 2)}\n`, 'utf8');

  const duplicateStore = new TaskIntakeStore({
    repoRoot: 'F:\\Repos\\Aralia',
    storePath: duplicateStorePath,
  });

  // Duplicate protection runs before Git preflight so a repeated click or
  // pasted task does not create another local queue item while the repo is
  // already blocked from Jules launch.
  await assert.rejects(
    () => duplicateStore.createDraft({
      title: ' Widget   task ',
      body: 'Ask Jules to make a bounded widget change.',
      expectedFiles: ['src/components/Widget'],
      verificationCommands: ['npm.cmd run build'],
    }),
    /Duplicate Jules task already exists as draft draft-widget: Widget task\./,
  );

  await assert.rejects(
    () => duplicateStore.createDraft({
      title: 'Promoted widget task',
      body: 'This body is allowed to differ because promoted handoffs no longer store the original draft body.',
      expectedFiles: ['src/components/Widget'],
      verificationCommands: ['npm.cmd run build'],
    }),
    /Duplicate Jules task already exists as handoff handoff-widget: Promoted widget task\./,
  );
} finally {
  await rm(duplicateTempDir, { recursive: true, force: true });
}
