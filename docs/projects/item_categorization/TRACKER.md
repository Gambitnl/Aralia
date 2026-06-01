# TRACKER: Item Categorization

## Active Work
## Confirmed Completed
- `[done]` Category ingestion for Equipment is adding `itemType` tags + `itemMetadata` in `scripts/ingestPhbGlossary.ts`.
- `[done]` Build-time Equipment hierarchy is emitted in `scripts/generateGlossaryIndex.js` as `subEntries` buckets.
- `[done]` Engine item data pipeline exists: `scripts/generateItemRegistry.ts` writes `src/data/items/generatedGlossaryItems.ts`.
- `[done]` Generated glossary items are merged into `ALL_ITEMS` in `src/data/items/index.ts`.
- `[done]` Existing glossary UI supports nested nodes and recursive searches (`src/components/Glossary/GlossarySidebar.tsx`, `src/components/Glossary/glossaryRuleChapters.ts`, `src/components/Glossary/hooks/useGlossarySearch.ts`).
- `[done]` Dev-mode glossary index rebuild trigger is wired in Vite and calls `node scripts/generateGlossaryIndex.js` (`vite.config.ts` + `Glossary.tsx`).

## Remaining Work
- `[open]` Resolve type-surface drift: `src/types/ui.d.ts` lacks `itemMetadata` while `src/types/ui.ts` has it.
- `[open]` Verify semantic completeness of mechanical mapping in `scripts/generateItemRegistry.ts` (type heuristics and conversions).
- `[open]` Decide whether and how to represent 5e `itemGroup`-style grouping in this pipeline.
- `[open]` Add or document a canonical `generateGlossaryIndex` run command path in project scripts (currently available via Vite dev endpoint, and manual direct invocation).

## Discovered Gaps
- See `GAPS.md` for the evidence-backed set tied to this project.

## Blockers
- No hard blockers. Current open items are mostly validation/normalization decisions.

## Next Expected Actions
- Reconcile and document the unresolved gap items from `GAPS.md`.
- Add a short verification checklist for future cold-starts:
  1. verify equipment entry count and tag coverage,
  2. regenerate glossary index,
  3. run targeted checks for item registry output count and runtime usage.

## Next Expected Actions
- Find and record new gaps in item integration (e.g. hooking up weapon attacks to combat engine).
- Evolve plan to implement further mechanical logic for equipped items.
