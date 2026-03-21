# Spell Integration Status: Level 8

Last Updated: 2026-03-12

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed:
- ../../public/data/spells/level-8 currently contains 24 spell JSON files
- the level-8 folder remains part of the active manifest-backed spell-data lane

## Current Interpretation

This file no longer treats the older Gold, Silver, and Bronze labels as a current status dashboard.
That shorthand was already too coarse for lower levels and is even less trustworthy for high-level spells with broad system interactions.

What this file can honestly say now:
- level-8 has a real migrated inventory
- level-8 spell data participates in the same validator, manifest, loader, and glossary path as the lower levels
- direct behavior for a specific level-8 spell still needs file-specific verification

## Where To Verify A Specific Level-8 Spell

Use:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../scripts/check-spell-integrity.ts
- ../../src/context/SpellContext.tsx
- ../../src/utils/character/spellAbilityFactory.ts
- any refreshed spell-overhaul note that covers the mechanic in question

## Historical Note

The older level-8 table remains preserved migration context, not a current operational dashboard.
