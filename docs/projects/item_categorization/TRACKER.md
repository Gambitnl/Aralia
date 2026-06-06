# TRACKER: Item Categorization
Last updated: 2026-06-05

## Active Work
- `[open]` Resolve `itemMetadata` type-surface drift between `src/types/ui.ts` and `src/types/ui.d.ts`; next proof is declaration parity for declaration-only consumers.

## Confirmed Completed
- `[done]` Category ingestion for Equipment adds `itemType` tags and `itemMetadata` in `scripts/ingestPhbGlossary.ts`.
- `[done]` Build-time Equipment hierarchy is emitted in `scripts/generateGlossaryIndex.js` as `subEntries` buckets.
- `[done]` Engine item data pipeline exists: `scripts/generateItemRegistry.ts` writes `src/data/items/generatedGlossaryItems.ts`.
- `[done]` Generated glossary items are merged into `ALL_ITEMS` in `src/data/items/index.ts`.
- `[done]` Existing glossary UI supports nested nodes and recursive searches (`src/components/Glossary/GlossarySidebar.tsx`, `src/components/Glossary/glossaryRuleChapters.ts`, `src/components/Glossary/hooks/useGlossarySearch.ts`).
- `[done]` Dev-mode glossary index rebuild trigger is wired in Vite and calls `node scripts/generateGlossaryIndex.js` (`vite.config.ts` + `Glossary.tsx`).

## Remaining Work
- `[open]` Verify semantic completeness of mechanical mapping in `scripts/generateItemRegistry.ts` (type heuristics and conversions).
- `[open]` Decide whether and how to represent 5e `itemGroup`-style grouping in this pipeline.
- `[open]` Add or document a canonical `generateGlossaryIndex` run command path in project scripts.
- `[open]` Confirm whether the empty `public/data/glossary/entries/magic_items` directory is expected or stale.
- `[open]` Watch for divergence between `src/utils/itemAdapter.ts` and `scripts/generateItemRegistry.ts` as alternate item-conversion paths.

## Discovered Gaps
- See `GAPS.md` for the evidence-backed set tied to this project.

## Blockers
- No hard blockers. The active item is a contract-alignment follow-up, not an execution blocker.

## Resume Notes
- Start with the active `itemMetadata` parity gap.
- Use `GAPS.md` for the open issue details and `DECISIONS.md` for the canonical grouping stance.
- After that, revisit `itemGroup` semantics and the command-path gap.
