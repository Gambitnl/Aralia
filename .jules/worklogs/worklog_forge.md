# Forge's Journal

## 2024-05-22 - Vitest Config Type Issue
**Learning:** Vitest config requires explicit types for `test` property in `vite.config.ts` or a separate `vitest.config.ts`.
**Action:** Use `vitest.config.ts` for cleaner separation of concerns and correct typing.

## 2024-05-22 - Sharp Incompatibility
**Learning:** The `sharp` dependency is for Node.js environments and fails in browser-based Vite builds if not carefully managed.
**Action:** Remove `sharp` if not strictly needed for build-time image processing, or ensure it's not imported in client code.

## 2024-05-23 - Front-Matter Dependency
**Learning:** `front-matter` is used in build/validation scripts (Node context) but was listed as a production dependency.
**Action:** Move `front-matter` to `devDependencies` to reduce bundle size, as it's not used in the client application.

## 2024-05-23 - Axe-Core Types Redundancy
**Learning:** `@types/axe-core` is deprecated because `axe-core` now includes its own type definitions.
**Action:** Remove `@types/axe-core` to avoid confusion and potential conflicts.

## 2024-05-24 - React Version
**Learning:** React 19 is being used. Ensure compatible peer dependencies.

## 2024-12-18 - Simplex Noise Dependency
**Learning:** `simplex-noise` was missing from `package.json` but required by `src/components/Submap/painters/shared.ts`. This suggests it was a "phantom dependency" or relying on a lockfile entry that got cleaned.
**Action:** Explicitly install `simplex-noise` as a dependency to ensure reproducible builds.
