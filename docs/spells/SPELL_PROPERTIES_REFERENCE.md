# Complete Spell Properties Reference

Last Updated: 2026-03-11
Purpose: Provide a current-state orientation reference for spell properties without pretending this file is a mechanically complete dump of every validator branch.

## Current Source Of Truth

For the actual live spell shape, use:
- src/systems/spells/validation/spellValidator.ts

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
- tags and related metadata such as ritual, rarity, source, and legacy markers

## Current Important Reality

Older versions of this file focused on gaps that were still open.

During the current first-wave review, the following are already present in the live validator surface:
- ritual support
- rarity support
- combat and exploration casting-cost structure
- utility, terrain, summoning, movement, and defensive effect lanes
- structured targeting and condition filters

## How To Use This File Safely

Use this file for orientation only.

If you need implementation truth for a spell JSON change:
1. read spellValidator.ts
2. compare with docs/spells/SPELL_JSON_EXAMPLES.md
3. run the spell validation scripts

## Related Current References

- docs/guides/SPELL_DATA_CREATION_GUIDE.md
- docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- docs/guides/SPELL_TROUBLESHOOTING_GUIDE.md
- docs/spells/SPELL_JSON_EXAMPLES.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md

## Current Interpretation Rule

Do not treat this file as a frozen exhaustive schema dump.

Treat it as a navigation layer that points readers toward the validator and the active spell workflow.
