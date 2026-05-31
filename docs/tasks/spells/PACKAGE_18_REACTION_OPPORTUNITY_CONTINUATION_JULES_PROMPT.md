# Package 18 Jules Prompt: Reaction Opportunity Continuation

You are working on Aralia Spell Phase 1, Package 18.

Read first:

- `docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- `public/data/spells/level-0/shocking-grasp.json` (for continuity pattern)
- relevant selected spell JSON files under `public/data/spells/level-1` and `level-3`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- focused tests for spell validation, command factories, and opportunity systems

Goal:

Classify the remaining early-game `reaction_or_opportunity_restriction` rows and
implement the largest coherent safe subset in one bounded package.
Package 18 is now the live Jules session: Linear `ARA-28`, handoff
`handoff-1780188354283-yposds`, Jules session `12854522108539821255`.

Expected value for this package:

- This slice should touch multiple spell rows that share the same mechanics family
  (reaction suppression, reaction-consuming forced movement, and reaction trigger/interruption
  semantics), not a single isolated row.
- The package remains within cantrip/level 1-3 scope and does not redesign broad
  AI arbitration, summon-control, or optional reaction prompt UI.

Expected behavior:

- Classify each candidate row as
  `implement_now`, `already_represented_after_proof`,
  `defer_broader_system`, or `belongs_to_other_bucket`.
- Use existing spell-schema and combat patterns where possible.
- Implement the selected rows only and avoid out-of-scope broadening.
- Remove only rows proved by runtime/data evidence.
- Update `reaction_or_opportunity_restriction.md` only for rows whose changes are implemented.
- Run the required verification list (below) and report what changed and what remains deferred.

Candidate rows for this continuation slice:

- `arms-of-hadar::reaction_or_opportunity_restriction`
- `dissonant-whispers::reaction_or_opportunity_restriction`
- `enemies-abound::reaction_or_opportunity_restriction`
- `confusion::reaction_or_opportunity_restriction`
- `counterspell::reaction_or_opportunity_restriction`
- `slow::reaction_or_opportunity_restriction` (both listed early-game entries)
- `lightning-arrow::manual_attack_hit_or_miss_trigger` if needed to preserve coherence

Do not edit:

- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, dashboard caches, draft payload artifacts, or local orchestration logs
- workflow files
- levels 4-9 spell data
- summon/familiar/flyby systems and broad AI arbitration
- combat HUD rider icon UI or optional tactical reaction prompt redesign

Scope is intentionally bounded to the exact files listed in the task packet.

Verification:

Run these commands and report results in the completion note:

1. `npm run validate:spells`
2. `node scripts\auditAtlasBuckets.mjs`
3. `npx vitest run src/commands/factory/__tests__/SpellCommandFactoryGrantedAction.test.ts src/systems/combat/__tests__/OpportunityAttackSystem.test.ts`

If runtime/schema files are touched and exported signatures change, run or explicitly
document dependency-header sync required by `AGENTS.md`.

Output you should include at package completion:

- Row classifications in `reaction_or_opportunity_restriction.md`.
- The implemented bounded row list and why it was safe to include.
- Proof commands and outcomes.
- Files changed.
- Residual rows left for later buckets or broader systems.

