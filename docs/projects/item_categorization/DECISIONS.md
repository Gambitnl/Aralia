# DECISIONS: Item Categorization
Last updated: 2026-06-08

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
- **Decision:** `itemMetadata` is part of the project’s glossary-item contract and is now present in both TS declaration and implementation types.
- **Status:** Implemented.
- **Evidence:** `src/types/ui.ts` and `src/types/ui.d.ts` both include `itemMetadata`, and the glossary item stat block now renders the field in the UI.
- **Next step:** No further action unless a future schema migration changes the contract again.

### 5. Item grouping taxonomy
- **Decision:** `itemGroup` is a real source signal in the vendor corpus, but the project has not yet chosen whether it should become a first-class visible grouping primitive.
- **Status:** Review-required.
- **Evidence:** `vendor/5etools-src/data/items.json` includes `itemGroup` bundles, while `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, and `scripts/generateItemRegistry.ts` still promote only `itemType`-driven grouping.
- **Next step:** Record the taxonomy decision in the Required Review Brief, then implement the chosen path only if the decision explicitly selects one.
