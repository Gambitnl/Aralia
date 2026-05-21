import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Protects the Jules Environment snapshot receipt for Spell Phase 1.
 *
 * The receipt now records the actual setup boundary: a broad typecheck attempt
 * failed in a clean Jules clone, then a Package 2 scoped snapshot passed the
 * commands that prove this first slice can run in Jules.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..', '..');

const receipt = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md'),
  'utf8',
);
const runbook = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md'),
  'utf8',
);
const plan = readFileSync(
  join(repoRoot, 'docs', 'tasks', 'spells', 'EARLY_GAME_SPELL_EXECUTION_PLAN.md'),
  'utf8',
);
const decisionReport = readFileSync(
  join(repoRoot, 'conductor', 'symphony', 'docs', 'decision-reports', 'SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md'),
  'utf8',
);
const serverSource = readFileSync(join(repoRoot, 'conductor', 'symphony', 'src', 'server.ts'), 'utf8');
const pendingScreenshotPath = join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'evidence',
  'jules-env-config-spell-phase1-pending-2026-05-21.png',
);
const pendingScreenshot = statSync(pendingScreenshotPath);
const typecheckFailedScreenshot = statSync(join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'evidence',
  'jules-env-config-spell-phase1-typecheck-failed-2026-05-21.png',
));
const focusedPathFailedScreenshot = statSync(join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'evidence',
  'jules-env-config-spell-phase1-focused-test-path-failed-2026-05-21.png',
));
const scopedPassedScreenshot = statSync(join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'evidence',
  'jules-env-config-spell-phase1-package2-scoped-snapshot-passed-2026-05-21.png',
));

assert.match(receipt, /# Spell Phase 1 Jules Environment Snapshot Receipt/);
assert.match(receipt, /Status: passed for Package 2 scoped setup/);
assert.match(receipt, /original broad setup script was attempted and failed during\s+repo-wide typecheck/);
assert.match(receipt, /final Package 2 scoped setup script passed/);
assert.match(receipt, /SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK\.md/);

assert.match(receipt, /npm ci --no-audit --no-fund/);
assert.match(receipt, /npm run typecheck/);
assert.match(receipt, /npm run validate:spells/);
assert.match(receipt, /npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(receipt, /failed during `npm run typecheck` in the Jules clean clone/);
assert.match(receipt, /Local `npm run typecheck\s+-- --pretty false` passed afterward/);

assert.match(receipt, /Receipt status: `passed`/);
assert.match(receipt, /Jules Environment page action performed: `yes`/);
assert.match(receipt, /Snapshot result: `passed_with_package_2_scoped_script`/);
assert.match(receipt, /Can Package 2 dispatch after this receipt: `yes`/);
assert.match(receipt, /not_blocked_by_environment_snapshot/);
assert.match(receipt, /6 test files and 37 tests/);
assert.match(receipt, /Failed Attempt Log/);
assert.match(receipt, /pre-existing tracked-clone typecheck mismatch/);
assert.match(receipt, /task-packet test-path error/);
assert.match(receipt, /Corrected scoped attempt/);
assert.match(receipt, /Latest Read-Only Page Observation/);
assert.match(receipt, /https:\/\/jules\.google\.com\/repo\/github\/Gambitnl\/Aralia\/config/);
assert.match(receipt, /Setup controls visible: setup script textbox with placeholder-like `echo do\s+setup` text and `Run and snapshot` button/);
assert.match(receipt, /Snapshot action performed: `yes after text-entry tooling became available`/);
assert.match(receipt, /docs\/tasks\/spells\/evidence\/jules-env-config-spell-phase1-pending-2026-05-21\.png/);
assert.match(receipt, /browser_fill_form/);
assert.match(receipt, /browser_type/);
assert.match(receipt, /Package 2 may now move to Symphony task creation\/promotion/);
assert(pendingScreenshot.isFile());
assert(pendingScreenshot.size > 0);
assert(typecheckFailedScreenshot.isFile());
assert(typecheckFailedScreenshot.size > 0);
assert(focusedPathFailedScreenshot.isFile());
assert(focusedPathFailedScreenshot.size > 0);
assert(scopedPassedScreenshot.isFile());
assert(scopedPassedScreenshot.size > 0);

assert.match(plan, /SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT\.md/);
assert.match(plan, /SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK\.md/);
assert.match(decisionReport, /SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT\.md/);
assert.match(decisionReport, /Decision 5: Create Pending Jules Environment Snapshot Receipt Without Claiming Proof/);
assert.match(decisionReport, /Decision 6: Treat Signed-In Jules Environment Page Observation As Read-Only, Not Proof/);
assert.match(decisionReport, /page as reachable and keep the snapshot\s+receipt pending/);
assert.match(decisionReport, /Decision 8: Add Operator Runbook For The External Jules Snapshot/);
assert.match(decisionReport, /Decision 12: Do Not Click Run And Snapshot Without Text Entry/);
assert.match(decisionReport, /docs\/tasks\/spells\/evidence\/jules-env-config-spell-phase1-pending-2026-05-21\.png/);
assert.match(decisionReport, /Did not click `Run and\s+snapshot`/);
assert.match(decisionReport, /placeholder-like\s+`echo do setup`/);
assert.match(decisionReport, /Decision 17: Run Jules Environment Snapshot And Replace Broad Typecheck Gate With Package 2 Scoped Gate/);
assert.match(decisionReport, /passed 6 test files and 37 tests/);
assert.match(decisionReport, /Package 2 may proceed to\s+Symphony task draft submission/);
assert.match(serverSource, /package2_scoped_snapshot_passed/);
assert.match(serverSource, /completedEvidence/);
assert.match(serverSource, /jules-env-config-spell-phase1-package2-scoped-snapshot-passed-2026-05-21\.png/);
assert.match(serverSource, /PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD\.json/);

assert.match(runbook, /# Spell Phase 1 Jules Environment Operator Runbook/);
assert.match(runbook, /Status: completed for Package 2 scoped setup/);
assert.match(runbook, /https:\/\/jules\.google\.com\/repo\/github\/Gambitnl\/Aralia\/config/);
assert.match(runbook, /npm ci --no-audit --no-fund/);
assert.match(runbook, /npm run typecheck/);
assert.match(runbook, /npm run validate:spells/);
assert.match(runbook, /npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
assert.match(runbook, /6 split combat utility test files with 37 tests passing/);
assert.match(runbook, /set `Receipt status` to `passed`, `failed`, or `waived`/);
assert.match(runbook, /If `npm ci` Fails In A Future Slice/);
