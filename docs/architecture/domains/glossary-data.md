# Glossary Data Domain

## Purpose

This domain covers the static glossary content that feeds the live glossary loader and glossary UI.
The important boundary in the current repo is that glossary data and spell data are adjacent but not the same domain. The glossary loader reads from public/data/glossary, while public/data/spells remains its own content lane.

## Verified Entry Points

- public/data/glossary/entries/
- public/data/glossary/index/
- src/test/glossaryData.test.ts

This pass confirmed that the glossary content is organized under entries plus index files, and that the live glossary UI tests still exist under src/components/Glossary/__tests__/.

## Current Shape

### Glossary entry families verified in this pass

- classes
- races
- rules
- lore
- magic_items
- dev

### Glossary index files verified in this pass

The current index lane includes:

- main.json
- character_classes.json
- character_races.json
- crafting.json
- crafting_glossary.json
- developer.json
- lore.json
- magic_items.json
- rules_glossary.json
- spellcasting_mechanics.json
- spells.json

## Important Boundary Correction

The previous version of this doc overclaimed ownership by folding public/data/spells and miscellaneous markdown artifacts into the glossary-data domain.
That is too broad for the current repo.

This domain should own:

- public/data/glossary/
- glossary-specific indexes and entry JSON
- glossary-data integrity checks such as src/test/glossaryData.test.ts

It should not present itself as the owner of all spell JSON or of the separate cantrip audit markdown artifacts that currently live in public/data/.

## Supporting Artifacts

This pass also confirmed that the following public/data artifacts still exist:

- public/data/cantrip_consistency_report.md
- public/data/cantrip_table.md

They are still relevant historical or audit-side artifacts, but they are not the primary glossary source of truth.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the static glossary-content lane that feeds the glossary loader and UI, not as a catch-all owner of every rules or spell data file in public/data.
