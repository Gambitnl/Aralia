# Green-Flame Blade Scenarios

Source references:
- `docs/spells/reference/level-0/green-flame-blade.md`
- `public/data/spells/level-0/green-flame-blade.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`

## Spell components worth exercising

- 1 action casting time
- Self range with a 5-foot melee target window
- Line of sight required
- Somatic plus material components only
- Material component is a melee weapon worth at least 1 sp
- The spell text requires a melee weapon attack with the weapon used in casting
- On a hit, the target takes the weapon attack's normal effects plus green fire that can leap to another creature
- The second creature must be different, visible, and within 5 feet of the hit target
- The secondary fire damage starts at the caster's spellcasting ability modifier and scales with character level
- Both fire payloads use Fire damage

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Green-Flame Blade on a visible creature within 5 feet while holding the melee weapon used for the spell. | PASS | The reference and JSON agree on action casting, self range, 5-foot melee targeting, line of sight, and the required melee-weapon material component. |
| Try to cast while not holding a melee weapon worth at least 1 sp. | BLOCKED | The component text requires the weapon, but the reviewed runtime slice does not show a held-item or inventory gate that can enforce it. |
| Cast Green-Flame Blade on an ally creature within 5 feet. | PASS | The spell data allows `creatures` and does not add an ally exclusion. |
| Cast Green-Flame Blade on an enemy creature within 5 feet. | PASS | The spell data explicitly allows `enemies`, and there is no hostile-only restriction beyond range and sight. |
| Try to target an object, crate, or door. | FAIL | The row only allows creatures/enemies, and the validated targeting schema does not open an object path here. |
| Try to cast from more than 5 feet away. | FAIL | The primary target window is 5 feet, so farther creatures are outside the encoded range. |
| Try to cast without line of sight. | FAIL | The row requires line of sight. |
| Expect the spell to create a real melee weapon attack roll gate before the damage rider. | PASS | Focused bridge proof now routes Green-Flame Blade through a weapon attack command instead of the generic damage-only path. |
| On a successful hit, the primary target takes the weapon attack's normal effects plus the extra fire rider. | PASS | `GreenFlameBladeBridge.test.ts` proves the hit path applies the primary rider after the weapon attack resolves. |
| If the attack misses, the primary target should not receive the fire rider. | PASS | The bridge proof covers miss suppression so the fire riders are not spent without a confirmed hit. |
| After a hit, choose a different visible creature within 5 feet of the hit target for the green fire leap. | PASS | The new bridge consumes the selected secondary creature and applies the leap only to a different creature within 5 feet of the hit target. |
| Select no secondary target after a hit. | PASS | The bridge leaves the leap target unset and only the primary hit resolves. |
| Try to choose the same creature as both the primary and secondary target. | PASS | The focused proof rejects same-target secondary selections and leaves the leap unset. |
| Try to choose a secondary target that is not visible or is farther than 5 feet from the hit target. | PASS | The focused proof rejects out-of-range secondary selections; line-of-sight remains represented by targeting metadata rather than a separate rendered targeting proof in this slice. |
| Expect the secondary fire to use Fire damage and scale to 1d8, 2d8, and 3d8 at higher levels. | PASS | The bridge materializes the secondary fire formula from the spell data and proves the cantrip-tier scaling path. |
| Expect the primary fire rider to scale to 1d8, 2d8, and 3d8 at higher levels. | PASS | The bridge consumes the Green-Flame Blade custom formula tiers for the primary hit rider rather than relying on generic spell scaling. |
| Treat the secondary target as legal whether ally or enemy, as long as it is different and in range. | PASS | The spell only says "a different creature of your choice" and does not add an ally/enemy filter for the leap target. |
