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
| Choose Booming Voice and expect the runtime to apply audible voice amplification plus Advantage on Charisma (Intimidation) checks. | FAIL | `UtilityCommand` records the created object, but no runtime consumer was found for the `soundEmission` or `abilityCheckModifier` data. |
| Choose Altered Eyes and expect the caster's eyes to visibly change for 1 minute. | FAIL | The spell data models an appearance change, but no runtime branch materializes or cleans up a first-class eye-appearance state. |
| Choose Fire Play and expect flames to flicker, brighten, dim, or change color. | FAIL | The `fire_state_change` payload is present in data, but the reviewed runtime does not consume it into a live flame-state artifact. |
| Choose Invisible Hand and expect an unlocked door or window to fly open or slam shut. | FAIL | The `object_motion` payload is logged, but there is no executor that moves or mutates a real door/window object. |
| Choose Phantom Sound and expect an instantaneous sound from a chosen point within range. | FAIL | The spell carries `sound_state` and `soundEmission` metadata, but the runtime does not spawn a spatial sound artifact. |
| Choose Tremors and expect harmless ground tremors for 1 minute. | FAIL | The `ground_motion` payload is not consumed by a runtime bridge, so the tremor effect remains metadata-only. |
| Cast Thaumaturgy repeatedly with 1-minute modes and expect the runtime to enforce the three-effect cap. | FAIL | `maxActiveNonInstantaneous` exists in the spell data, but no live counter or dismissal bridge was found. |
| Let a 1-minute Thaumaturgy effect expire or recast the spell and expect automatic cleanup or replacement. | FAIL | The reviewed runtime does not persist a cleanup state for these structured utility modes, so expiry is not materialized as gameplay state. |

