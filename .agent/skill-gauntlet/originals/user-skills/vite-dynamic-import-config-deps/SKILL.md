---
name: vite-dynamic-import-config-deps
description: |
  Prevent Vite from restarting the dev server when specific files change by
  converting static top-level imports in vite.config.ts into dynamic imports
  inside request handlers. Use when: (1) Vite logs "[filename] changed,
  restarting server..." unexpectedly, (2) editing a script/utility file kills
  the dev server and any connected processes (PTY, WebSocket sessions), (3) a
  file is statically imported in vite.config.ts but only used inside middleware
  route handlers. Covers why Vite watches config dependencies and how to opt out.
author: Claude Code
version: 1.0.0
date: 2026-02-28
---

# Vite Dynamic Import to Prevent Config Dependency Watching

## Problem
Any file statically imported at the top level of `vite.config.ts` becomes part
of Vite's config dependency graph. When that file changes, Vite does a **full
server restart** — killing WebSocket connections, PTY processes, and any other
stateful server resources.

## Context / Trigger Conditions
- Vite logs: `[scripts/some-file.ts] changed, restarting server...`
- Editing a utility/logic file causes the dev server to restart unexpectedly
- A stateful resource (PTY, WebSocket, DB connection) is killed by the restart
- The imported file is only actually called inside middleware `req/res` handlers,
  not at config initialization time

## Solution

**Before** (static import — Vite watches `roadmap-server-logic.ts`):
```typescript
// vite.config.ts — TOP LEVEL
import {
  generateRoadmapData,
  readOpportunitySettings,
} from './scripts/roadmap-server-logic';

// ... used inside configureServer middleware
```

**After** (dynamic import — Vite does NOT watch `roadmap-server-logic.ts`):
```typescript
// vite.config.ts — remove the top-level import entirely

// Inside configureServer:
server.middlewares.use(async (req, res, next) => {
  const {
    generateRoadmapData,
    readOpportunitySettings,
  } = await import('./scripts/roadmap-server-logic.ts');

  // use them normally...
});
```

Key changes:
1. Remove the static `import { ... } from '...'` at the top of `vite.config.ts`
2. Make the middleware function `async`
3. Add `const { ... } = await import('./path/to/file.ts')` at the top of the handler

## Verification
After the change, vite.config.ts itself will trigger one restart (unavoidable —
you changed the config). After that restart, editing the previously-watched file
should produce **no restart** — Vite will only show HMR updates (or nothing).

```
# Before fix:
[vite] scripts/roadmap-server-logic.ts changed, restarting server...

# After fix:
(silence — no restart when that file changes)
```

## Notes
- `await import()` is cached by Node.js after the first call — negligible perf cost
  on subsequent requests (it's just a resolved Promise, not a re-parse)
- Use `.ts` extension in the dynamic import path to match the other dynamic imports
  in your vite config (e.g. `await import('./scripts/foo.ts')`)
- This technique applies to ANY file in your config dependency chain — transitively
  imported files are also watched, so if `vite.config.ts` imports A which imports B,
  changes to B also restart the server
- The middleware function must be `async` to use `await import()` — connect-style
  middleware supports async functions in Vite's dev server
- This is different from HMR (hot module replacement) — HMR is for browser-side
  modules; config dependency watching is server-side and causes full restarts

## References
- [Vite Config Dependencies](https://vite.dev/config/#config-dependencies)
