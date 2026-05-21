import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Protects the first Spell Phase 1 Jules implementation packet.
 *
 * Package 2 is intentionally drafted before dispatch so Codex can keep moving
 * while preserving the external gates that Jules needs. This verifier makes the
 * boundary durable: the task must be Jules-ready, must stay scoped to premade
 * party/gear work, and must keep the no-dispatch-until-fresh-preflight guard.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..', '..');

const task = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md'),
  'utf8',
);
const plan = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'EARLY_GAME_SPELL_EXECUTION_PLAN.md'),
  'utf8',
);
const baseline = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'SPELL_PHASE_1_BASELINE_REPORT.md'),
  'utf8',
);
const decisionReport = readFileSync(
  join(repoRoot, 'conductor', 'symphony', 'docs', 'decision-reports', 'SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md'),
  'utf8',
);
const promptPacket = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md'),
  'utf8',
);
const taskDraftPayloadText = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json'),
  'utf8',
);
const taskDraftPayload = JSON.parse(taskDraftPayloadText);
const readinessChecklist = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md'),
  'utf8',
);
const roiBaselineReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md'),
  'utf8',
);
const atlasGateCheckpointReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md'),
  'utf8',
);
const foremanReviewReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md'),
  'utf8',
);
const taskCommunicationReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md'),
  'utf8',
);
const prDeploymentLocalSyncReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md'),
  'utf8',
);
const draftSubmissionReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md'),
  'utf8',
);
const gitSyncAttemptReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_GIT_SYNC_ATTEMPT_RECEIPT.md'),
  'utf8',
);
const handoffReceipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md'),
  'utf8',
);

