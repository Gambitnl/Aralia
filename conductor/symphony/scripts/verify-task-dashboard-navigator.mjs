import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the task-centered dashboard layer.
//
// Symphony already has detailed draft and handoff cards, but the operator also
// needs a compact "what task needs attention?" navigator before scanning every
// receipt. The checks below keep that navigator read-only and derived from the
// same task-draft snapshot as the rest of the dashboard.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const dashboardCss = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');

assert.match(dashboardSource, /function renderTaskNavigator/);
assert.match(dashboardSource, /taskNavigator/);
assert.match(dashboardSource, /pending-human-input/);
assert.match(dashboardSource, /task-navigator/);
assert.match(dashboardSource, /data-task-filter/);
assert.match(dashboardSource, /normalizeTaskNavigatorFilter/);
assert.match(dashboardSource, /function renderTaskDetailPreview/);
assert.match(dashboardCss, /\.task-navigator/);
assert.match(dashboardCss, /\.task-navigator-filters/);
assert.match(dashboardCss, /\.task-detail-preview/);

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
  '\n// Automatic dashboard refresh is disabled by the task-navigator verifier.\n',
);

const sandbox = buildSandbox(null);

vm.runInNewContext(executableSource, sandbox, { filename: 'dashboard.js' });

sandbox.renderTaskIntake(buildSnapshot());

const html = taskIntakeRoot.innerHTML;
const navigatorHtml = extractNavigatorHtml(html);

assert.match(navigatorHtml, /Task navigator/);
assert.match(navigatorHtml, /All tasks: 3/);
assert.match(navigatorHtml, /Needs input: 1/);
assert.match(navigatorHtml, /Open: 2/);
assert.match(navigatorHtml, /Completed: 1/);
assert.match(navigatorHtml, /data-task-filter="all"/);
assert.match(navigatorHtml, /data-task-filter="needs_input"/);
assert.match(navigatorHtml, /data-task-filter="open"/);
assert.match(navigatorHtml, /data-task-filter="completed"/);
assert.match(navigatorHtml, /data-task-filter="archived"/);
assert.match(navigatorHtml, /ARA-6 weapon proficiency regression/);
assert.match(navigatorHtml, /needs operator input/i);
assert.match(navigatorHtml, /href="#task-handoff-handoff-ara6"/);
assert.match(navigatorHtml, /href="#task-draft-draft-setup-repair"/);
assert.match(navigatorHtml, /data-task-record-kind="handoff"/);
assert.match(navigatorHtml, /data-task-record-kind="draft"/);
assert.match(navigatorHtml, /aria-label="Task navigator"/);
assert.match(navigatorHtml, /Task detail/);
assert.match(navigatorHtml, /Task page/);
assert.match(navigatorHtml, /Task detail JSON/);
assert.match(navigatorHtml, /Task messages/);
assert.match(navigatorHtml, /Record Task Message/);
assert.match(navigatorHtml, /data-task-action="record-task-message"/);
assert.match(navigatorHtml, /href="\/api\/v1\/tasks\/handoff-ara6"/);
assert.match(navigatorHtml, /Current boundary/);
assert.match(navigatorHtml, /Answer repair decision/);
assert.match(navigatorHtml, /Jules session/);
assert.match(navigatorHtml, /GitHub PR/);
assert.match(navigatorHtml, /Timeline events: 2/);
assert.match(navigatorHtml, /Needs human input/);

