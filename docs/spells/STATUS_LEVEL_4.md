# Spell Integration Status: Level 4

Last Updated: 2026-03-12

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed:
- ../../public/data/spells/level-4 currently contains 47 spell JSON files
- the level-4 folder remains part of the active manifest-backed spell-data lane

## Current Interpretation

This file no longer uses the old Gold, Silver, and Bronze scoring as if it were a current per-spell truth table.
The older scoring was built around a narrower execution model and is now too stale to trust as a live status dashboard.

What this file can honestly say now:
- level-4 has a real migrated inventory
- level-4 participates in the same validator, manifest, loader, and glossary lane as the lower levels
- per-spell execution depth still varies and should be checked directly when it matters

## Where To Verify A Specific Level-4 Spell

Use:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../scripts/check-spell-integrity.ts
- ../../src/context/SpellContext.tsx
- ../../src/utils/character/spellAbilityFactory.ts
- the relevant refreshed spell-overhaul note if one exists

## Historical Note

The older level-4 table is preserved as migration-era context. It is no longer presented here as a reliable current map of level-4 behavior.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/spells/STATUS_LEVEL_4.md","sha256WithoutMarker":"76b95e8f799897294189a56cec7bfcb3c512d9993861d8c6d9c8f93a9f941c66","markedAtUtc":"2026-06-26T00:26:22.327Z"} -->
