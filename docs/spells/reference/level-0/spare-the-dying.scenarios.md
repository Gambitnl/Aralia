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
- Single creature target; the current data narrows this to allies
- Current target data rejects objects and points because the spell is creature-only
- Source text requires a creature at 0 HP that is not dead
- The effect should make the target Stable and stop it from dying
- The spell has no explicit undead/construct exclusion in the reviewed data
- Higher-level prose says the range doubles at levels 5, 11, and 17
- Current combat runtime tracks `currentHP`, `deathSaves.isStable`, and Unconscious state separately
- The reviewed runtime slice looks narration-first unless the stabilization bridge is consumed

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Spare the Dying on a visible allied creature at 0 HP, not dead, within 15 feet. | FAIL | The source says the target becomes Stable, but the reviewed runtime path never consumes the zero-HP stabilization contract end to end: `UtilityCommand` only logs narration, and the paired `STATUS_CONDITION` row is skipped because its duration value is 0. No HP or death-save state changes occur. |
| Attempt to cast while the target is behind blocked line of sight; the cast should be rejected. | PASS | `TargetResolver` enforces `lineOfSight: true` and rejects blocked sight lines before execution. |
| Attempt to cast on a creature 20 feet away; the cast should be rejected at base level. | PASS | The spell's current range is 15 feet, and the target resolver rejects anything beyond that range. |
| Attempt to cast on a healthy living creature above 0 HP; the cast should be rejected or treated as an explicit no-op. | FAIL | The reviewed target logic does not enforce the 0-HP requirement, so healthy creatures are still targetable even though the spell text requires 0 HP. |
| Cast on a creature that is already Stable at 0 HP and expect deterministic idempotent stabilization. | FAIL | The current runtime has no first-class stabilization bridge or idempotent Stable refresh path; the zero-duration Stable row exits early, so the spell does not perform the intended no-op/reapplication semantics. |
| Cast on an enemy creature at 0 HP and expect the source-text "a creature" contract to allow it. | FAIL | The current spell data says `validTargets: creatures, allies`, so enemy targets are rejected even though the source text says "a creature" and does not restrict the spell to allies. |
| Cast on a neutral creature at 0 HP and expect the source-text "a creature" contract to allow it. | FAIL | Same ally-only restriction as the enemy case; neutral creatures are not accepted by the current target data. |
| Cast on an undead or construct creature and check whether the current ruleset has an exclusion. | BLOCKED | No undead/construct exclusion is encoded in the reviewed spell data, and the slice does not prove a special living-creature gate that would distinguish them from other creatures. |
| Attempt to target an object, corpse prop, or ground point instead of a creature; the cast should be rejected. | PASS | The spell is creature-only in the current data and target resolver path, so object/point targeting is correctly rejected. |
| Apply the spell to a player character at 0 HP and inspect death-save state. | FAIL | `deathSaveUtils` and `useTurnManager` track `deathSaves.isStable`, but Spare the Dying never sets that flag or clears death-save tracking. The current cast is narrative-only. |
| Cast the spell in combat versus trying to use it as an exploration stabilizer. | BLOCKED | The reviewed slice proves the combat command plumbing, but not a dedicated off-combat stabilization bridge. The runtime path is still the same narration-only cast either way. |
| Ask whether the current effect is deterministic runtime or narrative-only. | FAIL | The reviewed runtime is narrative-only: `UtilityCommand` logs the effect, but no stabilization state mutation is consumed anywhere in the command path. |
| Cast at levels 5, 11, and 17 and expect the range to double to 30, 60, and 120 feet. | FAIL | The higher-level text exists only as prose; `SpellCommandFactory` only applies structured `effect.scaling`, and Spare the Dying does not carry a structured range-scaling bridge. |
