# Spell Completeness Audit & Description Extraction

Created: 2025-12-04 15:40 UTC  
Last Updated: 2025-12-06 15:11 UTC  
**Status:** Active (Setup)  
**Start Here:** Use this file to navigate tasks, outputs, and workflows for the audit. Numbering restarts at `1A` for this project.

---

## Overview
- **Goal:** Audit local spell coverage against the 2024 PHB list (levels 1-9, excluding cantrips), extract reference-ready descriptions, and execute migration (JSON + glossary + validation) per level.
- **Phases:**
  - **Phase 1:** Completeness audit (inventory → PHB research → gap analysis).
  - **Phase 2:** Description extraction (pilot level 1 → scale levels 2-9).
  - **Phase 3:** Migration & validation for levels 1-9 (JSON/glossary updates, structured references, validation + per-batch gap logs) — see `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md`.
- **Constraints:** Cantrips (level 0) are out of scope for this workstream; follow cantrip learnings for schema/validation patterns.

## Active Tasks
| Number | File | Purpose | Output |
| --- | --- | --- | --- |
| 1A~ | [1A~INVENTORY-LOCAL-SPELLS.md](./1A~INVENTORY-LOCAL-SPELLS.md) | ✅ Inventory local spells by level (exclude cantrips) | `output/LOCAL-INVENTORY.md` |
| 1B~ | [1B~RESEARCH-PHB-2024-LIST.md](./1B~RESEARCH-PHB-2024-LIST.md) | ✅ Gather official 2024 PHB spell list with sources | `output/PHB-2024-REFERENCE.md` |
| 1C~ | [1C~GAP-ANALYSIS.md](./1C~GAP-ANALYSIS.md) | ✅ Compare local inventory vs PHB list | `@SPELL-COMPLETENESS-REPORT.md` |
| 2A | [2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md](./2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md) | Pilot reference extraction for level 1 | `docs/spells/reference/LEVEL-1-REFERENCE.md` |
| 2B | [2B-EXTRACT-REMAINING-LEVELS.md](./2B-EXTRACT-REMAINING-LEVELS.md) | Scale extraction to levels 2-9 | `docs/spells/reference/LEVEL-{2-9}-REFERENCE.md` |
| 3A | [LEVELS-1-9-MIGRATION-GUIDE.md](../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md) | Migration, validation, and per-batch gap logging for levels 1-9 | JSON + glossary + reference updates per level |

## Outputs & Locations
- `docs/tasks/spell-completeness-audit/output/` — Intermediate audit outputs.
- `docs/spells/reference/` — Reference spell descriptions by level.

## Workflow Shortcuts
- Inventory workflow: see [@WORKFLOW.md](./@WORKFLOW.md#inventory-collection).
- PHB research workflow: see [@WORKFLOW.md](./@WORKFLOW.md#phb-2024-research).
- Gap analysis workflow: see [@WORKFLOW.md](./@WORKFLOW.md#gap-analysis).
- Extraction workflow: see [@WORKFLOW.md](./@WORKFLOW.md#description-extraction).
- Migration workflow: see [@WORKFLOW.md](./@WORKFLOW.md#migration--validation-levels-1-9) and `../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md`.

## Next Actions
1. Prepare level 1 extraction batches (2A) — max 10 spells per batch, no cross-level mixing.
2. Mirror batch sizing for levels 2-9 (2B) before starting extraction.
3. Shift into migration flow per `LEVELS-1-9-MIGRATION-GUIDE.md`: level-by-level batches ≤10, structured references, JSON/glossary updates for missing/outdated spells, command validation sequence, per-batch gap logs, and level-level pause reviews.
