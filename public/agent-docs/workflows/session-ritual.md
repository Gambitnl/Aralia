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

3. **Update Roadmap State (Mandatory Checkpoint)**: Perform a roadmap update pass before ending the ritual.
   - This checkpoint is required on every tidy-up run.
   - If no roadmap-visible changes happened, still record an explicit "N/A" result.
   - Do a full roadmap update when changed files touch:
     - `scripts/roadmap-engine/**`
     - `src/components/debug/roadmap/**`
     - `misc/roadmap_docs.html`
     - `misc/dev_hub.html`
     - `docs/tasks/roadmap/**`
     - `.agent/roadmap-local/**` (except temporary run artifacts that do not affect roadmap state)
   - Required outcomes when triggered:
     - Refresh roadmap-facing status/naming text so shipped work is not left as planned.
     - Confirm roadmap docs/evidence links still resolve after file changes.
     - Refresh high-level roadmap docs language when capability or workflow behavior changed.
   - Required reporting block in tidy-up summary:
     - `Roadmap Update: yes|no (with reason)`
     - `Roadmap Files Reviewed: <paths>`
     - `Roadmap Files Updated: <paths or none>`
     - `Status/Naming Corrections Applied: <list or none>`
     - `Open Follow-ups: <list or none>`

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
