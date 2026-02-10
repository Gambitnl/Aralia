# Claude Code (Qoder IDE Extension) - Environment Learnings

## Identity & Environment Checklist
- Agent ID: claude-code-qoder
- Host/Tool (terminal, VS Code extension, etc.): Claude Code running as Qoder IDE extension
- Shell: powershell (Windows)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/; ~/.claude/
- Environment learnings file path: .agent/rules/environment-learnings/claude-code-qoder.md
- Verification steps used: User explicitly stated "you are currently in the Qoder IDE as an extension"; confirmed platform is win32 from system context; confirmed cwd is F:\Repos\Aralia.

## Session Learnings (2026-02-10)

### Vitest 4.x Runner Initialization
- Vitest 4.0's Module Runner resolves `import { afterEach } from 'vitest'` in setup files before the runner is initialized.
- When `globals: true` is set, lifecycle hooks are injected as globals — no import needed.
- Removing the explicit import fixed "Vitest failed to find the runner" for the entire test suite.
- See skill: `vitest4-setup-file-globals` for full details.

### Bash Quoting on Windows
- Bash tool does not support Windows-style backslash-escaped double quotes in `ls` paths.
- Use forward slashes: `ls "C:/Users/Gambit/.claude/skills/"` not `ls "C:\Users\Gambit\.claude\skills\"`.
