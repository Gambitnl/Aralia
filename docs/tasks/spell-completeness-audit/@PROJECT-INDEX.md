# Spell Completeness Audit & Description Extraction

**Status:** Preserved project index / mixed historical start surface
**Last Reviewed:** 2026-03-11

## Purpose

This file remains the start surface for the spell-completeness-audit subtree, but it should now be read as a preserved project map rather than a claim that every planned phase is still the current execution lane.

## Verified Current State

- output/LOCAL-INVENTORY.md still exists.
- output/PHB-2024-REFERENCE.md still exists.
- @SPELL-COMPLETENESS-REPORT.md still exists.
- The old 1A/1B/1C completion briefs and task-folder `GAPS.md` were retired on
  2026-06-25 after their useful provenance and still-valid gaps were routed to
  `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`.
- The old 2A/2B extraction planning docs were retired on 2026-06-25 after their still-valid coverage reconciliation work was routed to `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` as `spell-completeness-audit-G2`.
- docs/spells/reference/ is populated with per-spell reference docs, but the older LEVEL-*.md summary files described here were not found during this pass.
- The downstream migration authority still exists at ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md.

## What This Project Still Represents

- Phase 1: historical completeness-audit outputs that established a local-vs-PHB baseline.
- Phase 2: preserved extraction planning for level reference docs.
- Phase 3: a handoff into the later spell migration stream under spell-system-overhaul.

## Current Reading Order

1. Use @SPELL-COMPLETENESS-REPORT.md for the preserved Dec 2025 comparison snapshot.
2. Use output/LOCAL-INVENTORY.md and output/PHB-2024-REFERENCE.md for the source materials behind that snapshot.
3. Treat 1A through 1C and 2A through 2B as retired historical task packets, not
   as live backlog owners.
4. Use ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md for the later migration lane that took over once the audit phase ended.

## Preserved Task Map

| Number | File | Current Role |
| --- | --- | --- |
| 1A~ | Retired 2026-06-25 | Historical inventory task; output remains at `output/LOCAL-INVENTORY.md` |
| 1B~ | Retired 2026-06-25 | Historical PHB reference task; output remains at `output/PHB-2024-REFERENCE.md` |
| 1C~ | Retired 2026-06-25 | Historical comparison task; output remains at `@SPELL-COMPLETENESS-REPORT.md` |
| task GAPS | Retired 2026-06-25 | Still-valid G001-G003 content imported into living subproject gap `spell-completeness-audit-G1` |
| 2A | Retired 2026-06-25 | Level-1 extraction intent routed to `spell-completeness-audit-G2` |
| 2B | Retired 2026-06-25 | Levels 2-9 extraction intent routed to `spell-completeness-audit-G2` |
| 3A | [LEVELS-1-9-MIGRATION-GUIDE.md](../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md) | Later migration authority in the spell-overhaul subtree |

## Important Caution

Do not read this file as proof that the older per-level summary outputs were completed exactly as originally planned. The current reference lane exists, but it is populated as per-spell docs under docs/spells/reference/level-* rather than the promised LEVEL-*.md files.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-completeness-audit/@PROJECT-INDEX.md","sha256WithoutMarker":"d8a59b77f1df06c79c55ac64bb130d250a66b31e3e1852ed50dc3869e2f33a50","markedAtUtc":"2026-06-25T22:29:38.618Z"} -->
