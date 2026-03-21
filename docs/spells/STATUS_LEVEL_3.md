# Spell Integration Status: Level 3

Last Updated: 2026-03-12

This file now works as a level-3 inventory and caution note. It does not keep the old Gold, Silver, and Bronze labels as if they were a freshly re-verified maturity matrix.

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed:
- ../../public/data/spells/level-3 currently contains 68 spell JSON files
- level-3 remains an active folder in the manifest-backed spell-data lane

## Why The Older Scoring Model Was Dropped Here

The older level-3 table relied on a narrower view of spell execution that centered older inference logic too heavily.
That is no longer a safe summary because the current repo includes:
- more structured spell data than the old table captured
- a broader command and effect-handling lane than the old table acknowledged
- mixed implementation depth that cannot honestly be compressed into a stale Bronze or Silver label without spell-by-spell re-audit

## What This File Means Now

Use this file to remember that level-3 has a real migrated inventory.
Do not use it as a substitute for current behavioral verification of a specific spell.

For any level-3 spell that matters right now, verify through:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../scripts/check-spell-integrity.ts
- ../../src/context/SpellContext.tsx
- ../../src/utils/character/spellAbilityFactory.ts
- the relevant refreshed spell-overhaul note if one exists

## Historical Note

The older per-spell maturity table was preserved because it captured one migration-era view of readiness. This rewrite keeps the verified inventory fact while removing the false impression that the old labels are still a current operational dashboard.
