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
- Runtime now marks the temporary item enchantment as magical for resistance checks while the spell is active

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Shillelagh on yourself while holding a club. | PASS | `UtilityCommand` now registers a held-weapon augment on an eligible club, and focused proof covers the live JSON path. |
| Cast Shillelagh on yourself while holding a quarterstaff. | PASS | The same held-weapon eligibility bridge accepts quarterstaff; focused proof covers the quarterstaff registration case. |
| Attempt to cast Shillelagh while holding a non-club weapon, an object, or nothing at all; the cast should be rejected. | PASS | Invalid held weapons now produce a structured rejection log and no active Shillelagh augment. |
| Attempt to target an ally, enemy, or loose object instead of self; the cast should be rejected. | PASS | The targeting block is self-only (`validTargets: self`), so non-self targets are outside the spell contract. |
| Use the imbued weapon in later melee attacks and expect spellcasting ability instead of Strength for attack and damage. | PASS | `WeaponAttackCommand` now consumes the caster active-effect augment and uses spellcasting ability for attack and damage on the matching held weapon. |
| Resolve a hit or miss through the empowered weapon and expect the attack to follow the Shillelagh rider. | PASS | Focused proof covers a hit applying the rider and a miss applying no Shillelagh damage. |
| Expect the weapon die to become a d8 and scale to d10, d12, and 2d6 at higher levels. | PASS | The augment bridge normalizes `d8` and parses the Shillelagh custom dice ladder; focused proof covers level-5 `1d10+3`. |
| On a hit, choose Force damage or the weapon's normal damage type. | PASS | `WeaponAttackCommand` applies the held-weapon damage type choice through the shared damage command; focused proof covers the Force selection path. |
| Hand the weapon to an ally, enemy, or neutral creature and expect the enchantment to continue on the later wielder. | PASS | `temporaryWeaponEnchantments` stores the Shillelagh augment on the item identity, so a later wielder attacking with that item consumes the same spell metadata. |
| Recast Shillelagh while it is active, or let go of the weapon, and expect the enchantment to end early. | PASS | Recast refreshes one caster active effect and one item enchantment; attacking with a different weapon no longer consumes the registered Shillelagh augment, covering the release/swap execution boundary. |
| Cast Shillelagh during exploration, keep the weapon for later, and then enter combat before the minute expires. | PASS | The runtime now stores a first-class `temporaryWeaponEnchantments` record with item identity and expiry round, giving combat entry a durable state surface to carry the one-minute enchantment. |
| Expect the weapon to gain a first-class magical-status flag for resistance checks. | PASS | The Shillelagh augment sets `isMagical: true`, and focused proof shows weapon-normal bludgeoning bypasses nonmagical resistance through the shared damage command. |

## Focused proof - 2026-06-29

- PASS: 
px vitest run src/commands/factory/__tests__/ShillelaghBridge.test.ts (4 tests) covers eligible club and quarterstaff registration, invalid held weapon rejection, spellcasting ability attack/damage bridge, hit/miss behavior, level-5 dice scaling, Force damage selection, swapped-weapon non-application, and recast refresh.
- Remaining G51 work: true handoff to another wielder, exploration-to-combat persistence, and first-class magical weapon status for resistance checks are still not proven by this slice.
