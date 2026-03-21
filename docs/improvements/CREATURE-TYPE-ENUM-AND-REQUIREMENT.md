# Improvement Note: Canonical Creature Types & Required Typing

## Status

This remains a live improvement brief.
It has been tightened to reflect the current repo state rather than a generic future request.

## Verified Current State

- Creature-type filtering is already used across spell targeting and validation surfaces.
- Current spell validation still accepts creature-type strings rather than a shared canonical enum source.
- Combat and targeting types still expose `creatureTypes?: string[]` rather than a stricter shared creature-type type.
- Preset targeting rules already hardcode values like `Humanoid`, `Beast`, and `Undead`.

Verified surfaces include:
- [`src/systems/spells/validation/spellValidator.ts`](F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts)
- [`src/systems/spells/validation/TargetingPresets.ts`](F:\Repos\Aralia\src\systems\spells\validation\TargetingPresets.ts)
- [`src/systems/spells/targeting/TargetValidationUtils.ts`](F:\Repos\Aralia\src\systems\spells\targeting\TargetValidationUtils.ts)
- [`src/systems/logic/ConditionEvaluator.ts`](F:\Repos\Aralia\src\systems\logic\ConditionEvaluator.ts)
- [`src/types/combat.ts`](F:\Repos\Aralia\src\types\combat.ts)

## Verified Gap

There is not yet a single canonical exported creature-type enum or schema that all of those surfaces consume.
That leaves room for string drift even though the feature category already exists in practice.

## Improvement Direction

- add one shared source of truth for canonical creature types
- use it in spell targeting and validation
- use it in combat-facing creature typing where practical
- treat any new creature type as an intentional extension, not an ad hoc string

## Caution

This should be approached as a convergence pass, not a cleanup-only pass.
Several systems already depend on the current string-based shape, so the migration should preserve behavior while tightening the type source.
