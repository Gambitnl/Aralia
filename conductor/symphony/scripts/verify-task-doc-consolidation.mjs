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
assert.match(openTasks, /Do not gitignore contract verifiers/);
assert.match(openTasks, /`conductor\/symphony\/scripts\/verify-\*\.mjs` are durable source/);
assert.match(openTasks, /Runtime\s+state such as `conductor\/symphony\/\.symphony\/\*`, live proof captures, visual\s+verification images, and Jules run output should stay ignored/);
assert.match(openTasks, /verify-gitignore-contract-boundary\.mjs` is now part of\s+`verify:jules-contract`/);
assert.match(openTasks, /checks both sides of this boundary/);
assert.match(openTasks, /Latest read-only PR refresh: `2026-05-20 09:13 Europe\/Amsterdam`/);
assert.match(openTasks, /ara6-pr-refresh-before-repair-push-2026-05-20\.json/);
assert.match(openTasks, /nine checks total, five\s+passed, four failed, no pending checks, `workflow_setup` as the blocker/);
assert.match(openTasks, /repair-push readiness matching the current PR head/);
assert.match(openTasks, /ara6-dashboard-started-due-nudge-record-2026-05-20\.json/);
assert.match(openTasks, /ara6-dashboard-started-due-refresh-rescheduled-2026-05-20\.json/);
assert.match(openTasks, /produced two safe PR refreshes total, had zero failures, kept\s+`mutatesExternalSystems: false`/);
assert.match(openTasks, /rescheduled the ARA-6 nudge to a 300-second waiting cadence/);
assert.match(openTasks, /task-nudge wake-up evidence/);
assert.match(openTasks, /ARA-6 `refresh \/ github_pr` nudge and its 300-second next-check cadence now appear in the task chronology/);
assert.match(openTasks, /task event derived from the nudge ledger/);
assert.match(openTasks, /This pass did not chat\s+with Jules, push a repair, rerun checks, merge, inspect deployment, or sync\s+local Git/);
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
assert.match(openTasks, /was performed by Symphony/);
assert.match(openTasks, /Read-only external-state refresh/);
assert.match(openTasks, /PR #931 is still open, not draft, mergeable, unchanged at head `0c0d9480`/);
assert.match(openTasks, /latest PR update `2026-05-19T23:09:48Z`/);
assert.match(openTasks, /operator-approved repair push\/apply, then GitHub check rerun and Symphony PR refresh/);
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
