# Mind Sliver Scenarios

Source references:
- `docs/spells/reference/level-0/mind-sliver.md`
- `public/data/spells/level-0/mind-sliver.json`

## Spell components worth exercising

- 1 action, verbal only
- 60-foot ranged single-target spell
- One visible creature within range
- Creature/enemy-only targeting, no object branch
- Line of sight required
- Intelligence saving throw
- Psychic damage on a failed save
- `next_save` penalty rider on a failed save
- Penalty should apply to the target's next saving throw before the end of the caster's next turn
- Penalty should be consumed when that next save is actually rolled
- Cantrip damage scaling at levels 5, 11, and 17
- Interactions with save modifier systems such as existing save riders and other save modifiers

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Mind Sliver on a visible enemy creature within 60 feet with clear line of sight. | PASS | The spell data says one visible creature within 60 feet, and `TargetResolver` enforces range, visibility, and line-of-sight before execution. |
| Try to cast Mind Sliver on an ally creature within 60 feet. | PASS | The targeting row is enemy-only for creatures, so allies do not satisfy the structured target filter. |
| Try to cast Mind Sliver on a noncreature object. | PASS | The spell only exposes a creature target path; there is no object-target branch for this spell. |
| Try to cast Mind Sliver on a creature that is out of range or hidden behind blocked line of sight. | PASS | `TargetResolver` rejects targets beyond the 60-foot band and also fails closed when the caster cannot see the target or the line of sight is blocked. |
| Resolve the Intelligence save and fail it. | PASS | The damage row is save-gated for Intelligence and the utility row registers the save penalty rider on a failed save. |
| Resolve the Intelligence save and succeed on it. | PASS | The current spell data and save-gated damage path support the success branch without adding the penalty rider. |
| Apply Mind Sliver, then have the target make its next saving throw before the caster's next turn ends. | PASS | `SavePenaltySystem.getActivePenalties()` feeds the rider into the save roll, and `useCombatEngine` / `DamageCommand` consume `next_save` riders after the save is rolled. |
| Let the target make no further saving throws and wait for the caster-turn boundary. | PASS | `SavePenaltySystem.expirePenalties()` now clears the caster-relative `next_save` rider at the documented turn boundary even if no save was rolled first. |
| Give the target another save modifier rider at the same time as Mind Sliver. | PASS | The active-penalty path aggregates save riders, so Mind Sliver stacks with other save modifier systems instead of replacing them. |
| Cast Mind Sliver at caster levels 5, 11, and 17. | PASS | The structured spell data and validator coverage keep the cantrip damage scaling at 2d6, 3d6, and 4d6 respectively. |
