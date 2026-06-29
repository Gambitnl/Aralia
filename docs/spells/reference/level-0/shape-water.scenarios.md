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
| Cast Shape Water on a visible water source within 30 feet that fits inside a 5-foot cube. | BLOCKED | The spell data and target validators know about range and line of sight, but the runtime has no first-class water-surface or water-volume target to prove that the clicked area is actually water. `TargetResolver` only validates creatures or injected object candidates, and `UtilityCommand` has no water-state branch. |
| Attempt to cast Shape Water on an ally, enemy, or neutral creature instead of water; the cast should be rejected. | PASS | `validTargets` are `objects` and `ground`, so the shared target resolver rejects creature targets regardless of relation. This correctly blocks creature misuse when no water is present. |
| Try to cast Shape Water on an object or ground tile that has no water. | FAIL | Objects and ground are legal targeting categories, but there is no runtime water-presence check. The spell can therefore accept a dry target instead of rejecting it. |
| Attempt to target Shape Water beyond 30 feet; the cast should be rejected. | PASS | `TargetResolver` and `useTargetValidator` both enforce range before execution, so out-of-range water, objects, or ground are rejected. |
| Attempt to target Shape Water through blocked line of sight; the cast should be rejected. | PASS | The spell sets `lineOfSight: true`, and the shared resolvers reject an unseen target before command creation. |
| Choose Move Or Flow and expect the water to move or redirect up to 5 feet without causing damage. | FAIL | `SpellCommandFactory` resolves the mode choice, but `UtilityCommand` only logs the control option and has no water-state mutation branch. The no-damage water-physics rule is also not enforced. |
| Choose Shape And Animate and expect a simple animated water form to persist for 1 hour. | FAIL | The 1-hour duration exists in data, but no runtime artifact or timer consumes the shaped-water state. The command path still stays at narration/log level. |
| Choose Color Or Opacity and expect the same color or opacity change to apply throughout the water volume for 1 hour. | FAIL | The structured option is present in the spell data, but there is no first-class water-surface consumer to store or render a uniform color/opacity change. |
| Choose Freeze while creatures are in the water. | BLOCKED | The spell correctly says freezing is illegal if creatures are inside, but the reviewed runtime has no water-volume occupancy model to tell whether creatures are in the manipulated water. |
| Choose Freeze when no creatures are in the water and expect a frozen state that unfreezes in 1 hour. | FAIL | The freeze option exists in data, but there is no runtime freeze state, thaw timer, or cleanup path to materialize the 1-hour persistence. |
| Cast Shape Water multiple times with non-instantaneous modes and expect no more than two active effects, plus an action-based dismiss option. | FAIL | `modeChoice.maxActiveNonInstantaneous` is set to `2` and `canDismissActive` is `true`, but no runtime counter or dismissal bridge was found. The cap is still declarative data only. |
| Use Shape Water in combat as a normal action. | PASS | `combatCost` is `action`, and the spell can enter the combat command pipeline. The result is still only a logged utility cast, but the combat action itself is supported. |
| Use Shape Water in exploration or social scenes and expect the same deterministic water-state result. | BLOCKED | The reviewed runtime only proves the combat command path and generic utility narration. I found no separate out-of-combat consumer that would materialize water-state changes in exploration or social play. |
| Choose a mode and expect the runtime to mutate water state deterministically instead of leaning on AI narration. | FAIL | `aiContext.prompt` exists, but `UtilityCommand` still resolves Shape Water as narrative utility logging with generic control-option messages. The spell does not become a first-class deterministic water-state artifact yet. |

## Gap note

Shape Water is not just a generic utility-mode execution slice. The open issue is a water-specific world-state bridge: the runtime can log the cast and the mode choice, but it cannot yet prove visible-water selection, water-volume mutation, freeze/thaw cleanup, or the active non-instantaneous cap against a real mutable water artifact.
