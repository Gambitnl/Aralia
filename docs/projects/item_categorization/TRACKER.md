# TRACKER: Item Categorization

## Active Work
- `[done]` Bootstrapping project skeleton and writing implementation plan.
- `[done]` Implement categorization tag injection in `ingestPhbGlossary.ts`.
- `[done]` Implement Equipment grouping logic (in `generateGlossaryIndex.js` or `glossaryRuleChapters.ts`).
- `[done]` Rebuild indexes and verify UI visually.

## Active Work (Phase 2: Visuals & Mechanics)
- `[x]` Update `src/types/ui.ts` to include `itemMetadata`.
- `[x]` Update `ingestPhbGlossary.ts` to pass structured metadata instead of plain markdown.
- `[x]` Build `generateItemRegistry.ts` to convert `GlossaryEntry` items into strict engine `Item` entities.
- `[x]` Merge `GENERATED_GLOSSARY_ITEMS` into `ALL_ITEMS` inside `src/data/items/index.ts`.
- `[x]` Test the engine integration adapter against the Glossary entries. Ensure no items fall back to unregistered `ItemType` values.
- `[x]` Fix Stitch MCP `spawn EINVAL` on Windows.
- `[x]` Establish Stitch MCP as the standard for generating new premium glassmorphic UI components.
- `[x]` Fix data ingestion pipeline gaps (resolve `{@dice}`, `{@damage}`, `{@recharge}` markup missing in glossary entries).
- `[x]` Fix data ingestion to automatically build `seeAlso` arrays by scanning generated markdown links.
- `[-]` Use Stitch MCP to generate a premium glassmorphic UI for Glossary Item Entries (`GlossaryItemStatBlock.tsx`) - *Deferred per user request*.

## Completed Work
- Equipment correctly grouped dynamically at build-time.
- Magic items successfully ingested and categorized (XDMG).

## Blockers
- Waiting for user approval on updated `implementation_plan.md`.

## Discovered Gaps
- (See `GAPS.md` for full 50-item audit).

## Next Expected Actions
- Find and record new gaps in item integration (e.g. hooking up weapon attacks to combat engine).
- Evolve plan to implement further mechanical logic for equipped items.
