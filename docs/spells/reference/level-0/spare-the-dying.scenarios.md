# Spare the Dying Scenarios

Source references:
- `docs/spells/reference/level-0/spare-the-dying.md`
- `public/data/spells/level-0/spare-the-dying.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/hooks/combat/useTurnManager.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/combat/deathSaveUtils.ts`

## Spell components worth exercising

- 1 action, verbal and somatic only, no material component
- 15-foot range, with line of sight required
- Single creature target; the current data now follows the source-text "a creature" contract instead of narrowing to allies
- Current target data rejects objects and points because the spell is creature-only
- Source text requires a creature at 0 HP that is not dead
- The effect should make the target Stable and stop it from dying
- The spell has no explicit undead/construct exclusion in the reviewed data
- Higher-level prose says the range doubles at levels 5, 11, and 17
- Current combat runtime tracks `currentHP`, `deathSaves.isStable`, and Unconscious state separately
- The combat runtime now consumes the stabilization bridge for 0-HP targets

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Spare the Dying on a visible allied creature at 0 HP, not dead, within 15 feet. | PASS | `UtilityCommand` now consumes `hitPointState.mode: zero_hit_point_stabilization`, adds a Stable status/condition marker, and sets `deathSaves.isStable: true` without changing HP. |
| Attempt to cast while the target is behind blocked line of sight; the cast should be rejected. | PASS | `TargetResolver` enforces `lineOfSight: true` and rejects blocked sight lines before execution. |
| Attempt to cast on a creature 20 feet away; the cast should be rejected at base level. | PASS | The spell's current range is 15 feet, and the target resolver rejects anything beyond that range. |
| Attempt to cast on a healthy living creature above 0 HP; the cast should be rejected or treated as an explicit no-op. | PASS | The execution bridge leaves the target unchanged and records an explicit `requires_zero_hit_points` no-op log, so healthy targets no longer look like successful stabilization. |
| Cast on a creature that is already Stable at 0 HP and expect deterministic idempotent stabilization. | PASS | The runtime refreshes the Stable status/condition markers and preserves a single Stable record instead of stacking duplicates. |
| Cast on an enemy creature at 0 HP and expect the source-text "a creature" contract to allow it. | PASS | The spell data now uses `validTargets: creatures`, removing the ally-only restriction that contradicted the source text. |
| Cast on a neutral creature at 0 HP and expect the source-text "a creature" contract to allow it. | PASS | The same creature-only target contract allows non-ally creature targets; no enemy/ally gate remains in the spell data. |
| Cast on an undead or construct creature and check whether the current ruleset has an exclusion. | BLOCKED | No undead/construct exclusion is encoded in the reviewed spell data, and the slice does not prove a special living-creature gate that would distinguish them from other creatures. |
| Attempt to target an object, corpse prop, or ground point instead of a creature; the cast should be rejected. | PASS | The spell is creature-only in the current data and target resolver path, so object/point targeting is correctly rejected. |
| Apply the spell to a player character at 0 HP and inspect death-save state. | PASS | Focused proof shows the command preserves existing death-save counters and sets `deathSaves.isStable: true`, matching the turn-manager gate. |
| Cast the spell in combat versus trying to use it as an exploration stabilizer. | BLOCKED | The combat command path is now deterministic, but this review still does not prove a dedicated off-combat stabilization bridge. |
| Ask whether the current effect is deterministic runtime or narrative-only. | PASS | The command now mutates Stable status/condition state and death-save state instead of only logging narration. |
| Cast at levels 5, 11, and 17 and expect the range to double to 30, 60, and 120 feet. | PASS | `createAbilityFromSpell` now converts Spare the Dying's cantrip-tier range into 5-foot combat tiles: 15, 30, 60, and 120 feet at levels 1, 5, 11, and 17. |

## Focused proof

- `npx vitest run src/commands/__tests__/UtilityCommand.test.ts src/utils/character/__tests__/spellAbilityFactory.test.ts` passed on 2026-06-29 with 4 files and 49 tests.
- Dependency sync passed for `src/types/spells.ts` and `src/utils/character/spellAbilityFactory.ts`.
