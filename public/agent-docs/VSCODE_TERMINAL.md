# VSCODE Terminal (Codex CLI)

## Overview
This agent runs as **Codex CLI** inside the **VS Code integrated terminal** on Windows (PowerShell).
In this repo, Codex CLI follows the root `AGENTS.md` for environment and workflow guidance.

## Instruction Source
- Primary: [AGENTS.md](AGENTS.md)
- No `CODEX.md` is present in this repository.

## Environment Snapshot
- Shell: PowerShell (`powershell -NoLogo -Command`)
- Location: VS Code integrated terminal
- Agent name: `codex-cli`

## Available Codex Skills (local)
These skills live in `.codex/skills/` and are available to this agent:

- **codex-cli-slash-commands-blocked**: Workaround when Codex CLI blocks `/conductor:*` commands.
- **codexception**: Capture and codify new discoveries into reusable skills.
- **conductor-command-workaround**: Non-slash bridge for Conductor commands (compact output).
- **node-spawn-einval-cmd-windows**: Fix `spawn EINVAL` for `.cmd/.bat` by wrapping with `cmd.exe /c`.
- **powershell-var-assignment-stripped**: Avoid `$var =` in inline `-Command` strings; use literals or temp scripts.

## IDE Labels
- **VSCode Terminal**: This agent (Codex CLI).
- **VSCode IDE**: Codex as a VS Code extension (separate surface, not used here).
