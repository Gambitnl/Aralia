# Shillelagh Scenarios

Source references:
- `docs/spells/reference/level-0/shillelagh.md`
- `public/data/spells/level-0/shillelagh.json`
- `src/commands/base/SpellCommand.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/systems/spells/validation/attackAugmentSchemas.ts`
- `src/types/spells.ts`

## Spell components worth exercising

- 1 bonus action with verbal, somatic, and mistletoe material components
- Self range and self-only targeting, but the held item is the real subject of the buff
- Only a held club or quarterstaff is eligible
- The weapon must already be in the caster's hand at cast time
- The spell is timed for 1 minute, does not use concentration, and ends if recast
- The weapon buff should end if the caster lets go of the weapon
- Melee weapon attacks using the weapon should use spellcasting ability instead of Strength
- The weapon's damage die should become a d8 and scale at character levels 5, 11, and 17
- On a hit, damage can be Force or the weapon's normal damage type
- The spell models a held-weapon buff, not a new attack action
- No explicit magical-status flag is exposed in the reviewed data

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Shillelagh on yourself while holding a club. | FAIL | The JSON models the held-weapon buff, but the reviewed runtime path only logs a generic utility cast; no consumer applies the club attack augment. |
| Cast Shillelagh on yourself while holding a quarterstaff. | FAIL | Same gap as the club case: the structured attack augment is present in data, but no execution bridge consumes it. |
| Attempt to cast Shillelagh while holding a non-club weapon, an object, or nothing at all; the cast should be rejected. | FAIL | `weaponRequirement` is explicit in validation/data, but the reviewed runtime path shows no held-item eligibility check that would reject the invalid state. |
| Attempt to target an ally, enemy, or loose object instead of self; the cast should be rejected. | PASS | The targeting block is self-only (`validTargets: self`), so non-self targets are outside the spell contract. |
| Use the imbued weapon in later melee attacks and expect spellcasting ability instead of Strength for attack and damage. | FAIL | `abilitySubstitution` is modeled, but `SpellCommandFactory` only forwards `conditionalEndings` generically and no weapon-augment consumer was found. |
| Resolve a hit or miss through the empowered weapon and expect the attack to follow the Shillelagh rider. | FAIL | The reviewed runtime slice has no first-class Shillelagh attack bridge, so the hit/miss flow never reaches the nested augment contract. |
| Expect the weapon die to become a d8 and scale to d10, d12, and 2d6 at higher levels. | FAIL | The scaling exists only inside the nested `attackAugment` payload; the factory's scaling path applies top-level effect scaling, not this nested weapon rider. |
| On a hit, choose Force damage or the weapon's normal damage type. | FAIL | `damageTypeChoice` is present in the JSON, but no runtime consumer was found to present or apply that choice. |
| Hand the weapon to an ally, enemy, or neutral creature and expect the enchantment to continue on the later wielder. | FAIL | The reviewed code does not create a persistent held-weapon artifact or transfer the buff across a handoff. |
| Recast Shillelagh while it is active, or let go of the weapon, and expect the enchantment to end early. | FAIL | `conditionalEndings` records `end_on_recast` and `holder_releases_item`, but the factory only forwards those endings into context and no consumer was found. |
| Cast Shillelagh during exploration, keep the weapon for later, and then enter combat before the minute expires. | BLOCKED | The spell data says the buff lasts 1 minute, but the reviewed slice does not expose a first-class held-weapon state that proves persistence across exploration and combat. |
| Expect the weapon to gain a first-class magical-status flag for resistance checks. | BLOCKED | The reference text and JSON do not expose a dedicated magical-status field for Shillelagh, so this behavior is not first-class in the reviewed data. |
