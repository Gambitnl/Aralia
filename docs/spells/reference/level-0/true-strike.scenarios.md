# True Strike Scenarios

Source references:
- `docs/spells/reference/level-0/true-strike.md`
- `public/data/spells/level-0/true-strike.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/validation/attackAugmentSchemas.ts`

## Spell components worth exercising

- 1 action with somatic and material components, and no verbal component
- Self range and self-only targeting, with no line-of-sight requirement
- The material component is a weapon with which the caster is proficient and that is worth at least 1 CP
- The spell should make one weapon attack with the weapon used in the casting
- The attack should use spellcasting ability instead of Strength or Dexterity for attack and damage rolls
- On hit, the caster should be able to choose Radiant damage or the weapon's normal damage type
- The attack should add Radiant cantrip scaling at character levels 5, 11, and 17
- The current rules text is the 2024-style attack cantrip, not the old next-attack advantage version
- The spell is instantaneous, so there is no concentration or lingering rider to maintain
- The same cast should work as a combat opener or as an exploration cast that becomes an attack later in the same moment

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast True Strike on yourself in combat with a proficient weapon worth 1+ CP and expect the granted weapon attack to resolve immediately. | PASS | `SpellCommandFactory` now recognizes the True Strike immediate attack augment and returns a single `WeaponAttackCommand` instead of a lingering utility log. |
| Cast True Strike on yourself during exploration with the same eligible weapon and expect the same immediate weapon-attack behavior. | PASS | The same cast-time bridge now runs outside combat too, because the spell is still resolved through the command factory rather than a combat-only rider. |
| Attempt to target an ally, neutral creature, object, or point instead of yourself as the spell shell target; the cast should be rejected. Target the chosen enemy creature through `selectedSpellTargets`, and the attack should use that creature as the weapon-attack target. | PASS | The self spell stays self-targeted, but the attack target now rides through `selectedSpellTargets` so the weapon attack resolves against the selected creature instead of being lost. |
| Cast while line of sight to other creatures is blocked, or in a mapless scene, and expect sight not to matter. | PASS | The spell has `lineOfSight: false`, and `TargetResolver` only applies sight checks to `single`, `multi`, and `area` targeting types. |
| Attempt to cast with a weapon you are not proficient with, or with a weapon worth less than 1 CP; the cast should be rejected. | PASS | The new bridge validates the main-hand weapon snapshot before the action is spent and reports the rejection instead of faking an attack. |
| Resolve the attack as a weapon attack and expect spellcasting ability to replace Strength and Dexterity. | PASS | The synthesized attack ability now uses the caster's spellcasting modifier for the attack bonus and folds that same modifier into the base damage packet. |
| On hit, choose Radiant damage. | PASS | The command factory now honors the Radiant choice and resolves the base damage packet as Radiant. |
| On hit, choose the weapon's normal damage type. | PASS | The same bridge honors the normal-damage choice and keeps the weapon's own damage type on the base packet. |
| Cast at character levels 5, 11, and 17 and expect the extra Radiant damage to scale up. | PASS | The synthetic weapon attack now carries the 1d6 / 2d6 / 3d6 Radiant rider at the same breakpoints as the spell text. |
| Expect the older next-attack advantage rider from pre-2024 True Strike text. | PASS | The current reference text does not encode that rider, so the system correctly does not surface a lingering advantage effect. |
| Expect the granted attack to be consumed after one attack, with no stacking on recast and no duration-based expiration. | PASS | The bridge emits one weapon attack command and no lingering utility rider, so there is no transient spell state left behind to stack or expire. |
