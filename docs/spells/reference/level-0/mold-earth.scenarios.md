# Mold Earth Scenarios

Source references:
- `docs/spells/reference/level-0/mold-earth.md`
- `public/data/spells/level-0/mold-earth.json`
- `src/hooks/useAbilitySystem.ts`
- `src/hooks/combat/useTargetValidator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/TerrainCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/commands/__tests__/MovementCommand.test.ts`

## Spell components worth exercising

- 1 action casting time
- Somatic-only cantrip with no concentration
- 30-foot range and line of sight
- 5-foot cube limit on the chosen dirt or stone
- Loose-earth excavation and movement up to 5 feet
- Shapes, colors, words, images, and patterns on dirt or stone for 1 hour
- Difficult-terrain creation and clearing for 1 hour
- No more than two active non-instantaneous effects at once, with dismiss-on-action support
- Deterministic terrain mutation rather than AI narration
- Combat and exploration terrain control, not creature control

## Scenario matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Cast Mold Earth on a visible ground point within 30 feet and choose Excavation. | FAIL | `useAbilitySystem` records a point or ground click, but `SpellCommandFactory` still only hands `CombatCharacter[]` targets to `TerrainCommand`, and `TerrainCommand` resolves from `context.targets[0]` or falls back to the caster position. The clicked ground tile is not guaranteed to survive into the terrain mutation. |
| Attempt to cast Mold Earth beyond 30 feet or without line of sight; the cast should be rejected. | PASS | `useTargetValidator` rejects out-of-range or blocked-line-of-sight area casts before command execution, so the spell cannot legally resolve there. |
| Try to target a registered object itself instead of dirt or stone. | PASS | `buildSelectedSpellTargetsForPosition` can surface an object envelope, but `TargetResolver.isValidObjectTarget` rejects Mold Earth because the spell only allows `point` and `ground`, not `objects`. |
| Click an occupied creature tile and expect the creature-first target to be rejected. | FAIL | Occupied tiles become creature envelopes, but the area-targeting validator still accepts the tile as a legal area destination, so the engine does not cleanly reject creature-occupied ground as an illegal creature target. |
| Choose Terrain Toggle on a visible ground point and expect difficult terrain to appear or be cleared in the selected cube. | FAIL | The data models difficult or normal terrain, and `TerrainCommand` knows how to apply or remove it, but the selected point is not threaded into the command path, so the chosen cube is not proven to mutate. |
| Choose Shapes And Colors and expect visible words, images, or patterns on dirt or stone for 1 hour. | FAIL | The spell JSON carries `communicationDetails` and `illusionState`, but `TerrainCommand` leaves the cosmetic branch mechanically empty and no runtime renderer or state consumer was found for the surface marking. |
| Cast Mold Earth in combat or exploration and expect deterministic terrain mutation rather than AI narration. | PASS | `arbitrationType` is `mechanical`, so the spell stays on the deterministic command path instead of passing through AI arbitration. |
| Cast a non-instantaneous Mold Earth effect and advance past its duration. | PASS | `createTerrainSpellZoneFromAoEParams` stores `expiresAtRound`, and the combat engine already prunes expired spell zones, so the duration and cleanup path is present. |

## Notes

- The reviewed runtime still leaves a real Mold Earth gap around ground-target handoff and surface-marking materialization, so I would not treat the spell as fully resolved yet.
- The open gap is tracked as `G43`.
