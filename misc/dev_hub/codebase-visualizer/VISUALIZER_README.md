# Codebase Visualizer & Sync Tool

This Dev Hub tool maintains architectural "Stop Signs" at the top of source files so multi-agent edits do not silently break dependency chains.

## How to use the Sync Tool (Headless Mode)

If you add/remove exports or imports in a file, you **MUST** update its dependency header.

### Update one or many files
```bash
npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync --only path/to/a.ts path/to/b.tsx
```

Pass every changed path in a single invocation. The `src/` graph is built once and
reused for the whole list, so a wave of files costs one scan rather than one per file.

### Flags
- `--only` — **shared-checkout mode; use it by default.** Writes only the paths you
  named. Dependents are never rewritten (another agent may hold one locked); they are
  printed at the end as possibly stale so the caller can schedule them under its own
  locks.
- `--dry-run` — compute and print the report, write nothing.

### What it does
1. Scans the entire `src/` directory to rebuild import and dependent maps (once per invocation).
2. Locates each file's dependents (who uses it) and its own imports.
3. Injects or updates the comment block between `// @dependencies-start` and `// @dependencies-end`.
4. Prints one line per file — `updated` / `unchanged` / `skipped` — plus the stale-dependent list.

### What it will not damage (WF-G115)
- **Line endings.** The header is written with the target file's dominant EOL. A CRLF
  file stays all-CRLF; an earlier version of this tool left
  `BattleMap3DGpuScene.tsx` at 1032 CRLF / 16 LF.
- **Your own doc comment.** A leading `/** ... */` block that the author wrote is kept,
  and the advisory header is inserted *after* it. Only blocks containing the tool's own
  phrases (`ARCHITECTURAL ADVISORY:`, `MULTI-AGENT SAFETY:`, `Last Sync:`) are treated
  as generated and replaced.
- **Files whose header is already correct.** Those are reported `unchanged` and not
  rewritten, so a repeat pass produces no timestamp-only churn.

The fixture proof for all of the above is
`misc/dev_hub/codebase-visualizer/server/__tests__/syncScoped.test.ts`.

## Static HTML export

To generate a standalone dependency report:

```bash
npx tsx misc/dev_hub/codebase-visualizer/server/staticGenerator.ts
```

This writes `misc/codebase-visualization.html`.

## Why this is important

Agents and humans use these headers as architectural truth. Stale headers create hidden blast-radius mistakes and increase merge risk.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"misc/dev_hub/codebase-visualizer/VISUALIZER_README.md","sha256WithoutMarker":"152ec5a0fa43f3f05826311580c12864541ffa0f4246dbb0dc123b581c14e47d","markedAtUtc":"2026-06-26T00:42:50.361Z"} -->
