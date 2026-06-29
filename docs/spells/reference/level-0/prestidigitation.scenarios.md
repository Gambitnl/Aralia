# Prestidigitation Scenarios

Source references:
- `docs/spells/reference/level-0/prestidigitation.md`
- `public/data/spells/level-0/prestidigitation.json`
- `src/hooks/useAbilitySystem.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/targeting/selectedSpellTargets.ts`

## Spell components worth exercising

- 1 action casting time
- 10-foot range with line of sight
- Creature and object targeting, but no point-only targeting contract in the spell data
- AI-DM handling with player input required before execution continues
- Sensory Effect: instantaneous harmless sensory effect
- Fire Play: light or snuff a candle, torch, or small campfire
- Clean Or Soil: clean or soil an object no larger than 1 cubic foot
- Minor Sensation: chill, warm, or flavor up to 1 cubic foot of nonliving material for 1 hour
- Magic Mark: make a color, small mark, or symbol appear on an object or surface for 1 hour
- Minor Creation: create a nonmagical trinket or illusory image that fits in your hand until the end of your next turn
- Up to three non-instantaneous Prestidigitation effects can be active at once
- Harmless utility in combat, exploration, or social scenes

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Prestidigitation on a visible ally, enemy, or neutral creature/object within 10 feet during combat, exploration, or a social scene. | PASS | The spell has no ally/enemy/willingness gate, `validTargets` includes creatures and objects, and the cast can proceed on any visible in-range target. |
| Cast Prestidigitation on a visible object within 10 feet. | PASS | `public/data/spells/level-0/prestidigitation.json` includes objects in `validTargets`, and `TargetResolver` has a real object-target validation path. |
| Attempt to cast Prestidigitation on an empty point or ground-only click; the cast should be rejected. | PASS | The current targeting surface does not expose a point-only contract for this spell; creature/object targeting is the supported path and a point click is not a legal Prestidigitation target. |
| Attempt to cast Prestidigitation beyond 10 feet or through blocked line of sight; the cast should be rejected. | PASS | Range and LoS are enforced by the shared targeting validators, so the cast is rejected before execution. |
| Choose Sensory Effect and expect the runtime to materialize the harmless sensory flourish. | FAIL | The spell is AI-routed, but `UtilityCommand` has no Prestidigitation sensory branch or sensory artifact state, so the mode does not become a first-class runtime effect. |
| Choose Fire Play and expect a candle, torch, or small campfire to light or snuff. | FAIL | `UtilityCommand` only has branches for light, creation, and generic control options; Prestidigitation's fire mode is not consumed by a dedicated executor. |
| Choose Clean Or Soil and expect an object up to 1 cubic foot to be cleaned or soiled. | FAIL | No Prestidigitation-specific clean/soil branch exists in the runtime path, so the effect remains metadata only. |
| Choose Minor Sensation and expect nonliving material to chill, warm, or flavor for 1 hour. | FAIL | The duration and material limit are present in data, but no runtime branch applies the temperature/flavor change. |
| Choose Magic Mark and expect a color, mark, or symbol to appear on an object or surface. | FAIL | The spell data captures the mark/symbol mode, but there is no live object/surface marking artifact or render consumer for Prestidigitation. |
| Choose Minor Creation and expect a hand-sized trinket or illusory image to persist until the end of the next turn. | FAIL | The data models the trinket/image payload, but `UtilityCommand` only consumes generic `creation` utilities; Prestidigitation itself does not reach that runtime branch. |
| Cast Prestidigitation four times with non-instantaneous modes and expect the fourth cast to be refused or the oldest effect to be dismissed. | FAIL | The spell data caps active non-instantaneous effects at three, but no runtime counter or dismissal bridge was found to enforce that limit. |
| Cast Prestidigitation and expect the system to pause for AI narration rather than executing a deterministic mode branch immediately. | PASS | `useAbilitySystem` explicitly pauses `ai_dm` spells with `playerInputRequired` before command creation resumes, so this spell is intentionally AI-narrated. |
| Expect the exact AI narration string to be stable and source-verifiable. | BLOCKED | The narration text comes from model output, so the exact wording cannot be proven from static code/data review alone. |
