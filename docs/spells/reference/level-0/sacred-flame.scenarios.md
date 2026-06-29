# Sacred Flame Scenarios

Source references:
- `docs/spells/reference/level-0/sacred-flame.md`
- `public/data/spells/level-0/sacred-flame.json`

## Spell components worth exercising

- 1 action, verbal and somatic only, no material component
- 60-foot range
- One visible creature target
- Creature-only targeting, with no ally/enemy/neutral restriction
- Dexterity saving throw
- Half Cover and Three-Quarters Cover are ignored for the save
- 1d8 Radiant damage on a failed save
- Successful save should avoid damage entirely
- Cantrip scaling at levels 5, 11, and 17
- Resistance, immunity, and vulnerability should still apply to the final radiant damage

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Sacred Flame on a visible ally, enemy, or neutral creature within 60 feet while in combat. | PASS | `public/data/spells/level-0/sacred-flame.json` keeps the target gate to creatures only, and `src/utils/character/spellAbilityFactory.ts` maps that to `single_any`, so the runtime accepts any creature relation in range. |
| Attempt to cast Sacred Flame beyond 60 feet; the cast should be rejected. | PASS | `src/systems/spells/targeting/TargetResolver.ts` and `src/hooks/combat/useTargetValidator.ts` both reject the target as out of range before execution. |
| Attempt to target an object, door, or other non-creature; the cast should be rejected. | PASS | The spell only lists `creatures` as valid targets, and `TargetResolver.getObjectTargetRejectionReason(...)` returns `objects_not_allowed` for object candidates. |
| Attempt to target empty ground where no creature stands; the cast should be rejected. | PASS | `useTargetValidator` requires a creature for `single_any`, so a ground click with no target character is rejected. |
| Attempt to cast Sacred Flame at a creature you cannot see or cannot reach with line of sight; the cast should be rejected. | PASS | The spell sets `lineOfSight: true`, and `TargetResolver` checks both visibility and line-of-sight before the cast is accepted. |
| Put the target in half cover or three-quarters cover and expect the save to ignore that cover bonus. | PASS | `public/data/spells/level-0/sacred-flame.json` carries a `cover_bypass` save modifier for `half` and `three_quarters`, and `DamageCommand` skips the cover bonus when that modifier is present. |
| Attempt to cast Sacred Flame through full obstruction or total cover; the cast should be rejected. | PASS | The runtime does not model a special Sacred Flame total-cover bypass; a fully blocked target still fails the line-of-sight gate. |
| Let the target succeed on the Dexterity save and expect no damage. | PASS | `src/commands/effects/DamageCommand.ts` now passes `saveEffect: "none"` through the shared save-damage helper, and `src/utils/savingThrowUtils.ts` returns 0 on a successful save. |
| Let the target fail the Dexterity save and expect 1d8 Radiant damage. | PASS | The damage row is a `DAMAGE` effect with `1d8` Radiant damage, so failed saves flow through the normal damage engine. |
| Apply radiant resistance, immunity, or vulnerability after a failed save. | PASS | `DamageCommand` routes the result through `ResistanceCalculator.applyResistances(...)`, so the final radiant damage still respects the target's mitigation or amplification. |
| Cast Sacred Flame at character levels 5, 11, and 17 and expect the cantrip dice to scale up. | PASS | `SpellCommandFactory.applyCharacterLevelScaling(...)` applies the `character_level` tiers from the spell row, producing 2d8, 3d8, and 4d8 at the documented breakpoints. |
| Use Sacred Flame in combat as a normal action. | PASS | `combatCost.type` is `action`, and the combat command pipeline already consumes the spell through `useAbilitySystem` and `SpellCommandFactory`. |
| Try to use Sacred Flame as a noncombat/exploration cast. | BLOCKED | `explorationCost` is present in schema/data, but I found no runtime consumer outside the combat execution path, so this slice does not prove an out-of-combat cast flow. |
