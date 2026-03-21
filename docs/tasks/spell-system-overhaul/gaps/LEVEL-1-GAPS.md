# Level 1 Spell Gaps

**Status:** Active rollup pointer
**Last Reviewed:** 2026-03-12

## What This File Is

This is not a full per-spell dashboard.
It is a compact pointer for the still-open level-1 integration concerns that remain visible after the broader spell refresh.

## Verified Current State

A 2026-03-12 repo check confirmed:
- docs/tasks/spell-system-overhaul/TODO.md still names level-1 concerns around material costs, vision or obscurement, behavior or charm logic, ongoing ticks, forced movement and concentration links, summons or familiar handling, buff stacking or duration UI, ritual casting flow, and reaction triggers.
- hex.json already uses controlOptions for a narrow choice lane, but broader modal spell handling is still open.
- find-familiar.json exists in public/data/spells/level-1, so familiar-related work is no longer a missing-data problem; it is an integration and follow-through problem.
- several level-1 mechanics now have at least partial structured support, so this file should not overclaim that level 1 is broadly unmigrated.

## Concrete Capability Names

- Level 1 Integration Gap Rollup
- Modal Spell Choice Handling
- Familiar And Summon Follow-Through
- Reaction Timing Follow-Through
- Buff Duration And UI Follow-Through

## Current Reading Rule

Use this file as a narrow pointer into the live gap surfaces.
For concrete follow-through, consult:
- docs/tasks/spell-system-overhaul/TODO.md
- docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md
- docs/spells/STATUS_LEVEL_1.md
