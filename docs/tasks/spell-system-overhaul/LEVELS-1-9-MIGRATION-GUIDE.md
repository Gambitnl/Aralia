# Levels 1-9 Spell Migration Guide

**Last Reviewed:** 2026-03-12  
**Status:** Active bridge / narrowed playbook  
**Scope:** Levels 1-9 only. Use this as a bridge between the completeness-audit outputs and the live spell migration surfaces.

## Verified Current Surfaces

A 2026-03-12 repo check confirmed:
- docs/tasks/spell-system-overhaul/archive/SPELL_TEMPLATE.json exists
- docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md exists
- docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md exists
- docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md exists
- public/data/spells/level-2/ currently contains 65 JSON spell files

## What This Guide Is For

Use this guide to keep the leveled spell migration lane consistent when working from the completeness-audit packet into live spell data.

It is still useful for:
- source precedence
- level-by-level batching discipline
- batch gap logging
- keeping historical level rollups separate from current inventory truth

## What This Guide No Longer Assumes

- that every referenced level artifact already exists just because the guide names it
- that a spell-specific glossary markdown lane exists under public/data/glossary/entries/spells/
- that old batch rollup files are themselves current inventory truth
- that npm run lint and npm test are guaranteed meaningful spell-data gates for every migration step

## Current Working Rule

For active migration work, prefer this order:
1. Check the live spell folder for the target level.
2. Check the completeness-audit outputs for PHB and local inventory context.
3. Check the matching level rollup and gaps docs only as working aids, not as absolute truth.
4. Run the spell-data commands that still exist in the current repo, with npm run validate as the core validation gate.

## Concrete Capability Names

- Level-Based Spell Migration Workflow
- Level Rollup Coverage Metrics
- Batch Gap Logging
- Migration Phase Gates

## Pause Gate

Finish one level before claiming progress on the next level.
The purpose of that rule is not ceremony; it is to keep level inventory, gap notes, and validation evidence from getting mixed together across levels.
