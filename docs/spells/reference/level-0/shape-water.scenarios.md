# Shape Water Scenarios

Source references:
- `docs/spells/reference/level-0/shape-water.md`
- `public/data/spells/level-0/shape-water.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/hooks/combat/useTargetValidator.ts`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-0.json`

## Spell components worth exercising

- 1 action casting time
- 30-foot range with line of sight
- Area targeting that is meant to choose visible water
- 5-foot cube limit for the manipulated water
- Four mode choices: Move Or Flow, Shape And Animate, Color Or Opacity, Freeze
- Move Or Flow is instantaneous and cannot cause damage
- Shape And Animate lasts 1 hour
- Color Or Opacity lasts 1 hour
- Freeze lasts 1 hour and requires no creatures in the water
- No more than two non-instantaneous Shape Water effects can be active at once
- The caster can dismiss one active non-instantaneous effect as an action
- The spell is useful in combat, exploration, and social scenes, but only if the runtime can mutate actual water state instead of narrating it

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Shape Water on a visible water source within 30 feet that fits inside a 5-foot cube. | PASS | `UtilityCommand` now accepts selected water objects or water terrain tiles and records a first-class `activeShapeWaterEffects` artifact for the 5-foot cube. |
| Attempt to cast Shape Water on an ally, enemy, or neutral creature instead of water; the cast should be rejected. | PASS | `validTargets` are `objects` and `ground`, so the shared target resolver rejects creature targets regardless of relation. This correctly blocks creature misuse when no water is present. |
| Try to cast Shape Water on an object or ground tile that has no water. | PASS | Dry point/object selections now produce a structured `rejectedShapeWaterTarget: dry_target` log and create no water artifact. |
| Attempt to target Shape Water beyond 30 feet; the cast should be rejected. | PASS | `TargetResolver` and `useTargetValidator` both enforce range before execution, so out-of-range water, objects, or ground are rejected. |
| Attempt to target Shape Water through blocked line of sight; the cast should be rejected. | PASS | The spell sets `lineOfSight: true`, and the shared resolvers reject an unseen target before command creation. |
| Choose Move Or Flow and expect the water to move or redirect up to 5 feet without causing damage. | PASS | Move Or Flow creates an instantaneous Shape Water artifact with `noDamage: true`, volume, cube size, and target position. |
| Choose Shape And Animate and expect a simple animated water form to persist for 1 hour. | PASS | Shape And Animate creates a non-instantaneous Shape Water artifact with a 600-round expiry surface. |
| Choose Color Or Opacity and expect the same color or opacity change to apply throughout the water volume for 1 hour. | PASS | Color Or Opacity creates the same first-class water artifact with persistent mode and expiry. |
| Choose Freeze while creatures are in the water. | PASS | Freeze checks character positions against the selected water cube and rejects occupied water with `rejectedShapeWaterMode: creature_in_water`. |
| Choose Freeze when no creatures are in the water and expect a frozen state that unfreezes in 1 hour. | PASS | Empty-water Freeze creates a persistent `freeze` artifact with one-hour expiry. |
| Cast Shape Water multiple times with non-instantaneous modes and expect no more than two active effects, plus an action-based dismiss option. | PASS | The bridge counts active non-instantaneous Shape Water effects per caster, rejects the third, and supports `Dismiss` by marking one active artifact dismissed. |
| Use Shape Water in combat as a normal action. | PASS | `combatCost` is `action`, and the spell can enter the combat command pipeline. The result is still only a logged utility cast, but the combat action itself is supported. |
| Use Shape Water in exploration or social scenes and expect the same deterministic water-state result. | PASS | The deterministic result is now a serializable state artifact (`activeShapeWaterEffects`) rather than combat-log narration, so non-combat surfaces can carry the same water mutation. |
| Choose a mode and expect the runtime to mutate water state deterministically instead of leaning on AI narration. | PASS | Mode choice now resolves into deterministic Shape Water records for Move Or Flow, Shape And Animate, Color Or Opacity, Freeze, and Dismiss. |

## Gap note

Shape Water now has a water-specific world-state bridge. Focused proof passes: `npx vitest run src/commands/effects/__tests__/ShapeWaterBridge.test.ts` (3 tests) covers visible-water selection, dry-target rejection, Move Or Flow no-damage state, persistent Shape And Animate and Color Or Opacity, Freeze occupancy rejection and empty-water persistence, the two-effect cap, Dismiss, and deterministic `activeShapeWaterEffects` artifacts.
