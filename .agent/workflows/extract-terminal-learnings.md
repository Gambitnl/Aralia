---
description: Extract and implement environment learnings from current session into the correct agent file
chain: tidy-up
chain_via: session-ritual
---

1. Confirm the agent's identity and environment before extracting learnings.
    - Verify which agent is active (examples: Codex-CLI in terminal, VS Code extension, AntiGravity extension, etc.). Do not assume the examples are the only possibilities.
    - Check the current shell, working directory, and the agent-specific config/tool rules that apply.
    - Each agent should have its own environment learnings file (do not assume `.agent/rules/Terminal.md` is the correct endpoint).
    - Determine the correct environment learnings file for this agent before editing.
    - Recommended naming convention: `.agent/rules/environment-learnings/<agent-id>.md`.
    - Example agent IDs: `codex-cli-terminal`, `codex-vscode`, `codex-antigravity`.
    - If the repo already uses a different convention, follow it and record the path in the "Agent Identity & Environment" note.
    - If identity or environment is uncertain, ask the user to clarify and do not edit files.
    - After verification, add or update a short "Agent Identity & Environment" note in the agent's environment learnings file so future sessions can confirm they are in the correct context before applying changes.
2. Analyze the current conversation history for any tool calls involving `functions.exec_command`, `functions.write_stdin`, or other CLI interactions.
3. Identify:
    - Errors encountered (e.g., PowerShell syntax, quoting issues, path errors).
    - Successful workarounds or optimized commands used.
    - Specific Windows/VS Code environment quirks.
4. Update the verified agent environment learnings file with these new insights.
    - Ensure logical categorization (Common Errors, PowerShell Caveats, etc.).
    - Use code blocks for examples.
5. If no new learnings are found, inform the user concisely and do not edit any learnings file.

Identity & Environment Checklist (Appendix)
- Purpose: Make identity and target file selection explicit and auditable for each agent session.
- Deterministic identification guidance (use before editing any learnings file):
    - Prefer observable signals over assumptions.
    - Confirm the host/tool by inspecting UI/runtime context (terminal title, extension name, or explicit user-provided environment context).
    - Confirm shell by running a lightweight command (e.g., `Get-Host` in PowerShell) when allowed.
    - Confirm repo root by checking the working directory and presence of `AGENTS.md`.
    - Locate the correct config/tool rules path for that agent and record it.
    - Only proceed after at least two independent signals agree (e.g., shell + cwd, or extension + config path).
    - Record the verification steps in the checklist to make the reasoning auditable.
- Instruction: When you fill in the blank template, leave a new empty copy at the end so the next agent has a fresh checklist.
- Verified reference entry (Codex-CLI terminal in this repo; do not assume this is your session):
```markdown
Identity & Environment Checklist
- Agent ID: codex-cli-terminal
- Host/Tool (terminal, VS Code extension, etc.): Codex-CLI in VS Code terminal
- Shell: powershell
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/
- Environment learnings file path: .agent/rules/environment-learnings/codex-cli-terminal.md
- Verification steps used: confirmed cwd and shell from environment context; validated AGENTS.md exists via Test-Path
```
- Verified entry (Claude Code VS Code extension):
```markdown
Identity & Environment Checklist
- Agent ID: claude-code-vscode
- Host/Tool (terminal, VS Code extension, etc.): Claude Code running as VS Code native extension
- Shell: powershell (Windows)
- Working directory / repo root: F:\Repos\Aralia
- Config or tool rules path: AGENTS.md; .agent/rules/; ~/.claude/
- Environment learnings file path: .agent/rules/environment-learnings/claude-code-vscode.md
- Verification steps used: confirmed platform is win32 from system context; confirmed running inside VSCode native extension environment from system context; confirmed cwd is F:\Repos\Aralia from system context.
```
- Blank template (keep one empty copy for the next agent):
```markdown
Identity & Environment Checklist
- Agent ID:
- Host/Tool (terminal, VS Code extension, etc.):
- Shell:
- Working directory / repo root:
- Config or tool rules path:
- Environment learnings file path:
- Verification steps used:
```
