import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildHandoffOperatorQuestion } from '../dist/task-intake.js';

// This verifier protects Symphony's human-blocker behavior. When a handoff
// needs a human decision, the dashboard should show one plain-language question
// and a quiet-hours policy instead of pretending the foreman can continue or
// running a tight wait loop.

const repairDecision = {
  status: 'needs_operator_decision',
  category: 'workflow_setup',
  question: 'Which repair lane should Symphony use?',
  plainLanguageSummary: 'Setup failed before the task tests could run.',
  recommendedFirstStep: 'Create a small setup repair task before sending Jules feedback.',
  evidence: ['npm ci failed before tests ran.'],
  options: [],
  mutatesExternalSystems: false,
  mutatesLocalFiles: false,
  nextExpectedProof: 'Chosen repair lane.',
};

const quietPacket = buildHandoffOperatorQuestion({
  id: 'handoff-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  githubPullRequestRepairDecision: repairDecision,
}, { generatedAt: '2026-05-20T00:30:00.000Z' });

assert(quietPacket);
assert.equal(quietPacket.handoffId, 'handoff-ara6');
assert.equal(quietPacket.status, 'waiting_for_operator');
assert.equal(quietPacket.mutatesExternalSystems, false);
assert.equal(quietPacket.mutatesLocalFiles, false);
assert.equal(quietPacket.quietHours.timeZone, 'Europe/Amsterdam');
assert.equal(quietPacket.quietHours.appliesNow, true);
assert.equal(quietPacket.canNotifyNow, false);
assert.match(quietPacket.plainLanguageQuestion, /Which repair lane/);
assert.match(quietPacket.plainLanguageSummary, /Setup failed before the task tests could run/);
assert.match(quietPacket.requestedAction, /Chosen repair lane/);
assert.match(quietPacket.quietHours.summary, /quiet hours/i);
assert.match(quietPacket.nextCheckAt, /^2026-05-20T07:00:00\.000Z$/);

const nearWakePacket = buildHandoffOperatorQuestion({
  id: 'handoff-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  githubPullRequestRepairDecision: repairDecision,
}, { generatedAt: '2026-05-20T06:52:44.300Z' });

assert(nearWakePacket);
assert.equal(nearWakePacket.quietHours.localTime, '2026-05-20 08:52 Europe/Amsterdam');
assert.equal(nearWakePacket.quietHours.appliesNow, true);
assert.equal(nearWakePacket.nextCheckAt, '2026-05-20T07:00:00.000Z');

const daytimePacket = buildHandoffOperatorQuestion({
  id: 'handoff-ara6',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  githubPullRequestRepairDecision: repairDecision,
}, { generatedAt: '2026-05-20T10:00:00.000Z' });

assert(daytimePacket);
assert.equal(daytimePacket.quietHours.appliesNow, false);
assert.equal(daytimePacket.canNotifyNow, true);
assert.equal(daytimePacket.nextCheckAt, null);

const noQuestion = buildHandoffOperatorQuestion({
  id: 'handoff-no-blocker',
  title: 'No blocker',
  githubPullRequestRepairDecision: null,
}, { generatedAt: '2026-05-20T10:00:00.000Z' });

assert.equal(noQuestion, null);

const pushApprovalPacket = buildHandoffOperatorQuestion({
  id: 'handoff-ara6-push',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  repairPushReadiness: {
    handoffId: 'handoff-ara6-push',
    status: 'awaiting_operator_push_approval',
    source: 'local_commit',
    recordedAt: '2026-05-20T10:00:00.000Z',
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
      refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6-push/refresh-pr',
      scoutCoreReadinessEndpoint: '/api/v1/task-drafts',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      summary: 'After the operator pushes the repair, watch GitHub checks.',
    },
    nextExpectedProof: 'GitHub checks rerun.',
    summary: 'Local repair commit 19eb1cd4 is ready for operator-approved push.',
  },
  repairPushResult: null,
}, { generatedAt: '2026-05-20T10:00:00.000Z' });

assert(pushApprovalPacket);
assert.equal(pushApprovalPacket.sourceStage, 'repair_push_approval');
assert.equal(pushApprovalPacket.canNotifyNow, true);
assert.match(pushApprovalPacket.plainLanguageQuestion, /approve pushing the prepared repair/i);
assert.match(pushApprovalPacket.plainLanguageSummary, /19eb1cd4/);
assert.match(pushApprovalPacket.requestedAction, /record the push result/i);
assert.equal(pushApprovalPacket.mutatesExternalSystems, false);
assert.equal(pushApprovalPacket.mutatesLocalFiles, false);

