# Primal Savagery Scenarios

Source references:
- `docs/spells/reference/level-0/primal-savagery.md`
- `public/data/spells/level-0/primal-savagery.json`

## Spell components worth exercising

- 1 action, somatic only, no verbal or material component
- Self range with a single creature target within 5 feet
- Line of sight required
- Melee spell attack with a hit-conditioned acid damage row
- 1d10 Acid damage, scaling to 2d10 / 3d10 / 4d10 at levels 5 / 11 / 17
- Teeth or fingernails sharpen for the attack, then return to normal

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Primal Savagery and expect the caster's teeth or fingernails to sharpen briefly, then return to normal after the attack resolves. | BLOCKED | The reference text includes the transformation beat, but the reviewed runtime slice only exposes generic spell damage and visual hooks. No first-class Primal Savagery transformation state or revert consumer was found. |
| Select one visible creature within 5 feet and resolve the spell against it. | PASS | `targeting.type` is `single`, `range` is `5`, `validTargets` is `creatures`, and `TargetResolver` accepts a creature in range with line of sight. |
| Attempt to target a creature 10 feet away; the cast should be rejected. | PASS | `TargetResolver` rejects creature targets beyond `targeting.range` with an `out_of_range` rejection. |
| Try to target an object, crate, door, or ground tile instead of a creature. | PASS | The spell does not allow object targets (`validTargets` is `creatures` only), and the creature-target resolver has no point-target branch for this spell. |
| Target an ally, enemy, or neutral creature that is still within 5 feet and visible. | PASS | No ally/enemy/self filter is set, so any creature in range that passes line of sight is eligible. |
| Resolve the hit branch on a valid creature in reach. | PASS | The structured damage row is hit-conditioned, carries `1d10` Acid damage, and the current `DamageCommand` applies the acid payload once the hit result reaches it. |
| Resolve the miss branch on the same attack. | FAIL | The reviewed runtime slice does not show a dedicated spell-attack miss path or attack-roll command for this spell; `DamageCommand` only emits a confirmed hit event and then applies damage. |
| Apply Acid damage to a target with resistance, immunity, or vulnerability. | PASS | `DamageCommand` routes damage through `ResistanceCalculator`, so acid mitigation and amplification are part of the current damage path. |
| Cast the spell at character levels 5, 11, and 17. | PASS | The data encodes the 1d10 -> 2d10 -> 3d10 -> 4d10 tiering, and the factory's scaling helpers support `character_level` scaling. |
| Cast the spell during combat, including a normal action-cost turn. | PASS | The spell is action-speed combat magic and the reviewed action executor handles spell casting inside the combat turn flow. |
| Cast the spell in a noncombat or exploration-only state with no combat turn queue. | BLOCKED | The reviewed slice is combat-engine driven and does not prove a dedicated noncombat execution path for this cantrip, even though the spell's exploration cost is 0 minute. |
