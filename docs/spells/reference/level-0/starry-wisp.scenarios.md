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
| On a hit, make the target shed Dim Light and lose Invisible benefit until the end of the caster's next turn. | FAIL | The reviewed runtime path only logs a generic sensory utility cast; `SpellCommandFactory` does not hand Starry Wisp to a sensory-light/invisibility executor, so no live light source or anti-Invisible rider is materialized. |
| Use Starry Wisp in combat. | PASS | The reviewed spell path is combat-ready through the shared spell-command flow. |
| Use Starry Wisp in exploration or outside combat. | BLOCKED | No separate exploration execution bridge was found in the reviewed runtime slice; the visible path is combat-oriented. |
