import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Protects the reusable decision-report shape for the spell Phase 1 flow.
 *
 * ARA-6 is now historical evidence. The live contract should guard the
 * repeatable workflow: explicit approval envelope, tool-boundary separation,
 * sequential Jules-first execution, model routing, and decision entries that
 * explain what the agent chose under assumed approval.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const report = readFileSync(
  join(root, 'docs', 'decision-reports', 'SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md'),
  'utf8',
);
const openTasks = readFileSync(join(root, 'docs', 'tasks', 'SYMPHONY_OPEN_TASKS.md'), 'utf8');
const spellPlan = readFileSync(
  join(root, '..', '..', 'docs', 'tasks', 'spells', 'EARLY_GAME_SPELL_EXECUTION_PLAN.md'),
  'utf8',
);

assert.match(report, /# Spell Phase 1 Assumed-Approval Decisions/);
assert.match(report, /cantrips and spell levels 1-3/);
assert.match(report, /Approval Envelope/);
assert.match(report, /pushing a branch/);
assert.match(report, /opening a PR/);
assert.match(report, /merging a PR/);
assert.match(report, /changing shared schema\/runtime architecture/);
assert.match(report, /changing premade roster semantics/);
assert.match(report, /setting broad AI arbitration policy/);
assert.match(report, /Still outside the assumed-approval envelope/);
assert.match(report, /force-pushing/);
assert.match(report, /changing credentials, secrets, billing, or account configuration/);

assert.match(report, /Tool And Environment Boundaries/);
assert.match(report, /not project approval gates/);
assert.match(report, /safe-directory/);
assert.match(report, /environment\/tool boundary/);

assert.match(report, /Sequential Jules-First Rule/);
assert.match(report, /Codex is the foreman/);
assert.match(report, /Jules is the default implementation worker/);
assert.match(report, /No parallel write-producing spell slices/);

assert.match(report, /Model Routing Record/);
assert.match(report, /Use efficient models for bounded chores/);
assert.match(report, /Use stronger models for decisions/);

assert.match(report, /Decision Entry Template/);
for (const field of [
  'Date/time',
  'Phase',
  'Active slice',
  'Decision point',
  'Options considered',
  'Decision made by agent',
  'Model routing',
  'Rationale/evidence',
  'Mutation performed or skipped',
  'Scope guardrails',
  'Result',
  'Next expected proof',
]) {
  assert.match(report, new RegExp(`- ${field}:`));
}

assert.match(report, /Decision 0: Treat Git Safe-Directory Prompt As Tool Boundary/);
assert.match(report, /Phase: `symphony_finalization`/);
assert.match(report, /Use the per-command read-only override where possible/);
assert.match(report, /global Git safe-directory fix was later applied/);
assert.match(report, /Decision 1: Require Jules Environment Snapshot Proof Before First Spell Slice/);
assert.match(report, /Phase: `jules_environment`/);
assert.match(report, /ready_for_operator_snapshot/);
assert.match(report, /npm run validate:spells/);
assert.match(report, /Decision 17: Run Jules Environment Snapshot And Replace Broad Typecheck Gate With Package 2 Scoped Gate/);
assert.match(report, /combatUtils_\*\.test\.ts/);
assert.match(report, /Package 2 may proceed to\s+Symphony task draft submission/);
assert.match(report, /Decision 18: Submit Package 2 Symphony Draft And Stop At Git Sync Blocker/);
assert.match(report, /draft-1779344522441-vdy0hi/);
assert.match(report, /blocked_by_git_sync/);
assert.match(report, /Could not fetch origin/);
assert.match(report, /16 tracked file\(s\) have uncommitted changes/);
assert.match(report, /19 untracked file\(s\) are present/);
assert.match(report, /Did\s+not dispatch Jules/);
assert.match(report, /Decision 19: Commit Package 2 Setup Locally And Stop When Push Approval Fails/);
assert.match(report, /codex\/spell-phase1-symphony-package2-setup/);
assert.match(report, /290cccb8/);
assert.match(report, /dee53c47/);
assert.match(report, /git log --oneline/);
assert.match(report, /git push -u origin codex\/spell-phase1-symphony-package2-setup/);
assert.match(report, /rejected by user/);
assert.match(report, /Did\s+not push a remote branch/);
assert.match(report, /Decision 2: Choose Premade Party And Gear As First Jules Implementation Slice/);
assert.match(report, /Phase: `spell_baseline`/);
assert.match(report, /SPELL_PHASE_1_BASELINE_REPORT\.md/);

assert.match(report, /Open Decisions For The Next Slice/);
assert.match(report, /Git sync repair path/);
assert.match(report, /[Rr]emote push has not\s+completed/);
assert.match(report, /[Rr]erun the Symphony task queue or Git preflight/);
assert.match(report, /Decision 4: Reserve Package 2 Branch And Worktree Names Without Creating Them/);
assert.match(report, /jules\/spells-package2-premade-party-gear/);
assert.match(report, /Package 2 task draft/);

assert.match(openTasks, /SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(openTasks, /spell Phase 1/);
assert.match(openTasks, /sequential Jules/);
assert.match(spellPlan, /SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS\.md/);
assert.match(spellPlan, /Current Package 0 evidence/);
assert.match(spellPlan, /verify:jules-contract/);
