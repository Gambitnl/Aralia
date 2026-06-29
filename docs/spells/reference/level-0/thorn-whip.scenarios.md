# Thorn Whip Scenarios

Source references:
- `docs/spells/reference/level-0/thorn-whip.md`
- `public/data/spells/level-0/thorn-whip.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/MovementCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`

## Spell components worth exercising

- 1 action, verbal/somatic/material
- 30-foot creature target band
- Line of sight required
- Melee spell attack despite the 30-foot range
- Creature-only targeting with no object or ground branch
- Hit-conditioned piercing damage
- Large-or-smaller pull rider on hit
- Pull up to 10 feet closer to the caster
- Early stop on blocked, occupied, or caster-occupied spaces
- Cantrip scaling at levels 5, 11, and 17
- Resistance, immunity, and vulnerability handling through the shared damage engine
- Combat casts plus mapless/exploration-style rejection behavior

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Thorn Whip on a visible enemy creature 25 feet away with clear line of sight. | PASS | The spell data sets `range: 30`, `validTargets: ["creatures"]`, and `attackType: melee`; `TargetResolver` accepts the creature target, and the shared spell-attack path already classifies spell attacks separately from weapon attacks. |
| Cast Thorn Whip on a visible ally creature 25 feet away with clear line of sight. | PASS | There is no enemy-only filter on the spell; the only creature gate is the 30-foot range plus line-of-sight requirement. |
| Cast Thorn Whip on a visible neutral creature 25 feet away with clear line of sight. | PASS | Same reasoning as the ally case: `validTargets` only requires a creature, not a hostile relation. |
| Attempt to cast Thorn Whip on a creature 35 feet away; the cast should be rejected. | PASS | `TargetResolver` rejects the cast as out of range because the spell range is 30 feet. |
| Attempt to cast Thorn Whip when a wall blocks line of sight; the cast should be rejected. | PASS | The spell explicitly requires line of sight, and `TargetResolver` fail-closes with a blocked/not-visible rejection. |
| Attempt to cast Thorn Whip in a mapless exploration-style state with no map evidence for line of sight; the cast should be rejected. | PASS | The resolver returns false for line-of-sight spells when `mapData` is missing, so the current runtime rejects the cast instead of inventing sight. |
| Attempt to target an object with Thorn Whip; the cast should be rejected. | PASS | The spell only allows creatures, and `TargetResolver.getObjectTargetRejectionReason` rejects object candidates when `validTargets` does not include `objects`. |
| Attempt to target a ground point or empty tile with Thorn Whip; the cast should be rejected. | PASS | The spell is a single creature-target cast with no point/object branch, so ground targeting has no legal resolver path. |
| Resolve Thorn Whip on a hit against a normal creature with no resistance or vulnerability. | PASS | `DamageCommand` applies the hit-conditioned Piercing row, and the same command family already owns HP loss, logs, and attack-hit emission for confirmed spell hits. |
| Resolve Thorn Whip on a miss. | PASS | The attack-roll engine already resolves spell attacks as hit/miss, and the hit-conditioned damage plus pull rows only execute after a confirmed hit. |
| Resolve Thorn Whip on a Huge creature. | PASS | The damage row still applies, but the pull row is filtered to `Large`, `Medium`, `Small`, and `Tiny`, so Huge targets keep the hit damage and do not get pulled. |
| Resolve Thorn Whip on a hit where the pull path runs into a wall, occupied tile, or the caster's own space. | PASS | `MovementCommand.applyPull` stops early on blocked or occupied spaces and explicitly breaks before moving onto the caster's tile. |
| Resolve Thorn Whip on a target resistant to Piercing damage. | PASS | `DamageCommand` routes the hit through `ResistanceCalculator.applyResistances`, so resistance reduces the Piercing damage through the shared combat engine. |
| Resolve Thorn Whip on a target immune to Piercing damage. | PASS | The same shared resistance pass zeroes the damage when the target is immune. |
| Resolve Thorn Whip on a target vulnerable to Piercing damage. | PASS | The same shared resistance pass doubles the damage when the target is vulnerable. |
| Cast Thorn Whip at caster levels 5, 11, and 17. | PASS | The structured spell data already carries cantrip scaling, and `SpellCommandFactory.applyScaling` resolves the 2d6, 3d6, and 4d6 breakpoints. |
