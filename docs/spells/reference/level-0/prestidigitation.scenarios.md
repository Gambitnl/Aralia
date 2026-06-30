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
| Choose Sensory Effect and expect the runtime to materialize the harmless sensory flourish. | PASS | Prestidigitation now reuses the minor-utility artifact bridge and records the Sensory Effect mode as a structured harmless sensory artifact. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Choose Fire Play and expect a candle, torch, or small campfire to light or snuff. | PASS | Prestidigitation Fire Play now records the authored Small Flame Toggle artifact with mode and source metadata for downstream object/fire consumers. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Choose Clean Or Soil and expect an object up to 1 cubic foot to be cleaned or soiled. | PASS | Clean Or Soil now records the selected object metadata and authored Cleaned Or Soiled Object payload as a structured utility artifact. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Choose Minor Sensation and expect nonliving material to chill, warm, or flavor for 1 hour. | PASS | Minor Sensation now records a non-instantaneous material-sensation artifact with a one-hour expiry. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Choose Magic Mark and expect a color, mark, or symbol to appear on an object or surface. | PASS | Magic Mark now records object/surface target metadata and a one-hour surface-mark artifact instead of remaining prose-only. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Choose Minor Creation and expect a hand-sized trinket or illusory image to persist until the end of the next turn. | PASS | Minor Creation now records the hand-sized trinket or illusory-image artifact with a next-turn expiry and no-damage/no-worth source payload. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Cast Prestidigitation four times with non-instantaneous modes and expect the fourth cast to be refused or the oldest effect to be dismissed. | PASS | The bridge prunes expired Prestidigitation artifacts, then rejects a fourth active non-instantaneous effect with structured combat-log metadata because the spell data states the cap but does not authorize automatic oldest dismissal. Focused proof: `npx vitest run src/commands/__tests__/UtilityCommand.test.ts -t "Prestidigitation"`. |
| Cast Prestidigitation and expect the system to pause for AI narration rather than executing a deterministic mode branch immediately. | PASS | `useAbilitySystem` explicitly pauses `ai_dm` spells with `playerInputRequired` before command creation resumes, so this spell is intentionally AI-narrated. |
| Expect the exact AI narration string to be stable and source-verifiable. | BLOCKED | The narration text comes from model output, so the exact wording cannot be proven from static code/data review alone. |
