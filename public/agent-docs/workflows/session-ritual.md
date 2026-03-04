---
description: Execute the "Implicit Rituals" at the end of a session to maintain codebase hygiene.
---

This workflow automates the maintenance tasks that should be performed before ending a task or session.

1. **Sync Dependencies**: For every file you have modified, run the visualizer sync command to update the architectural "Stop Signs".
   // turbo
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync path/to/modified_file.ts`

2. **Script Path Migration Sweep**: If any script was moved or renamed, run a reference sweep and patch stale command docs/UI prompts in the same session.
   - Find direct references:
     `rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' 'scripts/(old-name-a|old-name-b)\\.ts' docs public .agent conductor src .github`
   - Include bare-name sweep (helps catch old underscore names):
     `rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' 'old_name_a|old_name_b' docs public .agent conductor src .github`
   - Notes:
     - `docs/architecture/_generated/file-inventory.json` may still show legacy paths when tombstone wrappers intentionally remain.
     - Tombstone wrapper files are expected hits and should not be treated as stale docs.

3. **Roadmap Node Orchestration Checkpoint (Mandatory)**:
   - This checkpoint is required on every tidy-up run.
   - If `/roadmap-node-orchestration` already ran earlier in tidy-up, confirm its report block exists in the final summary and continue.
   - If it did not run, execute `/roadmap-node-orchestration` before continuing.
   - Required reporting fields are defined in `public/agent-docs/workflows/roadmap-node-orchestration.md`.

4. **Extract Terminal Learnings**: Capture any new PowerShell quirks or environment-specific fixes discovered during the session.
   Execute the `/extract-terminal-learnings` workflow.

5. **Session Review**: Review the changes made and propose future improvements or cleanup tasks.
   Execute the `/review-session` workflow.

6. **Verify**: Run the pre-completion QA checklist - lint, type-check, build, tests, and red flag scan.
   Execute the `/verify` workflow.

7. **Code Commentary Check**: Verify that all files touched during the session follow the Code Commentary skill standards.
   Reference: `.agent/skills/code_commentary/SKILL.md`

8. **Log Session**: Capture a summary of the session's work to the Development Chronicle.
   Execute the `/log-session` workflow.