assert.match(task, /# Package 2 Jules Task: Premade Party And Gear/);
assert.match(task, /Status: local Symphony draft created; setup branch pushed; fresh Symphony\s+readiness preflight required before Jules dispatch/);
assert.match(task, /The Jules Environment `Run and Snapshot` proof has been captured/);
assert.match(task, /npm ci --no-audit --no-fund/);
assert.match(task, /npm run validate:spells/);
assert.match(task, /combatUtils_\*\.test\.ts/);
assert.match(task, /original broad `npm run typecheck` setup failed/);

assert.match(task, /Default worker: Jules/);
assert.match(task, /Codex role: foreman only/);
assert.match(task, /Jules should\s+own the implementation-heavy data and runtime patch/);
assert.match(task, /Branch And Worktree/);
assert.match(task, /jules\/spells-package2-premade-party-gear/);
assert.match(task, /codex\/spells-package2-premade-party-gear-review/);
assert.match(task, /F:\\Repos\\Aralia\\\.worktrees\\spells-package2-premade-party-gear/);
assert.match(task, /documentation, not a dispatch action/);
assert.match(task, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(task, /That prompt is not a dispatch receipt/);
assert.match(task, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(task, /draft-1779344522441-vdy0hi/);
assert.match(task, /blocked_by_git_sync/);
assert.match(task, /setup branch has since been pushed/);
assert.match(task, /fresh\s+Symphony task queue or Git preflight snapshot is required before dispatch/);
assert.match(task, /PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT\.md/);
assert.match(task, /PACKAGE_2_DISPATCH_READINESS_CHECKLIST\.md/);
assert.match(task, /source of truth for what is ready, what remains blocked/);
assert.match(task, /SPELL_PHASE_1_ROI_BASELINE_RECEIPT\.md/);
assert.match(task, /ROI\s+is still unknown/);
assert.match(task, /PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT\.md/);
assert.match(task, /Atlas\/gate checkpoint receipt/);
assert.match(task, /PACKAGE_2_FOREMAN_REVIEW_RECEIPT\.md/);
assert.match(task, /foreman review and failure-classification receipt/);
assert.match(task, /PACKAGE_2_TASK_COMMUNICATION_RECEIPT\.md/);
assert.match(task, /task communication receipt/);
assert.match(task, /PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT\.md/);
assert.match(task, /PR\/deployment\/local-sync receipt/);

assert.match(task, /public\/premade-characters\/\*\.json/);
assert.match(task, /src\/utils\/combat\/combatUtils\.ts/);
assert.match(task, /src\/utils\/character\/weaponUtils\.ts/);
assert.match(task, /src\/types\/items\.ts/);

for (const file of [
  'kael_ironvow.json',
  'brynna_ashward.json',
  'oren_pathmark.json',
  'tavian_oathsteel.json',
  'sera_dawnmantle.json',
  'merrit_greenbough.json',
  'lyris_songweaver.json',
  'nyx_velorin.json',
  'thalren_deeproot.json',
  'pip_coppercoil.json',
  'ivel_sparkvein.json',
  'cassian_blackreed.json',
  'maelis_quill.json',
]) {
  assert.match(task, new RegExp(file.replace('.', '\\.')));
}

assert.match(task, /broad spell schema\/runtime architecture/);
assert.match(task, /character creator UI/);
assert.match(task, /character sheet spellbook UI/);
assert.match(task, /AI arbitration policy/);
assert.match(task, /Symphony orchestration files/);

assert.match(task, /Equip all 13 level-1 premade characters/);
assert.match(task, /Preserve each premade identity/);
assert.match(task, /createPlayerCombatCharacter/);
assert.match(task, /armorClass/);
assert.match(task, /baseAC/);
assert.match(task, /range:N/);
assert.match(task, /prepared spells should be count-limited/);
assert.match(task, /wider spellbook model issue is found, report it instead/);

assert.match(task, /npm run generate:spell-gates/);
assert.match(task, /npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(task, /Do not claim visual\s+spellbook or character creator\s+verification from this package/);

assert.match(plan, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK\.md/);
assert.match(plan, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(plan, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(plan, /PACKAGE_2_DISPATCH_READINESS_CHECKLIST\.md/);
assert.match(plan, /SPELL_PHASE_1_ROI_BASELINE_RECEIPT\.md/);
assert.match(plan, /PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT\.md/);
assert.match(plan, /PACKAGE_2_FOREMAN_REVIEW_RECEIPT\.md/);
assert.match(plan, /PACKAGE_2_TASK_COMMUNICATION_RECEIPT\.md/);
assert.match(plan, /PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT\.md/);
assert.match(baseline, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK\.md/);
assert.match(decisionReport, /Decision 3: Draft Package 2 Locally But Do Not Promote It Before Snapshot Proof/);
assert.match(decisionReport, /Skipped dashboard handoff\s+creation and Jules dispatch/);
assert.match(decisionReport, /Package 2 is scoped and ready to become the first Jules implementation\s+packet once setup proof exists/);
assert.match(decisionReport, /Decision 4: Reserve Package 2 Branch And Worktree Names Without Creating Them/);
assert.match(decisionReport, /jules\/spells-package2-premade-party-gear/);
assert.match(decisionReport, /Did not create a branch, create a worktree, push, open\s+a PR, or dispatch Jules/);
assert.match(decisionReport, /Decision 7: Draft Package 2 Jules Prompt Packet Without Dispatching It/);
assert.match(decisionReport, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(decisionReport, /did not dispatch Package 2/);
assert.match(decisionReport, /Decision 9: Prepare Package 2 Symphony Draft Payload Without Submitting It/);
assert.match(decisionReport, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(decisionReport, /Did not POST to\s+`\/api\/v1\/task-drafts`/);
assert.match(decisionReport, /Decision 10: Add Package 2 Dispatch Readiness Checklist/);
assert.match(decisionReport, /PACKAGE_2_DISPATCH_READINESS_CHECKLIST\.md/);
assert.match(decisionReport, /did\s+not create a branch or worktree.*did\s+not dispatch Jules/is);
assert.match(decisionReport, /Decision 11: Add Spell Phase 1 ROI Baseline Receipt/);
assert.match(decisionReport, /SPELL_PHASE_1_ROI_BASELINE_RECEIPT\.md/);
assert.match(decisionReport, /ROI verdict unknown/);
assert.match(decisionReport, /did not claim candidate savings/);
assert.match(decisionReport, /Decision 13: Add Package 2 Atlas And Gate Checkpoint Receipt/);
assert.match(decisionReport, /PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT\.md/);
assert.match(decisionReport, /did not mark\s+the receipt complete/);
assert.match(decisionReport, /Decision 14: Add Package 2 Foreman Review And Failure Classification Receipt/);
assert.match(decisionReport, /PACKAGE_2_FOREMAN_REVIEW_RECEIPT\.md/);
assert.match(decisionReport, /Did not dispatch Jules, did not create a review branch/);
assert.match(decisionReport, /Decision 15: Add Package 2 Task Communication Receipt/);
assert.match(decisionReport, /PACKAGE_2_TASK_COMMUNICATION_RECEIPT\.md/);
assert.match(decisionReport, /did not send Jules feedback, did not record a fake\s+task message/);
assert.match(decisionReport, /Decision 16: Add Package 2 PR, Deployment, And Local Sync Receipt/);
assert.match(decisionReport, /PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT\.md/);
assert.match(decisionReport, /Did not create a\s+branch, open a PR, merge, record a deployment waiver, sync local Git/);

assert.match(promptPacket, /# Package 2 Jules Prompt: Premade Party And Gear/);
assert.match(promptPacket, /Status: prompt-ready, not dispatched/);
assert.match(promptPacket, /SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT\.md/);
assert.match(promptPacket, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(promptPacket, /draft-1779344522441-vdy0hi/);
assert.match(promptPacket, /blocked_by_git_sync/);
assert.match(promptPacket, /PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT\.md/);
assert.match(promptPacket, /Use `jules\/spells-package2-premade-party-gear`/);
assert.match(promptPacket, /Allowed write scope/);
assert.match(promptPacket, /Do not edit in this slice/);
assert.match(promptPacket, /public\/premade-characters\/\*\.json/);
assert.match(promptPacket, /src\/utils\/combat\/combatUtils\.ts/);
assert.match(promptPacket, /character creator UI/);
assert.match(promptPacket, /character sheet spellbook UI/);
assert.match(promptPacket, /AI arbitration policy/);
assert.match(promptPacket, /npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(promptPacket, /environment receipt now has a Package 2 scoped\s+`passed` result/);
assert.match(promptPacket, /Do not claim visual spellbook or character\s+creator verification from this package/);
assert.match(promptPacket, /List changed files/);
assert.match(promptPacket, /Send exactly one Package 2 implementation slice/);

assert.equal(taskDraftPayload.status, 'submitted_blocked_by_git_sync');
assert.equal(taskDraftPayload.submittedDraftId, 'draft-1779344522441-vdy0hi');
assert.equal(taskDraftPayload.submissionReceipt, 'docs/tasks/spells/PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md');
assert.equal(taskDraftPayload.endpoint, 'POST /api/v1/task-drafts');
assert.equal(taskDraftPayload.title, 'Spell Phase 1 Package 2: premade party and gear');
assert.match(taskDraftPayload.submitAfter, /SNAPSHOT_RECEIPT\.md records passed or approved waived result/);
assert.match(taskDraftPayload.body, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(taskDraftPayload.body, /jules\/spells-package2-premade-party-gear/);
assert.match(taskDraftPayload.body, /Jules Environment receipt now allows Package 2 dispatch/);
assert.deepEqual(taskDraftPayload.expectedFiles, [
  'public/premade-characters/*.json',
  'src/utils/combat/combatUtils.ts',
  'src/utils/combat/__tests__/combatUtils_*.test.ts',
  'optional narrow premade legality audit/test under existing test or script structure',
]);
assert.deepEqual(taskDraftPayload.verificationCommands, [
  'npm run validate:spells',
  'npm run generate:spell-gates',
  'npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose',
]);

assert.match(readinessChecklist, /# Package 2 Dispatch Readiness Checklist/);
assert.match(readinessChecklist, /Status: dispatched to Jules; waiting on Jules queue\/plan\/PR state/);
assert.match(readinessChecklist, /Ready Artifacts/);
assert.match(readinessChecklist, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK\.md/);
assert.match(readinessChecklist, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);
assert.match(readinessChecklist, /SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK\.md/);
assert.match(readinessChecklist, /SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT\.md/);
assert.match(readinessChecklist, /SPELL_PHASE_1_ROI_BASELINE_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_FOREMAN_REVIEW_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_TASK_COMMUNICATION_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_GIT_SYNC_ATTEMPT_RECEIPT\.md/);
assert.match(readinessChecklist, /PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT\.md/);
assert.match(readinessChecklist, /jules\/spells-package2-premade-party-gear/);
assert.match(readinessChecklist, /codex\/spells-package2-premade-party-gear-review/);
assert.match(readinessChecklist, /F:\\Repos\\Aralia\\\.worktrees\\spells-package2-premade-party-gear/);
assert.match(readinessChecklist, /Environment Snapshot Gate/);
assert.match(readinessChecklist, /npm ci --no-audit --no-fund/);
assert.match(readinessChecklist, /combatUtils_\*\.test\.ts/);
assert.match(readinessChecklist, /jules-env-config-spell-phase1-package2-scoped-snapshot-passed-2026-05-21\.png/);
assert.match(readinessChecklist, /local POST to `\/api\/v1\/task-drafts` has been sent/);
assert.match(readinessChecklist, /draft-1779344522441-vdy0hi/);
assert.match(readinessChecklist, /blocked_by_git_sync/);
assert.match(readinessChecklist, /draft-1779400428597-mind7o/);
assert.match(readinessChecklist, /Linear issue `ARA-7` has been created/);
assert.match(readinessChecklist, /handoff-1779400495781-jauy49/);
assert.match(readinessChecklist, /Jules session `15527431301408060204` is queued/);
assert.match(readinessChecklist, /No Package 2 implementation branch or worktree has been created/);
assert.match(readinessChecklist, /No Package 2 PR has been opened/);
assert.match(readinessChecklist, /No Package 2 task-scoped ROI savings claim is allowed yet/);
assert.match(readinessChecklist, /Next Dispatch Steps/);
assert.match(readinessChecklist, /Refresh Jules session `15527431301408060204` until it leaves `QUEUED`/);
assert.match(readinessChecklist, /asks for plan approval, opens a PR, or reports a\s+blocker/);
assert.match(readinessChecklist, /roi-foreman-usage/);
assert.match(readinessChecklist, /roi-estimate/);
assert.match(readinessChecklist, /before\s+deciding Package 3 can begin/);
assert.match(readinessChecklist, /scope\s+review, failure classification, and the selected review outcome/);
assert.match(readinessChecklist, /task-scoped messages, clarifications, and operator\/Jules communication facts/);
assert.match(readinessChecklist, /before claiming Package 2 has completed the GitHub, deployment, and local\s+sync lifecycle/);
assert.match(readinessChecklist, /Abort Or Repair Path If Snapshot Fails/);
assert.match(readinessChecklist, /do not dispatch Package 2/);
assert.match(readinessChecklist, /npm install --no-audit --no-fund/);

assert.match(draftSubmissionReceipt, /# Package 2 Symphony Draft Submission Receipt/);
assert.match(draftSubmissionReceipt, /Status: superseded by clean-base draft and Jules launch receipt/);
assert.match(draftSubmissionReceipt, /draft-1779344522441-vdy0hi/);
assert.match(draftSubmissionReceipt, /blocked_by_git_sync/);
assert.match(draftSubmissionReceipt, /Could not fetch origin/);
assert.match(draftSubmissionReceipt, /16 tracked file\(s\) have uncommitted changes/);
assert.match(draftSubmissionReceipt, /19 untracked file\(s\) are present/);
assert.match(draftSubmissionReceipt, /40678de8bdc3ce58db0c97e062f5a170526e4fa7/);
assert.match(draftSubmissionReceipt, /draft-1779400428597-mind7o/);
assert.match(draftSubmissionReceipt, /ARA-7/);
assert.match(draftSubmissionReceipt, /handoff-1779400495781-jauy49/);
assert.match(draftSubmissionReceipt, /15527431301408060204/);
assert.match(draftSubmissionReceipt, /PACKAGE_2_GIT_SYNC_ATTEMPT_RECEIPT\.md/);

assert.match(handoffReceipt, /# Package 2 Symphony Handoff Receipt/);
// The receipt is intentionally allowed to advance as the visible Jules handoff
// advances. This assertion protects the current post-approval state so future
// agents do not accidentally describe the handoff as still merely queued.
assert.match(handoffReceipt, /Status: Jules plan approved; waiting on Jules run\/PR state/);
assert.match(handoffReceipt, /40678de8bdc3ce58db0c97e062f5a170526e4fa7/);
assert.match(handoffReceipt, /draft-1779400428597-mind7o/);
assert.match(handoffReceipt, /ARA-7/);
assert.match(handoffReceipt, /handoff-1779400495781-jauy49/);
assert.match(handoffReceipt, /15527431301408060204/);
assert.match(handoffReceipt, /Latest dashboard-refreshed Jules state: `IN_PROGRESS`/);
assert.match(handoffReceipt, /Dashboard-First Blocker Found/);
assert.match(handoffReceipt, /visible Symphony dashboard/);
assert.match(handoffReceipt, /Current Foreman Boundary/);
assert.match(handoffReceipt, /Visible Jules Plan Approval Found/);
assert.match(handoffReceipt, /dashboard-linked\s+Jules session did not show a finished Package 2 result/);
assert.match(handoffReceipt, /Package 2 handoff reconciled to\s+`IN_PROGRESS`/);

assert.match(gitSyncAttemptReceipt, /# Package 2 Git Sync Attempt Receipt/);
assert.match(gitSyncAttemptReceipt, /Status: remote branch pushed; Symphony readiness still needs a fresh preflight/);
assert.match(gitSyncAttemptReceipt, /codex\/spell-phase1-symphony-package2-setup/);
assert.match(gitSyncAttemptReceipt, /290cccb8 Document spell phase 1 Symphony package 2 setup/);
assert.match(gitSyncAttemptReceipt, /dee53c47 Record Package 2 push boundary/);
assert.match(gitSyncAttemptReceipt, /c547c1ed Clarify Package 2 local branch head/);
assert.match(gitSyncAttemptReceipt, /6fc9e81a Stabilize Package 2 git sync receipt/);
assert.match(gitSyncAttemptReceipt, /git push -u origin codex\/spell-phase1-symphony-package2-setup/);
assert.match(gitSyncAttemptReceipt, /approval flow rejected the escalated push command before Git\s+ran/);
assert.match(gitSyncAttemptReceipt, /No remote branch was confirmed/);
assert.match(gitSyncAttemptReceipt, /Git created remote branch\s+`origin\/codex\/spell-phase1-symphony-package2-setup`/);
assert.match(gitSyncAttemptReceipt, /local branch now tracks\s+`origin\/codex\/spell-phase1-symphony-package2-setup`/);
assert.match(gitSyncAttemptReceipt, /npm run sync-check/);
assert.match(gitSyncAttemptReceipt, /stale intent gate/);
assert.match(gitSyncAttemptReceipt, /No Jules dispatch was claimed/);
assert.match(gitSyncAttemptReceipt, /Do not dispatch Jules for Package 2 until the Package 2 branch context is\s+confirmed visible/);

assert.match(roiBaselineReceipt, /# Spell Phase 1 ROI Baseline Receipt/);
assert.match(roiBaselineReceipt, /Status: baseline recorded, no ROI claim/);
assert.match(roiBaselineReceipt, /No Package 2 Jules task has been dispatched/);
assert.match(roiBaselineReceipt, /No Package 2 task-scoped foreman-usage receipt exists in Symphony yet/);
assert.match(roiBaselineReceipt, /Foreman Work Already Performed/);
assert.match(roiBaselineReceipt, /PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT\.md/);
assert.match(roiBaselineReceipt, /Non-Counted Context/);
assert.match(roiBaselineReceipt, /codex_goal_context/);
assert.match(roiBaselineReceipt, /Required Package 2 ROI Evidence/);
assert.match(roiBaselineReceipt, /roi-foreman-usage/);
assert.match(roiBaselineReceipt, /roi-estimate/);
assert.match(roiBaselineReceipt, /ROI is unknown/);
assert.match(roiBaselineReceipt, /not measured savings/);

assert.match(atlasGateCheckpointReceipt, /# Package 2 Atlas And Gate Checkpoint Receipt/);
assert.match(atlasGateCheckpointReceipt, /Status: pending Package 2 implementation/);
assert.match(atlasGateCheckpointReceipt, /Spell gate refresh run for Package 2: `no`/);
assert.match(atlasGateCheckpointReceipt, /Atlas review\/update run for Package 2: `no`/);
assert.match(atlasGateCheckpointReceipt, /npm run validate:spells/);
assert.match(atlasGateCheckpointReceipt, /npm run generate:spell-gates/);
assert.match(atlasGateCheckpointReceipt, /npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(atlasGateCheckpointReceipt, /public\/data\/spell_gate_report\.json/);
assert.match(atlasGateCheckpointReceipt, /Can Package 3 begin after this checkpoint/);
assert.match(atlasGateCheckpointReceipt, /Do not mark this receipt complete before Package 2 has real implementation\s+evidence/);
assert.match(atlasGateCheckpointReceipt, /Do not use this receipt to claim visual spellbook or character creator proof/);

assert.match(foremanReviewReceipt, /# Package 2 Foreman Review And Failure Classification Receipt/);
assert.match(foremanReviewReceipt, /Status: pending Package 2 implementation/);
assert.match(foremanReviewReceipt, /Package 2 Jules handoff exists: `no`/);
assert.match(foremanReviewReceipt, /Failure classification complete: `no`/);
assert.match(foremanReviewReceipt, /Scope Review Fields/);
assert.match(foremanReviewReceipt, /Files within allowed write scope/);
assert.match(foremanReviewReceipt, /Character creator UI touched/);
assert.match(foremanReviewReceipt, /Verification Fields/);
assert.match(foremanReviewReceipt, /Failure Classification/);
assert.match(foremanReviewReceipt, /`scope`/);
assert.match(foremanReviewReceipt, /`data`/);
assert.match(foremanReviewReceipt, /`runtime`/);
assert.match(foremanReviewReceipt, /`spell_gate`/);
assert.match(foremanReviewReceipt, /`decision_boundary`/);
assert.match(foremanReviewReceipt, /Review Outcomes/);
assert.match(foremanReviewReceipt, /ready_for_pr_follow_through/);
assert.match(foremanReviewReceipt, /needs_jules_feedback/);
assert.match(foremanReviewReceipt, /needs_codex_review_repair/);
assert.match(foremanReviewReceipt, /blocked_do_not_advance/);
assert.match(foremanReviewReceipt, /Do not mark Package 2 complete from Jules status alone/);
assert.match(foremanReviewReceipt, /If Codex performs any review repair, record why Jules feedback was not the\s+better first repair path/);

assert.match(taskCommunicationReceipt, /# Package 2 Task Communication Receipt/);
assert.match(taskCommunicationReceipt, /Status: pending Package 2 Symphony task/);
assert.match(taskCommunicationReceipt, /Symphony task draft exists: `no`/);
assert.match(taskCommunicationReceipt, /Jules handoff\/session exists: `no`/);
assert.match(taskCommunicationReceipt, /Task-scoped operator messages recorded: `no`/);
assert.match(taskCommunicationReceipt, /Task-scoped Codex foreman messages recorded: `no`/);
assert.match(taskCommunicationReceipt, /Communication Channels To Record/);
assert.match(taskCommunicationReceipt, /local task messages on the Package 2 task page/);
assert.match(taskCommunicationReceipt, /structured task clarifications/);
assert.match(taskCommunicationReceipt, /Jules prompt and any Jules dialogue/);
assert.match(taskCommunicationReceipt, /Do not treat broad Codex thread context as task-scoped Package 2 communication/);
assert.match(taskCommunicationReceipt, /Fields To Fill After Dispatch/);
assert.match(taskCommunicationReceipt, /Can Package 2 advance from a communication standpoint/);
assert.match(taskCommunicationReceipt, /Do not send Jules feedback just to make this receipt non-empty/);

assert.match(prDeploymentLocalSyncReceipt, /# Package 2 PR, Deployment, And Local Sync Receipt/);
assert.match(prDeploymentLocalSyncReceipt, /Status: pending Package 2 implementation/);
assert.match(prDeploymentLocalSyncReceipt, /Package 2 Jules handoff exists: `no`/);
assert.match(prDeploymentLocalSyncReceipt, /Package 2 PR exists: `no`/);
assert.match(prDeploymentLocalSyncReceipt, /GitHub checks refreshed: `no`/);
assert.match(prDeploymentLocalSyncReceipt, /Deployment proof or waiver recorded: `no`/);
assert.match(prDeploymentLocalSyncReceipt, /Local sync proof recorded: `no`/);
assert.match(prDeploymentLocalSyncReceipt, /Fields To Fill After PR Exists/);
assert.match(prDeploymentLocalSyncReceipt, /PR head SHA/);
assert.match(prDeploymentLocalSyncReceipt, /GitHub checks result/);
assert.match(prDeploymentLocalSyncReceipt, /Deployment Evidence/);
assert.match(prDeploymentLocalSyncReceipt, /Deployment status: `waived`/);
assert.match(prDeploymentLocalSyncReceipt, /Local Sync Evidence/);
assert.match(prDeploymentLocalSyncReceipt, /Post-sync verifier result/);
assert.match(prDeploymentLocalSyncReceipt, /Do not mark Package 2 lifecycle complete before a real PR/);
assert.match(prDeploymentLocalSyncReceipt, /If Package 2 is completed as a patch rather than a PR/);
