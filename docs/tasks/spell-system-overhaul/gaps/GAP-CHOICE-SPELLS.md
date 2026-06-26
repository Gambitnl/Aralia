# Gap: Modal Spell Choice Handling

**Status:** Partially implemented capability gap note
**Last Reviewed:** 2026-06-01

## Problem

The current spell lane now has a structured `modeChoice` capability for mutually exclusive mode/effect packages, but the choice stack is not end-to-end complete. Command creation can consume a supplied mode choice, while UI/runtime choice collection and per-target choices still need follow-through.

## Verified Current State

A 2026-06-01 repo check confirmed:
- `src/types/spells.ts`, `src/systems/spells/validation/modeChoiceSchemas.ts`, and the JSON schema now model `modeChoice`.
- `src/commands/factory/SpellCommandFactory.ts` filters `effects[]` by `modeChoice` when a matching `playerInput` value is supplied.
- `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` covers synthetic Blindness/Deafness-style filtering and real package mode-choice index validity, but the tests have not been run in this pass.
- `public/data/spells/level-2/blindness-deafness.json` now has a `modeChoice` menu pointing at separate Blinded and Deafened effects.
- `public/data/spells/level-2/enhance-ability.json` now has `targeting.perTargetChoice`, but the bounded source search found schema/type support only; no command/UI consumer was found.
- `hex.json` and many other spells still use `controlOptions` for narrower choice surfaces.

## Concrete Capability Name

- Modal Spell Choice Handling

## What This Means

The current repo is no longer at zero modal-choice support. The remaining gap is end-to-end choice handling:
- collect `modeChoice` from the caster before command creation in normal combat UI
- preserve the selected mode through `useAbilitySystem` into `SpellCommandFactory`
- execute and render per-target choices such as Enhance Ability's ability selection
- decide whether `controlOptions`, `modeChoice`, and `perTargetChoice` should stay separate lanes or share a broader choice orchestration layer

## Priority Examples

- Blindness/Deafness
- Enhance Ability
- Alter Self
- Eyebite
- Contagion
- Hex for broader reusable choice semantics beyond the current controlOptions lane

## Current Follow-Through

1. Keep `modeChoice` as the current cast-time mode/effect package model unless a stronger replacement is intentionally designed.
2. Add UI/runtime choice collection for `modeChoice` so command filtering is reachable without manual `playerInput` calls.
3. Implement `perTargetChoice` execution for Enhance Ability-style choices.
4. Revisit `controlOptions` after the mode/per-target lanes have a proven runtime path.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md","sha256WithoutMarker":"010b313475cd507ac2072c72f36ca9ce17a2079b89d6dda58314646bccdab7b2","markedAtUtc":"2026-06-25T22:29:38.598Z"} -->
