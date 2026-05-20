import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildDelegationRoiLedger, TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the Delegation ROI ledger contract. The ledger is
// allowed to say "unknown" while evidence is incomplete, but it must never
// dress an avoided-work guess up as measured Codex savings.

const ara6LikeHandoff = {
  id: 'handoff-ara6',
  draftId: 'draft-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Add regression coverage for non-proficient weapon attack penalties.',
  expectedFiles: ['src/**/*.ts'],
  verificationCommands: ['npm test -- --runInBand'],
  createdAt: '2026-05-19T21:38:28.033Z',
  updatedAt: '2026-05-19T23:52:00.000Z',
  launchedAt: '2026-05-19T21:38:28.033Z',
  lastStatusRefreshAt: '2026-05-19T23:38:21.149Z',
  lastPullRequestRefreshAt: '2026-05-19T23:52:00.000Z',
  julesSessionId: '4101281510355198885',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
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
      checkNames: ['Build', 'Lint', 'Tests', 'Quality Scan (advisory)'],
      evidence: ['npm ci failed before tests ran'],
      summary: 'Build, lint, tests, and advisory quality scan failed together.',
      nextAction: 'Inspect failed check logs.',
      mutatesExternalSystems: false,
    }],
  },
  githubPullRequestFiles: {
    risk: 'low',
    riskReasons: [],
    outOfScopeFiles: [],
  },
  githubPullRequestRepairDecision: {
    status: 'needs_operator_decision',
  },
  operatorMessages: [],
  planApprovals: [{ id: 'approval-1' }],
};

const ledger = buildDelegationRoiLedger({
  handoff: ara6LikeHandoff,
  taskNudges: [{
    subjectId: 'handoff-ara6',
    action: 'refresh',
    phase: 'github_pr',
  }],
});

assert.equal(ledger.status, 'roi_unknown');
assert.equal(ledger.separatesMeasuredFactsFromEstimates, true);
assert.equal(ledger.measuredFacts.codexTokens.total, null);
assert.equal(ledger.measuredFacts.codexTokens.source, 'missing');
assert.equal(ledger.measuredFacts.humanInterventionCount, 2);
assert.equal(ledger.workflowValueSignals.julesProducedPullRequest, true);
assert.equal(ledger.workflowValueSignals.prStayedWithinDeclaredScope, true);
assert.equal(ledger.workflowValueSignals.codexAvoidedLocalImplementation, true);
assert.equal(ledger.workflowValueSignals.stalledBecause, 'ci_setup');
assert.equal(ledger.estimatedAvoidedCodexWork.status, 'missing_estimate');
assert.match(ledger.verdict, /ROI unknown/);
assert.match(ledger.verdict, /measured task-scoped Codex spend/);
assert.match(ledger.verdict, /avoided-work estimate/);

const measuredLedger = buildDelegationRoiLedger({
  handoff: ara6LikeHandoff,
  codexUsage: {
    inputTokens: 1200,
    outputTokens: 300,
    totalTokens: 1500,
    secondsRunning: 42,
    source: 'codex_totals',
  },
});

assert.equal(measuredLedger.status, 'roi_unknown');
assert.equal(measuredLedger.measuredFacts.codexTokens.input, 1200);
assert.equal(measuredLedger.measuredFacts.codexTokens.output, 300);
assert.equal(measuredLedger.measuredFacts.codexTokens.total, 1500);
assert.equal(measuredLedger.measuredFacts.codexTokens.source, 'codex_totals');
assert.equal(measuredLedger.measuredFacts.codexActiveRuntimeSeconds, 42);
assert.match(measuredLedger.measuredFacts.dataSources.join(','), /codex_totals/);
assert.equal(measuredLedger.estimatedAvoidedCodexWork.status, 'missing_estimate');

const taskScopedUsageLedger = buildDelegationRoiLedger({
  handoff: {
    ...ara6LikeHandoff,
    delegationRoiForemanUsage: [{
      id: 'foreman-usage-1',
      handoffId: 'handoff-ara6',
      source: 'manual_codex_receipt',
      inputTokens: 2100,
      outputTokens: 700,
      totalTokens: 2800,
      activeRuntimeSeconds: 180,
      foremanTurns: 6,
      notes: 'Measured from the Codex thread usage while following Jules.',
      recordedAt: '2026-05-20T01:00:00.000Z',
      recordedBy: 'codex_foreman',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    }],
  },
});

assert.equal(taskScopedUsageLedger.status, 'roi_unknown');
assert.equal(taskScopedUsageLedger.measuredFacts.codexTokens.total, null);
assert.equal(taskScopedUsageLedger.measuredFacts.taskScopedForemanUsage.totalTokens, 2800);
assert.equal(taskScopedUsageLedger.measuredFacts.taskScopedForemanUsage.foremanTurns, 6);
assert.equal(taskScopedUsageLedger.measuredFacts.taskScopedForemanUsage.receiptCount, 1);
assert.match(taskScopedUsageLedger.measuredFacts.dataSources.join(','), /task_scoped_foreman_usage/);
assert.equal(taskScopedUsageLedger.estimatedAvoidedCodexWork.status, 'missing_estimate');

const candidateLedger = buildDelegationRoiLedger({
  handoff: {
    ...ara6LikeHandoff,
    delegationRoiEstimate: {
      status: 'documented_estimate',
      estimatedLocalCodexImplementationTurns: 5,
      estimatedLocalCodexTokens: 9000,
      estimatedDebuggingCycles: 2,
      confidence: 'low',
      method: 'Compared against similar local Codex implementation and check-repair tasks.',
      caveats: ['Counterfactual estimate, not measured savings.'],
      recordedAt: '2026-05-20T00:00:00.000Z',
      recordedBy: 'operator',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    },
  },
  codexUsage: {
    inputTokens: 1200,
    outputTokens: 300,
    totalTokens: 1500,
    secondsRunning: 42,
    source: 'codex_totals',
  },
});

assert.equal(candidateLedger.status, 'candidate_savings');
assert.equal(candidateLedger.estimatedAvoidedCodexWork.status, 'documented_estimate');
assert.equal(candidateLedger.estimatedAvoidedCodexWork.estimatedLocalCodexTokens, 9000);
assert.equal(candidateLedger.estimatedAvoidedCodexWork.mutatesExternalSystems, false);
assert.match(candidateLedger.verdict, /Candidate savings/);

const candidateFromTaskScopedUsageLedger = buildDelegationRoiLedger({
  handoff: {
    ...ara6LikeHandoff,
    delegationRoiForemanUsage: [{
      id: 'foreman-usage-2',
      handoffId: 'handoff-ara6',
      source: 'manual_codex_receipt',
      inputTokens: 2100,
      outputTokens: 700,
      totalTokens: 2800,
      activeRuntimeSeconds: 180,
      foremanTurns: 6,
      notes: 'Measured from the Codex thread usage while following Jules.',
      recordedAt: '2026-05-20T01:00:00.000Z',
      recordedBy: 'codex_foreman',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    }],
    delegationRoiEstimate: {
      status: 'documented_estimate',
      estimatedLocalCodexImplementationTurns: 5,
      estimatedLocalCodexTokens: 9000,
      estimatedDebuggingCycles: 2,
      confidence: 'low',
      method: 'Compared against similar local Codex implementation and check-repair tasks.',
      caveats: ['Counterfactual estimate, not measured savings.'],
      recordedAt: '2026-05-20T00:00:00.000Z',
      recordedBy: 'operator',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    },
  },
});

assert.equal(candidateFromTaskScopedUsageLedger.status, 'candidate_savings');
assert.equal(candidateFromTaskScopedUsageLedger.measuredFacts.taskScopedForemanUsage.totalTokens, 2800);

const broadGoalContextUsageLedger = buildDelegationRoiLedger({
  handoff: {
    ...ara6LikeHandoff,
    delegationRoiForemanUsage: [{
      id: 'foreman-usage-goal-context',
      handoffId: 'handoff-ara6',
      source: 'codex_goal_context',
      inputTokens: null,
      outputTokens: null,
      totalTokens: 11748522,
      activeRuntimeSeconds: null,
      foremanTurns: null,
      notes: 'Broad active-goal context usage from the long-running Codex thread.',
      recordedAt: '2026-05-20T10:00:00.000Z',
      recordedBy: 'codex_foreman',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    }],
    delegationRoiEstimate: {
      status: 'documented_estimate',
      estimatedLocalCodexImplementationTurns: 5,
      estimatedLocalCodexTokens: 9000,
      estimatedDebuggingCycles: 2,
      confidence: 'low',
      method: 'Compared against similar local Codex implementation and check-repair tasks.',
      caveats: ['Counterfactual estimate, not measured savings.'],
      recordedAt: '2026-05-20T00:00:00.000Z',
      recordedBy: 'operator',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    },
  },
});

