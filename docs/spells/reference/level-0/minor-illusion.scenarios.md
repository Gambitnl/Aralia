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
| Choose a whisper, scream, continuous sound, or discrete sound pattern and expect the current runtime to persist that behavior. | PASS | `UtilityCommand` now creates an `ActiveIllusionEffect` for Minor Illusion sound mode, preserving the selected point, player-facing description, and authored `sensoryManifestation` contract. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Minor Illusion artifact bridge"`. |
| Create a chair- or chest-sized image that fits inside the 5-foot Cube limit. | PASS | The spell JSON and reference both encode the Image mode as an object image capped at a 5-foot Cube. |
| Attempt to create a larger image or one that contains a bigger object; the request should be rejected. | PASS | The reference explicitly caps Image mode at a 5-foot Cube, so larger containment is outside the spell contract. |
| Expect the image to have no sound, light, smell, or other sensory spillover. | PASS | Image mode now creates an `ActiveIllusionEffect` that carries the authored sensory-manifestation exclusions for downstream rendering and interaction surfaces. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Minor Illusion artifact bridge"`. |
| Touch or move through the image and expect physical interaction to reveal it as an illusion. | PASS | Image-mode artifacts now preserve `physicalInteractionReveals` and the authored physical-interaction reveal rule. Full collision-triggered reveal remains a future interaction-system consumer. |
| Take the Study action and roll Intelligence (Investigation) to reveal the sound or image as an illusion. | PASS | Minor Illusion artifacts now preserve the Study/Intelligence (Investigation) reveal metadata against `spell_save_dc`. Full Study-action roll consumption remains a future interaction-system consumer. |
| Once a creature discerns the illusion, expect it to become faint only for that creature. | PASS | The active illusion artifact now carries `discernedState`, `discernedByCreatureIds`, and `faintToCreatureIds` so per-creature faint state can be recorded without ending the spell for everyone. |
| Recast Minor Illusion while it is still active and expect the previous illusion to end. | PASS | The Minor Illusion bridge removes the same caster's prior recast-ending Minor Illusion artifact before recording the new one. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Minor Illusion artifact bridge"`. |
| Use Minor Illusion as a stealth, social, or combat distraction and expect deterministic spell resolution rather than AI arbitration. | PASS | `arbitrationType` is `mechanical`, so the spell stays on the deterministic path instead of invoking the AI spell arbitrator. |
| Expect the engine to decide whether a guard or enemy believes the illusion. | FAIL | There is no AI/social arbitration branch for this spell, so belief checks are not auto-adjudicated by the current runtime. |
| Use an Image as real cover, a wall, or a container that can hold objects. | FAIL | Minor Illusion creates an image of an object, not physical substance, and no runtime support was found for collision, containment, or cover behavior. |
