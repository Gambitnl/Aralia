Identity & Environment Checklist
- Agent ID: codex-cli-terminal
- Host/Tool (terminal, VS Code extension, etc.): Codex-CLI in VS Code terminal
- Shell: powershell (Windows PowerShell 5.1)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/
- Environment learnings file path: .agent/rules/environment-learnings/codex-cli-terminal.md
- Verification steps used: confirmed cwd/shell via session context; validated AGENTS.md exists via Test-Path; confirmed PowerShell host via Get-Host

Agent Identity & Environment Note
- Verified on 2026-02-27 in Codex-CLI + Windows PowerShell at `F:\Repos\Aralia` before applying terminal learnings.

## PowerShell Quoting Pitfalls

### Ripgrep Patterns Containing `|`
In PowerShell, `|` is the pipeline operator. If your `rg` pattern includes `|`, it must be quoted so PowerShell does not treat it as a pipe.

```powershell
# Good: single-quoted pattern (PowerShell does not interpret |)
rg -n 'getAbilityModifierValue|getAbilityModifier' src

# Bad: unquoted/poorly-quoted pattern (PowerShell pipes accidentally)
rg -n getAbilityModifierValue|getAbilityModifier src
```

### Passing Commands Through `powershell -Command`
When a command is embedded inside another `powershell -Command "..."`, redirection and quoting can get mangled.

```powershell
# Prefer: keep the inner command simple, avoid inline redirection in nested quoting
powershell -NoLogo -Command "rg -n 'TODO' src\\file.ts"

# If you need redirection, consider running it directly in the current shell:
rg -n 'TODO' src\\file.ts > out.log 2>&1
```

### Avoid Complex Nested Escaping In One-Liners
If a `powershell -Command "..."` string mixes escaped double quotes, variable interpolation (like `$LASTEXITCODE`), and output redirection in one line, PowerShell may throw:
`The string is missing the terminator: ".`

Safer pattern:
- Run the main tool command in one call.
- Run summary/parsing in a second call.
- Prefer direct shell commands over deeply nested `powershell -Command` wrappers.

### `$` Variable Expansion Can Be Stripped In `exec_command` One-Liners
Inline commands that rely on PowerShell variables such as `$_` inside `ForEach-Object` can lose the variable token and pass empty values to downstream commands.

```powershell
# Risky in this environment: $_ can be stripped, causing --sync to receive no path
powershell -NoLogo -Command "'file.ts' | ForEach-Object { npx tsx ... --sync $_ }"
```

Safer pattern:
- Avoid PowerShell loop variables in nested one-liners.
- Use explicit command chaining with full file paths, or write a temporary `.cjs`/`.ps1` script and execute it.

### Long Inline Node Commands Through `powershell -Command` Are Fragile
Large `node -e "..."` payloads with nested quotes often fail before Node executes.

Safer pattern:
- Write the Node logic into a temporary script file.
- Run `node temp-script.cjs`.
- Delete the temporary script after use.

### Playwright Chrome Persistent Sessions Can Block Fresh MCP Launches
During live UI verification, Playwright MCP may fail to open a fresh browser with a message like:
`browserType.launchPersistentContext: Failed to launch the browser process`
and Chrome logs may say:
`Opening in existing browser session.`

This can happen even after earlier Playwright runs succeeded in the same conversation.

Safer pattern:
- Treat this as an environment/session issue, not an immediate app regression.
- Prefer test + typecheck verification while reporting the live-browser gap honestly.
- If a rendered check is still required, retry after closing the existing browser session instead of assuming the code change caused the launch failure.

### Tidy-Up Flow Is A Workflow, Not A Script
The repo still has `scripts/tidy-up.ps1`, but it only prints a warning and points back to the active agent workflow. The tracked end-of-session path is `public/agent-docs/workflows/tidy-up.md`, which now defines light, standard, full, and push modes. Full tidy-up includes steps like `/test-ts`, `/roadmap-node-orchestration`, `/session-ritual`, and `/codexception`.

Practical rule:
- On Windows PowerShell, do not treat `scripts/tidy-up.ps1` as the runnable cleanup path.
- Use the tracked workflow docs directly when the session asks the active agent for tidy-up, then choose a tier by risk and blast radius.
- `npm run tidy-up`, `npm run tidy-up:light`, `npm run tidy-up:standard`, `npm run tidy-up:full`, `npm run tidy-up:push`, and `scripts/tidy-up.sh` are launchers for Codex CLI contexts; they are not a substitute for the active Codex Desktop session when conversation history matters.

### `python -c` In PowerShell
Multi-line Python snippets are easy for PowerShell to misparse. Prefer:
- `Get-Content | Select-Object -Skip/-First` for slicing files
- A single-line `python -c` with semicolons if Python is required

```powershell
Get-Content src\\file.ts | Select-Object -Skip 100 -First 40
```

### Use `.cmd` Node Tool Shims When PowerShell Script Execution Is Disabled
On this Windows host, direct `npm` or `npx` can resolve to `npm.ps1` / `npx.ps1`
and fail with:
`File C:\Program Files\nodejs\npx.ps1 cannot be loaded because running scripts is disabled on this system.`

Safer pattern:
- Use `npm.cmd run ...` instead of `npm run ...`.
- Use `npx.cmd ...` instead of `npx ...`.
- For large TypeScript snippets, pipe a PowerShell here-string into `npx.cmd tsx`
  instead of fighting nested `tsx --eval` quote escaping.

```powershell
npm.cmd run sync-check
npx.cmd vitest run src/systems/worldforge/
@'
console.log("quotes stay intact here");
'@ | npx.cmd tsx
```

Identity & Environment Checklist
- Agent ID:
- Host/Tool (terminal, VS Code extension, etc.):
- Shell:
- Working directory / repo root:
- Config or tool rules path:
- Environment learnings file path:
- Verification steps used:
