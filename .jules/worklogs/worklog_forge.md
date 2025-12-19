# Forge's Worklog

## 2025-05-18 - Project Setup
**Learning:** The project uses `npm` (indicated by `package-lock.json`), but a stray `pnpm-lock.yaml` exists, causing confusion.
**Action:** Remove `pnpm-lock.yaml` to strictly enforce `npm` usage and prevent mixed lockfile issues.

## 2025-05-18 - Dependency Categories
**Learning:** `front-matter` is listed as a production dependency but is only used in `scripts/` for build/maintenance tasks.
**Action:** Move `front-matter` to `devDependencies` to reduce the production bundle size/dependency tree.

## 2025-05-18 - Redundant Types
**Learning:** `axe-core` includes built-in type definitions, making `@types/axe-core` redundant.
**Action:** Remove `@types/axe-core` to prevent version mismatches and clutter.
