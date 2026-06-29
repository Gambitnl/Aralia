# Minor Illusion Scenarios

Source references:
- `docs/spells/reference/level-0/minor-illusion.md`
- `public/data/spells/level-0/minor-illusion.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/spells/validation/illusionSchemas.ts`
- `src/types/spellIllusionMetadata.ts`

## Spell components worth exercising

- 1 action casting time
- 30-foot ranged point placement with line of sight
- A noncreature point target, so allies, enemies, and neutral locations are all legal if the point is in range and visible
- On-cast mode choice between Sound and Image
- Sound mode supports whisper-to-scream volume and either continuous or discrete playback before the spell ends
- Image mode creates an object image no larger than a 5-foot Cube
- Image mode cannot create sound, light, smell, or other sensory spillover
- Physical contact should reveal the image as illusory because things pass through it
- A Study action with Intelligence (Investigation) should reveal either mode as an illusion against spell save DC
- A creature that discerns the illusion should see it as faint only for that creature
- Duration is 1 minute
- The illusion ends if the caster casts the spell again
- The spell is mechanical, not AI-arbitrated, so social fallout and belief remain deterministic or human-narrated

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Minor Illusion on a visible point within 30 feet and choose Sound mode. | PASS | `TargetResolver` accepts visible point targets within range, and `SpellCommandFactory` can narrow the cast to the Sound option from `modeChoice.options`. |
| Cast Minor Illusion on a visible point within 30 feet and choose Image mode. | PASS | The same point-target path accepts the Image option, and the structured data records the image variant separately from Sound. |
| Attempt to cast Minor Illusion more than 30 feet away or without line of sight; the cast should be rejected. | PASS | The resolver rejects the cast with `out_of_range` or `line_of_sight_blocked` once the point is outside the 30-foot visible placement window. |
| Use Minor Illusion on an ally-facing, enemy-facing, or neutral point in a fight or social scene. | PASS | The spell targets a point, not a creature, and the reviewed target data has no willingness or allegiance gate. |
| Choose a whisper, scream, continuous sound, or discrete sound pattern and expect the current runtime to persist that behavior. | BLOCKED | The sound contract is modeled in `sensoryManifestation`, but `UtilityCommand` only logs a generic sensory cast and no live sound-illusion executor was found. |
| Create a chair- or chest-sized image that fits inside the 5-foot Cube limit. | PASS | The spell JSON and reference both encode the Image mode as an object image capped at a 5-foot Cube. |
| Attempt to create a larger image or one that contains a bigger object; the request should be rejected. | PASS | The reference explicitly caps Image mode at a 5-foot Cube, so larger containment is outside the spell contract. |
| Expect the image to have no sound, light, smell, or other sensory spillover. | FAIL | The exclusion list is present in the structured data, but no runtime artifact was found that enforces those exclusions in play. |
| Touch or move through the image and expect physical interaction to reveal it as an illusion. | FAIL | `illusion.revealRules` records `physical_interaction`, but the reviewed runtime path does not materialize a physical image that collision can reveal. |
| Take the Study action and roll Intelligence (Investigation) to reveal the sound or image as an illusion. | FAIL | The reveal rule is modeled against spell save DC, but no live Study/Investigation consumer was found in the reviewed runtime. |
| Once a creature discerns the illusion, expect it to become faint only for that creature. | BLOCKED | `discernedState` is modeled as `faint_to_discerning_creature`, but no per-creature illusion-state bridge was found in runtime. |
| Recast Minor Illusion while it is still active and expect the previous illusion to end. | BLOCKED | `conditionalEndings` stores `end_on_recast`, and the factory carries it into command context, but no runtime consumer was found for recast cleanup. |
| Use Minor Illusion as a stealth, social, or combat distraction and expect deterministic spell resolution rather than AI arbitration. | PASS | `arbitrationType` is `mechanical`, so the spell stays on the deterministic path instead of invoking the AI spell arbitrator. |
| Expect the engine to decide whether a guard or enemy believes the illusion. | FAIL | There is no AI/social arbitration branch for this spell, so belief checks are not auto-adjudicated by the current runtime. |
| Use an Image as real cover, a wall, or a container that can hold objects. | FAIL | Minor Illusion creates an image of an object, not physical substance, and no runtime support was found for collision, containment, or cover behavior. |
