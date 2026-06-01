# GAPS: Item Categorization

## 1. Confirmed, Project-Scoped Gaps

1. **[Open: Type Drift Between Typing Surfaces]** `src/types/ui.d.ts` does not expose `itemMetadata` even though `src/types/ui.ts` and ingested glossary JSON entries include it.
   - Impact: declaration-only consumers can miss the field at compile time even though runtime data exists.
   - Evidence: `src/types/ui.ts` includes `itemMetadata`; `src/types/ui.d.ts` does not.

2. **[Open: Item Grouping Semantics]** `scripts/ingestPhbGlossary.ts` normalizes only `itemType` tags and currently does not preserve a separate `itemGroup`-driven grouping signal.
   - Impact: any intended sub-groupings tied to 5etools `itemGroup` are not explicit in generated category trees.
   - Evidence: the item ingestion logic builds `itemTags` from `itemType` values and fallback heuristics, with no `itemGroup` mapping.

3. **[Open: Mechanical Conversion Validation]** `generateItemRegistry.ts` maps raw item metadata into simplified `Item` fields using heuristics (for type, damage, and value/rarity shape).
   - Impact: downstream gameplay parity may diverge from source metadata without an explicit acceptance test.
   - Evidence: heuristic type mapping (`weapon/armor/accessory/...`) and token-based damage parsing in `scripts/generateItemRegistry.ts`.

4. **[Open: Source Coverage Ambiguity]** `generateItemRegistry.ts` reads both `public/data/glossary/entries/equipment` and `public/data/glossary/entries/magic_items`, but the magic-items directory is currently empty in checked files.
   - Impact: unclear if empty directory is expected in current scope or a silent assumption.
   - Evidence: file-count check returned 0 files in `public/data/glossary/entries/magic_items`.

5. **[Open: Duplicate Conversion Paths]** `src/utils/itemAdapter.ts` is an alternate `GlossaryEntry` -> `Item` path and is only exercised by `scripts/test_itemAdapter.ts`.
   - Impact: future edits may diverge from `generateItemRegistry.ts` if one path is treated as canonical and the other drifts.
   - Evidence: both converter and generated registry exist; adapter is currently separate from the merged `generatedGlossaryItems.ts`.

6. **[Open: Rebuild Command Contract]** There is no dedicated `package.json` script listed for running `scripts/generateGlossaryIndex.js`.
   - Impact: regeneration is possible via dev endpoint (`POST /api/glossary/rebuild-index`) or manual `node scripts/generateGlossaryIndex.js`, but runbooks are less explicit.
   - Evidence: `package.json` has `build:data` for item registry, while index rebuild endpoint is implemented in `vite.config.ts`.

## 2. Verified/Resolved Within This Project

7. **[Resolved: Equipment Grouping]** Equipment entries are now grouped by `itemType` into hierarchical buckets in `public/data/glossary/index/equipment.json`.
   - Evidence: inspected file has 30 top-level groups with no missing `itemType` tags across 810 Equipment entries.

8. **[Resolved: Registry Merge]** Generated glossary items flow into runtime item data via `ALL_ITEMS`.
   - Evidence: `scripts/generateItemRegistry.ts` emits `GENERATED_GLOSSARY_ITEMS`, and `src/data/items/index.ts` spreads them into `ALL_ITEMS`.

9. **[Resolved: Recursive Glossary Display]** The glossary UI path already supports nested parents and child expansion/search behavior.
   - Evidence: `GlossarySidebar.tsx`, `useGlossarySearch.ts`, and `buildGlossaryDisplayIndex` route recursion over `subEntries`.

## 3. Notes / Open Validation Flags

10. **[Uncertain: Group Taxonomy Consistency]** Group names currently mirror generated `itemType` values (including plurals and punctuation variants like "Treasure (Gemstone)").
   - If UX requires a strict canonical taxonomy, this should be normalized in a dedicated taxonomy table.

11. **[Uncertain: `magic_items` Coverage Intent]** The empty `magic_items` directory may be transitional or stale; verify with project intent before leaving unchanged.
