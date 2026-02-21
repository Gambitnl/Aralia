---
description: Execute the "Implicit Rituals" at the end of a session to maintain codebase hygiene.
chain: tidy-up
chain_order: 2
---

> **Part of the tidy-up chain** — called as Step 2 by `scripts/tidy-up.ps1` / `tidy-up.sh`.

This workflow automates the maintenance tasks that should be performed before ending a task or session.

1. **Sync Dependencies**: For every file you have modified, run the visualizer sync command to update the architectural "Stop Signs".
   // turbo
   `npx tsx scripts/codebase-visualizer-server.ts --sync path/to/modified_file.ts`

// TODO: Add an instruction to explicitly verify that the active chat history contains meaningful actions before extracting learnings. If history is brief or empty, gracefully skip to avoid hallucinated additions.
2. **Extract Terminal Learnings**: Capture any new PowerShell quirks or environment-specific fixes discovered during the session.
   Execute the `/extract-terminal-learnings` workflow.

3. **Session Review**: Review the changes made and propose future improvements or cleanup tasks.
   Execute the `/review-session` workflow.

4. **Verify**: Run the pre-completion QA checklist — lint, type-check, build, tests, and red flag scan.
   Execute the `/verify` workflow.

5. **Code Commentary Check**: Verify that all files touched during the session follow the Code Commentary skill standards — file headers, section separators, block-level comments, and debt flagging.
   Reference: `.agent/skills/code_commentary/SKILL.md`

6. **Log Session**: Capture a summary of the session's work to the Development Chronicle. This should run last so it can capture everything above.
   Execute the `/log-session` workflow.
