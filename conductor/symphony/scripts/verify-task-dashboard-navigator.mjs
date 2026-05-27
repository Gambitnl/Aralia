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
assert.match(dashboardSource, /refresh-local-sync/);
assert.match(dashboardSource, /Check Local Sync/);
assert.match(dashboardSource, /PACKAGE_PACKET_DRAFTS/);
assert.match(dashboardSource, /function createPackagePacketDraft/);
assert.match(dashboardSource, /function renderPackagePacketDraftButtons/);
assert.match(dashboardSource, /data-foreman-group/);
assert.match(dashboardSource, /PACKAGE_10_TARGET_FILTER_DRAFT/);
assert.match(dashboardSource, /PACKAGE_11_STATUS_STATE_DRAFT/);
assert.match(dashboardSource, /PACKAGE_12_CONDITIONAL_ENDING_DRAFT/);
assert.match(dashboardSource, /PACKAGE_13_TERRAIN_SURFACE_DRAFT/);
assert.match(dashboardSource, /PACKAGE_14_VISION_LIGHT_SOUND_DRAFT/);
assert.match(dashboardSource, /PACKAGE_15_SUMMON_CONTROLLED_ENTITY_DRAFT/);
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
assert.match(navigatorHtml, /All tasks: 4/);
assert.match(navigatorHtml, /Needs input: 1/);
assert.match(navigatorHtml, /Open: 2/);
assert.match(navigatorHtml, /Completed: 1/);
assert.match(navigatorHtml, /Archived: 1/);
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
assert.match(navigatorHtml, /Task message author/);
assert.match(navigatorHtml, /Codex foreman/);
assert.match(navigatorHtml, /Record Task Message/);
assert.match(navigatorHtml, /data-task-action="record-task-message"/);
assert.match(navigatorHtml, /href="\/api\/v1\/tasks\/handoff-ara6"/);
assert.match(html, /Package Packet Drafts/);
assert.match(html, /Create Package 10 Draft/);
assert.match(html, /data-task-action="create-package10-target-filter-draft"/);
assert.match(html, /Create Package 11 Draft/);
assert.match(html, /data-task-action="create-package11-status-state-draft"/);
assert.match(html, /Create Package 12 Draft/);
assert.match(html, /data-task-action="create-package12-conditional-ending-draft"/);
assert.match(html, /Create Package 13 Draft/);
assert.match(html, /data-task-action="create-package13-terrain-surface-draft"/);
assert.match(html, /Create Package 14 Draft/);
assert.match(html, /data-task-action="create-package14-vision-light-sound-draft"/);
assert.match(html, /Create Package 15 Draft/);
assert.match(html, /data-task-action="create-package15-summon-controlled-entity-draft"/);
assert.match(html, /Create Package 16 Draft/);
assert.match(html, /data-task-action="create-package16-sustain-recast-action-draft"/);
assert.match(navigatorHtml, /Current boundary/);
assert.match(navigatorHtml, /Answer repair decision/);
assert.match(navigatorHtml, /Jules session/);
assert.match(navigatorHtml, /GitHub PR/);
assert.match(navigatorHtml, /Timeline events: 2/);
assert.match(navigatorHtml, /Needs human input/);
assert.match(navigatorHtml, /Promoted draft record/);
assert.match(navigatorHtml, /Promoted to handoff handoff-merged/);

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
assert.doesNotMatch(needsInputNavigatorHtml, /Promoted draft record/);

