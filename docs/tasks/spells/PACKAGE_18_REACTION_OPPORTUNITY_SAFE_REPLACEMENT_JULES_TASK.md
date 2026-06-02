# Package 18 Jules Task: Reaction Opportunity Safe Replacement

Status: replacement handoff for Package 18 after the first Jules run became unsafe.

This packet supersedes the original Package 18 Jules launch packet for any new
Jules launch or foreman replacement implementation. The original session
`12854522108539821255` was approved and started work, but its visible diff
attempted broad schema/type deletion and repo tooling/config deletion before any
implementation PR existed. Do not resume that session as-is.

This replacement keeps the spell-phase product goal moving without accepting
unsafe repository churn. It is intentionally evidence-first: close or preserve
only the rows that current data/runtime proof supports, and stop instead of
inventing a broad reaction-engine or schema bridge inside Package 18.

## Worker

Default worker: Jules in a fresh session.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification interpretation, compact workflow-gap reporting,
and tracker updates.

Jules owns the bounded evidence pass, any small data/doc/runtime proof that stays
within this replacement scope, and the completion note. If the work appears to
require forbidden files or broad schema/type rewrites, Jules must stop and report
the blocker instead of implementing around it.

## Superseded Session

- Unsafe Jules session: `12854522108539821255`
- Original launch docs: `PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_TASK.md`
  and `PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_PROMPT.md`
