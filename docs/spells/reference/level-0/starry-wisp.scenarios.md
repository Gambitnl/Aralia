# Starry Wisp Scenarios

Source references:
- `docs/spells/reference/level-0/starry-wisp.md`
- `public/data/spells/level-0/starry-wisp.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/hooks/useAbilitySystem.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/character/spellAbilityFactory.ts`

## Spell components worth exercising

- 1 action casting time
- 60-foot ranged target and range gate
- Line of sight required
- Valid targets are creatures and objects
- No ally, enemy, self, or willingness restriction is declared
- Verbal and somatic only
- Immediate radiant damage on a ranged spell attack hit
- Cantrip damage scales at character levels 5, 11, and 17
- On hit, the target should shed Dim Light in a 10-foot radius
- On hit, the target should not benefit from the Invisible condition until the end of the caster's next turn
- Combat and exploration use should be checked separately because the reviewed runtime slice is combat-oriented

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Starry Wisp at a visible creature within 60 feet. | PASS | `TargetResolver` accepts an in-range, visible creature target and the spell data allows creatures. |
| Cast Starry Wisp at a visible object within 60 feet. | PASS | `TargetResolver` also accepts objects, and the spell does not add extra object-eligibility limits. |
| Attempt to target a creature beyond 60 feet. | PASS | The range gate rejects the target as out of range. |
| Attempt to target a creature without line of sight. | PASS | The spell sets `lineOfSight: true`, so blocked or unavailable sight lines are rejected. |
| Attempt to target empty ground or a non-object tile as if it were an object. | PASS | Ground points are not legal here; only creature/object candidates can pass the target resolver. |
| Cast Starry Wisp on an ally creature. | PASS | No ally-only or enemy-only filter is declared, so a legal creature target remains valid. |
| Cast Starry Wisp on an enemy creature. | PASS | Same target contract as the ally case. |
| Cast Starry Wisp on a neutral creature. | PASS | Same target contract as the ally and enemy cases. |
| Resolve the ranged spell attack as a hit. | PASS | The shared spell-attack path reaches `DamageCommand`, so the target takes radiant damage on a hit. |
| Resolve the ranged spell attack as a miss. | PASS | Missed attacks skip the hit-conditioned damage branch, so no damage is applied. |
| Resolve the cantrip damage at character levels 5, 11, and 17. | PASS | The damage row carries character-level scaling, and the shared scaling bridge applies the 2d8/3d8/4d8 tiers. |
| Hit a target with radiant resistance, immunity, or vulnerability. | PASS | `DamageCommand` routes radiant damage through the shared resistance calculator. |
| On a hit against a creature, make the target shed Dim Light and lose Invisible benefit until the end of the caster's next turn. | PASS | `SpellCommandFactory` now routes single-target spell attacks through a hit/miss gate, and `UtilityCommand` materializes Starry Wisp's sensory-light plus anti-Invisible rider only after a hit. |
| On a miss against a creature, apply neither radiant damage nor the glow/anti-Invisible rider. | PASS | The focused factory proof forces a missed Starry Wisp attack and verifies the target keeps its HP, no `starry-wisp` light source appears, and no Invisible suppression status is added. |
| On a hit against an object, apply the spell's object damage and object-attached glow. | PASS | `SpellCommandFactory` now accepts selected object refs for spell attacks, records a structured `spellObjectImpacts` object-damage entry, and attaches Starry Wisp's Dim Light to the object's map position. |
| Use Starry Wisp in combat. | PASS | The reviewed spell path is combat-ready through the shared spell-command flow. |
| Use Starry Wisp in exploration or outside combat. | BLOCKED | No separate exploration execution bridge was found in the reviewed runtime slice; the visible path is combat-oriented. |

## Focused proof

- `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts src/commands/__tests__/UtilityCommand.test.ts -t "Starry Wisp"` passed on 2026-06-29 with 5 selected tests.
- Direct JSON parse proof confirmed `public/data/spells/level-0/starry-wisp.json` carries target-attached 10-foot Dim Light and `invisibilitySuppression.suppressesConditionBenefit: "Invisible"`.
- Dependency sync passed for `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/UtilityCommand.ts`, `src/types/combat.ts`, `src/types/spells.ts`, and `src/systems/spells/validation/spellValidator.ts`.
