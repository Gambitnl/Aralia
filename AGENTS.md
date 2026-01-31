# Agent Environment Signpost

In a multi-agent environment, different agents run in different shells. If you are the Codex-CLI agent running in the VS Code terminal on Windows (PowerShell), these notes help:
- Shell: use `powershell -NoLogo -Command` patterns; `pwsh` is not installed. Slice files with `Get-Content | Select-Object -Skip/-First`.
- TODO(2026-01-03 pass 3 Codex-CLI): When iterating lines with PowerShell, avoid inline for-loops that trip the parser; prefer `Get-Content | Select-Object` or a tiny Python snippet for indexed slices.
- Docs: start with `.uplink/workflow/protocols/README.md` as the shared protocol entry point, then open the relevant flow doc for the active role (e.g., scout/core). 
- Conductor: follow `conductor/codex-bridge.md` to apply the Conductor workflow to Codex without touching the Gemini CLI extension.
- Tools: prefer `rg` for search. `apply_patch` for small edits; if it fails on big blocks, write a tiny temp Python script to rewrite and delete it.
- Browser use is permitted when helpful; prefer DevTools MCP snapshots for UI context and headless browsing where appropriate.
- PowerShell quirks: no POSIX head/tail/heredocs; use `Select-Object` for slicing and stick to `powershell` (not `pwsh`). Typecheck output is large - fix in batches directly in terminal.
- Paths: root is `C:\Users\gambi\Documents\Git\AraliaV4\Aralia`; avoid double `Users\Users` prefixes when using cd.
- Visualizer Sync: Use `npx tsx scripts/codebase-visualizer-server.ts --sync <path>` to update a file dependency header. This provides a Stop Sign for agents to prevent breaking exports.

## Architecture & Reliability (per `.agent/rules/Architecture.md`)
- Before renaming, deleting, or changing exported signatures, run a quick `rg` for dependents or use the Codebase Visualizer and update every impacted file in the same task to keep the tree buildable.
- When touching internal helpers (especially in `utils`, `hooks`, or `state`), rerun `npx tsx scripts/codebase-visualizer-server.ts --sync path/to/file.ts` to keep the dependency header accurate.
- Favor descriptive, unique export names and avoid duplicate basenames within the same subsystem to reduce ambiguity and AI confusion.

## Terminal Best Practices (per `.agent/rules/Terminal.md`)
- Watch for `EADDRINUSE`, `command not found`, or module import errors; kill conflicting processes, ensure PATH/tools exist, and rebuild via `npm install`/`npm run build` before rerunning.
- PowerShell specifics: prefer backslash paths for native commands, double quotes for spacey paths, and remind yourself that backticks escape characters; redirect logs with `command > output.log 2>&1` or drop noise via `| Out-Null` when processes hang.
- Always set { shell: true } when spawning Windows commands (e.g., `npx`) from Node so `.cmd`/`.ps1` wrappers resolve.
- Use non-watch modes for tests/builds, capture hanging output to logs, and filter noisy errors with `Select-String` when exit codes are misleading.

## Review Session Workflow (per `.agent/workflows/review-session.md`)
- Phase 1: Re-read modified code files, analyze for quality/risks, and draft up to five additive proposals (one of which must be creative) without editing files.
- Phase 2 (triggered by explicit approval): Re-verify target locations, avoid duplicating TODOs, and insert the discussed inline TODOs with the enhanced wording, working file-by-file.
- After applying a proposal in Phase 2, summarize added TODOs and where they landed to close the loop.

## TypeScript Testing Workflow (per `.agent/workflows/test-ts.md`)
- Use `/test-ts` to run unit tests (Vitest), type tests (TSD), or build-time checks (TSC).
- Follow the workflow's systematic error-handling guide for debugging failures and reading environment logs like `test_output.log`.

## Terminal Learnings Workflow (per `.agent/workflows/extract-terminal-learnings.md`)
- Scan conversation history for CLI runs to capture errors, workarounds, or environment quirks.
- Update `.agent/rules/Terminal.md` with the new insights, grouping them under the existing sections and using code blocks for concrete commands/examples.
- If no fresh terminal learnings emerge, explicitly tell the user instead of editing the file.

## Implementation Plan Standards
When writing an `implementation_plan.md`, always include the following in the **Verification Plan** section:

```markdown
### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.
```

This ensures codebase hygiene is maintained after every task and that architectural "Stop Signs" stay accurate.
