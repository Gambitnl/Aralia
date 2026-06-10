# Command Effects Runtime Audit Or Proof

Status: review-required
Last updated: 2026-06-09

This file stores concise proof summaries for the Command Effects Runtime living
project.

## Proof Log

| Date | Proof | Result | Evidence |
|---|---|---|---|
| 2026-06-09 | G1 review gate recorded: delegated reactive payload source-of-truth is missing from command context | Blocked | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/types/state.ts`, `src/hooks/combat/useActionExecutor.ts` |
| 2026-06-09 | Ability teleport effects create `MovementCommand` through the factory bridge | Passed | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.teleport.test.ts` |
| 2026-06-08 | Teleport movement records requested and actual movement budget metadata | Passed | `src/commands/effects/MovementCommand.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts` |

## What The Proof Covers

- G2 remains closed: teleport command resolution keeps budget/fallback metadata in the combat log.
- G4 is now closed: teleport ability effects no longer disappear at the ability-factory boundary.
- G1 is review-required: reactive registration still lacks a safe delegated payload owner.
- The command-effects packet now has the required living-project support docs and frontmatter.

## What Remains Open

- G1 remains the active in-scope gap for reactive delegated execution.
- G3 and G5 remain parked follow-ups until rider or lifecycle ownership evidence changes.
