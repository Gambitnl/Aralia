# Spell Completeness Audit Workflow

Created: 2025-12-04 15:40 UTC  
Last Updated: 2025-12-04 16:35 UTC  
Reusable procedures for the audit and extraction project. Keep updates minimal and reference external sources instead of embedding long rules.

---

## Inventory Collection
1. Scan `public/data/spells/` for JSON spell files.
2. Extract `level` and `id` from each file; ignore cantrips (`level: 0`).
3. Aggregate counts per level and capture filenames/ids.
4. Save results to `output/LOCAL-INVENTORY.md` with totals and per-level listings.
5. If spell-by-spell checks are needed, process in batches of ≤10 per level with no cross-level mixing.

## PHB 2024 Research
1. Search for the official 2024 Player's Handbook spell list (levels 1-9).
2. Capture spell names, levels, and citations (book page or trusted source link).
3. Normalize spell names for comparison (uppercase, trim punctuation).
4. Record findings in `output/PHB-2024-REFERENCE.md` (validate in batches of ≤10 if reviewing per-spell data).

## Gap Analysis
1. Align naming between local inventory and PHB list (case-insensitive compare).
2. Per level, categorize spells as ✅ Present, ❌ Missing, or ❓ Extra.
3. Summarize totals per category and level.
4. Publish static reference at `@SPELL-COMPLETENESS-REPORT.md`.

## Description Extraction
1. Use a reliable rules source for mechanical text (avoid user-generated content).
2. Capture fields: Name, Level, School, Casting Time, Range, Components, Duration, Classes, Description, At Higher Levels.
3. For level 1, create `docs/spells/reference/LEVEL-1-REFERENCE.md` (pilot quality).
4. For levels 2-9, replicate structure per level: `LEVEL-{N}-REFERENCE.md`.
5. Maintain source notes for traceability; do not modify game data files.
6. Always work in batches of ≤10 spells per level with no cross-level overlap; finish the full check cycle per batch (online verification → local code review → add/update references) before moving to the next batch.
