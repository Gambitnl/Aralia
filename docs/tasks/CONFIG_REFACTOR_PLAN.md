# Configuration Refactor Plan & Research

**Status:** Draft / Research Phase
**Owner:** Druid 🌿

## Overview
The goal is to centralize the application's configuration to improve maintainability, type safety, and runtime validation. Currently, `import.meta.env` and `process.env` are accessed directly throughout the codebase, leading to potential inconsistencies and "magic string" dependencies.

## The Problem
- **Scattered Access:** `import.meta.env.BASE_URL` and `import.meta.env.VITE_ENABLE_DEV_TOOLS` are accessed in multiple files (Services, Hooks, Contexts, Components).
- **Inconsistent Parsing:** Boolean flags are sometimes manually parsed (`['true', '1', 'on'].includes(...)`) in different places.
- **Testing Difficulty:** Mocking `import.meta.env` in tests can be tricky depending on the test runner and environment.

## Proposed Solution: The `ENV` Object
We propose treating `src/config/env.ts` as the single source of truth for all environment variables.

### Key Changes
1.  **Refactor `src/config/env.ts`**:
    - Introduce a `parseBoolean` helper to standardize flag interpretation.
    - Export a typed `ENV` object that maps `import.meta.env` and `process.env` values.
    - Default `VITE_ENABLE_DEV_TOOLS` to `true` (legacy behavior) unless explicitly disabled.

2.  **Standardize Usage**:
    - Replace all instances of `import.meta.env.BASE_URL` with `ENV.BASE_URL`.
    - Replace direct flag access with `ENV.VITE_ENABLE_DEV_TOOLS`.

## Findings So Far
- **Usage Analysis:** `import.meta.env.BASE_URL` is heavily used in:
    - `src/services/SpellService.ts`
    - `src/hooks/useSpellGateChecks.ts`
    - `src/context/SpellContext.tsx`
    - `src/context/GlossaryContext.tsx`
    - `src/components/Glossary.tsx`
- **Missing Tests:** There is no unit test file for `SpellService`, which relies heavily on `BASE_URL`.
- **Vite Tree-Shaking:** `import.meta.env.DEV` is used in some components (e.g., `SaveSlotSelector.tsx`). We must be careful *not* to abstract this into `ENV.DEV` inside React components if we want Vite's build process to dead-code eliminate dev-only branches effectively.

## TODO: Research & Verification
Before finalizing this refactor, we must:

- [ ] **Verify Tree-Shaking:** Does wrapping `import.meta.env.DEV` in a config object prevent Vite/Rollup from tree-shaking development-only code in production builds? *Hypothesis: Yes, it might.*
- [ ] **Test Coverage:** Create a `SpellService.test.ts` to verify that the service correctly uses the configured `BASE_URL` from the new `ENV` object.
- [ ] **Runtime Validation:** Ensure that `validateEnv()` is called early enough in the lifecycle to catch missing variables before the app crashes.
- [ ] **Type Safety:** Check if the `EnvConfig` interface correctly reflects the optional/required nature of our variables.

## Next Steps
1.  Draft the `ENV` object structure in `src/config/env.ts`.
2.  Update one consumer (e.g., `SpellService`) and verify behavior.
3.  Investigate the tree-shaking implication for `ENV.DEV`.