assert.equal(broadGoalContextUsageLedger.status, 'roi_unknown');
assert.equal(broadGoalContextUsageLedger.measuredFacts.taskScopedForemanUsage.totalTokens, null);
assert.equal(broadGoalContextUsageLedger.measuredFacts.taskScopedForemanUsage.receiptCount, 0);
assert.equal(broadGoalContextUsageLedger.measuredFacts.goalContextForemanUsage.totalTokens, 11748522);
assert.equal(broadGoalContextUsageLedger.measuredFacts.goalContextForemanUsage.receiptCount, 1);
assert.match(broadGoalContextUsageLedger.measuredFacts.dataSources.join(','), /goal_context_foreman_usage/);
assert.match(broadGoalContextUsageLedger.verdict, /task-scoped Codex spend/);

const tempRoot = await mkdtemp(join(tmpdir(), 'symphony-roi-ledger-'));
const storePath = join(tempRoot, 'task-drafts.json');
await writeFile(storePath, JSON.stringify({
  drafts: [],
  handoffs: [ara6LikeHandoff],
  gitDisposition: [],
  taskNudges: [],
}, null, 2));

try {
  const store = new TaskIntakeStore({
    repoRoot: resolve(process.cwd(), '..', '..'),
    storePath,
  });
  const snapshot = await store.recordDelegationRoiEstimate('handoff-ara6', {
    estimatedLocalCodexImplementationTurns: 5,
    estimatedLocalCodexTokens: 9000,
    estimatedDebuggingCycles: 2,
    confidence: 'medium',
    method: 'Compared against similar local Codex implementation and check-repair tasks.',
    caveats: 'Counterfactual estimate, not measured savings.',
  });
  const storedHandoff = snapshot.handoffs.find(handoff => handoff.id === 'handoff-ara6');

  assert.equal(storedHandoff.delegationRoiLedger.estimatedAvoidedCodexWork.status, 'documented_estimate');
  assert.equal(storedHandoff.delegationRoiLedger.estimatedAvoidedCodexWork.confidence, 'medium');
  assert.equal(storedHandoff.delegationRoiLedger.estimatedAvoidedCodexWork.mutatesExternalSystems, false);
  assert.equal(storedHandoff.delegationRoiLedger.status, 'roi_unknown');

  const usageSnapshot = await store.recordDelegationRoiForemanUsage('handoff-ara6', {
    inputTokens: 2100,
    outputTokens: 700,
    totalTokens: 2800,
    activeRuntimeSeconds: 180,
    foremanTurns: 6,
    source: 'manual_codex_receipt',
    notes: 'Measured from the Codex thread usage while following Jules.',
  });
  const usageHandoff = usageSnapshot.handoffs.find(handoff => handoff.id === 'handoff-ara6');

  assert.equal(usageHandoff.delegationRoiForemanUsage.length, 1);
  assert.equal(usageHandoff.delegationRoiForemanUsage[0].mutatesExternalSystems, false);
  assert.equal(usageHandoff.delegationRoiForemanUsage[0].mutatesLocalFiles, false);
  assert.equal(usageHandoff.delegationRoiLedger.measuredFacts.taskScopedForemanUsage.totalTokens, 2800);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderDelegationRoiLedger/);
assert.equal((dashboard.match(/function renderDelegationRoiLedger/g) || []).length, 1);
assert.match(dashboard, /Measured facts/);
assert.match(dashboard, /Estimated avoided Codex work/);
assert.match(dashboard, /Workflow value signals/);
assert.match(dashboard, /ROI unknown/);
assert.match(dashboard, /Record ROI Estimate/);
assert.match(dashboard, /record-roi-estimate/);
assert.match(dashboard, /Record Foreman Usage/);
assert.match(dashboard, /record-roi-foreman-usage/);
assert.match(dashboard, /Goal-context foreman tokens/);

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(server, /roi-estimate/);
assert.match(server, /recordDelegationRoiEstimate/);
assert.match(server, /roi-foreman-usage/);
assert.match(server, /recordDelegationRoiForemanUsage/);
