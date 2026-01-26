# Codebase Visualizer & Sync Tool

This tool maintains architectural "Stop Signs" at the top of code files to prevent cross-file dependency breaks in multi-agent environments.

## How to use the Sync Tool (Headless Mode)

If you add/remove exports or imports in a file, you **MUST** update its dependency header to keep the metadata fresh for other agents.

### Update a single file:
```bash
npx tsx scripts/codebase-visualizer-server.ts --sync path/to/file.ts
```

### What it does:
1. Scans the entire `src/` directory to re-map imports and exports.
2. Locates the file's dependents (who uses it) and its own imports.
3. Injects or updates a comment block at the top of the file between `// @dependencies-start` and `// @dependencies-end`.

## Why this is important:
External agents (Jules, Codex, etc.) use these headers as a primary source of architectural truth. Stale headers lead to "The Trap" (breaking changes that crash dependent systems).
