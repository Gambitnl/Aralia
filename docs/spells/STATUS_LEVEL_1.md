# Spell Integration Status: Level 1

Last Updated: 2026-03-12

This file now serves as a verified level-1 inventory note instead of a pseudo-granular completion dashboard.

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed:
- ../../public/data/spells/level-1 currently contains 68 spell JSON files
- the level-1 folder remains part of the active manifest-backed spell lane
- the older batch-doc references still exist as historical implementation context, but they are not the only authority on current execution maturity

## What Is Safe To Keep From The Older Version

The older version was directionally right about one thing: level-1 spells have a broad migrated inventory in the structured spell-data lane.

What remains credible:
- level-1 spell JSONs exist and are manifest-backed
- the batch-doc era created a real migrated corpus
- the glossary and spell-loader surfaces have a level-1 inventory to work from

## What This File No Longer Claims

This file does not claim that every level-1 spell has been freshly re-tested through:
- character creation
- spellbook and resource flow
- combat execution
- glossary display

It also does not claim that a single word such as Complete can capture the current behavior of every level-1 spell. The repo now uses a mix of structured spell data, command-based execution, and older bridge logic, so that older shorthand is too coarse.

## How To Read Level-1 Status Now

Use this file for the level-1 inventory fact and for orientation.
For current behavioral truth, continue into:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ./SPELL_JSON_EXAMPLES.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../scripts/check-spell-integrity.ts
- spell-specific overhaul notes when a given mechanic was re-audited more recently than this level summary

## Historical Note

The older table that listed every level-1 spell as Complete is preserved in the migration history, but the wording was stronger than this doc pass can honestly support without a full spell-by-spell rerun.
This rewrite keeps the verified inventory fact while dropping the false precision.