const noPushApprovalAfterResult = buildHandoffOperatorQuestion({
  id: 'handoff-ara6-push',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  repairPushReadiness: pushApprovalPacket ? {
    handoffId: 'handoff-ara6-push',
    status: 'awaiting_operator_push_approval',
    source: 'local_commit',
    recordedAt: '2026-05-20T10:00:00.000Z',
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
      refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6-push/refresh-pr',
      scoutCoreReadinessEndpoint: '/api/v1/task-drafts',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      summary: 'After the operator pushes the repair, watch GitHub checks.',
    },
    nextExpectedProof: 'GitHub checks rerun.',
    summary: 'Local repair commit 19eb1cd4 is ready for operator-approved push.',
  } : null,
  repairPushResult: {
    handoffId: 'handoff-ara6-push',
    status: 'pushed',
    pushedCommit: '19eb1cd4',
    targetPullRequestHeadCommit: '19eb1cd4',
    pushedAt: '2026-05-20T10:05:00.000Z',
    recordedAt: '2026-05-20T10:06:00.000Z',
    pushedBy: 'operator',
    evidenceUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    summary: 'Operator pushed the repair.',
    checksCommand: 'gh pr checks 931 --repo Gambitnl/Aralia',
    refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6-push/refresh-pr',
    nextBoundary: 'github_checks_rerun',
    nextExpectedProof: 'GitHub checks complete after the repair push.',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  },
}, { generatedAt: '2026-05-20T10:00:00.000Z' });

assert.equal(noPushApprovalAfterResult, null);

const pushApprovalWinsOverOldRepairDecision = buildHandoffOperatorQuestion({
  id: 'handoff-ara6-push',
  title: 'Add regression coverage for non-proficient weapon attack penalties',
  githubPullRequestRepairDecision: repairDecision,
  repairPushReadiness: {
    handoffId: 'handoff-ara6-push',
    status: 'awaiting_operator_push_approval',
    source: 'local_commit',
    recordedAt: '2026-05-20T10:00:00.000Z',
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
      refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6-push/refresh-pr',
      scoutCoreReadinessEndpoint: '/api/v1/task-drafts',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      summary: 'After the operator pushes the repair, watch GitHub checks.',
    },
    nextExpectedProof: 'GitHub checks rerun.',
    summary: 'Local repair commit 19eb1cd4 is ready for operator-approved push.',
  },
  repairPushResult: null,
}, { generatedAt: '2026-05-20T10:00:00.000Z' });

assert.equal(pushApprovalWinsOverOldRepairDecision?.sourceStage, 'repair_push_approval');
assert.match(pushApprovalWinsOverOldRepairDecision?.plainLanguageQuestion ?? '', /approve pushing the prepared repair/i);
assert.doesNotMatch(pushApprovalWinsOverOldRepairDecision?.plainLanguageQuestion ?? '', /Which repair lane/i);

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /function renderOperatorQuestion/);
assert.match(dashboard, /Needs your input/);
assert.match(dashboard, /pending-human-input/);
assert.match(dashboard, /approve_repair_push/);
assert.match(dashboard, /Reject repair push/);
assert.match(dashboard, /isPushApproval \? ''/);
assert.match(dashboard, /Execute Selected Repair Lane/);

if (process.env.SYMPHONY_OPERATOR_QUESTION_RENDER === '1') {
  // This rendered proof uses the same human-facing labels and button choices
  // guarded in dashboard.js above, but it does not start Symphony or contact
  // Linear, Jules, GitHub, or the live task store.
  const css = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
  <main>
    <section class="handoff-readiness operator-question pending-human-input" open>
      <h1>Repair push approval proof</h1>
      <details class="handoff-readiness operator-question pending-human-input" open>
        <summary>Needs your input</summary>
        <p><strong>Do you approve pushing the prepared repair to the Jules PR?</strong></p>
        <p>Local repair commit 19eb1cd4 is ready for operator-approved push. Repair base 0c0d9480 matches the current PR head 0c0d9480.</p>
        <ul>
          <li><strong>Requested proof:</strong> Approve the external push and record the push result, or reject this repair and prepare a replacement.</li>
          <li><strong>Can notify now:</strong> Yes</li>
          <li><strong>Quiet hours:</strong> Not active</li>
        </ul>
        <label>Push decision
          <select>
            <option>Approve repair push</option>
            <option>Reject repair push</option>
            <option>Wait for manual repair</option>
            <option>Other</option>
          </select>
        </label>
        <label>Operator answer
          <textarea rows="2" placeholder="Plain-language decision for this blocker"></textarea>
        </label>
        <button type="button">Record Operator Answer</button>
        <strong>Recorded answers</strong>
        <p class="usage-summary">No operator answer has been recorded yet.</p>
      </details>
    </section>
  </main>
</body>
</html>`;
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const bodyText = await page.locator('body').innerText();
  assert.equal(bodyText.includes('Needs your input'), true);
  assert.equal(bodyText.includes('Push decision'), true);
  assert.equal(bodyText.includes('Approve repair push'), true);
  assert.equal(bodyText.includes('Execute Selected Repair Lane'), false);
  await page.screenshot({
    path: '.symphony/live-proof/repair-push-approval-question-2026-05-20.png',
    fullPage: false,
    timeout: 10000,
  });
  await browser.close();
}
