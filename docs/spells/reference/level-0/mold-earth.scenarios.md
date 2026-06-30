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
| Cast Mold Earth on a visible ground point within 30 feet and choose Excavation. | PASS | `TerrainCommand` now prefers a selected point/ground spell target before falling back to creature targets or the caster, so a non-caster ground point survives into the terrain mutation. Focused proof: `npx vitest run src/commands/effects/__tests__/TerrainCommand.test.ts`. |
| Attempt to cast Mold Earth beyond 30 feet or without line of sight; the cast should be rejected. | PASS | `useTargetValidator` rejects out-of-range or blocked-line-of-sight area casts before command execution, so the spell cannot legally resolve there. |
| Try to target a registered object itself instead of dirt or stone. | PASS | `buildSelectedSpellTargetsForPosition` can surface an object envelope, but `TargetResolver.isValidObjectTarget` rejects Mold Earth because the spell only allows `point` and `ground`, not `objects`. |
| Click an occupied creature tile and expect the creature-first target to be rejected. | FAIL | Occupied tiles become creature envelopes, but the area-targeting validator still accepts the tile as a legal area destination, so the engine does not cleanly reject creature-occupied ground as an illegal creature target. |
| Choose Terrain Toggle on a visible ground point and expect difficult terrain to appear or be cleared in the selected cube. | PASS | The selected point/ground spell target now drives the terrain origin for Mold Earth terrain toggles, and the focused TerrainCommand proof shows the selected non-caster tile receives difficult terrain while the caster tile stays unchanged. |
| Choose Shapes And Colors and expect visible words, images, or patterns on dirt or stone for 1 hour. | PASS | Mold Earth cosmetic manipulation now records an `activeMoldEarthSurfaceMarks` artifact with spell id, caster, selected position, created turn, expiry, and authored manipulation metadata. Focused proof: `npx vitest run src/commands/effects/__tests__/TerrainCommand.test.ts`. |
| Cast Mold Earth in combat or exploration and expect deterministic terrain mutation rather than AI narration. | PASS | `arbitrationType` is `mechanical`, so the spell stays on the deterministic command path instead of passing through AI arbitration. |
| Cast a non-instantaneous Mold Earth effect and advance past its duration. | PASS | `createTerrainSpellZoneFromAoEParams` stores `expiresAtRound`, and the combat engine already prunes expired spell zones, so the duration and cleanup path is present. |

## Notes

- The G43 command bridge is resolved for selected ground-point mutation and Shapes And Colors surface-marking state.
- The occupied-creature tile rejection row remains a targeting-validation concern rather than a TerrainCommand execution gap.
