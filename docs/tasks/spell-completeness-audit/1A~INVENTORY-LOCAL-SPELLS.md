# Task 1A: Inventory Local Spells (Levels 1-9)

Created: 2025-12-04 15:48 UTC  
Last Updated: 2025-12-04 16:35 UTC  
**Project:** Spell Completeness Audit & Description Extraction  
**Type:** Task (Research/Analysis)  
**Status:** Completed

---

## Objective
Scan the existing spell JSON files to document how many spells exist per level (1-9), including their ids, for comparison against the 2024 PHB. Cantrips (level 0) are explicitly excluded.

## Inputs
- Codebase source: `public/data/spells/`
- Existing status files (for awareness only): `docs/spells/STATUS_LEVEL_*.md`

## Deliverable
- `docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md`
  - Totals per level (1-9)
  - Spell ids per level
  - Notes on any anomalies (missing fields, nonstandard structure)

## Steps
1. Enumerate all JSON files under `public/data/spells/`.
2. Extract `level` and `id` from each file; skip entries with `level: 0`.
3. Group ids by level; compute totals per level and overall total.
4. Note any files with missing/invalid `level` or `id` values.
5. Save the report to `output/LOCAL-INVENTORY.md`.
6. When complete, rename this file with tilde: `1A~INVENTORY-LOCAL-SPELLS.md`.

## Constraints
- Read-only analysis: **do not modify** spell JSON files.
- Ignore cantrips and any non-spell data.
- Preserve original ids; no normalization.

## Acceptance Criteria
- [x] Inventory includes counts and ids for levels 1-9 only.
- [x] Cantrips excluded.
- [x] Anomalies (if any) are documented.
- [x] Report saved to `output/LOCAL-INVENTORY.md`.
