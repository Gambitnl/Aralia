import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildJulesHandoffTimeline } from '../dist/task-intake.js';

// This verifier protects the task-centered timeline promised for Symphony.
// The timeline is read-only evidence: it must make the handoff history easier
// to follow without launching Jules, commenting on GitHub, or changing local Git.

const timeline = buildJulesHandoffTimeline({
  id: 'handoff-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  executor: 'jules',
  status: 'sent_to_jules',
  createdAt: '2026-05-19T21:30:00.000Z',
  updatedAt: '2026-05-19T23:55:00.000Z',
  linearIssueIdentifier: 'ARA-6',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-6/example',
  linearIssueCreatedAt: '2026-05-19T21:35:00.000Z',
  manifestPath: '.jules/runs/ara6/manifest.json',
  launchedAt: '2026-05-19T21:38:28.033Z',
  julesSessionId: '4101281510355198885',
  julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
  julesState: 'COMPLETED',
  lastStatusRefreshAt: '2026-05-19T23:38:21.149Z',
  planApprovals: [{
    id: 'approval-1',
    createdAt: '2026-05-19T22:00:00.000Z',
    status: 'approved',
    command: 'npx jules approve',
    output: 'approved',
    error: null,
  }],
  operatorMessages: [{
    id: 'message-1',
    body: 'Please keep the regression test scoped.',
    createdAt: '2026-05-19T22:10:00.000Z',
    status: 'sent',
    command: 'npx jules message',
    output: 'sent',
    error: null,
  }],
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
  githubPullRequestState: 'OPEN',
  githubPullRequestChecks: {
    conclusion: 'failing',
    total: 9,
    passed: 5,
    failed: 4,
    pending: 0,
    skipped: 0,
    unknown: 0,
    artifacts: [],
    blockers: [{
      category: 'workflow_setup',
      severity: 'blocking',
      checkNames: ['Build'],
      evidence: ['npm ci failed'],
      summary: 'Setup failed before task tests ran.',
      nextAction: 'Resolve setup blocker.',
      mutatesExternalSystems: false,
    }],
  },
  lastPullRequestRefreshAt: '2026-05-19T23:52:00.000Z',
  githubPullRequestRepairDecision: {
    status: 'needs_operator_decision',
    category: 'workflow_setup',
    question: 'Which repair lane should Symphony use?',
    plainLanguageSummary: 'Setup failed before tests ran.',
    recommendedFirstStep: 'Create setup repair task.',
    evidence: [],
    options: [],
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    nextExpectedProof: 'Chosen repair lane.',
  },
  operatorAnswers: [{
    id: 'answer-1',
    handoffId: 'handoff-ara6',
    selectedAction: 'create_setup_repair_task',
    answer: 'Create a local setup repair task first.',
    answeredBy: 'operator',
    answeredAt: '2026-05-19T23:53:00.000Z',
    sourceQuestion: 'Which repair lane should Symphony use?',
    sourceStage: 'repair_decision',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  }, {
    id: 'answer-2',
    handoffId: 'handoff-ara6',
    selectedAction: 'approve_repair_push',
    answer: 'Approve pushing the prepared lockfile repair after confirming the PR head still matches.',
    answeredBy: 'operator',
    answeredAt: '2026-05-19T23:57:00.000Z',
    sourceQuestion: 'Do you approve pushing the prepared repair to the Jules PR?',
    sourceStage: 'repair_push_approval',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  }],
  repairLaneExecutions: [{
    id: 'repair-lane-1',
    handoffId: 'handoff-ara6',
    selectedAction: 'create_setup_repair_task',
    status: 'local_draft_created',
    createdAt: '2026-05-19T23:54:00.000Z',
    createdDraftId: 'draft-setup-repair',
    summary: 'Created local setup repair draft draft-setup-repair.',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  }],
  repairPushReadiness: {
    handoffId: 'handoff-ara6',
    status: 'awaiting_operator_push_approval',
    source: 'local_commit',
    recordedAt: '2026-05-19T23:56:00.000Z',
    worktreePath: 'F:/Repos/Aralia/.worktrees/pr-931-setup-repair',
    branch: 'codex/pr-931-setup-repair',
    commit: '19eb1cd4',
    repairBaseCommit: '0c0d9480',
    targetPullRequestHeadCommit: '0c0d9480',
    freshnessStatus: 'matches_current_pr_head',
    isBasedOnCurrentPullRequestHead: true,
    freshnessSummary: 'Repair base 0c0d9480 matches the current PR head 0c0d9480.',
    targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    changedFiles: ['package-lock.json'],
    verificationCommands: ['npm ci --dry-run'],
    verificationSummary: 'Lockfile repair verified locally.',
    pushCommand: 'git push origin codex/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
    canPushNow: false,
    mutatesExternalSystemsIfRun: true,
    mutatesLocalFiles: false,
    postPushFollowUp: {
      status: 'waiting_for_operator_push',
      expectedSequence: ['operator_pushes_repair', 'github_checks_rerun', 'symphony_refreshes_pr', 'scout_core_readiness_updates'],
      checksCommand: 'gh pr checks 931 --repo Gambitnl/Aralia',
      refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6/refresh-pr',
      scoutCoreReadinessEndpoint: '/api/v1/task-drafts',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      summary: 'After the operator pushes the repair, watch GitHub checks.',
    },
    nextExpectedProof: 'GitHub checks rerun.',
    summary: 'Local repair commit 19eb1cd4 is ready for operator-approved push.',
  },
  repairPushResult: {
    handoffId: 'handoff-ara6',
    status: 'pushed',
    pushedCommit: '19eb1cd4',
    targetPullRequestHeadCommit: '19eb1cd4',
    pushedAt: '2026-05-19T23:58:00.000Z',
    recordedAt: '2026-05-19T23:58:30.000Z',
    pushedBy: 'operator',
    evidenceUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    summary: 'Operator pushed the local setup repair.',
    checksCommand: 'gh pr checks 931 --repo Gambitnl/Aralia',
    refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6/refresh-pr',
    nextBoundary: 'github_checks_rerun',
    nextExpectedProof: 'GitHub checks complete after the repair push.',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  },
  delegationRoiLedger: {
    status: 'roi_unknown',
    generatedAt: '2026-05-20T00:00:00.000Z',
    handoffId: 'handoff-ara6',
    summary: 'ROI unknown.',
    verdict: 'ROI unknown.',
    separatesMeasuredFactsFromEstimates: true,
    measuredFacts: {
      codexTokens: { input: null, output: null, total: null, source: 'missing' },
      codexActiveRuntimeSeconds: null,
      codexForemanEventCount: 1,
      julesElapsedSeconds: 7193,
      githubElapsedSeconds: 819,
      humanInterventionCount: 3,
      localCodexEditedProductionFiles: null,
      dataSources: ['task_handoff_record'],
    },
    estimatedAvoidedCodexWork: {
      status: 'missing_estimate',
      estimatedLocalCodexImplementationTurns: null,
      estimatedLocalCodexTokens: null,
      estimatedDebuggingCycles: null,
      confidence: 'missing',
      method: null,
      caveats: [],
    },
    workflowValueSignals: {
      delegatedToJules: true,
      julesProducedPullRequest: true,
      prStayedWithinDeclaredScope: null,
      codexAvoidedLocalImplementation: true,
      humanInterventionsNeeded: 3,
      stalledBecause: 'ci_setup',
      pullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    },
  },
  deploymentEvidence: {
    handoffId: 'handoff-ara6',
    status: 'waived',
    source: 'operator_waiver',
    evidenceUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    summary: 'Operator waived deployment proof for this verifier fixture.',
    checkedAt: '2026-05-20T00:05:00.000Z',
    recordedAt: '2026-05-20T00:05:30.000Z',
    recordedBy: 'operator',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  },
}, [{
  id: 'nudge-ara6-pr-refresh',
  subjectId: 'handoff-ara6',
  subjectKind: 'handoff',
  subjectTitle: 'Add regression coverage for non-proficient weapon attack penalties',
  action: 'refresh',
  phase: 'github_pr',
  note: 'Refresh GitHub checks after the current pause instead of polling in a tight loop.',
  createdAt: '2026-05-19T23:52:30.000Z',
  pauseSeconds: 300,
  nextNudgeAt: '2026-05-19T23:57:30.000Z',
  status: 'recorded',
  mutatesExternalSystems: false,
}]);

