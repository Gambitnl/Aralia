import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the main dashboard hierarchy. The dashboard has grown
// into the operator's intake form, Git safety console, Jules lifecycle console,
// PR review console, local-sync console, worker monitor, and evidence board.
// The contract below keeps those surfaces available while requiring the current
// middleman boundary to become the first thing the operator can understand.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');

assert.match(dashboardSource, /function renderForemanConsole/);
assert.match(dashboardSource, /function renderDashboardFocusStrip/);
assert.match(dashboardSource, /function renderForemanCurrentBoundary/);
assert.match(dashboardSource, /function renderForemanDetailGroup/);
assert.match(dashboardSource, /function renderBrowserFollowAlongGuidance/);
assert.match(dashboardSource, /Current Foreman Boundary/);
assert.match(dashboardSource, /Browser Follow-along/);
assert.match(dashboardSource, /Use the Codex Browser plugin bridge first/);
assert.match(dashboardSource, /Direct Playwright MCP can report Transport closed/);
assert.match(dashboardSource, /signed-in in-app browser tab/);
assert.match(dashboardSource, /Terminal Playwright is only repeatable local dashboard verification/);
assert.match(dashboardSource, /Git Safety/);
assert.match(dashboardSource, /Jules Lifecycle/);
assert.match(dashboardSource, /PR Review And Local Return/);
assert.match(dashboardSource, /Task Intake And Records/);

const taskIntakeRoot = {
  html: '',
  addEventListener() {},
  set innerHTML(value) {
    this.html = value;
  },
  get innerHTML() {
    return this.html;
  },
  firstChild: { nodeValue: '' },
};
const inertElement = {
  addEventListener() {},
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
  firstChild: { nodeValue: '' },
};
const executableSource = dashboardSource.replace(
  /\nrefreshDashboard\(\);\r?\nstartLiveRefresh\(\);\r?\n/,
  '\n// Automatic dashboard refresh is disabled by the foreman-console verifier.\n',
);
const sandbox = {
  document: {
    getElementById(id) {
      return id === 'task-intake-root' ? taskIntakeRoot : inertElement;
    },
    documentElement: { dataset: {}, scrollHeight: 0 },
    body: { scrollHeight: 0 },
  },
  window: {
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    innerHeight: 900,
    matchMedia() {
      return { matches: false };
    },
    scrollTo() {},
  },
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  EventSource: undefined,
};

vm.runInNewContext(executableSource, sandbox, { filename: 'dashboard.js' });

sandbox.renderTaskIntake(buildSnapshot());

const html = taskIntakeRoot.innerHTML;

assert.match(html, /foreman-console/);
assert.match(html, /dashboard-focus-strip/);
assert.match(html, /Current Foreman Boundary/);
assert.match(html, /What needs attention now/);
assert.match(html, /Resolve Git disposition before Linear\/Jules/);
assert.match(html, /<dt>Safety<\/dt><dd>operator_only<\/dd>/);
assert.match(html, /<dt>Git<\/dt><dd>Git sync blocked<\/dd>/);
assert.match(html, /<dt>Drafts<\/dt><dd>1<\/dd>/);
assert.match(html, /<dt>PRs<\/dt><dd>1\/1<\/dd>/);
assert.match(html, /Next proof/);
assert.match(html, /Git Safety/);
assert.match(html, /Jules Lifecycle/);
assert.match(html, /PR Review And Local Return/);
assert.match(html, /Task Intake And Records/);
assert.match(html, /Save Draft/);
assert.match(html, /Watch Existing PR/);
assert.match(html, /GitHub Sync Gate/);
assert.match(html, /Jules handoff status board/);
assert.match(html, /Tracked Jules Handoffs and Observed PRs/);

