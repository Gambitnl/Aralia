# Task 2A: Extract Level 1 Spell Descriptions

Created: 2025-12-04 16:35 UTC  
Last Updated: 2025-12-04 16:35 UTC  
**Project:** Spell Completeness Audit & Description Extraction  
**Type:** Task (Reference Extraction)  
**Status:** Active

---

## Objective
Create a reference-quality catalog of level 1 spells using authoritative mechanical text, suitable as a pilot for later levels.

## Inputs
- `@SPELL-COMPLETENESS-REPORT.md` (coverage confirmation)
- Authoritative rules source for D&D 2024 spells (with citations)

## Deliverable
- `docs/spells/reference/LEVEL-1-REFERENCE.md`
  - Fields: Name, Level, School, Casting Time, Range, Components, Duration, Classes, Description, At Higher Levels, Source notes

## Batch Plan (Level 1)
- **Total spells:** 65 (per `LOCAL-INVENTORY.md`), **PHB set:** 64 (per `PHB-2024-REFERENCE.md`)
- **Batches (max 10 spells each, no overlap):**  
  - Batch 1: spells 01-10 (alphabetical by PHB list)  
  - Batch 2: spells 11-20  
  - Batch 3: spells 21-30  
  - Batch 4: spells 31-40  
  - Batch 5: spells 41-50  
  - Batch 6: spells 51-60  
  - Batch 7: spells 61-65  
- Complete online check → local code review → reference entry for each batch before starting the next.

## Steps
1. Select level 1 spells confirmed in the coverage report.
2. For each spell, extract mechanical details from a reliable source; capture citation.
3. Normalize formatting (markdown tables or headings) consistent across entries.
4. Save all entries to `LEVEL-1-REFERENCE.md` with clear section headers.
5. Note uncertainties or missing data for follow-up.
6. Execute in batches of ≤10 spells (7 batches total for level 1) with no cross-level overlap; complete online check → local code review → reference entry for each batch before moving on.

## Constraints
- Research-only; do not modify JSON spell files.
- Use consistent ordering of fields across spells.
- Avoid user-generated or unofficial text.
- Batch size limit: 10 spells maximum per batch; keep batches within a single level (no mixing levels).

## Acceptance Criteria
- [ ] All level 1 spells captured with required fields and citations.
- [ ] Formatting consistent and readable.
- [ ] Uncertain items flagged for review.
- [ ] Report saved to `docs/spells/reference/LEVEL-1-REFERENCE.md`.
