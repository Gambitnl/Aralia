# Produce Flame Scenarios

Source references:
- `docs/spells/reference/level-0/produce-flame.md`
- `public/data/spells/level-0/produce-flame.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/ReactiveEffectCommand.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/visibility/VisibilitySystem.ts`

## Spell components worth exercising

- 1 bonus action with verbal and somatic components only
- Self cast that creates a held flame in the caster's hand
- Bright light in a 20-foot radius plus dim light for another 20 feet
- No heat and no ignition while the flame is being carried
- The spell ends if it is cast again
- The caster can later take a Magic action to hurl the flame
- Throw range is 60 feet and the target may be a creature or an object
- The later throw is a ranged spell attack that deals Fire damage on a hit
- Cantrip damage scales at character levels 5, 11, and 17
- Fire resistance, immunity, and vulnerability should apply through the shared damage pipeline
- The text explicitly excludes object/environment ignition

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Produce Flame on yourself and expect a flickering flame to appear in your hand. | PASS | The reference says the flame appears in your hand, and the structured light effect is attached to the caster rather than to a separate object. |
| Expect the carried flame to shed Bright Light in a 20-foot radius and Dim Light for another 20 feet. | PASS | The reference and JSON both encode a 20/20 light split, and `UtilityCommand` materializes that light source. |
| Move after casting and expect the light to follow the caster/hand. | PASS | The light source is stored with `attachedTo: caster` and an attached caster id, so the shared active-light pipeline keeps it with the caster. |
| Attempt to cast Produce Flame on an ally, enemy, or neutral target instead of yourself; the cast should be rejected. | PASS | The spell's cast-time targeting is self-only, so `TargetResolver` rejects non-self initial casts. |
| Carry the flame and expect it to be harmless, hot, or able to ignite something by itself. | PASS | The reference explicitly says the flame emits no heat and ignites nothing, and the structured light payload sets `ignitesObjects: false`. |
| Cast Produce Flame again while the earlier flame is still active and expect the first flame to end. | FAIL | `end_on_recast` is present in the spell data, but the reviewed runtime slice only forwards conditional endings into command context; no consumer for the recast-ending trigger was found. |
| Use the later Magic action to hurl the flame at a creature or object within 60 feet. | FAIL | The damage effect is routed to `ReactiveEffectCommand` via `on_caster_action`, but that branch is empty, so the later throw never becomes an executable combat action. |
| Expect the thrown flame to respect the 60-foot range and allow ally, enemy, or neutral object targets. | BLOCKED | The data does not add a relation filter, but the missing throw bridge means target selection for the later action is not reachable in the reviewed runtime slice. |
| Resolve the throw as a ranged spell attack and branch on hit or miss. | BLOCKED | The reviewed code never reaches a live attack-resolution path for the later throw, so hit/miss behavior cannot be observed yet. |
| On a successful throw, expect 1d8 Fire damage and the usual resistance, immunity, or vulnerability adjustments. | BLOCKED | `DamageCommand` and `ResistanceCalculator` support fire mitigation, but the missing throw bridge prevents the Produce Flame attack from reaching that shared damage pipeline. |
| Resolve Produce Flame at character levels 5, 11, and 17. | PASS | The JSON and validator encode cantrip scaling to 2d8, 3d8, and 4d8 at those tiers. |
| Expect the flame to ignore object/environment ignition even in an exploration scene. | PASS | The reference explicitly excludes ignition, so the current data/runtime intentionally keeps the flame harmless to carried objects and the environment. |
| Use Produce Flame as a combat or exploration light source and expect the shared light/visibility systems to consume it. | PASS | `UtilityCommand` publishes the light source into `activeLightSources`, and the visibility pipeline consumes that shared light state in combat and map views. |

