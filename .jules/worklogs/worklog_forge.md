# Forge's Journal

## 2025-05-18 - [Dependency Cleanup & Import Fixes]
**Learning:** `axe-core` now includes its own type definitions, making `@types/axe-core` redundant.
**Learning:** `front-matter` is only used in scripts, so it should be a `devDependency`.
**Learning:** Several `Glossary` components had incorrect relative imports after a likely refactor (importing from parent/sibling instead of correct structure).
**Learning:** When moving components to a subdirectory, relative imports to parent directories must be adjusted (e.g., `../types` -> `../../types`).
**Action:** Always check `npm view [package] types` before assuming `@types/` packages are needed.
**Action:** When moving components, ensure all consumers update their import paths, and check internal imports of the moved components.
**Action:** Added typed environment variables to `src/vite-env.d.ts` for better DX.
