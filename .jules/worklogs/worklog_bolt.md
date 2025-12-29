## 2024-05-23 - Lazy Loading Modal Components

**Learning:** The `GameModals` component was statically importing all modal components (Map, QuestLog, Glossary, etc.), causing them to be bundled into the main `index` chunk. By converting these to `React.lazy` imports wrapped in `Suspense`, we reduced the main bundle size from ~1.03 MB to ~681 kB (~34% reduction).

**Action:** When adding new modals to `GameModals.tsx` or similar centralized managers, always use `React.lazy` to prevent them from inflating the initial bundle size. Ensure named exports are handled via `.then(module => ({ default: module.ExportName }))`.

## 2024-05-23 - Breaking the Constants Monolith
**Learning:** `src/constants.ts` acts as a "God Object" re-exporting massive data sets (Items, NPCs, Locations). Importing *any* constant from it (like simple rule values) pulls the entire world data into the bundle of the consuming component.
**Action:** Move lightweight rule constants (Ability Names, etc.) to dedicated data files (`src/data/dndData.ts`) and ensure utilities like `characterValidation.ts` import from specific data sources, not the aggregator.

## 2024-05-23 - TODO: Aggressive Decoupling of Constants (Aborted)
**Context:** `src/constants.ts` is a major performance bottleneck because it aggregates all game data. A plan was formed to refactor this but was deemed too high-risk/sweeping for the current session.

**The Plan:**
1.  **Stop Re-exporting Heavy Data:** Remove exports like `ITEMS`, `NPCS`, `LOCATIONS` from `src/constants.ts`.
2.  **Direct Imports:** Update all ~90 files currently importing from `constants.ts` to import directly from their source files (e.g., `import { ITEMS } from './data/items'`).
3.  **Lazy Dev Data:** Refactor `src/data/dev/dummyCharacter.ts` to export a getter (`getDummyParty()`) rather than a static array, preventing immediate calculation of the dummy party (and thus immediate loading of all dependencies) at app startup.
4.  **Update Consumers:** Update `appState.ts` and `useGameInitialization.ts` to use the lazy getter.

**Benefit:** Significant reduction in initial bundle parse time and circular dependency risks.
**Status:** Deferred. Future "Bolt" or "Architect" agents should execute this in smaller chunks.

## 2024-05-23 - Lazy Dummy Data
**Learning:** The `dummyCharacter.ts` file was executing expensive object creation logic (iterating through all items) immediately upon import. This contributed to initial load time even for production users who don't use the dummy character.
**Action:** Refactored `getDummyInitialInventory` and `getDummyParty` to be lazy getters with memoization. Important: When using memoization for test/dev helpers, ensure parameters (like mock data injection) bypass the global cache to prevent test pollution.
