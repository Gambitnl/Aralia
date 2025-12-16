## 2024-05-23 - Code Splitting Large Route Components

**Learning:** Large view components (`CombatView`, `TownCanvas`, `CharacterCreator`, `GameLayout`) were bundled into the main `index` chunk, causing the initial bundle size to be ~1.27 MB. By converting these to lazy imports, we reduced the main chunk size to ~890 kB, a reduction of ~380 kB (~30%).

**Action:** Whenever introducing a new major Game Phase or large full-screen component, use `React.lazy` and `Suspense` in `App.tsx` (or the routing root) to ensure it is split into a separate chunk. This improves initial load time and keeps the main bundle lighter.
