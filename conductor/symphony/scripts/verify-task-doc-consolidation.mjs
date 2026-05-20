import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * This verifier keeps Symphony's handoff task documents aligned with the live
 * ARA-6 evidence.
 *
 * The older Task 02-04 files are still useful as human-readable handoff prompts,
 * but the ordered queue is now the source of truth for the current workflow
 * boundary. This check makes sure future agents do not accidentally treat stale
 * Linear, manifest, or launch wording as the live state after ARA-6 advanced the
 * proof into PR/check/repair/deployment follow-through.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

// Read each status document directly so this guard catches drift in the files
// future agents are most likely to hand to another worker.
const openTasks = readFileSync(join(root, 'docs', 'tasks', 'SYMPHONY_OPEN_TASKS.md'), 'utf8');
const task02 = readFileSync(join(root, 'docs', 'tasks', '02-linear-creation-proof.md'), 'utf8');
const task03 = readFileSync(join(root, 'docs', 'tasks', '03-jules-manifest-staging-proof.md'), 'utf8');
const task04 = readFileSync(join(root, 'docs', 'tasks', '04-jules-launch-readiness-and-launch-proof.md'), 'utf8');

assert.match(openTasks, /Superseded Per-Task Status/);
assert.match(openTasks, /verify-task-doc-consolidation\.mjs/);
assert.match(openTasks, /Task 02, Task 03, and Task 04 against ARA-6 evidence/);
assert.match(openTasks, /Documentation is part of the live workflow, not an after-action cleanup item/);
assert.match(openTasks, /If a stage only gets read-only evidence,\s+record that as read-only evidence/);
assert.match(openTasks, /canonical approval-boundary table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#approval-boundaries`/);
assert.match(openTasks, /instead of maintaining a second approval list/);
assert.match(openTasks, /canonical workflow-phase table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#workflow-phases`/);
assert.match(openTasks, /instead of maintaining a second phase ladder/);
assert.match(openTasks, /operator has allowed assumed approvals at\s+each phase boundary/);
assert.match(openTasks, /decision point, options, decision made by the agent/);
assert.match(openTasks, /Do not gitignore contract verifiers/);
assert.match(openTasks, /`conductor\/symphony\/scripts\/verify-\*\.mjs` are durable source/);
assert.match(openTasks, /Runtime\s+state such as `conductor\/symphony\/\.symphony\/\*`, live proof captures, visual\s+verification images, and Jules run output should stay ignored/);
assert.match(openTasks, /verify-gitignore-contract-boundary\.mjs` is now part of\s+`verify:jules-contract`/);
assert.match(openTasks, /checks both sides of this boundary/);
assert.match(openTasks, /Latest live PR movement/);
assert.match(openTasks, /pushed two `github_pr` boundary repairs to PR #931/);
assert.match(openTasks, /`19eb1cd4` applied the prepared lockfile setup repair/);
assert.match(openTasks, /`f755df2b` removed the\s+forbidden `package-lock\.json` PR diff/);
assert.match(openTasks, /Jules then pushed bot commit `bb44a2f7`/);
assert.match(openTasks, /live PR diff to the\s+task note plus the two regression-test files/);
assert.match(openTasks, /`2026-05-20T15:39:26Z`/);
assert.match(openTasks, /`..\/decision-reports\/ARA-6_ASSUMED_APPROVAL_DECISIONS\.md`/);
assert.match(openTasks, /ara6-dashboard-started-due-nudge-record-2026-05-20\.json/);
assert.match(openTasks, /ara6-dashboard-started-due-refresh-rescheduled-2026-05-20\.json/);
assert.match(openTasks, /produced two safe PR refreshes total, had zero failures, kept\s+`mutatesExternalSystems: false`/);
assert.match(openTasks, /rescheduled the ARA-6 nudge to a 300-second waiting cadence/);
assert.match(openTasks, /task-nudge wake-up evidence/);
assert.match(openTasks, /ARA-6 `refresh \/ github_pr` nudge and its 300-second next-check cadence now appear in the task chronology/);
assert.match(openTasks, /task event derived from the nudge ledger/);
assert.match(openTasks, /PR #932 merge, PR #931 branch update, PR #931 merge, and deployment\s+evidence receipt have happened under the ARA-6 assumed-approval rule/);
assert.match(openTasks, /Scout\s+conflict detection, CodeQL, and GitHub Pages deployment passed for merge\s+commit `1c4316c`/);
assert.match(openTasks, /local sync then merged `origin\/master` into\s+`feature\/ollama-model-router` as local commit `28ff49a6`/);
assert.match(openTasks, /Task 7 addendum/);
assert.match(openTasks, /standalone task detail packet now includes `guardedActions`/);
assert.match(openTasks, /Guarded Operator Actions/);
assert.match(openTasks, /mutation flags and command text, but it does not run those actions/);
assert.match(openTasks, /task-page-guarded-actions-2026-05-20\.png/);
assert.match(openTasks, /task-page-guarded-actions-live-json-2026-05-20\.json/);
assert.match(openTasks, /`repairPushReadiness` is not currently present/);
assert.match(openTasks, /repair-push-readiness-live-recorded-2026-05-20\.json/);
assert.match(openTasks, /task-page-guarded-actions-live-json-after-readiness-2026-05-20\.json/);
assert.match(openTasks, /task-page-guarded-actions-after-readiness-2026-05-20\.png/);
assert.match(openTasks, /task-page-worktree-qualified-push-2026-05-20\.png/);
assert.match(openTasks, /task-page-worktree-qualified-push-2026-05-20\.md/);
assert.match(openTasks, /freshness status `matches_current_pr_head`/);
assert.match(openTasks, /corrected quiet-hours next check `2026-05-20T07:00:00\.000Z`/);
assert.match(openTasks, /git -C F:\\Repos\\Aralia\\\.worktrees\\pr-931-setup-repair push origin codex\/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885/);
assert.match(openTasks, /dashboard displays the worktree-qualified push command/);
assert.match(openTasks, /latest rendered proof verifies the safer `git -C F:\\Repos\\Aralia\\\.worktrees\\pr-931-setup-repair push origin \.\.\.` command display/);
assert.match(openTasks, /approval routing detail and task detail API use that same worktree-qualified command/);
assert.match(openTasks, /was performed by Symphony/);
assert.match(openTasks, /`approvalCheckpoint` packet/);
assert.match(openTasks, /Approval Checkpoint/);
assert.match(openTasks, /still-external guarded command, mutation\s+flags, and next expected proof/);
assert.match(openTasks, /symphony-task-approval-checkpoint\.png/);
assert.match(openTasks, /no browser console errors/);
assert.match(openTasks, /Role-aware task messages/);
assert.match(openTasks, /local task message be recorded as either `operator` or `codex_foreman`/);
assert.match(openTasks, /View-only task activity mirror/);
assert.match(openTasks, /Task Activity Mirror/);
assert.match(openTasks, /does not read terminal scrollback, and does not mutate external systems/);
assert.match(openTasks, /view-only task activity mirror now reads those structured\s+records/);
assert.match(openTasks, /live task chat usage, ROI, and real worker dispatch/);
assert.match(openTasks, /`ROI Evidence` card/);
assert.match(openTasks, /missing proof pieces and keeps broad\s+goal-context usage separate from task-scoped spend/);
assert.match(openTasks, /symphony-task-roi-evidence\.png/);
assert.match(openTasks, /\/tasks\/:id` now renders a readable `ROI Evidence` card/);
assert.match(openTasks, /goal-context usage is not measured savings/);
assert.match(openTasks, /`PR Checks And Repair`/);
assert.match(openTasks, /PR check summary, PR next action, PR check\/view commands, PR state\/head fields/);
assert.match(openTasks, /failed check\s+names\/details links/);
assert.match(openTasks, /individual failed checks such as Build, Lint, Tests, and Quality Scan/);
assert.match(openTasks, /readable `Deployment And Local Sync`/);
assert.match(openTasks, /deployment blockers, local-sync blockers, mutation flags, and expected proof/);
assert.match(openTasks, /Read-only external-state refresh/);
assert.match(openTasks, /Latest live PR movement/);
assert.match(openTasks, /pushed two `github_pr` boundary repairs to PR #931/);
assert.match(openTasks, /PR #931 head `bb44a2f7`/);
assert.match(openTasks, /ARA-6_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(openTasks, /Assumed approval has already been used for the two ARA-6 repair pushes/);
assert.match(openTasks, /Coordinator lockfile repair PR: `https:\/\/github\.com\/Gambitnl\/Aralia\/pull\/932`/);
assert.match(openTasks, /commit `f19cc779`/);
assert.match(openTasks, /PR #932\s+\(`https:\/\/github\.com\/Gambitnl\/Aralia\/pull\/932`\) merged as `ca10728f`/);
assert.match(openTasks, /PR #931\s+updated to `91ceee43`/);
assert.match(openTasks, /PR #931 merged as\s+`1c4316c`/);
assert.match(openTasks, /The next boundary is local sync,\s+not additional PR repair/);
assert.match(openTasks, /Local sync has now completed as merge commit\s+`28ff49a6`/);
assert.match(openTasks, /Poison File Check passed/);
assert.match(openTasks, /Build\/Lint\/Tests\/Quality Scan still fail at `npm ci`/);
assert.match(openTasks, /coordinator\/dependency repair/);
assert.match(openTasks, /REST API as alpha with `X-Goog-Api-Key`/);
assert.match(openTasks, /`approvePlan`, `sendMessage`, and PR outputs/);
assert.match(openTasks, /short-lived Ubuntu VMs, preinstalled Node\/npm\/rg, and `Run and Snapshot`/);
assert.match(openTasks, /GET \/api\/v1\/jules-environment-setup/);
assert.match(openTasks, /post-repair `npm ci --no-audit --no-fund` recommendation/);
assert.match(openTasks, /diagnostic `npm install --no-audit --no-fund` fallback/);
assert.match(openTasks, /`Run and Snapshot` held as an operator-approved external mutation/);
assert.match(openTasks, /Jules Environment Setup` card/);
assert.match(openTasks, /\/api\/v1\/browser-tooling-health/);
assert.match(openTasks, /verify-browser-tooling-health\.mjs` proves\s+that packet records the primary bridge/);
assert.match(openTasks, /known direct-Playwright failure\s+mode, allowed\/disallowed uses, observed ARA-6 evidence, next expected proof,\s+and false mutation flags/);
assert.match(openTasks, /Local packet, direct read endpoint, and receipt implemented/);
assert.match(openTasks, /direct `GET \/api\/v1\/jules-handoffs\/:id\/deployment-readiness` access/);
assert.match(openTasks, /task-detail `links\.deploymentReadiness`/);
assert.match(openTasks, /No for read-only packet, direct read endpoint, or local receipt/);

// Task 02 should not send a future worker back to the Linear boundary. ARA-6
// already created exactly one approved Linear issue through Symphony.
assert.match(task02, /Completed for ARA-6/);
assert.match(task02, /superseded by the live ARA-6 evidence/);
assert.match(task02, /Linear issue: `ARA-6`/);
assert.match(task02, /External mutations: One approved Linear issue creation/);
assert.doesNotMatch(task02, /Remaining blockers: (?!None for Task 02 itself)/);

// Task 03 should remain a manifest-staging receipt, not a prompt to stage the
// same ARA-6 manifest again.
assert.match(task03, /Completed for ARA-6/);
assert.match(task03, /superseded by the live ARA-6 evidence/);
assert.match(task03, /Manifest staging and launch-readiness proof artifacts were captured/);
assert.match(task03, /Remaining blockers: None for Task 03 itself/);

// Task 04 is the file most likely to drift: launch is complete, baseline
// reconciliation is implemented, and the live boundary is now PR/check repair
// through merge/deployment/local sync.
assert.match(task04, /Completed for ARA-6 launch and baseline post-launch reconciliation/);
assert.match(task04, /verify-jules-state-reconciliation-packet\.mjs/);
assert.match(task04, /reconciled_from_external_evidence/);
assert.match(task04, /needs_browser_reconciliation/);
assert.match(task04, /Current boundary: PR #931 check handling/);
assert.doesNotMatch(task04, /reconciliation proof remains incomplete/);
assert.doesNotMatch(task04, /Remaining blockers: Implement\/prove fallback PR discovery/);
