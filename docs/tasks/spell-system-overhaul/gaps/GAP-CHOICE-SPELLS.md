# Gap: Modal Spell Choice Handling

**Status:** Active capability gap note
**Last Reviewed:** 2026-03-12

## Problem

The current spell lane still lacks one generic structured capability for spells that ask the caster to choose between mutually exclusive effect packages.

## Verified Current State

A 2026-03-12 repo check confirmed:
- src/types/spells.ts contains choice-related structures, but they do not provide a general ChoiceEffect for nested spell-effect branches.
- src/types/spells.ts already includes selectionMode: choice for some targeting or summon-adjacent structures.
- blindness-deafness.json still encodes Blinded as the concrete structured status while pushing the Blindness versus Deafness choice into description text and an ai_assisted prompt.
- enhance-ability.json still stores all six enhancement modes in prose instead of structured selectable branches.
- hex.json already uses controlOptions for one narrow choice surface, so the repo does have partial choice-style support.

## Concrete Capability Name

- Modal Spell Choice Handling

## What This Means

The current repo is not at zero choice support, but it still does not have one reusable structured spell-effect model for modal spells.
That gap keeps several spells in a partial state where one choice is hard-coded, the options live in prose, or AI prompting is used as a stopgap.

## Priority Examples

- Blindness/Deafness
- Enhance Ability
- Alter Self
- Eyebite
- Contagion
- Hex for broader reusable choice semantics beyond the current controlOptions lane

## Current Follow-Through

1. Decide whether the shared solution should be a new ChoiceEffect, a nested effect-options block, or a narrower extension of existing controlOptions.
2. Keep the solution generic enough to handle cast-time and recurring-turn choices.
3. Revisit the current partially modeled spells once the shared structure exists.
