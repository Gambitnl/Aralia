# Claude Code (VS Code Extension) - Environment Learnings

## Identity & Environment Checklist
- Agent ID: claude-code-vscode
- Host/Tool (terminal, VS Code extension, etc.): Claude Code running as VS Code extension
- Shell: powershell (Windows)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/; ~/.claude/
- Environment learnings file path: .agent/rules/environment-learnings/claude-code-vscode.md
- Verification steps used: Confirmed platform is win32 from system context; confirmed cwd is F:\Repos\Aralia from system context; confirmed running inside VSCode native extension environment.

## Common Pitfalls

### Getting the current time on Windows
- The Edit/Write tools evaluate content literally - JS expressions like `${new Date()}` will NOT be evaluated.
- To get the current time, use PowerShell:
  ```powershell
  powershell -Command "Get-Date -Format 'HH:mm'"
  ```
- Then hardcode the returned value into the file content.

### Windows Bash commands
- `echo %TIME%` style Windows batch syntax does not work in all shell contexts. Prefer PowerShell `Get-Date`.
