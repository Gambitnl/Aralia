import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPullRequestNextAction,
  buildPullRequestRepairDecision,
  summarizePullRequestChecks,
} from '../dist/task-intake.js';

// This verifier protects the bridge between GitHub Actions improvements and
// Symphony's PR foreman surface. A CI job is not useful to Symphony if its
// machine-readable artifact stays buried in GitHub logs.

const checks = summarizePullRequestChecks([
  {
    name: 'Quality Scan (advisory)',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: 'https://github.com/example/aralia/actions/runs/123456789/job/987654321',
  },
  {
    name: 'Build',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
  },
]);

assert.equal(checks.conclusion, 'passing');
assert.equal(checks.artifacts.length, 1);
assert.equal(checks.artifacts[0].checkName, 'Quality Scan (advisory)');
assert.equal(checks.artifacts[0].artifactName, 'quality-scan-json');
assert.equal(checks.artifacts[0].detailsUrl, 'https://github.com/example/aralia/actions/runs/123456789/job/987654321');
assert.match(checks.artifacts[0].summary, /GitHub step summary/);
assert.match(checks.artifacts[0].summary, /Machine-readable/);

const ara6SetupBlockedChecks = summarizePullRequestChecks([
  {
    name: '🔨 Build',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/Gambitnl/Aralia/actions/runs/26130846019/job/76855371593',
  },
  {
    name: '🎨 Lint',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/Gambitnl/Aralia/actions/runs/26130846019/job/76855371572',
  },
  {
    name: '🧪 Tests',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/Gambitnl/Aralia/actions/runs/26130846019/job/76855371553',
  },
  {
    name: 'Quality Scan (advisory)',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/Gambitnl/Aralia/actions/runs/26130846019/job/76855371550',
  },
]);

assert.equal(ara6SetupBlockedChecks.conclusion, 'failing');
assert.deepEqual(ara6SetupBlockedChecks.failedChecks.map(check => check.name), ['🔨 Build', '🎨 Lint', '🧪 Tests', 'Quality Scan (advisory)']);
assert.equal(ara6SetupBlockedChecks.failedChecks[0].detailsUrl, 'https://github.com/Gambitnl/Aralia/actions/runs/26130846019/job/76855371593');
assert.equal(ara6SetupBlockedChecks.blockers.length, 1);
assert.equal(ara6SetupBlockedChecks.blockers[0].category, 'workflow_setup');
assert.equal(ara6SetupBlockedChecks.blockers[0].mutatesExternalSystems, false);
assert.match(ara6SetupBlockedChecks.blockers[0].summary, /shared setup or dependency-install step/i);
assert.match(ara6SetupBlockedChecks.blockers[0].nextAction, /inspect the failed check logs/i);
assert.deepEqual(ara6SetupBlockedChecks.blockers[0].checkNames, ['🔨 Build', '🎨 Lint', '🧪 Tests', 'Quality Scan (advisory)']);

const setupNextAction = buildPullRequestNextAction({
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  checks: ara6SetupBlockedChecks,
  files: { risk: 'low', riskReasons: [], outOfScopeFiles: [] },
  scoutReviewCommand: 'gh pr view 931 --comments --files',
  julesFeedbackCommand: 'gh pr comment 931 --body-file .jules/feedback/handoff-1-pr-feedback.md',
  coreValidationCommand: null,
  coreMergeCommand: null,
  refreshPullRequestUrl: null,
});

const setupRepairDecision = buildPullRequestRepairDecision({
  handoffId: 'handoff-1',
  checks: ara6SetupBlockedChecks,
  nextAction: setupNextAction,
  julesFeedbackCommand: 'gh pr comment 931 --body-file .jules/feedback/handoff-1-pr-feedback.md',
  refreshPullRequestUrl: '/api/v1/jules-handoffs/handoff-1/refresh-pr',
  generatedAt: '2026-05-20T00:00:00.000Z',
});

assert(setupRepairDecision);
assert.equal(setupRepairDecision.status, 'needs_operator_decision');
assert.equal(setupRepairDecision.category, 'workflow_setup');
assert.equal(setupRepairDecision.mutatesExternalSystems, false);
assert.equal(setupRepairDecision.mutatesLocalFiles, false);
assert.match(setupRepairDecision.question, /separate setup repair task/);
assert.match(setupRepairDecision.recommendedFirstStep, /failed GitHub check logs/);
assert(setupRepairDecision.options.some(option => option.id === 'create_setup_repair_task' && option.requiresOperatorApproval));
assert(setupRepairDecision.options.some(option => option.id === 'send_jules_feedback' && option.mutatesExternalSystemsIfRun));
assert(setupRepairDecision.options.some(option => option.id === 'refresh_after_repair' && !option.mutatesExternalSystemsIfRun));

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderPullRequestCheckArtifacts/);
assert.match(dashboard, /function renderPullRequestCheckBlockers/);
assert.match(dashboard, /function renderPullRequestRepairDecision/);
assert.match(dashboard, /Check blocker classification/);
assert.match(dashboard, /Repair decision needed/);
assert.match(dashboard, /human-friendly fork/);
assert.match(dashboard, /foreman-level ownership/);
assert.match(dashboard, /quality-scan-json/);
assert.match(dashboard, /GitHub step summary/);
assert.match(dashboard, /Machine-readable CI artifact/);
assert.match(dashboard, /artifact\.detailsUrl/);
assert.match(dashboard, /Open check details/);
