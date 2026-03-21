# Spell Completeness Audit & Description Extraction

**Status:** Preserved project index / mixed historical start surface
**Last Reviewed:** 2026-03-11

## Purpose

This file remains the start surface for the spell-completeness-audit subtree, but it should now be read as a preserved project map rather than a claim that every planned phase is still the current execution lane.

## Verified Current State

- output/LOCAL-INVENTORY.md still exists.
- output/PHB-2024-REFERENCE.md still exists.
- @SPELL-COMPLETENESS-REPORT.md still exists.
- 2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md and 2B-EXTRACT-REMAINING-LEVELS.md still exist as planning docs.
- docs/spells/reference/ is populated with per-spell reference docs, but the older LEVEL-*.md summary files described here were not found during this pass.
- The downstream migration authority still exists at ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md.

## What This Project Still Represents

- Phase 1: historical completeness-audit outputs that established a local-vs-PHB baseline.
- Phase 2: preserved extraction planning for level reference docs.
- Phase 3: a handoff into the later spell migration stream under spell-system-overhaul.

## Current Reading Order

1. Use @SPELL-COMPLETENESS-REPORT.md for the preserved Dec 2025 comparison snapshot.
2. Use output/LOCAL-INVENTORY.md and output/PHB-2024-REFERENCE.md for the source materials behind that snapshot.
3. Treat 2A and 2B as preserved extraction plans, not as proof that the level reference files were completed.
4. Use ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md for the later migration lane that took over once the audit phase ended.

## Preserved Task Map

| Number | File | Current Role |
| --- | --- | --- |
| 1A~ | [1A~INVENTORY-LOCAL-SPELLS.md](./1A~INVENTORY-LOCAL-SPELLS.md) | Historical inventory task that produced output/LOCAL-INVENTORY.md |
| 1B~ | [1B~RESEARCH-PHB-2024-LIST.md](./1B~RESEARCH-PHB-2024-LIST.md) | Historical PHB reference task that produced output/PHB-2024-REFERENCE.md |
| 1C~ | [1C~GAP-ANALYSIS.md](./1C~GAP-ANALYSIS.md) | Historical comparison task that produced @SPELL-COMPLETENESS-REPORT.md |
| 2A | [2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md](./2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md) | Preserved level-1 extraction plan |
| 2B | [2B-EXTRACT-REMAINING-LEVELS.md](./2B-EXTRACT-REMAINING-LEVELS.md) | Preserved scale-out extraction plan |
| 3A | [LEVELS-1-9-MIGRATION-GUIDE.md](../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md) | Later migration authority in the spell-overhaul subtree |

## Important Caution

Do not read this file as proof that the older per-level summary outputs were completed exactly as originally planned. The current reference lane exists, but it is populated as per-spell docs under docs/spells/reference/level-* rather than the promised LEVEL-*.md files.
