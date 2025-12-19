## 2024-05-23 - Lazy Loading Modal Components

**Learning:** The `GameModals` component was statically importing all modal components (Map, QuestLog, Glossary, etc.), causing them to be bundled into the main `index` chunk. By converting these to `React.lazy` imports wrapped in `Suspense`, we reduced the main bundle size from ~1.03 MB to ~681 kB (~34% reduction).

**Action:** When adding new modals to `GameModals.tsx` or similar centralized managers, always use `React.lazy` to prevent them from inflating the initial bundle size. Ensure named exports are handled via `.then(module => ({ default: module.ExportName }))`.
