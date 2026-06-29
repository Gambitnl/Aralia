# Create Bonfire Scenarios

Source references:
- `docs/spells/reference/level-0/create-bonfire.md`
- `public/data/spells/level-0/create-bonfire.json`

## Spell components worth exercising

- 1 action, verbal and somatic only, no material component
- 60-foot range with line of sight to visible ground
- Area cast to one 5-foot cube on the ground
- Creatures in the cube make Dexterity saves on cast, on first entry each turn, and on end of turn
- Fire damage starts at 1d8 and scales to 2d8, 3d8, and 4d8 at levels 5, 11, and 17
- Concentration for 1 minute
- The bonfire should ignite unattended flammable objects in its area

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Create Bonfire on visible ground within 60 feet, with a creature already standing in the chosen cube. | PASS | The reference, JSON, and structured rows all encode an immediate cast-time Dexterity save for creatures in the bonfire space. |
| Cast Create Bonfire at a point more than 60 feet away. | FAIL | The spell range is explicitly 60 feet in both the reference and JSON. |
| Try to place the bonfire where the caster cannot see the ground. | BLOCKED | `lineOfSight: true` is explicit, but the reviewed runtime slice does not prove the exact obstruction or cover rejection path. |
| Try to place the bonfire on a square already occupied by a creature. | BLOCKED | The spell targets ground and creates a 5-foot cube, but the reviewed repo slice does not prove occupied-square placement rules. |
| Mix allies and enemies in the same bonfire cube and resolve the spell against the whole cluster. | PASS | The damage rows have creature targeting only and no ally/enemy filter, so every creature in the area is eligible. |
| Put a creature in the cube, then have it move into the cube for the first time on a turn. | PASS | The bundled row includes an `on_enter_area` trigger with `first_per_turn`, and the trigger handler recognizes that trigger type. |
| Leave a creature in the cube until the end of its turn. | PASS | The bundled row includes an `on_end_turn_in_area` damage trigger with a Dexterity save. |
| Put a creature in the cube, then have it enter, leave, and re-enter on the same turn. | PASS | The data uses `first_per_turn` for the entry trigger, so repeated entry on the same turn is limited to one damage application. |
| Resolve the spell at character levels 5, 11, and 17. | PASS | The JSON stores the cantrip scaling table as `2d8`, `3d8`, and `4d8` for those tiers. |
| Keep concentration on the spell for its full 1-minute duration. | PASS | The reference and JSON both mark the spell as concentration for 1 minute, and the bonfire object is marked to expire with the spell. |
| Drop concentration before the minute ends. | BLOCKED | The duration metadata is explicit, but the reviewed runtime slice does not prove the full interruption/cleanup path for this spell. |
| Place an unattended flammable object inside the bonfire area and expect it to ignite. | FAIL | The bonfire object is stored on a `DAMAGE` effect, but the factory only preserves `createdObjects` for `UTILITY` effects, so the ignition/object-creation row does not reach the runtime path. |
| Put a flammable object in the cube while it is worn or carried and expect it to remain unignited. | BLOCKED | The data marks the row as excluding worn or carried objects, but the reviewed runtime slice does not prove the selective ignition branch because the object-creation path is not executed for this spell. |

