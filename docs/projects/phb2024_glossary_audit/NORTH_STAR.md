# NORTH STAR: PHB 2024 Glossary Audit

Status: complete docs handoff
Last updated: 2026-05-31

## Purpose and Scope

Capture the remaining 2024 Player's Handbook glossary work needed for Aralia without expanding this project into spell, class, or race migration.

In-scope families are Feats, Backgrounds, Items, Skills, Senses, Languages, and Hazards where `source: "XPHB"` or `basicRules2024 === true`.

Out of scope:
- Spells
- Classes and races
- Non-2024 rule text

## Implemented State

- Core rules work was completed in the earlier PHB rules migration pass.
- This project completed ingestion for the remaining PHB 2024 families above.
- Item metadata extraction was added during PHB ingestion (`type`, `value`, `weight`, `dmg1`, `ac`) and preserved in generated entry output.
- Top-level category visibility was wired into glossary UI utilities for the new PHB folders.

## File Map (Primary Evidence)

- `scripts/ingestPhbGlossary.ts`: source extraction and glossary-entry emission.
- `scripts/generateGlossaryIndex.js`: index build and subgroup wiring.
- `src/components/Glossary/glossaryUIUtils.tsx`: category labels used by the sidebar.
- `docs/tasks/2024_phb_rules_migration.md`: prior PHB core-rules scope and mapping history.
- `public/data/glossary/entries/<category>/...`: generated 2024 category output.
- `public/data/glossary/index/<category>.json`: generated tree consumed by runtime.
- `docs/projects/item_categorization`: shared `itemType` and metadata assumptions.
- `docs/tasks/glossary`: broader glossary scope and link target standards.

## Integrations

- Build path follows the pattern:
  1) `scripts/ingestPhbGlossary.ts` parses vendor JSON,
  2) `scripts/generateGlossaryIndex.js` builds nested index files,
  3) glossary runtime loads `public/data/glossary` through the existing context and UI stack.
- This project depends on `docs/projects/item_categorization` for equipment grouping behavior.
- This project is functionally visible via `docs/projects/glossary-ui` for runtime behavior checks.

## Current Gaps and Uncertainties

- Item metadata typing parity is tracked in item-categorization follow-up work.
- The non-dev glossary rebuild contract is not fully normalized outside Vite/dev endpoints.
- `docs/tasks/glossary` notes that not all rule-surface inventory entries are high-value for PHB completeness checks.

## Resume Path

Read `TRACKER.md`, then `GAPS.md`, then the files in the file map above.
For a quick validation cycle, run `node scripts/generateGlossaryIndex.js` and check that the glossary UI categories load without merge conflicts.

## Registry Links

- [Project registry](../../projects/PROJECT_TRACKER.md)
- [Global gaps](../../projects/GLOBAL_GAPS.md)
- [Tracker](./TRACKER.md)
- [Gaps](./GAPS.md)


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
