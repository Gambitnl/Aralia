# Frostbite Scenarios

Source references:
- `docs/spells/reference/level-0/frostbite.md`
- `public/data/spells/level-0/frostbite.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/spatial/lineOfSight.ts`

## Spell components worth exercising

- 1 action casting time
- Ranged 60-foot creature-only target
- Line of sight required
- Verbal and somatic components only
- Constitution saving throw
- Cold damage on a failed save
- Disadvantage on the target's next weapon attack roll
- The rider should apply only after a failed save
- The rider should not affect non-weapon attack rolls
- The rider should expire by the end of the target's next turn if unused
- Cantrip damage scales at character levels 5, 11, and 17

## Scenario matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Cast Frostbite on a visible creature within 60 feet and it fails the Constitution save. | PASS | The row is a creature-only, line-of-sight spell with a Constitution save, and `AttackRollModifierCommand` bundles the failed-save damage plus the weapon-attack rider. |
| Cast Frostbite on a visible ally within 60 feet. | PASS | The spell has no ally/enemy or willing/unwilling filter; `targeting.filter` leaves those fields at `not_applicable`, so any creature in range can be selected. |
| Cast Frostbite on a visible enemy within 60 feet. | PASS | Same targeting path as the ally case; hostile creatures are valid because the spell only constrains creature type, range, and line of sight. |
| Try to target an object, crate, or door. | PASS | `validTargets` is `creatures`, so the spell data does not allow object targets. |
| Try to cast from beyond 60 feet. | PASS | `TargetResolver` rejects creature targets that are beyond the row's `targeting.range` / `range.distance` of 60 feet. |
| Try to cast through total cover or another line-of-sight blocker. | PASS | The row sets `lineOfSight: true`, and `TargetResolver` calls `hasLineOfSight`, which returns false when a blocking tile sits between caster and target. |
| On a successful Constitution save, the target takes no cold damage and gets no rider. | PASS | `AttackRollModifierCommand` logs the success, skips bundled damage/status work, and does not create the active rider effect on a successful save. |
| On a failed Constitution save, the target takes cold damage and gets the next-weapon-attack disadvantage rider. | PASS | The spell data names `Cold` damage and `disadvantage` on the next `weapon` attack, and the rider command stores the shared active effect that the attack pipeline reads later. |
| The disadvantage rider should apply to weapon attacks but not to spell attacks. | PASS | `AbilityCommandFactory` only applies the active rider when the stored kind matches the outgoing attack kind, and the Frostbite row stores `attackKind: "weapon"`. |
| The disadvantage rider should last until the end of the target's next turn if the target never attacks. | PASS | `AttackRollModifierCommand` now gives next-attack riders a one-round grace window and `useTurnManager` removes the round-based rider at the next turn boundary when it remains unused. |
| At character levels 5, 11, and 17, the damage should scale to 2d6, 3d6, and 4d6. | PASS | `SpellCommandFactory` now scales the nested `ATTACK_ROLL_MODIFIER` damage payload so Frostbite's cold damage grows to 2d6, 3d6, and 4d6 at the cantrip breakpoints. |
