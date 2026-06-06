# NORTH STAR: Item Categorization

## Dashboard Card Schema
Project: Item Categorization
Slug: item_categorization
Category: Feature/UI Projects
Status: active
Confidence: high
Evidence: docs/projects/item_categorization
Gap signal: 6 open project gaps; itemMetadata parity is the current resume target
Protocol: living project doc set
Next step: Resolve `itemMetadata` parity in the type surface, then decide whether `itemGroup` should become a first-class grouping primitive.
Required verification: docs_consistency, build_typecheck
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Objective
Keep Equipment glossary entries consistently organized by source type (`itemType`) so the Glossary sidebar renders as a nested hierarchy instead of a large flat list, preserving rulebook-like grouping where possible.

## Intended Outcome
When a user opens the "Equipment" section in the Glossary, they see grouped buckets such as Adventuring Gear, Weapons, Armor, and Magic Item classes, with items nested as children, and the same recursion/search behavior used by the rest of the Glossary.

## Current State
The Equipment grouping pipeline is already in place:
- `public/data/glossary/entries/equipment/` contains 810 item JSON files.
- `scripts/ingestPhbGlossary.ts` writes `itemType:*` tags and `itemMetadata`.
- `scripts/generateGlossaryIndex.js` builds hierarchical Equipment buckets from those tags.
- The Glossary UI already renders nested entries recursively.

The remaining open work is mostly contract and taxonomy cleanup:
- `src/types/ui.d.ts` still lacks `itemMetadata`.
- `itemGroup`-style grouping is not yet modeled separately.
- Group labels still mirror generated `itemType` text instead of a curated canonical list.

## Scope Boundaries
- In scope: confirm and document the Equipment grouping pipeline, then preserve intent by capturing remaining gaps in mechanical integration and schema parity.
- Out of scope: broad item/economy simulation redesign, Spell/Feat migration, or non-Glossary inventory system rewrites.

## Resume Path
Read `TRACKER.md` first, then `GAPS.md`.
Start with the type-surface drift gap in `GAPS.md`, then use `DECISIONS.md` if you need the canonical stance on `itemMetadata`, `itemGroup`, or the glossary grouping path.

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
- start with gap 1 in `GAPS.md`
- use `DECISIONS.md` for the canonical stance on `itemMetadata`, `itemGroup`, and the glossary grouping path
- if no valid in-scope project gaps exist, route new cross-project findings to `docs/projects/GLOBAL_GAPS.md` instead
