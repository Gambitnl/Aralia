import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Keeps Symphony task documentation aligned with the current live boundary.
 *
 * This verifier intentionally avoids pinning the contract to any one historical
 * task, PR, or commit. It protects the reusable documentation shape instead:
 * the ordered queue must point at canonical approval/phase tables, keep
 * historical proof separate from the current live flow, and hand future work to
 * Spell Phase 1 rather than sending workers back through completed repair steps.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const openTasks = readFileSync(join(root, 'docs', 'tasks', 'SYMPHONY_OPEN_TASKS.md'), 'utf8');
const task02 = readFileSync(join(root, 'docs', 'tasks', '02-linear-creation-proof.md'), 'utf8');
const task03 = readFileSync(join(root, 'docs', 'tasks', '03-jules-manifest-staging-proof.md'), 'utf8');
const task04 = readFileSync(join(root, 'docs', 'tasks', '04-jules-launch-readiness-and-launch-proof.md'), 'utf8');

assert.match(openTasks, /Documentation is part of the live workflow, not an after-action cleanup item/);
assert.match(openTasks, /canonical approval-boundary table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#approval-boundaries`/);
assert.match(openTasks, /canonical workflow-phase table is\s+`..\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#workflow-phases`/);
assert.match(openTasks, /operator has allowed\s+assumed approvals at each phase boundary/);
assert.match(openTasks, /decision point, options, decision made by the agent/);

assert.match(openTasks, /Do not gitignore contract verifiers/);
assert.match(openTasks, /`conductor\/symphony\/scripts\/verify-\*\.mjs` are durable source/);
assert.match(openTasks, /Runtime\s+state such as `conductor\/symphony\/\.symphony\/\*`, live proof captures, visual\s+verification images, and Jules run output should stay ignored/);

assert.match(openTasks, /Historical .*Proof Thread/i);
assert.match(openTasks, /historical/i);
assert.match(openTasks, /workflow rather than the current live\s+contract target/);
assert.match(openTasks, /spell Phase 1/i);
assert.doesNotMatch(openTasks, /current live\s+ARA-6/i);

assert.match(openTasks, /spell Phase 1/i);
assert.match(openTasks, /EARLY_GAME_SPELL_EXECUTION_PLAN\.md/);
assert.match(openTasks, /SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(openTasks, /Jules environment setup/);
assert.match(openTasks, /package2_scoped_snapshot_passed/);
assert.match(openTasks, /SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK\.md/);
assert.match(openTasks, /SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT\.md/);
assert.match(openTasks, /Package 2 Symphony task draft submission and Jules dispatch/);
assert.doesNotMatch(openTasks, /PR #931 lockfile blockers/);
assert.doesNotMatch(openTasks, /After the repair push and check rerun, decide whether to run the recommended script/);
assert.match(openTasks, /Delegation ROI ledger/);
assert.match(openTasks, /sequential Jules/);
assert.match(openTasks, /not parallel local workers/);

assert.match(openTasks, /Superseded Per-Task Status/);
assert.match(openTasks, /Task 02, Task 03, and Task 04/);

assert.match(task02, /Completed/);
assert.match(task02, /superseded/i);
assert.match(task02, /Remaining blockers: None for Task 02 itself/);

assert.match(task03, /Completed/);
assert.match(task03, /superseded/i);
assert.match(task03, /Remaining blockers: None for Task 03 itself/);

assert.match(task04, /Completed/);
assert.match(task04, /baseline post-launch reconciliation/);
assert.match(task04, /verify-jules-state-reconciliation-packet\.mjs/);
assert.match(task04, /reconciled_from_external_evidence/);
assert.match(task04, /needs_browser_reconciliation/);
