# Vicious Mockery Scenarios

Source references:
- `docs/spells/reference/level-0/vicious-mockery.md`
- `public/data/spells/level-0/vicious-mockery.json`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-0.json`

## Spell components worth exercising

- 1 action casting time
- Ranged 60-foot single-creature targeting
- Creature-only valid targets
- Line of sight in structured data, while the rules text also allows a creature the caster can hear
- Verbal-only component profile
- Wisdom saving throw
- Psychic damage on a failed save
- No damage on a successful save
- Outgoing disadvantage rider on the target's next attack roll
- Rider cleanup after the next attack roll or at the end of the next turn if unused
- Cantrip scaling at character levels 5, 11, and 17
- No ally, enemy, neutral, or willingness filter
- Combat action use plus purely narrative social flavor

## Scenario matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Cast Vicious Mockery on a visible creature within 60 feet and it fails the Wisdom save. | PASS | The spell is a creature-only, 60-foot, line-of-sight cantrip; the failed-save path applies the Psychic damage row and leaves the rider row available for later use. |
| Cast Vicious Mockery on a visible creature within 60 feet and it succeeds on the Wisdom save. | PASS | The shared `saveEffect: "none"` success path now returns 0 damage in `src/utils/savingThrowUtils.ts`; the rider still remains separate from the damage outcome. |
| Cast Vicious Mockery on a visible ally within 60 feet. | PASS | There is no ally/enemy/willingness filter in the structured spell data, so any visible creature is a legal target if range and line of sight are satisfied. |
| Cast Vicious Mockery on a visible enemy within 60 feet. | PASS | Same target-contract path as the ally case; hostile creatures are legal because only creature type, range, and visibility are constrained. |
| Cast Vicious Mockery on a visible neutral creature within 60 feet. | PASS | Same target-contract path as the ally and enemy cases; neutral relation does not matter in the current data. |
| Attempt to target an object, door, or ground point; the cast should be rejected. | PASS | `validTargets` is `creatures`, so object or point targets are rejected by the shared target resolver. |
| Attempt to cast Vicious Mockery beyond 60 feet; the cast should be rejected. | PASS | `TargetResolver` rejects targets outside the row's 60-foot range before any save or damage logic runs. |
| Cast Vicious Mockery on a creature that can be heard but not seen. | FAIL | The rules text allows a creature the caster can see or hear, but the reviewed runtime only models `lineOfSight: true` and the target resolver has no hearing-based acquisition path yet. This is the G59 gap. |
| On a failed save, the target takes psychic damage. | PASS | The damage effect is Psychic, and `DamageCommand` applies the failed-save roll through the normal damage/resistance path. |
| On a failed save, psychic resistance, immunity, and vulnerability modify the damage correctly. | PASS | `DamageCommand` delegates damage typing to `ResistanceCalculator`, so standard psychic resistance/immunity/vulnerability adjustments are part of the current combat path. |
| On a failed save, the target also gets disadvantage on the next attack roll it makes. | PASS | The utility row stores `attackRollModifier: disadvantage`, `direction: outgoing`, and `attackKind: any`, and `AbilityCommandFactory` reads those active effects when future attacks are rolled. |
| If the target never attacks again, the rider clears before or at the end of its next turn. | BLOCKED | The data encodes `consumption: next_attack_roll` and `duration: 1 round`, but the reviewed runtime slice did not show a complete unused-rider expiry path. This is the same cleanup class as G33, just with `attackKind: any`. |
| At character levels 5, 11, and 17, the damage scales to 2d6, 3d6, and 4d6. | PASS | `SpellCommandFactory.applyScaling` handles `character_level` damage scaling, and the spell JSON carries the three breakpoint tiers. |
| Casting Vicious Mockery in combat is a normal 1-action verbal spell. | PASS | The reference block and structured JSON both model a one-action, verbal-only cantrip, so the combat cast contract is clear. |
| Using Vicious Mockery as a purely social jab outside combat is only narrative in the reviewed slice. | BLOCKED | The reviewed runtime is the combat-command path; no dedicated non-combat social-state executor was found for the insult rider beyond spell text and logging flavor. |