- Original docs PR: [#1142](https://github.com/Gambitnl/Aralia/pull/1142),
  launch-state only, not implementation completion.
- Current implementation PR: none known for Package 18 at replacement time.

Why replacement is required:

- The visible Jules diff showed destructive-looking edits to `src/types/spells.ts`
  and `src/systems/spells/validation/spellValidator.ts`.
- A controlled resume attempt did not stabilize the run.
- The diff then escalated to repo tooling/config file deletion while the broad
  type-file deletion risk remained visible.
- The old task packet allowed too many schema/type/runtime surfaces for a Jules
  recovery run and included rows that are already represented or out of this
  package's safe implementation lane.

## Goal

Progress Package 18 by reconciling the cantrip/level 1-3
`reaction_or_opportunity_restriction` slice against current evidence, while
preserving broader reaction-engine work for a later package.

Package 18 is not complete just because this replacement packet exists. Completion
requires a new PR or foreman implementation that proves the selected row statuses
and updates the bucket/tracker accordingly.

## Read First

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- `public/data/spells/level-0/shocking-grasp.json` as the existing opportunity
  suppression continuity pattern
- `public/data/spells/level-1/arms-of-hadar.json`
- `public/data/spells/level-1/dissonant-whispers.json`
- `public/data/spells/level-3/enemies-abound.json`
- `public/data/spells/level-3/counterspell.json`
- `public/data/spells/level-3/slow.json`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- `src/systems/combat/__tests__/OpportunityAttackSystem.test.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts`
- `src/systems/spells/__tests__/spellPipeline.test.ts`

## Replacement Candidate Rows

Process these rows only:

- `arms-of-hadar::reaction_or_opportunity_restriction`
- `dissonant-whispers::reaction_or_opportunity_restriction`
- `enemies-abound::reaction_or_opportunity_restriction`
- `counterspell::reaction_or_opportunity_restriction`
- `slow::reaction_or_opportunity_restriction` repeated early-game variants

Do not process these rows in this replacement run:

- `confusion::reaction_or_opportunity_restriction`: do not edit for Package 18.
  The unsafe run already exposed confusion about this row's level/scope, and the
  bucket currently records it as closed by existing `Confused` reaction handling.
- `lightning-arrow::manual_attack_hit_or_miss_trigger`: defer to the manual
  attack-hit-or-miss trigger bucket/package. It is adjacent risk context, not a
  safe reaction/opportunity continuation implementation target.

## Expected Classification Bias

Use current evidence rather than the older launch packet:

- `arms-of-hadar`: expected already represented after proof because the bucket
  records `Reactions Suppressed` data and combat utility reaction prevention.
- `dissonant-whispers`: expected already represented after proof because the
  bucket records `forcedMovement.usesReaction: true` and MovementCommand reaction
  deduction.
- `enemies-abound`: expected already represented after proof because
  OpportunityAttackSystem records the forced opportunity-attack reason.
- `slow`: expected already represented after proof because combat utilities
  prevent reactions while `Slowed`.
- `counterspell`: expected blocker/defer unless a small existing field already
  captures interruption/action-loss semantics. Do not add a new spell-casting
  interruption event in Package 18.

If this expected classification is contradicted by the current files, report the
specific contradiction and keep the fix bounded to allowed files.

## Allowed Write Scope

Allowed by default:

- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- `public/data/spells/level-1/arms-of-hadar.json`
- `public/data/spells/level-1/dissonant-whispers.json`
- `public/data/spells/level-3/enemies-abound.json`
- `public/data/spells/level-3/counterspell.json`
- `public/data/spells/level-3/slow.json`
- focused tests under:
  - `src/systems/combat/__tests__/OpportunityAttackSystem.test.ts`
  - `src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts`
  - `src/systems/spells/__tests__/spellPipeline.test.ts`

Allowed only if the evidence proves a tiny localized runtime gap and the PR
remains small:

- `src/systems/combat/reactions/OpportunityAttackSystem.ts`

## Forbidden Write Scope

Do not edit, delete, format, generate, or commit:

- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- any other `src/systems/spells/schema/**` file
- `src/hooks/combat/useActionExecutor.ts`
- `public/data/spells/level-3/confusion.json`
- `public/data/spells/level-1/lightning-arrow.json`
- `public/data/spells/level-3/lightning-arrow.json`
- `.github/**`
- `package.json`, `package-lock.json`, or any lockfile
- `debug-pixels.mjs`
- `eslint.config.mjs`
- `playwright.config.ts`
- `postcss.config.js`
- `remove-checkerboard.mjs`
- `tailwind.config.js`
- `test-dc.js`
- `vite.config.ts`
- `vitest.config.ts`
- root helper scripts or patch scripts, including `safe_patch_*`, `patch_*`,
  `update_bucket.cjs`, `*.tmp.*`, or one-off migration helpers
- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, dashboard caches, draft payloads, click logs, or local
  orchestration state

If any forbidden file appears in the working diff, revert that file before
publishing. If the forbidden edit is required to make the package pass, stop and
report the blocker instead of publishing.

## Required Work

1. Read the current bucket rows and selected source files.
2. Classify each replacement candidate as `already_represented_after_proof`,
   `implement_now`, `defer_broader_system`, or `belongs_to_other_bucket`.
3. Prefer proving existing closures over rewriting broad schema/type layers.
4. Implement only small bounded fixes that stay inside the allowed write scope.
5. Leave Counterspell open or mark it deferred if the missing semantics require a
   new spell-interruption event model.
6. Do not edit Confusion or Lightning Arrow in this package.
7. Update the bucket row notes only for statuses that are proved by current
   data/runtime/test evidence.
8. Completion note must list changed files and explicitly say whether any
   forbidden file was touched.

## Verification Commands

Run from repository root after the bounded changes:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
npx vitest run src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts src/systems/combat/__tests__/OpportunityAttackSystem.test.ts src/systems/spells/__tests__/spellPipeline.test.ts
```

If one of these commands fails because of broad pre-existing debt outside this
package, report the failing command, the first relevant failure, and why it is or
is not caused by the Package 18 diff. Do not broaden the package to repair
ambient debt.

## Acceptance Criteria

- Package 18 has a new PR or foreman replacement diff based on this safe packet.
- PR file list stays inside allowed scope.
- No forbidden file is changed, deleted, reformatted, generated, or committed.
- Candidate rows are classified with evidence in the bucket file.
- Rows already represented by current runtime/data remain closed with proof.
- Counterspell is not forced through a broad schema/type bridge inside this
  package.
- Confusion and Lightning Arrow remain out of this replacement run.
- Verification results are reported with exact commands and outcomes.
- Residual reaction-engine work is left visible for a later package rather than
  hidden by a partial implementation.