# Command Effects Runtime — Absorbed 2026-07-14

Status: active — G1 delegated reactive payload execution implemented 2026-06-19
Last updated: 2026-06-19

## Purpose

Owns executable effect logic under `src/commands/effects`. Applies spell and ability effects once factories produce `SpellCommand` objects.

## Current State

- Source implementations live in `src/commands/effects` and are active in combat flow.
- Command set: `DamageCommand`, `HealingCommand`, `StatusConditionCommand`, `MovementCommand`, `ReactiveEffectCommand`, `RegisterRiderCommand`, plus support commands.
- Teleport ability effects dispatch through `AbilityCommandFactory` instead of collapsing into generic push fallback.
- Type guards and no-op warning paths protect bad effect shapes while preserving partial state behavior.
- **G1 RESOLVED 2026-06-19**: `CommandContext` now owns `delegatedReactivePayload` containing effect rows plus live-state read/commit hooks. `ReactiveEffectCommand` executes supported delegated payloads through `CommandExecutor` when the registered trigger fires.

## Key Decisions

1. **D-01**: Teleport resolution belongs to `MovementCommand`, including bounds/fallback handling and combat-log budget metadata.
2. **D-02**: Ability teleport effects create `MovementCommand` through `AbilityCommandFactory`. Other movement-economy effects stay outside this factory path.
3. **D-03** (2026-06-10): The command context owns the delegated reactive payload. `ReactiveEffectCommand` rehydrates sibling effect commands on trigger and reactive effects execute through the normal command pipeline.

## Open Gaps

| Gap | Status | Issue | Next action |
|---|---|---|---|
| G3 | active | Non-damage/complex riders only partially routed through `RegisterRiderCommand` | Decide rider schema expansion or add owner note |
| G5 | active | Status and condition turn cleanup lifecycle implemented outside this command layer | Hand off to owning lifecycle subsystem; keep API contract here |

## File Map (Abbreviated)

- `src/commands/effects/`: Core effect commands (damage, healing, status, movement, reactive, riders)
- `src/commands/base/SpellCommand.ts`: Command-context contract; now exposes `delegatedReactivePayload`
- `src/commands/factory/`: `SpellCommandFactory`, `AbilityCommandFactory`
- `src/hooks/combat/useActionExecutor.ts`: Current inline reactive trigger execution path
- Tests: `src/commands/effects/__tests__/`, `src/commands/factory/__tests__/`

## Resume Path

1. Read this file.
2. Confirm G3 and G5 status in code.
3. If new owner evidence changes G3/G5, update and link to new owner project.
4. Run `npx vitest run src/commands/effects/__tests__/ReactiveEffectCommand.test.ts` to verify G1 implementation (passed 2 tests on 2026-06-19).
5. Keep inline `useActionExecutor.ts` behavior untouched until explicitly redirected for uncovered cases.

## Proof Log

- **2026-06-19**: G1 delegated reactive payload execution — Passed. `CommandContext` exposes `delegatedReactivePayload`; `ReactiveEffectCommand` rehydrates supported delegated payloads through `CommandExecutor`; 2 tests passed.
- **2026-06-19**: Focused effects command subset — Passed. 6 files / 28 tests.
- **2026-06-09**: G1 review gate recorded — `ReactiveEffectCommand` callback path blocked until delegated payload source-of-truth decided (resolved by D-03).

---

Absorbed from `docs/projects/command-effects-runtime/` via absorption wave 2026-07-14. Source archive in git history.