function buildSnapshot() {
  const generatedAt = '2026-05-17T00:00:00.000Z';
  const preflight = {
    ok: false,
    checkedAt: generatedAt,
    baseBranch: 'master',
    remoteBranch: 'origin/master',
    localCommit: 'local-commit',
    remoteCommit: 'remote-commit',
    ahead: 1,
    behind: 7,
    dirtyFiles: 2,
    untrackedFiles: 3,
    summary: 'GitHub sync gate is blocked.',
    blockers: ['Local master is behind origin/master.'],
    remediation: ['Record Git disposition decisions.'],
    resolutionPacket: {
      generatedAt,
      mutatesGit: false,
      summary: 'Git resolution packet is available.',
      commits: [],
      files: [],
      commands: { status: 'git status --short' },
    },
    nextAction: {
      code: 'review_git_disposition',
      tone: 'blocked',
      label: 'Review Git Disposition',
      command: null,
      summary: 'Resolve local Git state first.',
      steps: ['Review local commits and untracked files.'],
    },
  };

  return {
    preflight,
    gitDisposition: {
      categories: [],
      decidedCount: 0,
      totalRequired: 1,
      readyForHumanSync: false,
      summary: 'Disposition is required.',
      updatedAt: null,
    },
    gitSyncPlan: {
      generatedAt,
      status: 'blocked_by_disposition',
      mutatesGit: false,
      canExecute: false,
      summary: 'Git sync is blocked until dispositions are recorded.',
      requiredDispositions: ['remote_commits'],
      blockers: ['Remote commits need disposition.'],
      steps: [],
      executionPacket: {
        packageId: 'dashboard-foreman-console',
        generatedAt,
        status: 'blocked_by_disposition',
        mutatesGit: false,
        canExecute: false,
        requiresHumanConfirmation: true,
        summary: 'No Git command can run yet.',
        requiredDispositions: ['remote_commits'],
        blockedReasons: ['Remote commits need disposition.'],
        readOnlyCommands: ['git status --short'],
        mutatingCommands: [],
        verificationCommands: ['git fetch origin'],
        safetyChecklist: ['Do not pull until decisions are recorded.'],
        expectedNextProof: 'Recorded Git disposition and clean preflight.',
      },
    },
    git_disposition_review: {
      status: 'blocked',
      summary: 'Git disposition decisions are missing.',
      requiredCategories: ['remote_commits'],
      mutatesGit: false,
      categories: [],
      blockers: ['Remote commits need disposition.'],
    },
    capabilities: { kickoffGuide: null },
    drafts: [{
      id: 'draft-foreman-console',
      title: 'Dashboard hierarchy proof',
      body: 'Keep current boundary first.',
      status: 'blocked_by_git_sync',
      expectedFiles: ['conductor/symphony/public/dashboard.js'],
      verificationCommands: ['npm.cmd run verify:jules-contract'],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      next_action: {
        code: 'wait',
        tone: 'blocked',
        label: 'Wait for Git Disposition',
        summary: 'Git sync is blocked.',
        steps: ['Resolve Git first.'],
      },
    }],
    handoffs: [{
      id: 'observed-pr-proof',
      title: 'Observed PR proof',
      status: 'observed_pr',
      julesState: null,
      julesSessionId: null,
      julesSessionUrl: null,
      githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/900',
      githubPullRequestState: 'CLOSED',
      githubPullRequestChecks: { conclusion: 'unknown', pending: 0, failed: 0 },
      githubPullRequestFiles: { risk: 'high', riskReasons: ['Observed risk'], outOfScopeFiles: [] },
      next_action: {
        code: 'record_observed_learning',
        tone: 'waiting',
        label: 'Record Observed Learning',
        summary: 'Observed PR stays read-only.',
        steps: ['Create a follow-up draft if useful.'],
      },
      localSyncStatus: null,
    }],
    taskRouting: {
      generatedAt,
      route: 'blocked',
      subjectId: 'draft-foreman-console',
      subjectTitle: 'Dashboard hierarchy proof',
      summary: 'GitHub sync gate is blocked.',
      reasons: ['Git sync is blocked.'],
      nextAction: {
        code: 'wait',
        label: 'Wait for Git disposition',
        detail: 'Resolve Git first.',
        pauseSeconds: 0,
        nextNudgeAt: null,
      },
      candidates: [],
    },
    taskNudges: {
      total: 0,
      summary: 'No durable nudge evidence recorded yet.',
      latest: null,
      recent: [],
      nextNudgeAt: null,
      scheduler: {
        checkedAt: generatedAt,
        status: 'idle',
        summary: 'No recorded nudges are scheduled.',
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
    middleman_path: {
      status: 'blocked',
      currentBoundary: 'git_sync',
      currentBoundaryLabel: 'GitHub sync',
      summary: 'GitHub sync: local work needs disposition before Linear/Jules.',
      nextExpectedProof: 'Human-owned Git disposition and a passing GitHub sync preflight.',
      foremanAction: {
        boundary: 'git_sync',
        boundaryLabel: 'GitHub sync',
        label: 'Resolve Git disposition before Linear/Jules',
        status: 'blocked',
        method: 'NONE',
        endpoint: null,
        evidenceEndpoint: 'http://127.0.0.1:8101/api/v1/git-disposition/review',
        recordEndpoint: 'http://127.0.0.1:8101/api/v1/git-disposition',
        canRunNow: false,
        requiresOperator: true,
        safety: 'operator_only',
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedReason: 'Local Git disposition is missing.',
        instruction: 'Review Git disposition before Linear/Jules.',
        expectedProof: 'Human-owned Git disposition and a passing GitHub sync preflight.',
      },
      stages: [
        { id: 'git_sync', label: 'GitHub sync', status: 'blocked', sourceTitle: null },
        { id: 'linear_issue', label: 'Linear issue', status: 'waiting', sourceTitle: 'Dashboard hierarchy proof' },
      ],
    },
    next_action: {
      code: 'wait',
      tone: 'blocked',
      label: 'Wait for Git disposition',
      summary: 'Resolve Git before sending work to Jules.',
      source_type: 'task_queue',
      source_id: 'draft-foreman-console',
      steps: ['Record Git disposition decisions.'],
    },
    conflict_watch: {
      status: 'clear',
      summary: 'No cross-handoff conflicts are currently known.',
      overlap_files: [],
      risk_files: [],
      next_action: null,
    },
  };
}
