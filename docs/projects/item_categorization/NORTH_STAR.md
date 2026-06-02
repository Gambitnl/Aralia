# NORTH STAR: Item Categorization

## Objective
Keep Equipment glossary entries consistently organized by source type (`itemType`) so the Glossary sidebar renders as a nested hierarchy instead of a large flat list, preserving rulebook-like grouping where possible.

## Intended Outcome
When a user opens the “Equipment” section in the Glossary, they see grouped buckets (e.g., Adventuring Gear, Weapons, Armor, Magic Item classes), with items nested as children, and the same existing recursion/search behavior used by the rest of the Glossary.

## Current State
As of the latest inspected build-state, this has already been implemented:

- `public/data/glossary/entries/equipment/` currently contains 810 item JSON files.
- Ingestion now writes `tags` including `itemType:...` to each Equipment entry and persists `itemMetadata` (type, rarity, value, weight, damage, properties, etc.) in `scripts/ingestPhbGlossary.ts`.
- `scripts/generateGlossaryIndex.js` now builds an Equipment category tree from those `itemType` tags and emits parent nodes with `subEntries` (top-level Equipment index now has 30 groups).
- The recursive Glossary rendering path already supports nested nodes (`GlossarySidebar.tsx`, `useGlossarySearch.ts`, and the `buildGlossaryDisplayIndex` pass).

What still looks partially open:

- The grouping labels are as generated (`itemType` text) rather than a curated canonical list yet.
- Some 5e source fields such as `itemGroup` are not yet explicitly preserved as a separate grouping primitive.
- `itemMetadata` is typed in `src/types/ui.ts` but missing in `src/types/ui.d.ts`.

## Scope Boundaries
- **In Scope:** Confirming and documenting the Equipment grouping pipeline (ingest → index -> UI tree), then preserving intent by capturing remaining gaps in mechanical integration and schema parity.
- **Out of Scope:** Broad item/economy simulation redesign, Spell/Feat migration, or non-Glossary inventory system rewrites.

## Resume Path
Check `TRACKER.md` for active tasks and `GAPS.md` for evidence-backed open work.

For missing files in this project folder: there is no `implementation_plan.md` present at the moment.

If you are extending the work, also verify:
- `scripts/ingestPhbGlossary.ts` for tag/metadata extraction behavior.
- `scripts/generateGlossaryIndex.js` for Equipment grouping behavior.
- `public/data/glossary/index/equipment.json` for grouped shape and missing-type exposure.
- `src/components/Glossary/*` for recursion/search and `subEntries` handling.
- `src/data/items/generatedGlossaryItems.ts` and `src/data/items/index.ts` for item registry merge behavior.

## Registry Evidence

- `docs/projects/PROJECT_TRACKER.md` (project row: Item Categorization)
- `public/data/glossary/index/equipment.json` (30 group buckets; 810 item leaves)
- `public/data/glossary/entries/equipment/` (source item entries)
- `docs/projects/item_categorization` (NORTH_STAR, TRACKER, GAPS, DECISIONS)

## Operational Protocol (For Future Agents)
- **Ever-Widening Scope**: Treat the task as a discovery process. The goal is an ever-widening scope, not artificial shrinkage just to complete the task.
- **Track Gaps**: Discover gaps as you work, classify them, and add them to the `GAPS.md` tracker without letting discovery swallow the active task.
- **Preserve intent**: Preserve durable intent, decisions, and evidence. Keep raw process exhaust external or summarized.
- **UI Generation**: Use Stitch MCP (`/stitch-generate`) only if new UI components are required. Current changes for this project can be mostly documented and verified via existing glossary tree behavior.

## Registry Links

- [Project registry](../../projects/PROJECT_TRACKER.md)
- [Global gaps](../../projects/GLOBAL_GAPS.md)


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
