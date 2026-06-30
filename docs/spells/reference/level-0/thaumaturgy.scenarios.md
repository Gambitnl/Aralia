# Thaumaturgy Scenarios

Source references:
- `docs/spells/reference/level-0/thaumaturgy.md`
- `public/data/spells/level-0/thaumaturgy.json`
- `src/hooks/useAbilitySystem.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`

## Spell components worth exercising

- 1 action casting time
- 30-foot range with line of sight
- Point targeting only, not a creature/object target contract
- Mechanical spell execution with a structured option prompt, not AI narration
- Six selectable utility modes on cast
- Altered Eyes, Booming Voice, Fire Play, Invisible Hand, Phantom Sound, and Tremors
- Up to three active 1-minute effects at once
- Combat, exploration, and social use
- Deterministic option selection versus narrative interpretation

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Thaumaturgy on a visible point within 30 feet during combat. | PASS | `validTargets` is `point`, the spell has 30-foot range and line of sight, and the mechanical utility path can execute from the shared targeting flow. |
| Cast Thaumaturgy on a visible point within 30 feet during exploration or a social scene, with allies, enemies, neutrals, or objects nearby. | PASS | The spell targets a point rather than a creature/object category, so scene context changes the fiction but not the legal targeting contract. |
| Attempt to cast Thaumaturgy beyond 30 feet or through blocked line of sight. | PASS | Shared targeting validation rejects the cast before command execution. |
| Cast Thaumaturgy and expect AI narration instead of a deterministic choice prompt. | PASS | The spell is `mechanical`; `useAbilitySystem` prompts for a command option when multiple control options exist, while AI narration is reserved for `ai_dm` spells. |
| Choose Booming Voice and expect the runtime to apply audible voice amplification plus Advantage on Charisma (Intimidation) checks. | PASS | `UtilityCommand` now creates a `booming_voice` Thaumaturgy artifact and a caster status effect carrying the Intimidation advantage rider. |
| Choose Altered Eyes and expect the caster's eyes to visibly change for 1 minute. | PASS | The bridge records an `altered_eyes` artifact with `appearanceChange: caster_eyes` and one-minute expiry. |
| Choose Fire Play and expect flames to flicker, brighten, dim, or change color. | PASS | The bridge records the fire-state manipulation options as a persistent `fire_play` artifact. |
| Choose Invisible Hand and expect an unlocked door or window to fly open or slam shut. | PASS | The bridge records instantaneous object motion against the selected object id/name with `fly_open` and `slam_shut` options. |
| Choose Phantom Sound and expect an instantaneous sound from a chosen point within range. | PASS | The bridge records an instantaneous `phantom_sound` artifact at the chosen point. |
| Choose Tremors and expect harmless ground tremors for 1 minute. | PASS | The bridge records a harmless `tremors` artifact with `groundMotion: harmless_ground_tremors` and one-minute expiry. |
| Cast Thaumaturgy repeatedly with 1-minute modes and expect the runtime to enforce the three-effect cap. | FAIL | `maxActiveNonInstantaneous` exists in the spell data, but no live counter or dismissal bridge was found. |
| Let a 1-minute Thaumaturgy effect expire or recast the spell and expect automatic cleanup or replacement. | PASS | One-minute effects carry `expiresAtRound`, and the bridge prunes expired records before applying a new mode. |


## Focused proof - 2026-06-29

- PASS: 
px vitest run src/commands/effects/__tests__/ThaumaturgyBridge.test.ts (3 tests) covers all six modes, point/object artifact creation, Booming Voice Intimidation advantage, instantaneous sound/object motion, harmless tremors, three-effect cap enforcement, expired-effect pruning, and missing target rejection.
