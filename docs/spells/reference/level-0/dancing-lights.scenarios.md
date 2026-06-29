# Dancing Lights Scenarios

Source references:
- `docs/spells/reference/level-0/dancing-lights.md`
- `public/data/spells/level-0/dancing-lights.json`

## Spell components worth exercising

- 1 action, verbal, somatic, and material (`a bit of phosphorus`)
- 120-foot point target with line of sight required
- Up to four torch-size lights, or one combined Medium humanoid-like form
- Each light sheds dim light in a 10-foot radius
- Bonus action movement up to 60 feet to a space within range
- Each light must stay within 20 feet of another created light
- A light vanishes if it exceeds the spell's range
- Duration 1 minute with concentration
- Utility light effect, with no creature, object, or save target

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Dancing Lights at a visible point within 120 feet, using V/S/M components. | PASS | The reference and JSON both encode an action cast, a 120-foot point target, line of sight, and V/S/M components with phosphorus. |
| Try to cast Dancing Lights beyond 120 feet. | FAIL | The spell's range is explicitly 120 feet in both the reference and JSON. |
| Try to cast Dancing Lights without line of sight. | FAIL | `lineOfSight: true` is explicit in the structured data. |
| Try to target an ally, enemy, or object directly instead of a point. | FAIL | The spell only lists `point` as a valid target; it does not target creatures or objects directly. |
| Select `Separate Lights` from the on-cast menu. | PASS | `SpellCommandFactory` resolves `modeChoice.options` by label, so the choice itself is live. |
| Expect `Separate Lights` to produce four independently tracked hovering lights. | FAIL | The runtime light command emits a single `LightSource`, and no `movementState` consumer exists in `src` for the four-light cluster. |
| Select `Humanoid Form` from the on-cast menu. | PASS | The menu option is present in the structured spell data and is routed through the same mode-choice path. |
| Expect `Humanoid Form` to produce one combined Medium humanoid-like visual form instead of separate lights. | FAIL | The reviewed runtime path still creates one `LightSource` record and does not build a distinct combined-form entity. |
| Resolve the spell as a visual light source that sheds dim light in a 10-foot radius. | PASS | `UtilityCommand` stores the created light in `activeLightSources` with `dimRadius: 10`. |
| Use the created light in a dark area and expect it to function as illumination data, not as a creature or object. | PASS | The runtime records a `LightSource` artifact, which is a visual/light-state entry rather than a combat creature or inventory object. |
| Let concentration end before the 1-minute duration expires and expect the lights to disappear cleanly. | BLOCKED | The reviewed slice proves concentration and duration metadata, but not the concentration-break cleanup path for utility light sources. |
| Spend a later-turn bonus action to move the lights up to 60 feet while keeping the 20-foot leash intact. | FAIL | The structured spell JSON carries `movementState`, but there is no runtime consumer in `src`, so the bonus-action move/leash rule is not executed. |
| Move one light more than 20 feet from the others or let a light exceed spell range. | FAIL | The runtime does not model the four-light cluster or the range-leash cleanup path, so the vanish rule cannot run. |
| Place the point in an occupied square or near cover and expect special rejection or collision handling. | BLOCKED | Point occupancy and cover-specific resolution are not proven in the reviewed code slice. |