assert.equal(timeline.handoffId, 'handoff-ara6');
assert.equal(timeline.mutatesExternalSystems, false);
assert.equal(timeline.mutatesLocalFiles, false);
assert.equal(timeline.events[0].stage, 'task_created');
assert.deepEqual(timeline.events.map(event => event.stage), [
  'task_created',
  'linear_issue',
  'jules_manifest',
  'jules_launch',
  'jules_plan_approval',
  'operator_message',
  'jules_status_refresh',
  'github_pr_refresh',
  'repair_decision',
  'task_nudge',
  'operator_answer',
  'repair_lane_execution',
  'repair_push_readiness',
  'operator_answer',
  'repair_push_result',
  'delegation_roi',
  'deployment_evidence',
]);
assert(timeline.events.every((event, index, events) => index === 0 || event.sortKey >= events[index - 1].sortKey));
assert.match(timeline.summary, /17 timeline event/);
assert.match(timeline.nextExpectedProof, /GitHub checks complete after the repair push/i);
assert(timeline.events.every(event => event.mutatesExternalSystems === false));
assert(timeline.events.every(event => event.mutatesLocalFiles === false));
assert.match(timeline.events.find(event => event.stage === 'task_nudge')?.detail ?? '', /refresh \/ github_pr/);
assert.match(timeline.events.find(event => event.stage === 'task_nudge')?.detail ?? '', /Next check: 2026-05-19T23:57:30\.000Z after 300 second/);
assert.match(timeline.events.find(event => event.stage === 'operator_answer')?.detail ?? '', /create_setup_repair_task/);
assert.match(timeline.events.find(event => event.id.includes('answer-2'))?.label ?? '', /Repair push approval answer/);
assert.match(timeline.events.find(event => event.id.includes('answer-2'))?.detail ?? '', /approve_repair_push/);
assert.match(timeline.events.find(event => event.stage === 'repair_push_readiness')?.detail ?? '', /operator-approved push/);
assert.match(timeline.events.find(event => event.stage === 'repair_push_result')?.detail ?? '', /Operator pushed/);
assert.match(timeline.events.find(event => event.stage === 'deployment_evidence')?.detail ?? '', /waived deployment proof/);

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderHandoffTimeline/);
assert.match(dashboard, /Task timeline/);
assert.match(dashboard, /timeline-event/);
