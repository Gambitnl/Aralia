# Poison Spray Scenarios

Source references:
- `docs/spells/reference/level-0/poison-spray.md`
- `public/data/spells/level-0/poison-spray.json`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/utils/combat/resistanceUtils.ts`
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`

## Spell components worth exercising

- 1 action casting time
- Verbal and somatic only, no material component
- 30-foot range with line of sight required
- Single creature target only
- Ranged spell attack, not a saving throw spell
- Immediate Poison damage on hit
- Cantrip scaling at character levels 5, 11, and 17
- Poison resistance, immunity, and vulnerability should flow through the shared damage calculator

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Poison Spray at a visible creature within 30 feet. | PASS | The reference and JSON both describe a single creature target at 30 feet, and `TargetResolver` accepts an in-range creature with line of sight. |
| Attempt to target a creature more than 30 feet away; the cast should be rejected. | PASS | `TargetResolver` rejects the target as `out_of_range` when the distance exceeds the spell's 30-foot range. |
| Attempt to target an object directly with Poison Spray; the cast should be rejected. | PASS | The spell's `validTargets` are creatures only, and the object resolver returns `objects_not_allowed`. |
| Try to target the ground or an empty point instead of a creature. | BLOCKED | The reviewed data models a creature-only single target, and no ground/point targeting branch is present for this spell slice. |
| Cast Poison Spray on an ally creature. | PASS | The spell does not declare an ally/enemy/willingness restriction, so any creature in range is legal. |
| Cast Poison Spray on an enemy creature. | PASS | Same creature-only target contract as the ally case. |
| Cast Poison Spray on a neutral creature. | PASS | No creature relation filter is declared, so neutral creatures are still legal targets. |
| Attempt to resolve Poison Spray as a Constitution-save spell instead of a ranged spell attack; the save branch should not exist. | PASS | The spell has no save metadata; the reviewed runtime path is attack-hit damage, not a save branch. |
| Expect a successful Constitution save to negate Poison Spray damage; this should be rejected as outside the spell contract. | PASS | There is no Constitution save gate in the spell data, so there is no successful-save path to prove. |
| Resolve a hit and apply 1d12 Poison damage. | PASS | The damage row is hit-conditioned and the structured row says the target takes `1d12` Poison damage on a ranged spell hit. |
| Resolve a miss and expect no damage. | PASS | The reviewed spell row is hit-gated, so the miss case does not have a damage application path. |
| Resolve Poison Spray at character levels 5, 11, and 17. | PASS | The structured row and validator test both record the scaling tiers as `2d12`, `3d12`, and `4d12`. |
| Apply Poison resistance, immunity, or vulnerability to the target and resolve the hit. | PASS | `ResistanceCalculator` handles all three outcomes, and the damage pipeline already routes by damage type. Immunity wins, resistance halves, and vulnerability doubles. |
| Attempt to cast Poison Spray with line of sight blocked; the cast should be rejected. | PASS | The spell sets `lineOfSight: true`, and `TargetResolver` rejects blocked visibility. |
| Cast Poison Spray through half cover or three-quarters cover and expect cover-adjusted spell-attack handling. | BLOCKED | I found explicit cover handling for weapon attacks and save-based damage, but not a confirmed spell-attack cover bridge in the reviewed slice. |
| Cast Poison Spray in combat. | PASS | The shared ability/command path creates spell commands from the spell data and the combat executor treats spell abilities as attack-capable actions. |
| Cast Poison Spray outside combat. | BLOCKED | The reviewed slice proves the combat-oriented execution path, but not a separate noncombat runtime branch for this spell. |
