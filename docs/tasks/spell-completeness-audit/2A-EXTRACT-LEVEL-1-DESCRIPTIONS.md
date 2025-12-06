# Task 2A: Extract Level 1 Spell Descriptions

Created: 2025-12-04 16:35 UTC  
Last Updated: 2025-12-06 15:11 UTC  
**Project:** Spell Completeness Audit & Description Extraction  
**Type:** Task (Reference Extraction)  
**Status:** Active

---

## Objective
Create a reference-quality catalog of level 1 spells using authoritative mechanical text, suitable as a pilot for later levels, and feed migration outputs (JSON + glossary + validation + gaps) per `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md`.

## Inputs
- `@SPELL-COMPLETENESS-REPORT.md` (coverage confirmation)
- Authoritative rules source for D&D 2024 spells (with citations)

## Deliverable
- `docs/spells/reference/LEVEL-1-REFERENCE.md`
  - Fields (align with `docs/tasks/spell-system-overhaul/archive/SPELL_TEMPLATE.json`): Name, Level, School, Ritual (true/false), Casting Time (value/unit; activation type; reaction condition if any), Range (type + distance), Components (V/S/M flags; material description; cost; consumed flag), Duration (type; value/unit; concentration flag), Classes, Targeting/Area (shape, size, range, valid targets, line of sight), Save/Attack (type, outcome), Damage/Healing (dice, type; slot-level or other scaling), Conditions Applied (name, duration), Secondary Effects (movement, terrain, summon, utility), Description (narrative), At Higher Levels, Source/Citation.

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

## Batch Progress
- Batch 1 (spells 01-10): In Progress — placeholders added in `docs/spells/reference/LEVEL-1-REFERENCE.md`.

## Steps
1. Select level 1 spells confirmed in the coverage report.
2. For each spell, extract mechanical details from a reliable source; capture citation.
3. Normalize formatting (markdown tables or headings) consistent across entries.
4. Save all entries to `LEVEL-1-REFERENCE.md` with clear section headers.
5. Note uncertainties or missing data for follow-up.
6. Execute in batches of ≤10 spells (7 batches total for level 1) with no cross-level overlap; complete online check → local code review → reference entry for each batch before moving on.
7. For each entry, include structured fields per the template alignment (ritual; casting time with activation/reaction; range type; components with material details/cost/consumed; duration with concentration; targeting/area; save/attack; damage/healing with scaling; conditions; secondary effects) before the narrative Description.
8. After reference updates, follow the migration guide for JSON/glossary updates, validation commands, and per-batch gap logging (`LEVEL-1-BATCH-{X}-GAPS.md`).

## Migration Outputs & Validation (Level 1)
- Outputs per batch: structured reference updates; JSON at `public/data/spells/level-1/{id}.json` for missing/outdated spells; glossary at `public/data/glossary/entries/spells/{id}.md`; batch gap log at `docs/tasks/spell-system-overhaul/gaps/LEVEL-1-BATCH-{X}-GAPS.md`.
- Validation commands (in order): `npm run lint`; `npm test`; `npx tsx scripts/regenerate-manifest.ts`; `npm run validate`. Record outcomes in the batch gap file (successes and failures).
- Log PHB source gaps, schema limitations, or command issues in the batch gap file; “No blockers” if none.

## Constraints
- Level 1 only (no cantrips); batch size limit 10; no cross-level mixing.
- Use authoritative sources; avoid speculative/user-generated text.
- Keep structured field ordering consistent; update timestamps and remove TODOs.

## Acceptance Criteria
- [ ] All level 1 spells captured with required fields and citations.
- [ ] Formatting consistent and readable; timestamps updated; TODOs removed.
- [ ] Uncertain items flagged for review.
- [ ] Reference saved to `docs/spells/reference/LEVEL-1-REFERENCE.md`.
- [ ] Missing/outdated spells migrated to JSON/glossary per template, with per-batch gap logs and validation commands run/logged.
