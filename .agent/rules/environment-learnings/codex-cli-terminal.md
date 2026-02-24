Identity & Environment Checklist
- Agent ID: codex-cli-terminal
- Host/Tool (terminal, VS Code extension, etc.): Codex-CLI in VS Code terminal
- Shell: powershell (Windows PowerShell 5.1)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/
- Environment learnings file path: .agent/rules/environment-learnings/codex-cli-terminal.md
- Verification steps used: confirmed cwd/shell via session context; validated AGENTS.md exists via Test-Path; confirmed PowerShell host via Get-Host

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

### `python -c` In PowerShell
Multi-line Python snippets are easy for PowerShell to misparse. Prefer:
- `Get-Content | Select-Object -Skip/-First` for slicing files
- A single-line `python -c` with semicolons if Python is required

```powershell
Get-Content src\\file.ts | Select-Object -Skip 100 -First 40
```

Identity & Environment Checklist
- Agent ID:
- Host/Tool (terminal, VS Code extension, etc.):
- Shell:
- Working directory / repo root:
- Config or tool rules path:
- Environment learnings file path:
- Verification steps used:
