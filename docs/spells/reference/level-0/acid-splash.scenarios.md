# Acid Splash Scenarios

Source references:
- `docs/spells/reference/level-0/acid-splash.md`
- `public/data/spells/level-0/acid-splash.json`

## Spell components worth exercising

- 1 action, verbal and somatic only, no material component
- 60-foot range
- One chosen point, with a 5-foot-radius sphere
- Creatures only
- Dexterity saving throw
- 1d6 Acid damage on a failed save
- Cantrip scaling at levels 5, 11, and 17

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Acid Splash at one visible point within 60 feet, with several creatures packed into the 5-foot sphere. | PASS | The spell is an area cast at one point, not a multi-target selection. The reference and JSON both give `maxTargets: 1`, `range: 60`, and a 5-foot Sphere. |
| Try to choose two separate target points for the same cast. | FAIL | `maxTargets: 1` only supports one chosen point. |
| Mix allies and enemies inside the sphere and resolve the spell against the whole cluster. | PASS | The spell has no ally/enemy filter, only `validTargets: creatures`, so all creatures in the area are eligible. |
| A creature in the sphere succeeds on the Dexterity save and still takes half damage. | FAIL | The reference text says damage happens on a failed save, and the structured row does not encode half-damage-on-success behavior. |
| A creature in the sphere fails the Dexterity save and takes 1d6 Acid damage. | PASS | This is the core effect described in both the markdown reference and the structured spell row. |
| Try to target an object, door, crate, or other non-creature directly with Acid Splash. | FAIL | The spell only lists creatures as valid targets. |
| Put an object in the burst area and expect the spell to have a separate object-damage path. | BLOCKED | The reviewed spell data does not prove any object or environment damage handling beyond creature-only targeting. |
| Place the target point beyond 60 feet. | FAIL | The spell's range is explicitly 60 feet in both the reference and JSON. |
| Try to place the target point where the caster does not have line of sight, including a cover boundary case. | BLOCKED | `lineOfSight: true` is explicit, but the reviewed repo slice does not prove the exact obstruction or cover rejection path for area-point placement. |
| Put a creature just outside the 5-foot sphere edge. | PASS | The area is a 5-foot-radius Sphere, so a creature outside the radius is not in the affected area. |
| Resolve the cantrip at character levels 5, 11, and 17. | PASS | The scaling tiers are explicitly recorded as 2d6, 3d6, and 4d6 Acid damage at those levels. |


