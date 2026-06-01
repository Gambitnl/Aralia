# DECISIONS: Item Categorization

## Decision Summary

### 1. Where to apply Equipment grouping logic
- **Decision:** Use build-time grouping in `scripts/generateGlossaryIndex.js` (already implemented) and keep `glossaryRuleChapters.ts` focused on rules/spellchapter reshaping.
- **Status:** Implemented.
- **Evidence:** `scripts/generateGlossaryIndex.js` now creates `subEntries` wrappers for `entry.category === "Equipment"` from `itemType` tags; those wrappers are written into `public/data/glossary/index/equipment.json`.
- **Next check:** Keep this as canonical for Equipment unless the content model later requires more granular manual overrides.

### 2. UI rendering strategy for nested glossary groups
- **Decision:** Reuse existing generic recursive renderer (`GlossarySidebar.tsx` + `GlossaryEntryNode`) and `useGlossarySearch` nested expansion path.
- **Status:** Implemented.
- **Evidence:** `GlossarySidebar.tsx` already accepts `subEntries`, recursively renders child nodes, and search logic in `useGlossarySearch.ts` can expand matching ancestors.
- **Open question:** No new glossary UI scaffolding is required for this project unless visual polish is explicitly requested.

### 3. Engine integration path for ingested items
- **Decision:** Keep generated item source of truth in `src/data/items/generatedGlossaryItems.ts` and merge via `src/data/items/index.ts`.
- **Status:** Implemented.
- **Evidence:** `build:data` script calls `tsx scripts/generateItemRegistry.ts`; `generatedGlossaryItems.ts` is imported and merged into `ALL_ITEMS`.
- **Open question:** Decide whether `src/utils/itemAdapter.ts` becomes a deprecated alternate path or a compatibility helper.

### 4. Type contract coverage
- **Decision:** `itemMetadata` is considered part of the project’s glossary-item contract and should be present in both TS declaration and implementation types.
- **Status:** Pending alignment.
- **Evidence:** `src/types/ui.ts` has `itemMetadata`; `src/types/ui.d.ts` does not.
- **Next step:** Either extend `ui.d.ts` or unify source of truth so declaration consumers see the field.
