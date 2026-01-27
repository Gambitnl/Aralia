---
description: Execute the "Implicit Rituals" at the end of a session to maintain codebase hygiene.
---

This workflow automates the maintenance tasks that should be performed before ending a task or session.

1. **Sync Dependencies**: For every file you have modified, run the visualizer sync command to update the architectural "Stop Signs".
   // turbo
   `npx tsx scripts/codebase-visualizer-server.ts --sync path/to/modified_file.ts`

2. **Extract Terminal Learnings**: Capture any new PowerShell quirks or environment-specific fixes discovered during the session.
   Execute the `/extract-terminal-learnings` workflow.

3. **Session Review**: Review the changes made and propose future improvements or cleanup tasks.
   Execute the `/review-session` workflow.

4. **Update Handover Docs**: If significant architectural changes were made, ensure `AGENTS.md` is updated with the latest context for the next agent.
