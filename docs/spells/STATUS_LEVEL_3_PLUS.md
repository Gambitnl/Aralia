# Spell Integration Status: Level 3+

Last Updated: 2026-03-12

This file is now the umbrella note for higher-level spells. It no longer presents the old Gold, Silver, and Bronze shorthand as a live maturity dashboard.

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed the following spell-folder counts:
- level-3: 68
- level-4: 47
- level-5: 59
- level-6: 45
- level-7: 27
- level-8: 24
- level-9: 22

That is 292 spell JSON files across levels 3 through 9.

## What This File Means Now

Use this file as an umbrella orientation note for higher-level spell inventory.
Do not use it as a substitute for current per-spell execution truth.

The older combined table was based on a migration-era maturity model that:
- over-centered older spellAbilityFactory inference
- understated the amount of structured data now present in the repo
- implied more per-spell certainty than this pass has freshly re-verified

## How To Verify A Higher-Level Spell

For current behavior, continue into:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../scripts/check-spell-integrity.ts
- the specific level file from STATUS_LEVEL_3.md through STATUS_LEVEL_9.md
- any refreshed spell-overhaul note that covers the mechanic in question

## Historical Note

The older combined 3+ table remains part of the migration history, but it is no longer treated here as a trustworthy current dashboard.
