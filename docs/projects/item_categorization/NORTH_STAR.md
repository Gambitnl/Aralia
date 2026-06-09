# NORTH STAR: Item Categorization

## Dashboard Card Schema
Project: Item Categorization
Slug: item_categorization
Category: Feature/UI Projects
Status: review-required
Confidence: high
Evidence: docs/projects/item_categorization
Gap signal: 5 open project gaps; itemGroup semantics is now gated on taxonomy review
Protocol: living project doc set
Next step: Await human/product decision on whether `itemGroup` becomes a first-class grouping primitive.
Required verification: docs_consistency, build_typecheck
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

## Objective
Keep Equipment glossary entries consistently organized by source type (`itemType`) so the Glossary sidebar renders as a nested hierarchy instead of a large flat list, preserving rulebook-like grouping where possible.

## Required Review Brief

Title: ItemGroup taxonomy decision
Question: Should `itemGroup` become a first-class grouping primitive in the item categorization pipeline, or remain preserved source metadata while Equipment grouping stays `itemType`-driven?
Issue: The vendor corpus includes real `itemGroup` bundles in `vendor/5etools-src/data/items.json`, but the current ingestion and index builders only promote `itemType` tags into visible Equipment buckets.
Current behavior: `scripts/ingestPhbGlossary.ts` writes `itemType:*` tags and `scripts/generateGlossaryIndex.js` builds Equipment groups from those tags. `scripts/generateItemRegistry.ts` and the generated item registry ignore `itemGroup`.
Why blocked: Either choice changes taxonomy and visible hierarchy, so a forward iteration agent should not guess at the product stance or split generated corpora by hand.
Option A: Promote `itemGroup` to first-class grouping metadata and use it to surface explicit variant-family parent nodes.
Option B: Keep `itemGroup` as source-only metadata and leave the current `itemType` hierarchy as the canonical grouping model.
Evidence: `vendor/5etools-src/data/items.json`, `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, `scripts/generateItemRegistry.ts`.
Decision owner: Human/product taxonomy owner.
Proof after decision: Refresh the decision record and, if needed, add a narrow generator/test change with a targeted glossary-index verification pass.

## Intended Outcome
When a user opens the "Equipment" section in the Glossary, they see grouped buckets such as Adventuring Gear, Weapons, Armor, and Magic Item classes, with items nested as children, and the same recursion/search behavior used by the rest of the Glossary.

## Current State
The Equipment grouping pipeline is already in place:
- `public/data/glossary/entries/equipment/` contains 810 item JSON files.
- `scripts/ingestPhbGlossary.ts` writes `itemType:*` tags and `itemMetadata`.
- `scripts/generateGlossaryIndex.js` builds hierarchical Equipment buckets from those tags.
- The Glossary UI already renders nested entries recursively.

The remaining open work is mostly taxonomy cleanup:
- `itemMetadata` now matches between `src/types/ui.ts` and `src/types/ui.d.ts`.
- `itemGroup`-style grouping is not yet modeled separately.
- Group labels still mirror generated `itemType` text instead of a curated canonical list.
- The `itemGroup` taxonomy call is now review-required before any implementation path is chosen.

## Scope Boundaries
- In scope: confirm and document the Equipment grouping pipeline, then preserve intent by capturing remaining gaps in mechanical integration and schema parity.
- Out of scope: broad item/economy simulation redesign, Spell/Feat migration, or non-Glossary inventory system rewrites.

## Resume Path
Read `TRACKER.md` first, then `GAPS.md`.
Start with the `itemGroup` review gate in `GAPS.md`, then use `DECISIONS.md` and the Required Review Brief if you need the canonical stance on whether `itemGroup` should become a first-class grouping primitive.

## Registry Evidence
- `docs/projects/PROJECT_TRACKER.md` (project row: Item Categorization)
- `docs/projects/item_categorization/DECISIONS.md`
- `public/data/glossary/index/equipment.json` (30 group buckets; 810 item leaves)
- `public/data/glossary/entries/equipment/` (source item entries)

## Operational Protocol
- Preserve intent and future feature space before pruning anything.
- Track gaps in `GAPS.md`; route cross-project findings to `docs/projects/GLOBAL_GAPS.md`.
- Keep raw process exhaust external unless a short excerpt is needed for a real handoff decision.
- Reuse the existing glossary recursion/search path instead of introducing a parallel UI tree.

## Registry Links
- [Project registry](../../projects/PROJECT_TRACKER.md)
- [Global gaps](../../projects/GLOBAL_GAPS.md)

## Cold-Start Gap Routing
The next cold-start agent should:
- read `TRACKER.md` and `GAPS.md` first
- start with gap 2 in `GAPS.md`
- use `DECISIONS.md` and the Required Review Brief for the canonical stance on `itemGroup` and the glossary grouping path
- if no valid in-scope project gaps exist, route new cross-project findings to `docs/projects/GLOBAL_GAPS.md` instead
