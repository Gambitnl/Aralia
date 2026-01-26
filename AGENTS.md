# Agent Environment Signpost

In a multi-agent environment, different agents run in different shells. If you are the Codex-CLI agent running in the VS Code terminal on Windows (PowerShell), these notes help:
- Shell: use `powershell -NoLogo -Command` patterns; `pwsh` is not installed. Slice files with `Get-Content | Select-Object -Skip/-First`.
- TODO(2026-01-03 pass 3 Codex-CLI): When iterating lines with PowerShell, avoid inline for-loops that trip the parser; prefer `Get-Content | Select-Object` or a tiny Python snippet for indexed slices.
- Docs: start with `.uplink/workflow/protocols/README.md` as the shared protocol entry point, then open the relevant flow doc for the active role (e.g., scout/core). 
- Tools: prefer `rg` for search. `apply_patch` for small edits; if it fails on big blocks, write a tiny temp Python script to rewrite and delete it.
- Browser use is permitted when helpful; prefer DevTools MCP snapshots for UI context and headless browsing where appropriate.
- PowerShell quirks: no POSIX head/tail/heredocs; use `Select-Object` for slicing and stick to `powershell` (not `pwsh`). Typecheck output is large - fix in batches directly in terminal.
- Paths: root is `C:\\Users\\gambi\\Documents\\Git\\AraliaV4\\Aralia`; avoid double `Users\\Users` prefixes when using cd.
- Visualizer Sync: Use `npx tsx scripts/codebase-visualizer-server.ts --sync <path>` to update a file dependency header. This provides a Stop Sign for agents to prevent breaking exports.

