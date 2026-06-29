# Booming Blade Scenarios

Source references:
- `docs/spells/reference/level-0/booming-blade.md`
- `public/data/spells/level-0/booming-blade.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/mechanics/ScalingEngine.ts`

## Spell components worth exercising

- 1 action casting time
- Self range with a 5-foot creature target window
- Line of sight required
- Somatic plus material only
- Material component is a melee weapon worth at least 1 sp
- The spell text requires a melee weapon attack with the weapon used in casting
- On hit, the target gets normal weapon effects plus a one-round booming rider
- The rider should trigger only on willing movement of 5 feet or more before the start of the caster's next turn
- Forced movement, teleport, and ally/enemy identity should not change the rider contract
- Cantrip damage scales at character levels 5, 11, and 17

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Booming Blade on a visible creature within 5 feet while holding the melee weapon used for the spell. | PASS | `TargetResolver` accepts a creature target in range with line of sight, and the row is self-range with a 5-foot creature window. |
| Try to cast while not holding a melee weapon worth at least 1 sp. | BLOCKED | The component text requires a melee weapon, but the inspected runtime slice does not show a dedicated inventory or held-weapon gate for spell casting. |
| Cast Booming Blade on an ally creature within 5 feet. | PASS | The row only restricts `validTargets` to `creatures`; there is no ally/enemy filter in the reviewed spell data or validator path. |
| Cast Booming Blade on an enemy creature within 5 feet. | PASS | Same as the ally case; hostile creatures are valid as long as they are in range and visible. |
| Try to target an object, crate, or door. | FAIL | The row only allows creatures, and `TargetResolver` rejects object candidates when `validTargets` does not include `objects`. |
| Try to cast from more than 5 feet away. | FAIL | `TargetResolver` checks creature distance against `targeting.range`, and this row's creature target range is 5 feet. |
| Try to cast without line of sight. | FAIL | The row sets `lineOfSight: true`, and `TargetResolver` rejects blocked or unavailable sight lines. |
| Expect the spell to create a real melee weapon attack roll gate before the damage rider. | FAIL | `SpellCommandFactory` routes the row into a `DamageCommand` path and does not create a `WeaponAttackCommand` for this spell, so the current flow cannot prove an actual hit/miss gate. |
| On a successful melee hit, the target takes the immediate thunder rider damage. | FAIL | The damage command can apply the rider payload, but the inspected execution path does not prove the prerequisite melee weapon hit. |
| If the melee attack misses, the target should take no immediate thunder damage. | FAIL | The current spell flow does not establish a true melee hit gate before the damage row resolves. |
| After the hit, the target stays sheathed until the start of the caster's next turn. | BLOCKED | The movement debuff is one-shot and round-scoped, but the reviewed runtime slice does not prove the exact start-of-next-turn boundary. |
| If the target willingly moves 5 feet or more, the rider deals thunder damage and ends. | FAIL | `processMovementTriggers` fires on movement debuffs without checking the stored `movementType: 'willing'` or any 5-foot threshold. |
| If the target is shoved, dragged, teleported, or otherwise moved forcibly, the rider should not trigger. | FAIL | The current movement-trigger path does not distinguish willing movement from forced movement. |
| At character levels 5, 11, and 17, the spell's thunder damage should scale. | FAIL | The row stores the tier map in `effect.scaling.customFormula`, but the inspected spell factory does not consume `customFormula`; it only applies `scalingTiers` or `bonusPerLevel`. |
