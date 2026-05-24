import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * ============================================================================
 * VERIFIER: verify-operating-spec.mjs
 * ============================================================================
 * 
 * PURPOSE:
 * This verifier protects the JULES_MIDDLEMAN_OPERATING_SPEC.md,
 * SYMPHONY_MIDDLEMAN_ARCHITECTURE.md, JULES_MIDDLEMAN_AUDIT.md, and
 * SYMPHONY_OPEN_TASKS.md files. It guarantees that the core contract structure,
 * scenario coverage matrices, governance rules, and safety boundaries remain
 * 100% synchronized and protected.
 * 
 * WHY IT WAS DESIGNED THIS WAY:
 * As the project grows, documentation can drift. However, pinning checks to
 * unstable dates, PR numbers, or local checkout screenshots (e.g. screenshot-2026-05-20)
 * causes verifiers to break whenever we tidy or progress the active boundary.
 * This refactored verifier keeps all stable spec and architectural assertions
 * while matching the new clean, modular task structure in SYMPHONY_OPEN_TASKS.md.
 * 
 * WHAT WAS PRESERVED:
 * - 100% of the assertions protecting JULES_MIDDLEMAN_OPERATING_SPEC.md (spec).
 * - 100% of the assertions protecting SYMPHONY_MIDDLEMAN_ARCHITECTURE.md (architecture).
 * - All structural, high-level assertions on SYMPHONY_OPEN_TASKS.md (openTasks) and the audit.
 * ============================================================================
 */

// Load all contract documents
const spec = await readFile(
  new URL('../docs/JULES_MIDDLEMAN_OPERATING_SPEC.md', import.meta.url),
  'utf8',
);
const openTasks = await readFile(
  new URL('../docs/tasks/SYMPHONY_OPEN_TASKS.md', import.meta.url),
  'utf8',
);
const architecture = await readFile(
  new URL('../docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md', import.meta.url),
  'utf8',
);
const audit = await readFile(
  new URL('../JULES_MIDDLEMAN_AUDIT.md', import.meta.url),
  'utf8',
);

