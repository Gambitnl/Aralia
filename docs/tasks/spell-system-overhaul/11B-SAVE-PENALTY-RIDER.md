# 11B - Save Penalty Rider (Cantrip Gap: Mind Sliver)

## Current Repo Status

This file is preserved as task context, but its original "missing feature" framing is now stale.

Repo verification on 2026-03-11 confirmed that the structured save-penalty rider already exists across data, combat state, and runtime handling:
- `public/data/spells/level-0/mind-sliver.json` already includes a populated `savePenalty` block.
- `src/types/combat.ts` already defines `SavePenaltyRider` and stores `savePenaltyRiders` on combat characters.
- `src/commands/effects/UtilityCommand.ts` already registers structured save penalties through `SavePenaltySystem`.
- `src/systems/combat/SavePenaltySystem.ts` already supports registering penalties, consuming `next_save` riders, and aging duration-based riders.
- `src/systems/combat/__tests__/SavePenaltySystem.test.ts` already exists.

## What Became Historical

The original version assumed:
- the schema still needed a `savePenalty` structure
- the engine could not track or consume "next save" riders
- `mind-sliver.json` still needed to be migrated out of prose-only representation

Those assumptions no longer match the current repo.

## What Still Looks Incomplete

This file still has value as a follow-through checkpoint:
- the repo now has the rider model, but this document does not prove that every saving-throw entry point consumes or displays those riders consistently
- end-to-end gameplay proof, UI surfacing, and wider AI-awareness may still need deeper verification outside this narrow audit

## Maintained Interpretation

Use this file as a follow-through note rather than a schema-design task:
1. do not reopen the already-implemented `savePenalty` data shape
2. verify runtime consumption at the actual save-resolution call sites when deeper combat auditing happens
3. treat any remaining work as integration proof, not as absence of the feature

## Verification Basis

Checked against:
- `public/data/spells/level-0/mind-sliver.json`
- `src/types/combat.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/systems/combat/SavePenaltySystem.ts`
- `src/systems/combat/__tests__/SavePenaltySystem.test.ts`
