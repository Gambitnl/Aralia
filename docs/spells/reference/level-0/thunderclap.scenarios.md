# Thunderclap Scenarios

Source references:
- `docs/spells/reference/level-0/thunderclap.md`
- `public/data/spells/level-0/thunderclap.json`

## Spell components worth exercising

- 1 action, somatic only, no verbal or material component
- Self range with a 5-foot Sphere / Emanation centered on the caster
- Creatures only, with no ally/enemy/neutral restriction in the data row
- Constitution saving throw
- 1d6 Thunder damage on a failed save
- Successful save should deal no damage
- Cantrip scaling at levels 5, 11, and 17
- The thunderous sound is audible up to 100 feet on cast
- No line-of-sight requirement in the data row

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Thunderclap on a visible ally, enemy, and neutral creature standing within 5 feet of the caster. | PASS | `public/data/spells/level-0/thunderclap.json` keeps `validTargets: ["creatures"]` with no relation filter, and `src/hooks/useAbilitySystem.ts` expands an area cast to every character on the affected tiles. |
| Cast Thunderclap with the caster standing in the 5-foot emanation and expect the caster to be included in the affected set. | PASS | The spell is self-centered and does not declare a self-exclusion rule, so the area resolver includes the caster when they occupy the origin tile. This is not the Sword Burst-style exclusion case from G55. |
| Put a creature just outside the 5-foot radius and expect it not to be hit. | PASS | The area is a 5-foot Sphere / Emanation, and the reviewed target path uses the resolved affected tiles as the damage pool. |
| Attempt to target empty ground or a non-creature object. | PASS | `TargetResolver.ts` still applies the creature filter for `targeting.type === 'area'`, so non-creature targets are rejected instead of resolving as a valid cast. |
| Put an affected creature behind total cover or out of direct sight and expect Thunderclap to still resolve. | PASS | The spell row sets `lineOfSight: false`, and `TargetResolver.ts` only enforces visibility and line-of-sight when that flag is true. |
| Let a target fail the Constitution save and expect 1d6 Thunder damage. | PASS | The effect is a `DAMAGE` row with `1d6` Thunder damage, so the failed-save damage path is the intended baseline. |
| Let a target succeed on the Constitution save and expect no damage. | PASS | `src/commands/effects/DamageCommand.ts` now forwards `saveEffect: "none"` to the shared save-damage helper, which returns 0 on a successful save. |
| Apply thunder resistance, immunity, or vulnerability after a failed save. | PASS | The reviewed damage path still routes final damage through the normal mitigation layer, so Thunder damage respects the target's final resistance or vulnerability state. |
| Cast Thunderclap at character levels 5, 11, and 17 and expect 2d6, 3d6, and 4d6 damage. | PASS | The spell JSON carries character-level scaling, and the current spell factory applies the documented cantrip tiers. |
| Cast Thunderclap and expect the 100-foot thunder boom to become gameplay-relevant sensory output for combat, exploration, or social reaction systems. | FAIL | The spell data includes `soundEmission`, but I found no live consumer in `src/commands` or `src/systems`; this is the broader sound-emission bridge already tracked in G56. |
| Use Thunderclap as a normal combat action. | PASS | `combatCost.type` is `action`, and the combat execution path already resolves action-based spell casts. |
| Try to use Thunderclap in exploration or other noncombat flow. | BLOCKED | I found no separate noncombat executor in the reviewed slice, so this path is not proven here. |
