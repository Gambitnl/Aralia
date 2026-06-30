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
| Cast Produce Flame again while the earlier flame is still active and expect the first flame to end. | PASS | `UtilityCommand` now replaces same-caster Produce Flame carried lights when the authored `end_on_recast` trigger is present, with focused proof in `UtilityCommand.test.ts`. |
| Use the later Magic action to hurl the flame at a creature or object within 60 feet. | PASS | The later `Hurl Flame` granted action is now executable through `GrantedActionCommand`, and `ProduceFlameBridge.test.ts` proves both creature and object target paths. |
| Expect the thrown flame to respect the 60-foot range and allow ally, enemy, or neutral object targets. | PASS | The generated follow-up ability exposes `single_any` targeting and a 12-tile/60-foot range limit, while selected object refs survive into command execution. |
| Resolve the throw as a ranged spell attack and branch on hit or miss. | PASS | `ProduceFlameBridge.test.ts` proves the later throw rolls a ranged spell attack, damages on hit, and leaves the target unharmed on miss. |
| On a successful throw, expect 1d8 Fire damage and the usual resistance, immunity, or vulnerability adjustments. | PASS | Hit damage delegates to `DamageCommand`, preserving the shared damage pipeline; the focused bridge proof covers the 1d8 Fire payload reaching a creature and an object-impact record. |
| Resolve Produce Flame at character levels 5, 11, and 17. | PASS | The JSON and validator encode cantrip scaling to 2d8, 3d8, and 4d8 at those tiers. |
| Expect the flame to ignore object/environment ignition even in an exploration scene. | PASS | The reference explicitly excludes ignition, so the current data/runtime intentionally keeps the flame harmless to carried objects and the environment. |
| Use Produce Flame as a combat or exploration light source and expect the shared light/visibility systems to consume it. | PASS | `UtilityCommand` publishes the light source into `activeLightSources`, and the visibility pipeline consumes that shared light state in combat and map views. |

