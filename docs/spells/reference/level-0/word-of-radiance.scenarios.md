# Word of Radiance Scenarios

Source references:
- `docs/spells/reference/level-0/word-of-radiance.md`
- `public/data/spells/level-0/word-of-radiance.json`

## Spell components worth exercising

- 1 action, verbal and material only, with a sunburst token and no somatic component
- Self range with a 5-foot Emanation centered on the caster
- Creatures only, with no ally/enemy/neutral restriction in the data row
- The rules text says each creature of your choice that you can see in the area
- Constitution saving throw
- 1d6 Radiant damage on a failed save
- Successful save should deal no damage
- Cantrip scaling at levels 5, 11, and 17
- Radiant resistance, immunity, and vulnerability should still apply to the final damage
- Line of sight is required for the selected creatures, and the spell is combat-usable as a normal action

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Word of Radiance while the caster stands in the 5-foot Emanation with nearby ally, enemy, and neutral creatures. | PASS | The spell is self-centered, uses a 5-foot Sphere/Emanation, and `validTargets: ["creatures"]` keeps the allegiance mix legal. The reviewed runtime gathers creatures on the affected tiles without an ally/enemy gate. |
| Choose only some visible creatures in the Emanation and leave another visible creature unchosen. | PASS | `src/hooks/useAbilitySystem.ts` now honors the caster-choice area selection bridge and carries only the chosen visible creatures into `targetCharacterIds`. |
| Stand in the Emanation and expect the caster tile to be part of the affected creature set. | PASS | The spell is self-centered and the area resolver includes the caster when they occupy the origin tile, so caster inclusion is supported at the footprint level. |
| Attempt to target a non-creature object or click empty ground away from the caster; the cast should be rejected. | PASS | Objects are not valid targets for this row, and a non-caster ground click fails the self-range gate before execution. |
| Let a creature fail the Constitution save and take 1d6 Radiant damage. | PASS | This is the core damage path in both the reference text and the structured spell row. |
| Let a creature succeed on the Constitution save and expect no damage. | PASS | The shared `saveEffect: "none"` success path now returns 0 damage in `src/utils/savingThrowUtils.ts`, so Word of Radiance follows the same cantrip convention. |
| Apply radiant resistance, immunity, or vulnerability after a failed save. | PASS | The reviewed damage path still routes final damage through the normal mitigation layer, so Radiant damage respects the target's final resistance or vulnerability state. |
| Cast Word of Radiance at character levels 5, 11, and 17 and expect the damage to scale to 2d6, 3d6, and 4d6. | PASS | The spell JSON carries character-level scaling, and the current spell factory applies the documented cantrip tiers. |
| Put a creature in the Emanation but behind cover or otherwise not visible to the caster and expect it to be unavailable for selection. | PASS | The same area-selection bridge now filters the candidate set through the visibility gate before command execution, so blocked or otherwise unseen creatures are pruned from the chosen subset. |
| Use Word of Radiance as a normal combat action. | PASS | `combatCost.type` is `action`, and the combat execution path already resolves action-based spell casts. |
| Try to use Word of Radiance in exploration or other noncombat flow. | BLOCKED | I found no separate noncombat executor in the reviewed slice, so this path is not proven here. |
