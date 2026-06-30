# Light Scenarios

Source references:
- `docs/spells/reference/level-0/light.md`
- `public/data/spells/level-0/light.json`

## Spell components worth exercising

- 1 action, verbal and material only
- Touch range with a 5-foot targeting band
- One Large-or-smaller object
- Target must not be worn or carried by someone else
- Bright light in a 20-foot radius plus dim light for another 20 feet
- Caster-chosen color
- Opaque cover blocks the light
- Duration is 1 hour
- Casting the spell again ends the prior instance
- Visibility should change through the active light-source and map-light systems

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Light on a Large or smaller object within 5 feet, with line of sight, and leave the object otherwise unobstructed. | PASS | The reference and JSON both describe a touch spell that targets objects, and `TargetResolver` enforces range, line of sight, and object size gates before object-eligibility checks. |
| Try to cast Light on an object farther than 5 feet away. | FAIL | `TargetResolver` rejects object targets beyond the spell's 5-foot range with an `out_of_range` rejection. |
| Try to cast Light on an object you cannot see. | FAIL | `TargetResolver` checks `lineOfSight` for object targets and returns `line_of_sight_blocked` when sight is unavailable. |
| Try to cast Light on a worn or carried object, such as a held weapon or worn cloak. | FAIL | The spell row sets `objectEligibility.wornOrCarried: excluded`, and `TargetResolver` rejects worn-or-carried objects. |
| Try to cast Light on a Huge object or anything larger than Large. | FAIL | The spell row sets `maxSize: Large or smaller`, and `TargetResolver` rejects oversized objects. |
| Cast Light on an allied object, an enemy object, or an unattended neutral object. | PASS | The spell targets objects rather than creatures, so ally/enemy relation does not add a separate gate here; the object must only satisfy the object-specific eligibility rules. |
| Choose a custom light color when casting Light. | PASS | The JSON stores `colorChoice: caster_choice`, and `UtilityCommand` persists the chosen color on the created `LightSource`. |
| Expect the created light to emit 20 feet of bright light and another 20 feet of dim light. | PASS | The reference text and JSON both encode the 20/20 radius split, and the light command test proves the radii land on the active light source. |
| Cover the lit object with opaque material and expect the emitted light to be suppressed while covered. | PASS | The spell data sets `opaqueCoverBlocks: true`, the emitted `LightSource` now carries that flag, and `VisibilitySystem` suppresses object-mounted light when the map object at that position is marked covered. |
| Cast Light again while a prior Light instance is still active and expect the earlier instance to end. | PASS | The turn manager filters out prior active light sources by `sourceSpellId` when the same spell is recast, matching the `end_on_recast` metadata. |
| Advance time and expect Light to persist for 1 hour before expiring. | PASS | `UtilityCommand` records an expiration round for timed light effects, and the spell data sets a 1-hour duration. |
| Place the lit object in darkness and expect the light to change map visibility. | PASS | `useVisibility` consumes `activeLightSources`, and `VisibilitySystem.calculateLightLevels` uses each source's bright and dim radii to raise tiles from darkness into visible or dim states unless line of sight is blocked. |