const completedPathRoot = {
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
const completedPathSandbox = buildSandbox(null, completedPathRoot);
vm.runInNewContext(executableSource, completedPathSandbox, { filename: 'dashboard.js' });
const completedPathSnapshot = buildSnapshot();
completedPathSnapshot.middleman_path = {
  ...completedPathSnapshot.middleman_path,
  status: 'complete',
  currentBoundary: 'local_sync',
  currentBoundaryLabel: 'Local sync',
  summary: 'Merged PR is already present locally.',
  nextExpectedProof: 'Next package draft or handoff receipt.',
  foremanAction: {
    boundary: 'local_sync',
    boundaryLabel: 'Local sync',
    label: 'Wait for Local sync',
    status: 'complete',
    safety: 'operator_only',
    canRunNow: false,
    method: 'NONE',
    instruction: 'The prior handoff is complete; use task intake for the next package.',
  },
};
completedPathSandbox.renderTaskIntake(completedPathSnapshot);

// Completed handoff paths should reveal next-work controls. This protects the
// dashboard-first workflow from leaving the Package 15 shortcut hidden behind a
// collapsed drawer after the old package has already been locally reconciled.
assert.match(completedPathRoot.innerHTML, /<details class="foreman-detail-group" data-foreman-group="Task Intake And Records" open>\s*<summary>\s*<span>Task Intake And Records<\/span>/);
assert.match(completedPathRoot.innerHTML, /Create Package 15 Draft/);

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
assert.doesNotMatch(completedNavigatorHtml, /Promoted draft record/);

const archivedRoot = {
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
const archivedSandbox = buildSandbox('archived', archivedRoot);
vm.runInNewContext(executableSource, archivedSandbox, { filename: 'dashboard.js' });
archivedSandbox.renderTaskIntake(buildSnapshot());

const archivedNavigatorHtml = extractNavigatorHtml(archivedRoot.innerHTML);
assert.match(archivedNavigatorHtml, /Filter: Archived/);
assert.match(archivedNavigatorHtml, /Promoted draft record/);
assert.match(archivedNavigatorHtml, /promoted/);
assert.match(archivedNavigatorHtml, /Promoted to handoff handoff-merged/);
assert.doesNotMatch(archivedNavigatorHtml, /Setup repair draft/);
assert.doesNotMatch(archivedNavigatorHtml, /ARA-6 weapon proficiency regression/);

const answeredRoot = {
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
const answeredSandbox = buildSandbox(null, answeredRoot);
vm.runInNewContext(executableSource, answeredSandbox, { filename: 'dashboard.js' });
answeredSandbox.renderTaskIntake(buildAnsweredQuestionSnapshot());

const answeredNavigatorHtml = extractNavigatorHtml(answeredRoot.innerHTML);
assert.match(answeredNavigatorHtml, /Needs input: 0/);
assert.match(answeredNavigatorHtml, /Resolve Workflow Config Blocker/);
assert.doesNotMatch(answeredNavigatorHtml, /needs operator input/i);

const scoutRoot = {
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
const scoutSandbox = buildSandbox(null, scoutRoot);
vm.runInNewContext(executableSource, scoutSandbox, { filename: 'dashboard.js' });
scoutSandbox.renderTaskIntake(buildScoutCoreSnapshot());

const scoutNavigatorHtml = extractNavigatorHtml(scoutRoot.innerHTML);
assert.match(scoutNavigatorHtml, /Scout\/Core review/);
assert.match(scoutNavigatorHtml, /Scout review must clear risky files/);
assert.doesNotMatch(scoutNavigatorHtml, /Wait for PR Checks/);
assert.match(scoutRoot.innerHTML, /Marked feedback proves a GitHub PR comment exists/);
assert.match(scoutRoot.innerHTML, /active Jules session does not visibly show the latest feedback/);

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
    }, {
      id: 'draft-promoted',
      title: 'Promoted draft record',
      body: 'This draft already became a Jules handoff.',
      status: 'ready_for_handoff',
      expectedFiles: ['src/components/Widget.tsx'],
      verificationCommands: ['npm test'],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      next_action: {
        code: 'stage_jules_manifest',
        tone: 'ready',
        label: 'Stage Jules Manifest',
        summary: 'This old draft should not be counted as open once a handoff exists.',
        steps: ['Stage manifest.'],
      },
      links: {
        taskDetail: '/api/v1/tasks/draft-promoted',
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
      draftId: 'draft-promoted',
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

function buildAnsweredQuestionSnapshot() {
  const snapshot = buildSnapshot();
  const handoff = snapshot.handoffs[0];
  handoff.operatorQuestion.sourceStage = 'repair_decision';
  handoff.operatorAnswers = [{
    selectedAction: 'create_setup_repair_task',
    answer: 'Create a setup repair task before asking Jules to change task code.',
    answeredBy: 'operator',
    answeredAt: snapshot.preflight.checkedAt,
    sourceQuestion: handoff.operatorQuestion.plainLanguageQuestion,
    sourceStage: handoff.operatorQuestion.sourceStage,
  }];
  handoff.next_action = {
    code: 'repair_failed_checks',
    tone: 'blocked',
    label: 'Resolve Workflow Config Blocker',
    summary: 'The decision has been recorded; repair the workflow setup before sending Jules feedback.',
    steps: ['Create setup repair task.'],
  };
  return snapshot;
}

function buildScoutCoreSnapshot() {
  const snapshot = buildSnapshot();
  snapshot.drafts = [];
  snapshot.handoffs = [{
    id: 'handoff-scout-core',
    title: 'Package 3 Scout/Core proof',
    status: 'sent_to_jules',
    createdAt: snapshot.preflight.checkedAt,
    updatedAt: snapshot.preflight.checkedAt,
    julesState: 'FAILED',
    githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/954',
    githubPullRequestState: 'OPEN',
    githubPullRequestChecks: { conclusion: 'pending', pending: 4, failed: 0 },
    githubPullRequestFiles: { risk: 'high', riskReasons: ['Outside declared Jules write scope.'], outOfScopeFiles: ['src/components/CharacterCreator/Class/SpellCard.tsx'] },
    githubPullRequestFeedback: {
      totalComments: 1,
      summary: '1 Jules feedback comment(s), 0 Scout conflict comment(s), 0 external review comment(s).',
      julesFeedback: [{
        author: 'Gambitnl',
        body: '[Jules feedback]\nPlease repair the Scout acceptance blockers before Core merge.',
        url: 'https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519567250',
        createdAt: snapshot.preflight.checkedAt,
        source: 'comment',
      }],
      scoutConflictComments: [],
      externalReviewComments: [],
    },
    handoffTimeline: { events: [] },
    next_action: {
      code: 'wait_for_checks',
      tone: 'waiting',
      label: 'Wait for PR Checks',
      summary: 'GitHub checks are not conclusively passing yet.',
      steps: ['Refresh PR checks after GitHub updates.'],
    },
    scout_core_readiness: {
      status: 'blocked_by_scout',
      nextBoundary: 'scout_core',
      canRefreshNow: true,
      canScoutReviewNow: true,
      canCoreValidateNow: false,
      canCoreMergeNow: false,
      refreshUrl: '/api/v1/jules-handoffs/handoff-scout-core/refresh-pr',
      blockers: ['Scout review must clear risky files before Core validates.'],
      expectedNextProof: 'Scout/Core readiness, conflict bridge result, or explicit review blocker.',
      nextAction: {
        code: 'wait_for_checks',
        tone: 'waiting',
        label: 'Wait for PR Checks',
        summary: 'GitHub checks are not conclusively passing yet.',
        steps: ['Refresh PR checks after GitHub updates.'],
      },
    },
  }];
  snapshot.middleman_path = {
    status: 'blocked',
    currentBoundary: 'scout_core',
    currentBoundaryLabel: 'Scout/Core review',
    summary: 'Scout/Core review: risky files need attention.',
    nextExpectedProof: 'Scout/Core readiness, conflict bridge result, or explicit review blocker.',
    foremanAction: {
      boundary: 'scout_core',
      boundaryLabel: 'Scout/Core review',
      label: 'Refresh Scout/Core Evidence',
      status: 'blocked',
      safety: 'external_read',
      canRunNow: true,
      method: 'POST',
      endpoint: '/api/v1/jules-handoffs/handoff-scout-core/refresh-pr',
      instruction: 'Refresh the GitHub PR evidence that Scout/Core depends on.',
    },
    stages: [],
  };
  return snapshot;
}
