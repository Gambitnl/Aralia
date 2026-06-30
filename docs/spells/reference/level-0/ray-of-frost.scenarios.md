# Ray of Frost Scenarios

Source references:
- `docs/spells/reference/level-0/ray-of-frost.md`
- `public/data/spells/level-0/ray-of-frost.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/MovementCommand.ts`
- `src/hooks/useAbilitySystem.ts`
- `src/systems/spells/targeting/TargetResolver.ts`

## Spell components worth exercising

- 1 action casting time
- 60-foot ranged target and range gate
- Line of sight required
- Valid targets are creatures only
- No ally, enemy, self, or willingness restriction is declared
- Verbal and somatic only
- Immediate cold damage on a ranged spell attack hit
- Cantrip damage scales at character levels 5, 11, and 17
- Speed reduction rider is modeled as a 1-round movement effect
- Combat and noncombat use should be checked separately because the reviewed runtime is combat-oriented

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Ray of Frost at a visible creature within 60 feet. | PASS | `TargetResolver` accepts an in-range creature target when line of sight is available, and the spell data allows creatures. |
| Attempt to target a creature beyond 60 feet; the cast should be rejected. | PASS | The spell range is 60 feet, so `TargetResolver` rejects the out-of-range creature with the normal range error. |
| Attempt to target a creature without line of sight; the cast should be rejected. | PASS | The spell sets `lineOfSight: true`, and `TargetResolver` blocks blocked or unavailable sight lines. |
| Attempt to target an object or ground point; the cast should be rejected. | PASS | The spell only allows creatures, so object and point/ground selections are rejected instead of being coerced into a legal target. |
| Cast Ray of Frost on an ally creature. | PASS | No ally-only or enemy-only filter is declared, so a legal in-range creature target remains valid regardless of team relation. |
| Cast Ray of Frost on an enemy creature. | PASS | Same target contract as the ally case. |
| Cast Ray of Frost on a neutral creature. | PASS | Same target contract as the ally and enemy cases; no relation filter narrows the creature list. |
| Resolve the ranged spell attack as a hit. | PASS | `AbilityCommandFactory` emits a structured hit result, and the spell's damage and speed-rider rows resolve only on the hit path. |
| Resolve the ranged spell attack as a miss. | PASS | `AbilityCommandFactory` emits `isHit: false` and skips the base spell-effect block, so the Ray of Frost damage and slow rows do not resolve on a miss. |
| Resolve the cold damage rider at character levels 5, 11, and 17. | PASS | The cantrip scaling row is present in the spell JSON and the shared damage factory applies character-level dice scaling to the damage effect. |
| Hit a target with cold resistance, immunity, or vulnerability. | PASS | `DamageCommand` routes cold damage through `ResistanceCalculator.applyResistances`, so the shared damage path handles half, zero, and doubled damage in the normal way. |
| On a hit, apply the -10 speed rider immediately. | PASS | The movement effect is present in the spell JSON, and `MovementCommand.applySpeedChange` now applies a temporary movement-total rider on the hit path without mutating base speed. |
| Let the caster's next turn start and expect the speed rider to fall off. | PASS | `MovementCommand` now applies a single source-bound Ray of Frost slow rider, and `useTurnManager` clears the matching rider when the caster's next turn starts. |
| Hit the same target again before any cleanup and expect the slowdown to refresh instead of stacking. | PASS | Reapplying the same source-bound Ray of Frost slow refreshes the existing rider and condition mirror, so the penalty stays at -10 feet instead of stacking. |
| Use Ray of Frost in combat. | PASS | The reviewed spell path is combat-ready: `useAbilitySystem` builds `SpellCommandFactory` commands, executes them, and then projects attack results back out for follow-up reactions. |
| Use Ray of Frost outside combat or in exploration mode. | BLOCKED | No noncombat/exploration execution bridge was found in the reviewed spell path; the visible runtime slice is action-and-combat oriented and does not consume the spell's exploration cost. |
