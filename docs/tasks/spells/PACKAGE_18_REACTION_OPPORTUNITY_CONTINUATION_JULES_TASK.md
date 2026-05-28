# Package 18 Jules Task: Reaction Opportunity Continuation (Cantrip/Level 1-3)

Status: bounded continuation packet for the next `reaction_or_opportunity_restriction`
slice after Package 17.

This packet moves the mechanism forward by taking the remaining cantrip/level 1-3
`reaction_or_opportunity_restriction` findings in a coherent, bounded batch.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker updates.
Jules owns implementation-heavy spell data, scoped schema/runtime bridge work, focused
tests, and bucket-row classification updates for this bounded slice.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package18-reaction-opportunity-continuation`

Optional Codex review branch, only if bounded local follow-up is necessary:

- `codex/spells-package18-reaction-opportunity-continuation-review`

Recommended review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package18-reaction-opportunity-continuation`

## Jules Value

Jules value: This is a high-value continuation slice because it groups multiple early-
game row families that share the same reaction/economic effect shape (forced
movement using reaction economy, reaction suppression, reaction-trigger interruption,
and reaction-forced opportunity behavior), and can close representative failures at once.

At minimum, the package should classify all listed cantrip/level 1-3 rows first and
implement the largest coherent subset that is safe under existing `combatCost`, `reactionCondition`,
`forcedMovement`, `statusCondition`, opportunity system, validation, and command-factory patterns.

## Goal

Classify the remaining cantrip/level 1-3 `reaction_or_opportunity_restriction` rows and
implement the largest coherent subset that can be represented through existing schema/runtime
patterns without widening into summon-control, broader reaction-engine, or AI-arbitration redesign.

Current remaining early-game candidates to process in this package:

- `arms-of-hadar::reaction_or_opportunity_restriction` (cantrip/level-1 row still open)
- `dissonant-whispers::reaction_or_opportunity_restriction`
- `enemies-abound::reaction_or_opportunity_restriction`
- `confusion::reaction_or_opportunity_restriction`
- `counterspell::reaction_or_opportunity_restriction` (validate action/bonus/action/reaction interruption fields and loss semantics)
- `slow::reaction_or_opportunity_restriction` second row (repeated row variant)
- `lightning-arrow::manual_attack_hit_or_miss_trigger` (adjacent risk/next-in-bucket if required by structure constraints)

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- selected rows in:
  - `public/data/spells/level-0/shocking-grasp.json`
  - `public/data/spells/level-1/arms-of-hadar.json`
  - `public/data/spells/level-1/dissonant-whispers.json`
  - `public/data/spells/level-1/lightning-arrow.json`
  - `public/data/spells/level-3/enemies-abound.json`
  - `public/data/spells/level-3/confusion.json`
  - `public/data/spells/level-3/counterspell.json`
  - `public/data/spells/level-3/slow.json`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts`
- `src/systems/spells/__tests__/spellPipeline.test.ts`
- `src/systems/combat/__tests__/OpportunityAttackSystem.test.ts`

## Scope Rules

Do not edit:

- Symphony dashboard/runtime/source or local orchestration files.
- `src/commands/effects/__tests__/MovementCommand.test.ts`
- Any workflow files, runtime tooling scripts, or local scratch artifacts.
- Levels 4-9 spell data.
- summon/familiar/flyby systems or broad AI arbitration logic.
- broad reaction-prompt UI and combat HUD/rider-icon work.

Allowed write scope for this package:

- `public/data/spells/level-0/shocking-grasp.json` (if new defensive proof required)
- `public/data/spells/level-1/arms-of-hadar.json`
- `public/data/spells/level-1/dissonant-whispers.json`
- `public/data/spells/level-3/enemies-abound.json`
- `public/data/spells/level-3/confusion.json`
- `public/data/spells/level-3/counterspell.json`
- `public/data/spells/level-3/slow.json`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- focused tests under affected files as needed for verified selected rows

## Required Work

1. Classify all listed rows as `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `belongs_to_other_bucket`.
2. Implement the largest safe coherent subset first:
   - reaction suppression / reaction disabling mechanics,
   - reaction-consuming forced movement behavior,
   - counterspell interruption/action-loss metadata where it is currently only prose,
   - opportunity-attack enforcement behavior where it can be mapped to existing runtime patterns.
3. Keep the implementation bounded to cantrip/level 1-3 and `reaction_or_opportunity_restriction`
   family.
4. Update bucket rows only for proven changes.
5. Ensure PR file list stays inside expected scope and does not include helper artifacts.

## Verification Commands

Run from repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
npx vitest run src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts src/systems/combat/__tests__/OpportunityAttackSystem.test.ts
```

If TypeScript signatures change in shared files, run dependency-header sync required by
`AGENTS.md`; if unavailable in this checkout, record the exact failure and continue with
this package verification rather than broad tooling repair.

## Acceptance Criteria

- All listed rows are classified in the bucket file first.
- Implementation is a multi-row subset, not a single-row micro-fix.
- Proof exists for selected rows through data/runtime or focused tests.
- `reaction_or_opportunity_restriction.md` is updated only where closure is proven.
- No helper files, workflow edits, local orchestration artifacts, or broad unrelated runtime
  edits are included in the PR.
- Atlas and gate-relevant bucket statuses are consistent with completed closures.