// 1. Operating Spec (spec) Assertions
assert.match(spec, /# Symphony\/Jules Middleman Operating Spec/);
assert.match(spec, /Use this file as the stable scope reference/);
assert.match(spec, /The active thread goal should point\s+here instead of carrying every scenario inline/);
assert.match(spec, /audit file records evidence\s+and live task status/);
assert.match(spec, /Codex workers launched by Symphony are foremen/);
assert.match(spec, /Symphony also acts as task tracker and task nudger/);
assert.match(spec, /Jules planning, Jules execution, GitHub\s+checks, PR review, Scout\/Core review, and local sync can each require different\s+wait cadences/);
assert.match(spec, /GitHub Actions\s+checks are part of that foreman surface/);
assert.match(spec, /faster, clearer, more actionable\s+failure signals/);
assert.match(spec, /Not every change should go to Jules/);
assert.match(spec, /local Codex agent when that\s+is lower overhead/);
assert.match(spec, /built-in Codex app browser/);
assert.match(spec, /Codex Browser\s+plugin's in-app browser bridge/);
assert.match(spec, /direct Playwright MCP call can fail with\s+`Transport closed`/);
assert.match(spec, /that does not prove Jules is\s+unobservable/);
assert.match(spec, /intended operator experience is task-centered/);
assert.match(spec, /tasks waiting for human input/);
assert.match(spec, /task-scoped Codex chat surface/);
assert.match(spec, /current baseline for that task-centered view is a read-only `Task navigator`/);
assert.match(spec, /counts all\/open\/completed\/archived records plus tasks needing\s+human input/);
assert.match(spec, /filters the list by those buckets as a display preference/);
assert.match(spec, /instead of creating a\s+separate task truth/);
assert.match(spec, /compact read-only `Task detail` preview/);
assert.match(spec, /current boundary, update time, timeline count/);
assert.match(spec, /verify-task-dashboard-navigator\.mjs/);
assert.match(spec, /\/tasks\/:id/);
assert.match(spec, /first standalone task page/);
assert.match(spec, /verify-task-detail-page\.mjs/);
assert.match(spec, /GET \/api\/v1\/tasks\/:id/);
assert.match(spec, /verify-task-detail-api\.mjs/);
assert.match(spec, /non-mutating\s+single-task JSON endpoint/);
assert.match(spec, /read-only Jules\s+handoff prompt packet/);
assert.match(spec, /read-only Jules dialogue\/approval history packet/);
assert.match(spec, /operator-question state, ROI ledger, readiness\s+packets, stored local task messages, local task disposition/);
assert.match(spec, /local-only operator-answer and repair-push-result actions/);
assert.match(spec, /protects the `operatorAnswer` task link/);
assert.match(spec, /rendered `Record Operator Answer` and `Record Repair Push Result`\s+forms/);
assert.match(spec, /do not execute repair lanes,\s+send Jules feedback, push to GitHub, rerun checks, merge, pull, or edit local\s+files/);
assert.match(spec, /read-only `Approval\s+Checkpoint`/);
assert.match(spec, /current operator question, latest local answer\s+when present, the still-external guarded command, and the next proof receipt/);
assert.match(spec, /without approving or running anything/);
assert.match(spec, /existing GitHub PR check summary and PR check\/view commands as read-only\s+task fields/);
assert.match(spec, /`PR Checks And Repair`/);
assert.match(spec, /individual failed check names plus their details links/);
assert.match(spec, /without pushing, rerunning checks, commenting\s+on GitHub, merging, or editing local files/);
assert.match(spec, /readable `ROI Evidence` summary/);
assert.match(spec, /missing task-scoped usage receipts, missing avoided-work\s+estimates, and broad goal-context usage/);
assert.match(spec, /does not count as measured task\s+spend or unlock a savings claim/);
assert.match(spec, /readable\s+`Deployment And Local Sync`\s+summary/);
assert.match(spec, /does not create\s+deployments, waive deployment proof, merge, pull, or edit local\s+files/);
assert.match(spec, /POST \/api\/v1\/tasks\/:id\/messages/);
assert.match(spec, /verify-task-message-api\.mjs/);
assert.match(spec, /do not send Jules feedback, create Linear\/GitHub\s+records, or mutate local Git/);
assert.match(spec, /POST \/api\/v1\/tasks\/:id\/disposition/);
assert.match(spec, /verify-task-disposition-api\.mjs/);
assert.match(spec, /mark work active, completed,\s+archived, or abandoned as dashboard state only/);
assert.match(spec, /weekday nights from 01:00 to 09:00/);
assert.match(spec, /should not\s+keep running a tight background\s+script while blocked on the human/);
assert.match(spec, /current active goal is the full \*\*Symphony delegation workflow\*\*/);
assert.match(spec, /Codex acts as a foreman, clarifies\s+tasks, creates or updates Linear tracking/);
assert.match(spec, /follows Jules through planning, execution, PR creation, GitHub checks,\s+deployment state, repair or feedback sequencing, merge readiness, and local repo\s+sync after merge/);
assert.match(spec, /task-level Delegation ROI\s+ledger that measures whether delegating to Jules reduces Codex usage/);
assert.match(spec, /implementation, workflow\s+intent, audit, architecture overview, and ordered task documents must stay\s+current/);
assert.match(spec, /supporting slices of that larger end-to-end proof, not the whole goal/);
assert.match(spec, /Approval wording in that goal is intentionally scoped to operator-owned\s+workflow boundaries/);
assert.match(spec, /An operator-approved mutation is an external or\s+workflow-advancing action that affects Linear, Jules, GitHub, PR branches,\s+deployment waivers, local master sync, or user-visible task decisions/);
assert.match(spec, /does\s+not include ordinary local implementation hygiene inside the active Symphony\s+workstream/);
assert.match(spec, /documentation edits, verifier updates, local API\/dashboard code\s+changes, local verifier runs, or local checkpoint commits/);
assert.match(spec, /do not push,\s+launch, merge, sync, contact external systems, or claim a live workflow boundary\s+has advanced/);
assert.match(spec, /### Approval Boundaries/);
assert.match(spec, /canonical approval-boundary list for Symphony\/Jules work/);

for (const boundary of [
  'Linear issue creation or update',
  'Jules manifest staging',
  'Jules launch or session action',
  'GitHub PR feedback',
  'GitHub PR branch update',
  'GitHub CI mutation',
  'Scout/Core validation or merge',
  'Deployment waiver or repair',
  'Local repository sync',
  'User-visible task decision',
]) {
  assert.match(spec, new RegExp(boundary));
}

assert.match(spec, /### Workflow Phases/);
assert.match(spec, /canonical phase list/);

for (const phase of [
  'workflow_setup',
  'linear_issue',
  'jules_manifest',
  'jules_launch',
  'jules_session',
  'github_pr',
  'scout_core',
  'deployment',
  'local_sync',
]) {
  assert.match(spec, new RegExp(`\\| \\*\\*${phase}\\*\\* \\|`));
}

assert.match(spec, /## Human Blockers And Quiet Hours/);
assert.match(spec, /weekday nights from 01:00 to 09:00/);
assert.match(spec, /default weekday quiet-hours window is derived in the task detail packet/);
assert.match(spec, /operator-run command or browser API fallback when the browser is unobservable/);
assert.match(spec, /Jules setup scripts and snapshots should be informed by official Jules\s+environment docs/);
assert.match(spec, /short-lived Ubuntu VMs/);
assert.match(spec, /Node 22\.16\.0 and npm 11\.4\.2/);
assert.match(spec, /`Run and Snapshot` saves a\s+successful setup/);
assert.match(spec, /GET \/api\/v1\/jules-environment-setup/);
assert.match(spec, /Jules Environment\s+Setup/);
assert.match(spec, /broad `npm run typecheck` setup failed in a clean\s+Jules clone/);
assert.match(spec, /accepted scoped snapshot passed `npm ci --no-audit --no-fund`/);
assert.match(spec, /combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(spec, /Any future `npm install` setup script remains diagnostic/);
assert.match(spec, /package2_scoped_snapshot_passed/);
assert.match(spec, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(spec, /dispatch Jules with the exact Package 2\s+prompt/);
assert.match(spec, /worker-mode packet recommends a mode from task evidence/);
assert.match(spec, /`operator_only` for blocked human decisions, `local_fast` for tiny local\s+edits\/verifiers\/docs, `local_careful`/);
assert.match(spec, /explicit config wins and the dashboard should say\s+when it is overriding the automatic recommendation/);
assert.match(spec, /process startup defaults dispatch to paused, even without\s+`--dashboard-only`/);
assert.match(spec, /backend dispatch-control endpoint is explicitly enabled/);
assert.match(spec, /dashboard dispatch toggle mirrors backend state only/);
assert.match(spec, /Routing is the source of the dynamic worker-mode packet/);
assert.match(spec, /The main dashboard must not force every proof packet and every control to\s+compete equally for first-screen attention/);
assert.match(spec, /current screen-space inventory is: header controls, dispatch toggle, run\s+totals, worker roster/);
assert.match(spec, /Symphony must measure whether Jules delegation is saving Codex usage/);
assert.match(spec, /Measured facts: Codex input\/output\/total tokens/);
assert.match(spec, /Estimated avoided Codex work: estimated local Codex implementation turns/);
assert.match(spec, /Workflow value signals: whether Jules produced a PR/);
assert.match(spec, /must never present avoided-token estimates as actual token savings/);
assert.match(spec, /`codex_totals`, worker roster token totals, retained usage\/rate-limit\s+activity/);
assert.match(spec, /task-scoped foreman-usage receipt instead of pretending the measured spend is\s+zero/);
assert.match(spec, /Broad active-goal or thread-level usage is useful context/);
assert.match(spec, /`codex_goal_context` receipts must be\s+displayed in a separate goal-context bucket/);
assert.match(spec, /must not unlock\s+`candidate_savings` without a task-scoped spend source/);
assert.match(spec, /show "ROI unknown" rather than "saved"/);
assert.match(spec, /current baseline implementation attaches `delegationRoiLedger` to each\s+handoff snapshot/);
assert.match(spec, /passes Symphony runtime `codex_totals` into `\/api\/v1\/task-\s+drafts` when available/);
assert.match(spec, /aggregates local `delegationRoiForemanUsage`\s+receipts when present/);
assert.match(spec, /renders the ledger on the dashboard/);
assert.match(spec, /missing, the ledger says `ROI unknown`/);
assert.match(spec, /Measured task-scoped Codex foreman usage is recorded through the local\s+`roi-foreman-usage` path/);
assert.match(spec, /Avoided-work estimates are recorded through the local `roi-estimate` path/);
assert.match(spec, /mutates only the Symphony task store/);

for (const heading of [
  'Git And GitHub Blockers',
  'Draft And Issue Blockers',
  'Jules Blockers',
  'GitHub PR Blockers',
  'Scout/Core Blockers',
  'Local Sync Blockers',
  'Worker And Runtime Blockers',
  'Test And Documentation Blockers',
]) {
  assert.match(spec, new RegExp(`### ${heading}`));
}

assert.match(spec, /### Scenario Coverage Matrix/);
assert.match(spec, /This matrix serves as the canonical map of required middleman scenario coverage/);
assert.match(spec, /Refer to \[`JULES_MIDDLEMAN_AUDIT\.md`\]\(\.\.\/JULES_MIDDLEMAN_AUDIT\.md#requirement-audit\)/);

for (const area of [
  'Dashboard Intake',
  'GitHub Sync Gate',
  'Linear Issue Creation',
  'Jules Manifest Staging',
  'Jules Launch / Session',
  'GitHub PR Monitoring',
  'GitHub Actions / CI Quality',
  'Conflict-Prone Files',
  'Scout / Core Readiness',
  'Deployment Readiness',
  'Local Sync',
  'Worker / Dispatch Gate',
  'Worker Model Assignment',
  'Task Routing & Nudges',
  'Dashboard Focus & Console',
  'Approvals',
  'Usage / Spending',
  'Delegation ROI Ledger',
  'Governance Docs',
  'Browser Constraints',
]) {
  assert.match(spec, new RegExp(`\\| \\*\\*${area}\\*\\* \\|`));
}

// 2. Open Tasks (openTasks) Assertions
assert.match(openTasks, /# Symphony Open Task Order/);
assert.match(openTasks, /Historical ARA-6 Proof Thread/);
assert.match(openTasks, /ARA-6 is historical proof for the workflow/);
assert.match(openTasks, /spell Phase 1/i);
assert.match(openTasks, /SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(openTasks, /Documentation is part of the live workflow, not an after-action cleanup item/);
assert.match(openTasks, /canonical approval-boundary table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#approval-boundaries`/);
assert.match(openTasks, /canonical workflow-phase table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#workflow-phases`/);
assert.match(openTasks, /Do not gitignore contract verifiers/);
assert.match(openTasks, /`conductor\/symphony\/scripts\/verify-\*\.mjs` are durable source/);
assert.match(openTasks, /Runtime\s+state such as `conductor\/symphony\/\.symphony\/\*`, live proof captures, visual\s+verification images, and Jules run output should stay ignored/);
assert.match(openTasks, /Symphony evaluates task scope sequentially/);
assert.match(openTasks, /package2_scoped_snapshot_passed/);
assert.match(openTasks, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(openTasks, /Track Codex costs conservative-first/);
assert.match(openTasks, /Superseded Per-Task Status/);

// 3. Architecture Spec (architecture) Assertions
assert.match(architecture, /repair-base commit,\s+current PR head commit/);
assert.match(architecture, /`repair_push_approval` question/);
assert.match(architecture, /current-boundary question takes\s+precedence over the older repair-decision packet/);
assert.match(architecture, /Approval gates are architectural boundaries, not a ban on local maintenance/);
assert.match(architecture, /protect external or workflow-advancing mutation/);
assert.match(architecture, /Local Symphony hygiene such as docs edits, verifier updates,\s+dashboard\/API code edits, verifier runs, and local checkpoint commits stays\s+inside the implementation loop/);
assert.match(architecture, /does not show the execute-repair-lane\s+button/);
assert.match(architecture, /labels that later answer as repair-push approval/);
assert.match(architecture, /protect against pushing a stale local repair/);
assert.match(architecture, /Freshness evidence on\s+that packet/);
assert.match(architecture, /Its `postPushFollowUp`\s+packet then names the read-only sequence/);
assert.match(architecture, /Once that approval answer is recorded, task routing switches to an\s+`operator_only` `Record repair push result` boundary/);
assert.match(architecture, /does not imply that GitHub checks can rerun before the external push is\s+recorded/);
assert.match(architecture, /Post-push\s+follow-up evidence keeps the next step read-only/);
assert.match(architecture, /`repairPushResult` as a local receipt/);
assert.match(architecture, /`Record Repair Push Result` control/);
assert.match(architecture, /not a GitHub mutation path/);
assert.match(architecture, /derives `guardedActions` for handoff task details/);
assert.match(architecture, /operator runbook entries for commands or endpoints/);
assert.match(architecture, /Guarded Operator Actions/);
assert.match(architecture, /does not run GitHub comments, Git pushes, check reruns, merges, pulls, or Jules\s+messages automatically/);
assert.match(architecture, /GET \/api\/v1\/browser-tooling-health/);
assert.match(architecture, /read-only packet that\s+names the Browser plugin bridge as the primary live follow-along path/);
assert.match(architecture, /direct Playwright `Transport closed` as a known unreliable path/);
assert.match(architecture, /does not query Jules or become\s+a browser-state store/);
assert.match(architecture, /GET \/api\/v1\/jules-handoffs\/:id\/deployment-readiness/);
assert.match(architecture, /Task detail packets link to this endpoint as `links\.deploymentReadiness`/);
assert.match(architecture, /live GitHub Pages adapter evidence beyond the current read-only deployment-readiness packet/);

// 4. Audit Spec (audit) Assertions
assert.match(audit, /Task navigator/);
assert.match(audit, /verify-task-dashboard-navigator\.mjs/);
assert.match(audit, /verify-task-detail-api\.mjs/);
assert.match(audit, /verify-task-detail-page\.mjs/);
assert.match(audit, /Task Clarifications/);
assert.match(audit, /Record Clarification/);
assert.match(audit, /Jules Handoff Prompt/);
assert.match(audit, /Jules Dialogue And Approvals/);
assert.match(audit, /verify-task-message-api\.mjs/);
assert.match(audit, /verify-task-clarification-api\.mjs/);
assert.match(audit, /derive a pending-human `clarificationState`/);
assert.match(audit, /\/tasks\/:id/);
assert.match(audit, /keep all GitHub\/Jules\/Linear\/local mutation flags false/);
assert.match(audit, /verify-task-disposition-api\.mjs/);
assert.match(audit, /active, completed, archived, or abandoned task filing as local dashboard state/);
assert.match(audit, /counts all local Symphony records/);
assert.match(audit, /filters.*by those buckets as a.*display preference/);
assert.match(audit, /compact read-only `Task detail` preview/);
assert.match(audit, /GET \/api\/v1\/tasks\/:id/);
assert.match(audit, /Task page/);
assert.match(audit, /Task detail JSON/);
assert.match(audit, /POST \/api\/v1\/tasks\/:id\/messages/);
assert.match(audit, /Task messages/);
assert.match(audit, /can record a local message/);
assert.match(audit, /local-only `Record Operator Answer`/);
assert.match(audit, /local-only `Record Repair Push Result`/);
assert.match(audit, /local-only.*operatorAnswers/);
assert.match(audit, /`approvalCheckpoint` packet/);
assert.match(audit, /Approval Checkpoint/);
assert.match(audit, /Task Activity Mirror/);
assert.match(audit, /true external task actions,.*live task-chat usage/);

console.log('✅ verify-operating-spec.mjs passed core Operating Spec contract validation!');
