# Complete Spell Properties Reference

Last Updated: 2026-04-09
Purpose: Provide a current-state orientation reference for spell properties without pretending this file is a mechanically complete dump of every validator branch.

## Current Source Of Truth

For the actual live spell shape, use:
- src/types/spells.ts
- src/systems/spells/validation/spellValidator.ts
- scripts/add_spell.js
- src/systems/spells/mechanics/ScalingEngine.ts

These files do different jobs:
- `src/types/spells.ts` says what the runtime spell model is meant to be able to house
- `src/systems/spells/validation/spellValidator.ts` says what the repo currently accepts
- `scripts/add_spell.js` is the starter scaffold for new spell files
- `src/systems/spells/mechanics/ScalingEngine.ts` shows how structured scaling is actually interpreted at runtime

This file is a human-facing orientation layer, not the canonical validator definition.

## High-Level Current Spell Shape

The current validator expects a structured spell object that includes at least these top-level areas:
- identity and metadata
- castingTime
- range
- components
- duration
- targeting
- effects
- arbitrationType
- aiContext
- description and higher-level notes
- higher-level scaling, when the spell has runtime-meaningful scaling data
- tags and related metadata such as ritual, rarity, source, and legacy markers

## Current Important Reality

Older versions of this file focused on gaps that were still open.

During the current first-wave review, the following are already present in the live validator surface:
- ritual support
- rarity support
- combat and exploration casting-cost structure
- utility, terrain, summoning, movement, and defensive effect lanes
- structured targeting and condition filters
- explicit range units
- richer area and placement geometry such as point anchoring, `sizeType`, `shapeVariant`, and `spatialDetails`
- additive structured higher-level scaling alongside readable prose `higherLevels`

## Current Geometry And Timing Interpretation

Two patterns matter enough to call out explicitly:

- Ritual is not part of the runtime `castingTime.unit`
  - canonical spell pages often show visible phrases like `1 Minute Ritual`
  - the runtime model keeps `ritual: true` separate so the app can reason about the ordinary timing and the ritual-capable status independently

- Area spells are no longer limited to a flat `range + size` reading
  - the current template can carry point-anchored placement, richer area geometry, and extra measured spatial details for awkward spells
  - use this instead of flattening every spell into a simple sphere/cone/line summary when the live spell JSON needs more fidelity

## How To Use This File Safely

Use this file for orientation only.

If you need implementation truth for a spell JSON change:
1. read spellValidator.ts
2. cross-check src/types/spells.ts if the question is "can the model house this cleanly?"
3. compare with docs/spells/SPELL_JSON_EXAMPLES.md
4. check scripts/add_spell.js if the question is "what starter structure should a new spell use?"
5. run the spell validation scripts

## Related Current References

- docs/guides/SPELL_DATA_CREATION_GUIDE.md
- docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- docs/guides/SPELL_TROUBLESHOOTING_GUIDE.md
- docs/spells/SPELL_JSON_EXAMPLES.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md

## Current Interpretation Rule

Do not treat this file as a frozen exhaustive schema dump.

Treat it as a navigation layer that points readers toward the validator and the active spell workflow.