const needsInputRoot = {
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
const needsInputSandbox = buildSandbox('needs_input', needsInputRoot);
vm.runInNewContext(executableSource, needsInputSandbox, { filename: 'dashboard.js' });
needsInputSandbox.renderTaskIntake(buildSnapshot());

const needsInputHtml = needsInputRoot.innerHTML;
const needsInputNavigatorHtml = extractNavigatorHtml(needsInputHtml);
assert.match(needsInputNavigatorHtml, /Filter: Needs input/);
assert.match(needsInputNavigatorHtml, /ARA-6 weapon proficiency regression/);
assert.doesNotMatch(needsInputNavigatorHtml, /Setup repair draft/);
assert.doesNotMatch(needsInputNavigatorHtml, /Merged dashboard-started proof/);

const completedRoot = {
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
const completedSandbox = buildSandbox('completed', completedRoot);
vm.runInNewContext(executableSource, completedSandbox, { filename: 'dashboard.js' });
completedSandbox.renderTaskIntake(buildSnapshot());

const completedHtml = completedRoot.innerHTML;
const completedNavigatorHtml = extractNavigatorHtml(completedHtml);
assert.match(completedNavigatorHtml, /Filter: Completed/);
assert.match(completedNavigatorHtml, /Merged dashboard-started proof/);
assert.match(completedNavigatorHtml, /Wait for deployment proof/);
assert.match(completedNavigatorHtml, /GitHub PR/);
assert.doesNotMatch(completedNavigatorHtml, /ARA-6 weapon proficiency regression/);
assert.doesNotMatch(completedNavigatorHtml, /Setup repair draft/);

function extractNavigatorHtml(html) {
  const match = html.match(/<section class="task-navigator"[\s\S]*?<\/section>/);
  assert(match, 'Expected rendered dashboard HTML to include the task navigator section.');
  return match[0];
}

function buildSandbox(storedFilter, root = taskIntakeRoot) {
  return {
  document: {
    getElementById(id) {
      return id === 'task-intake-root' ? root : inertElement;
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
    getItem(key) {
      return key === 'symphony-task-navigator-filter' ? storedFilter : null;
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
}

function buildSnapshot() {
  const generatedAt = '2026-05-20T10:00:00.000Z';

  return {
    preflight: {
      ok: true,
      checkedAt: generatedAt,
      baseBranch: 'master',
      remoteBranch: 'origin/master',
      localCommit: 'local',
      remoteCommit: 'remote',
      ahead: 0,
      behind: 0,
      dirtyFiles: 0,
      untrackedFiles: 0,
      summary: 'GitHub sync gate is clean.',
      blockers: [],
    },
    gitDisposition: null,
    gitSyncPlan: null,
    git_disposition_review: null,
    capabilities: {
      canCreateLinearIssue: true,
      requiresLinearIssueForHandoff: true,
      kickoffGuide: null,
    },
    drafts: [{
      id: 'draft-setup-repair',
      title: 'Setup repair draft',
      body: 'Repair workflow setup before Jules gets more feedback.',
      status: 'ready_for_linear',
      expectedFiles: ['package-lock.json'],
      verificationCommands: ['npm ci --dry-run'],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      next_action: {
        code: 'create_linear_issue',
        tone: 'waiting',
        label: 'Create Linear Issue',
        summary: 'Ready for tracking.',
        steps: ['Create tracking issue.'],
      },
      links: {
        taskDetail: '/api/v1/tasks/draft-setup-repair',
      },
    }],
    handoffs: [{
      id: 'handoff-ara6',
      title: 'ARA-6 weapon proficiency regression',
      status: 'sent_to_jules',
      createdAt: generatedAt,
      updatedAt: generatedAt,
      julesState: 'COMPLETED',
      julesSessionId: '4101281510355198885',
      julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
      githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
      githubPullRequestState: 'OPEN',
      githubPullRequestChecks: { conclusion: 'failed', pending: 0, failed: 4 },
      githubPullRequestFiles: { risk: 'medium', riskReasons: [], outOfScopeFiles: [] },
      operatorQuestion: {
        plainLanguageQuestion: 'Which repair path should Symphony use?',
        plainLanguageSummary: 'The PR is blocked by workflow setup.',
        requestedAction: 'Choose repair lane',
        canNotifyNow: true,
        quietHours: { appliesNow: false, summary: 'Quiet hours are not active.' },
      },
      operatorAnswers: [],
      handoffTimeline: {
        events: [
          { stage: 'jules_launch', label: 'Jules launched', occurredAt: generatedAt, source: 'symphony', status: 'recorded' },
          { stage: 'github_pr', label: 'PR detected', occurredAt: generatedAt, source: 'github', status: 'recorded' },
        ],
      },
      next_action: {
        code: 'answer_operator_question',
        tone: 'blocked',
        label: 'Answer repair decision',
        summary: 'Needs operator input.',
        steps: ['Choose repair path.'],
      },
      localSyncStatus: null,
      links: {
        taskDetail: '/api/v1/tasks/handoff-ara6',
      },
    }, {
      id: 'handoff-merged',
      title: 'Merged dashboard-started proof',
      status: 'sent_to_jules',
      createdAt: generatedAt,
      updatedAt: generatedAt,
      julesState: 'COMPLETED',
      githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/930',
      githubPullRequestState: 'MERGED',
      githubPullRequestChecks: { conclusion: 'success', pending: 0, failed: 0 },
      githubPullRequestFiles: { risk: 'low', riskReasons: [], outOfScopeFiles: [] },
      next_action: {
        code: 'wait_for_deployment',
        tone: 'waiting',
        label: 'Wait for deployment proof',
        summary: 'Merged and waiting on deployment evidence.',
        steps: ['Check deployment.'],
      },
      localSyncStatus: null,
    }],
    taskRouting: null,
    taskNudges: {
      total: 0,
      summary: 'No nudges.',
      latest: null,
      recent: [],
      nextNudgeAt: null,
      scheduler: {
        checkedAt: generatedAt,
        status: 'idle',
        summary: 'No nudges due.',
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
      status: 'waiting',
      currentBoundary: 'github_pr',
      currentBoundaryLabel: 'GitHub PR',
      summary: 'Repair decision is the current useful boundary.',
      nextExpectedProof: 'Operator answer receipt or repair push receipt.',
      foremanAction: {
        boundary: 'github_pr',
        boundaryLabel: 'GitHub PR',
        label: 'Answer repair decision',
        status: 'blocked',
        safety: 'operator_only',
        canRunNow: false,
        method: 'NONE',
        instruction: 'Record the operator decision before mutating anything.',
      },
      stages: [],
    },
  };
}
