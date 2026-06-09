# TRACKER: Item Categorization
Status: review-required
Last updated: 2026-06-08

## Active Work
- `[review-required]` Decide whether and how to represent 5e `itemGroup`-style grouping in this pipeline; next proof is a taxonomy decision or migration note.

## Confirmed Completed
- `[done]` Category ingestion for Equipment adds `itemType` tags and `itemMetadata` in `scripts/ingestPhbGlossary.ts`.
- `[done]` `itemMetadata` type-surface drift between `src/types/ui.ts` and `src/types/ui.d.ts` is resolved.
- `[done]` Build-time Equipment hierarchy is emitted in `scripts/generateGlossaryIndex.js` as `subEntries` buckets.
- `[done]` Engine item data pipeline exists: `scripts/generateItemRegistry.ts` writes `src/data/items/generatedGlossaryItems.ts`.
- `[done]` Generated glossary items are merged into `ALL_ITEMS` in `src/data/items/index.ts`.
- `[done]` Existing glossary UI supports nested nodes and recursive searches (`src/components/Glossary/GlossarySidebar.tsx`, `src/components/Glossary/glossaryRuleChapters.ts`, `src/components/Glossary/hooks/useGlossarySearch.ts`).
- `[done]` Dev-mode glossary index rebuild trigger is wired in Vite and calls `node scripts/generateGlossaryIndex.js` (`vite.config.ts` + `Glossary.tsx`).

## Remaining Work
- `[open]` Verify semantic completeness of mechanical mapping in `scripts/generateItemRegistry.ts` (type heuristics and conversions).
- `[open]` Add or document a canonical `generateGlossaryIndex` run command path in project scripts.
- `[open]` Confirm whether the empty `public/data/glossary/entries/magic_items` directory is expected or stale.
- `[open]` Watch for divergence between `src/utils/itemAdapter.ts` and `scripts/generateItemRegistry.ts` as alternate item-conversion paths.

## Discovered Gaps
- See `GAPS.md` for the evidence-backed set tied to this project.

## Blockers
- Human/product taxonomy decision required for `itemGroup` semantics before any forward implementation path is chosen.

## Resume Notes
- Start with the Required Review Brief in `NORTH_STAR.md` and wait for the taxonomy decision.
- Use `GAPS.md` and `DECISIONS.md` for the current canonical stance and the blocked gap details.
- After the review lands, revisit the command-path gap and the remaining item-registry validation work only if the decision chooses a concrete implementation path.
