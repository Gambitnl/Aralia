# Configuration Refactor Proposal: Centralize `BASE_URL`

## 🌿 Druid's Insight
**Status:** Proposed / Backlog
**Target:** `src/config/env.ts` and various consumers

### The Problem
The application currently accesses the base URL configuration via the raw Vite environment variable `import.meta.env.BASE_URL` scattered across multiple services, hooks, and components.

This leads to:
1.  **Magic Strings:** Repeated use of `import.meta.env` makes refactoring difficult.
2.  **Testing Friction:** `import.meta.env` is not natively available in standard Node.js test environments (Jest/Vitest) without specific mocking or setup, leading to "process is not defined" or "import.meta is not defined" errors in unit tests.
3.  **Inconsistency:** If we ever need to add fallback logic or runtime validation for the base URL, we would have to update every single call site.

### The Solution
Centralize the `BASE_URL` definition in `src/config/env.ts` (which already exists and exports `ENV`).

**Proposed Change:**
Ensure `src/config/env.ts` exports:
```typescript
export const ENV = {
  // ... other vars
  BASE_URL: import.meta.env.BASE_URL,
};
```

Then, refactor all consumers to import `ENV`:
```typescript
// BEFORE
const url = `${import.meta.env.BASE_URL}data/spells.json`;

// AFTER
import { ENV } from '../config/env';
const url = `${ENV.BASE_URL}data/spells.json`;
```

### Affected Files
The following files have been identified as consumers of `import.meta.env.BASE_URL` and should be refactored:

1.  `src/services/SpellService.ts`
2.  `src/context/SpellContext.tsx`
3.  `src/context/GlossaryContext.tsx`
4.  `src/hooks/useSpellGateChecks.ts`
5.  `src/components/Glossary.tsx`
6.  `src/components/Glossary/FullEntryDisplay.tsx`

### Implementation Plan
1.  **Update Config:** Verify `src/config/env.ts` correctly maps `BASE_URL`.
2.  **Refactor Consumers:** Systematically go through the file list above and replace usage.
3.  **Verify Tests:** Ensure unit tests mock `ENV.BASE_URL` or that the `config` module resolves correctly in the test environment.
4.  **Manual Check:** Verify that assets (images, JSON files) still load correctly in the browser, especially if the app is hosted on a subpath.

### Why Prioritize?
This is a low-effort, high-value cleanup ("quick win"). It strengthens the configuration architecture and makes the codebase more robust against future changes to the build system or environment variable injection method.
