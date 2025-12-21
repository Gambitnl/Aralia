## 2024-05-23 - Lazy Loading Modal Components

**Learning:** The `GameModals` component was statically importing all modal components (Map, QuestLog, Glossary, etc.), causing them to be bundled into the main `index` chunk. By converting these to `React.lazy` imports wrapped in `Suspense`, we reduced the main bundle size from ~1.03 MB to ~681 kB (~34% reduction).

**Action:** When adding new modals to `GameModals.tsx` or similar centralized managers, always use `React.lazy` to prevent them from inflating the initial bundle size. Ensure named exports are handled via `.then(module => ({ default: module.ExportName }))`.

## 2024-05-23 - Breaking the Constants Monolith
**Learning:** `src/constants.ts` acts as a "God Object" re-exporting massive data sets (Items, NPCs, Locations). Importing *any* constant from it (like simple rule values) pulls the entire world data into the bundle of the consuming component.
**Action:** Move lightweight rule constants (Ability Names, etc.) to dedicated data files (`src/data/dndData.ts`) and ensure utilities like `characterValidation.ts` import from specific data sources, not the aggregator.
