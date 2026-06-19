# Command Effects Runtime Audit Or Proof

Status: active
Last updated: 2026-06-19

This file stores concise proof summaries for the Command Effects Runtime living
project.

## Proof Log

| Date | Proof | Result | Evidence |
|---|---|---|---|
| 2026-06-19 | T2 delegated reactive payload execution | Passed | `src/commands/base/SpellCommand.ts` adds `delegatedReactivePayload`; `src/commands/effects/ReactiveEffectCommand.ts` rehydrates supported delegated payloads through `CommandExecutor`; `npx vitest run src\commands\effects\__tests__\ReactiveEffectCommand.test.ts` passed 2 tests |
| 2026-06-19 | Runnable focused effect command subset | Passed | `npx vitest run src\commands\effects\__tests__\ReactiveEffectCommand.test.ts src\commands\effects\__tests__\DamageCommand.test.ts src\commands\effects\__tests__\MovementCommand.test.ts src\commands\effects\__tests__\AttackRollModifierCommand.test.ts src\commands\effects\__tests__\TerrainCommand.test.ts src\commands\effects\__tests__\ConcentrationBreakPathParity.test.ts` passed 6 files / 28 tests |
| 2026-06-19 | Focused effects command directory run | Blocked outside slice | `npx vitest run src\commands\effects\__tests__` passed 28 tests across the runnable effect suites, but `src/commands/effects/__tests__/StatusConditionCommand.test.ts` has an existing transform error from duplicate local declarations (`effect`, `command`, `newState`, `updatedTarget`) outside the allowed scope |
| 2026-06-09 | G1 review gate recorded: delegated reactive payload source-of-truth is missing from command context | Blocked | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/types/state.ts`, `src/hooks/combat/useActionExecutor.ts` |
| 2026-06-09 | Ability teleport effects create `MovementCommand` through the factory bridge | Passed | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.teleport.test.ts` |
| 2026-06-08 | Teleport movement records requested and actual movement budget metadata | Passed | `src/commands/effects/MovementCommand.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts` |

## What The Proof Covers

- G2 remains closed: teleport command resolution keeps budget/fallback metadata in the combat log.
- G4 is now closed: teleport ability effects no longer disappear at the ability-factory boundary.
- G1 is resolved for T2: reactive registration can now use a command-context-owned delegated payload and execute it through the normal command executor when the trigger fires.
- The command-effects packet now has the required living-project support docs and frontmatter.

## What Remains Open

- Inline `useActionExecutor.ts` reactive behavior was intentionally preserved because this slice did not redirect uncovered inline cases.
- The broader effects test directory is still blocked by the existing `StatusConditionCommand.test.ts` duplicate declaration transform error outside this allowed scope.
- G3 and G5 remain parked follow-ups until rider or lifecycle ownership evidence changes.
