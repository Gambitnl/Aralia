# Fire Bolt Scenarios

Source references:
- `docs/spells/reference/level-0/fire-bolt.md`
- `public/data/spells/level-0/fire-bolt.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryCantripScaling.test.ts`

## Spell components worth exercising

- 1 action casting time
- Range 120 feet with line of sight required
- Valid targets include creatures and objects
- No ally, enemy, self, or willingness restriction is declared
- Somatic and verbal only
- Immediate fire damage on a ranged spell attack hit
- Cantrip damage scales at character levels 5, 11, and 17
- Flammable object ignition is part of the rules text if the object is not worn or carried
- Attack-roll systems should still classify the cast as a spell attack and apply cover where the combat engine supports it

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Fire Bolt at a visible creature within 120 feet. | PASS | The reference and JSON both allow creature targets, the spell range is 120 feet, and `TargetResolver` accepts in-range creature targets with line of sight. |
| Cast Fire Bolt at a visible object within 120 feet. | PASS | The spell explicitly allows objects, and `TargetResolver` has an object-target path when the spell permits object targets. |
| Cast Fire Bolt on an ally creature within 120 feet. | PASS | The reviewed spell data does not add an ally/enemy filter, so any visible creature target is legal if it is in range. |
| Cast Fire Bolt on an enemy creature within 120 feet. | PASS | Same target contract as the ally case. |
| Try to target a creature more than 120 feet away. | FAIL | The spell range is explicitly 120 feet, and `TargetResolver` rejects targets beyond the targeting range. |
| Try to target a creature without line of sight. | FAIL | The spell sets `lineOfSight: true`, and `TargetResolver` blocks blocked or unavailable sight lines. |
| Resolve Fire Bolt through half cover or three-quarters cover and expect the attack roll to use the cover-adjusted target AC. | PASS | `AbilityCommandFactory` calculates cover and adds the bonus to target AC before resolving the attack, so the attack roll respects battlefield cover. |
| Resolve the spell attack and miss. | PASS | The action executor records hit/miss attack results, and the Fire Bolt damage row only executes on a hit. |
| Resolve the spell attack and hit. | PASS | On a hit, the damage row applies `1d10` Fire damage through the shared damage command path. |
| Resolve Fire Bolt at character levels 5, 11, and 17. | PASS | `SpellCommandFactoryCantripScaling.test.ts` proves the damage dice scale to `2d10`, `3d10`, and `4d10` at those tiers. |
| Hit an unattended flammable object and expect it to start burning. | PASS | Focused G28 proof routes Fire Bolt's hit-conditioned object ignition row through the spell-attack object-hit bridge and records an `activeFireEffects` `ignited_object` entry with damage, target object, position, and source spell metadata. |
| Hit a flammable object that is worn or carried and expect the ignition rider to be suppressed instead of starting a burn. | PASS | Focused G28 proof verifies the hit is still recorded, but the ignition artifact is not created when the selected object carries `isWornOrCarried: true`; the combat log records the `worn_or_carried` suppression reason. |
| Let the attack-roll system classify Fire Bolt as a spell attack even though the JSON `attackType` field is blank. | PASS | `useActionExecutor` still classifies spell abilities as spell attacks, and the ranged classification falls back from the spell's range when needed. |
