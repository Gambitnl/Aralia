import assert from 'node:assert/strict';
import { Orchestrator } from '../dist/orchestrator.js';

// This verifier protects the live usage/spending pressure surface. The
// dashboard advertises /api/v1/state.rate_limits as the authoritative snapshot,
// so the orchestrator must retain rate-limit events instead of only preserving
// them as per-worker activity text.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const orchestrator = new Orchestrator(undefined, logger);
const state = orchestrator.state;

state.running.set('issue-rate-limit', {
  issue: {
    id: 'issue-rate-limit',
    identifier: 'ARA-usage',
    title: 'Track usage',
    description: null,
    priority: null,
    state: 'In Progress',
    branchName: null,
    url: null,
    labels: [],
    blockedBy: [],
    createdAt: null,
    updatedAt: null,
  },
  identifier: 'ARA-usage',
  workspace: {
    path: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-usage',
    workspaceKey: 'ARA-usage',
    createdNow: false,
  },
  attempt: null,
  workerHandle: { abort() {} },
  workerDesignation: {
    designation: 'worker-ARA-usage-run-0001',
    runNumber: 1,
    attempt: null,
    issueIdentifier: 'ARA-usage',
    workspacePath: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-usage',
    threadId: null,
    model: null,
    reasoningEffort: null,
    startedAt: new Date('2026-05-17T00:00:00.000Z'),
  },
  sessionId: null,
  codexAppServerPid: null,
  startedAt: new Date('2026-05-17T00:00:00.000Z'),
  lastEventAt: new Date('2026-05-17T00:00:00.000Z'),
  lastCodexEvent: null,
  lastCodexTimestamp: null,
  lastCodexMessage: '',
  lastReadableCodexTimestamp: null,
  lastError: null,
  waitingOnApproval: false,
  approvalSummary: null,
  pendingApproval: null,
  recentCodexEvents: [],
  codexInputTokens: 0,
  codexOutputTokens: 0,
  codexTotalTokens: 0,
  lastReportedInputTokens: 0,
  lastReportedOutputTokens: 0,
  lastReportedTotalTokens: 0,
  turnCount: 0,
});

const rateLimits = {
  planType: 'prolite',
  rateLimitReachedType: null,
  primary: {
    usedPercent: 64,
    windowDurationMins: 300,
    resetsAt: 1778984151,
  },
  secondary: {
    usedPercent: 12,
    windowDurationMins: 10080,
    resetsAt: 1779570951,
  },
  credits: {
    usedUsd: 3.25,
    remainingUsd: 16.75,
  },
};

orchestrator.handleCodexEvent('issue-rate-limit', {
  event: 'notification',
  timestamp: new Date('2026-05-17T00:00:01.000Z'),
  payload: { rateLimits },
});

assert.deepEqual(state.codexRateLimits, rateLimits);

const activity = orchestrator.getIssueActivity('ARA-usage');
assert(activity, 'Issue activity should be available for the running issue.');
assert.equal(activity.activity[0].source_type, 'rateLimits');
assert.match(activity.activity[0].detail, /Primary window used: 64%/);
assert.match(activity.activity[0].detail, /Weekly window used: 12%/);
assert.match(activity.activity[0].detail, /Plan: prolite/);
assert.match(activity.activity[0].detail, /Credits used: \$3\.25/);
assert.match(activity.activity[0].detail, /Credits remaining: \$16\.75/);
