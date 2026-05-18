import assert from 'node:assert/strict';
import { HttpServer } from '../dist/server.js';
import { LinearClient } from '../dist/linear-client.js';
import { TrackerError } from '../dist/types.js';

// This verifier protects the dashboard-to-Linear bridge before a real external
// Linear call is allowed. Missing credentials or project routing should appear
// as explicit blockers in the API and client layer, not as a ready button that
// later fails with an unclear network or GraphQL error.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const readyPreflight = {
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
  id: 'draft-linear-config',
  title: 'Linear config proof',
  body: 'Prove dashboard Linear blockers are explicit.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'ready_for_handoff',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

function buildSnapshotForTracker(tracker) {
  const config = { tracker };
  const server = new HttpServer(0, {
    getConfig() {
      return config;
    },
    getDashboardBaseUrl() {
      return 'http://127.0.0.1:8081';
    },
  }, logger);

  return server.withTaskCapabilities.bind(server)({
    drafts: [draft],
    handoffs: [],
    preflight: readyPreflight,
  });
}

const missingApiKeySnapshot = buildSnapshotForTracker({
  kind: 'linear',
  apiKey: '',
  projectSlug: 'aralia-jules',
});

assert.equal(missingApiKeySnapshot.capabilities.canCreateLinearIssue, false);
assert.equal(missingApiKeySnapshot.capabilities.requiresLinearIssueForHandoff, true);
assert.equal(missingApiKeySnapshot.capabilities.linearProjectSlug, 'aralia-jules');
assert.match(missingApiKeySnapshot.capabilities.linearIssueCreationBlocker, /Linear API key is missing/);
assert.equal(missingApiKeySnapshot.drafts[0].next_action.code, 'linear_issue_config_blocked');
assert.equal(missingApiKeySnapshot.next_action.code, 'linear_issue_config_blocked');

const missingProjectSnapshot = buildSnapshotForTracker({
  kind: 'linear',
  apiKey: 'linear-test-key',
  projectSlug: '',
});

assert.equal(missingProjectSnapshot.capabilities.canCreateLinearIssue, false);
assert.equal(missingProjectSnapshot.capabilities.requiresLinearIssueForHandoff, true);
assert.equal(missingProjectSnapshot.capabilities.linearProjectSlug, null);
assert.match(missingProjectSnapshot.capabilities.linearIssueCreationBlocker, /Linear project slug is missing/);
assert.equal(missingProjectSnapshot.drafts[0].next_action.code, 'linear_issue_config_blocked');

const readySnapshot = buildSnapshotForTracker({
  kind: 'linear',
  apiKey: 'linear-test-key',
  projectSlug: 'aralia-jules',
});

assert.equal(readySnapshot.capabilities.canCreateLinearIssue, true);
assert.equal(readySnapshot.capabilities.requiresLinearIssueForHandoff, true);
assert.equal(readySnapshot.capabilities.linearIssueCreationBlocker, null);
assert.equal(readySnapshot.drafts[0].next_action.code, 'create_linear_issue');

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('fetch should not be called for local config blockers');
};

try {
  await assert.rejects(
    () => new LinearClient({
      endpoint: 'https://api.linear.app/graphql',
      apiKey: '',
      projectSlug: 'aralia-jules',
      activeStates: ['Todo'],
      terminalStates: ['Done'],
      logger,
    }).createProjectIssue({
      title: 'Missing API key',
      description: 'This should fail before fetch.',
    }),
    (err) => err instanceof TrackerError
      && err.code === 'missing_tracker_api_key'
      && /Linear API key is missing/.test(err.message),
  );

  await assert.rejects(
    () => new LinearClient({
      endpoint: 'https://api.linear.app/graphql',
      apiKey: 'linear-test-key',
      projectSlug: '',
      activeStates: ['Todo'],
      terminalStates: ['Done'],
      logger,
    }).createProjectIssue({
      title: 'Missing project',
      description: 'This should fail before fetch.',
    }),
    (err) => err instanceof TrackerError
      && err.code === 'missing_tracker_project_slug'
      && /Linear project slug is missing/.test(err.message),
  );
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(fetchCalls, 0);
