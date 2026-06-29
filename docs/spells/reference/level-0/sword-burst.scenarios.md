# Sword Burst Scenarios

Source references:
- `docs/spells/reference/level-0/sword-burst.md`
- `public/data/spells/level-0/sword-burst.json`

## Spell components worth exercising

- 1 action, verbal only, no somatic or material component
- Self range with a 5-foot Sphere area centered on the caster
- Creatures only, with no ally/enemy/neutral restriction in the data row
- The rules text says "other creatures," so the caster should not be in the affected pool
- Dexterity saving throw
- 1d6 Force damage on a failed save
- Successful save should deal no damage
- Cantrip scaling at levels 5, 11, and 17
- Line of sight is not required by the data row

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Sword Burst in combat while one ally, one enemy, and one neutral creature stand in the 5-foot burst around the caster. | PASS | The spell has `validTargets: creatures` and no ally/enemy filter, so the relation mix does not block the burst. The reviewed runtime resolves every creature in the affected tiles, so all three non-caster creatures are eligible. |
| Cast Sword Burst from the middle of that same cluster and expect the caster to be excluded from the damage pool. | PASS | `src/hooks/useAbilitySystem.ts` now routes self-centered creature areas through `resolveAreaTargetSelection(...)`, which strips the caster out of the affected creature set before command execution. |
| Put a creature just outside the 5-foot radius and expect it not to be hit. | PASS | The spell uses a 5-foot Sphere, and the area calculator respects that boundary. |
| Attempt to click empty ground or a non-creature object; the cast should be rejected. | PASS | Object clicks are rejected because `validTargets` only allows creatures, and `TargetResolver.isValidObjectTarget(...)` rejects objects for this row. Empty-ground clicks at range 0 fail the self-centered targeting gate. |
| Put a creature in half cover inside the burst and expect the Dexterity save to keep the cover bonus. | PASS | `DamageCommand` still applies Dexterity save cover modifiers, and Sword Burst does not declare any cover-bypass rule. |
| Let a creature fail the Dexterity save and expect 1d6 Force damage. | PASS | This is the core damage path in both the reference text and the structured row. |
| Let a creature succeed on the Dexterity save and expect no damage. | PASS | The shared `saveEffect: "none"` success path now returns 0 damage in `src/utils/savingThrowUtils.ts`, so Sword Burst follows the same cantrip contract as the other level-0 save spells. |
| Cast Sword Burst at character levels 5, 11, and 17. | PASS | The spell JSON carries the cantrip tiers, and `SpellCommandFactory.applyScaling(...)` applies the 2d6, 3d6, and 4d6 breakpoints. |
| Use Sword Burst as a normal combat action. | PASS | `combatCost.type` is `action`, and the combat execution path already spends and resolves action casts. |
| Try to use Sword Burst as an exploration or noncombat cast. | BLOCKED | I found no separate noncombat executor in the reviewed slice, so this path is not proven here. |
