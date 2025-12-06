# Task 2B: Extract Spell Descriptions (Levels 2-9)

Created: 2025-12-04 16:35 UTC  
Last Updated: 2025-12-06 15:11 UTC  
**Project:** Spell Completeness Audit & Description Extraction  
**Type:** Task (Reference Extraction)  
**Status:** Active

---

## Objective
Scale the reference extraction process to levels 2-9 using the pilot format from 2A and drive migration outputs (JSON + glossary + validation + gaps) per `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md`.

## Inputs
- `@SPELL-COMPLETENESS-REPORT.md`
- `docs/spells/reference/LEVEL-1-REFERENCE.md` (format reference)
- Authoritative rules source for D&D 2024 spells (with citations)

## Deliverable
- `docs/spells/reference/LEVEL-{2-9}-REFERENCE.md` (one file per level) with the same field set as 2A.

## Batch Plan (Per Level)
- Work level-by-level; do not mix spells from different levels within a batch.
- Batch size limit: ≤10 spells. Finish online check → local code review → reference entry per batch before moving on.
- Suggested batch counts based on `PHB-2024-REFERENCE.md` (adjust if sources change):
  - Level 2: 7 batches (6×10, 1×3)
  - Level 3: 6 batches (5×10, 1×2)
  - Level 4: 5 batches (4×10, 1×1)
  - Level 5: 5 batches (4×10, 1×9)
  - Level 6: 4 batches (3×10, 1×4)
  - Level 7: 3 batches (2×10, 1×2)
  - Level 8: 2 batches (1×10, 1×8)
  - Level 9: 2 batches (1×10, 1×7)

## Steps
1. For each level 2-9, list spells confirmed in the coverage report.
2. Extract mechanical details with citations; mirror the 2A formatting.
3. Save per-level references under `docs/spells/reference/`.
4. Log gaps or blocked items for follow-up work.
5. After reference updates, run migration steps per level in batches ≤10: JSON/glossary updates for missing/outdated spells, validation command sequence, and per-batch gap logging (`LEVEL-{N}-BATCH-{X}-GAPS.md`).

## Migration Outputs & Validation (Per Level)
- Outputs per batch: structured reference updates; JSON at `public/data/spells/level-{N}/{id}.json` for missing/outdated spells; glossary at `public/data/glossary/entries/spells/{id}.md`; batch gap log at `docs/tasks/spell-system-overhaul/gaps/LEVEL-{N}-BATCH-{X}-GAPS.md`.
- Validation commands (in order): `npm run lint`; `npm test`; `npx tsx scripts/regenerate-manifest.ts`; `npm run validate`. Record outcomes in the batch gap file (successes and failures); rerun once if transient/missing, otherwise log and continue.
- Log PHB source gaps, schema limitations, ID conflicts, or command issues in the batch gap file; “No blockers” if none. Pause after each level to summarize blockers before moving on.

## Constraints
- Levels 2-9 only (no cantrips); batch size limit 10; no cross-level mixing.
- Consistency with level 1 formatting is required; update timestamps and remove TODOs.
- Use authoritative sources; avoid speculative text.

## Acceptance Criteria
- [ ] Levels 2-9 files created with required fields and citations; formatting matches 2A pilot.
- [ ] Blockers noted per level and per batch gap files created.
- [ ] Files saved to `docs/spells/reference/`.
- [ ] Missing/outdated spells migrated to JSON/glossary per template, with per-batch validation commands run/logged.
