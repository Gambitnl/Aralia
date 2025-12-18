# Forge's Journal

## 2025-05-18 - [Dependency Cleanup]
**Learning:** `axe-core` now includes its own type definitions, making `@types/axe-core` redundant.
**Learning:** `front-matter` is only used in scripts, so it should be a `devDependency`.
**Action:** Always check `npm view [package] types` before assuming `@types/` packages are needed.
**Action:** Added typed environment variables to `src/vite-env.d.ts` for better DX.
