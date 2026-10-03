---
description: Execute the "Implicit Rituals" at the end of a session to maintain codebase hygiene.
---

This workflow automates the maintenance tasks that should be performed before ending a task or session.

## Scope

For ordinary task completion, apply only the steps relevant to the changed files and
the completion rules in root `AGENTS.md`. Do not launch a tidy-up, full validation
suite, retrospective skill extraction, profile update, or chronicle entry merely
because a focused test completed. Reuse verification already performed this session.
An explicit tidy-up request uses the tidy-up checkpoints below. Existing authorization
and memory-writing restrictions still apply; this workflow does not grant new permission.

Tracked workflow docs live in `public/agent-docs/workflows/`.
The `.agent/workflows/` directory is local-only and ignored by Git; use it only
for local calibration files such as `USER.local.md` and `INTENT-GATE.local.md`.

## Sub-Agent Parallel Contract

Use sub-agents only for independent branches that do not require earlier gates to complete.

1. Keep Steps 1-4 strictly sequential.
2. Steps 5-6 may run in parallel via sub-agents because they are analysis/reporting checkpoints by default.
3. If any Step 5-6 branch discovers required file edits, pause that branch and route the edit decision to the parent agent before continuing.
4. Always rejoin all branches before Step 7 (`/verify`), then run Steps 7-9 sequentially.
5. Parent agent is responsible for the final merged summary block and completion decision.

1. **Sync Dependencies**: For code files covered by root `AGENTS.md` dependency-tracking rules, run the visualizer sync command to update the architectural "Stop Signs". Skip documentation, data, and files already synced after their last change.
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
   - If the session added or updated roadmap nodes, review that workflow's guardrails and failure modes before treating the checkpoint as complete.

4. **User Profile Calibration Checkpoint (Mandatory)**:
   - This checkpoint is required on every tidy-up run.
   - Use `.agent/workflows/USER.local.md` as the local-only source-of-truth user profile file when it exists.
   - If the file is missing, run the checkpoint as `no (profile file absent)` and do not fail tidy-up solely for that absence.
   - Refine the profile only when the session surfaced meaningful signal.
   - Keep the profile concise and distinguish between user reasoning style and project-adjacent philosophy.
   - Do not force questionnaire-style updates just to satisfy the step.
   - Required reporting fields are defined in `public/agent-docs/workflows/user-profile-calibration.md`.

5. **Extract Terminal Learnings**: If the task established a verified, reusable
   PowerShell or environment workaround, consult `/extract-terminal-learnings`.
   Ordinary successful commands do not require a new learning artifact.

6. **Session Review**: Review the task's diff and unresolved gaps. Use `/review-session`
   for an explicit session review or tidy-up; do not invent cleanup work to fill a report.

7. **Verify**: Complete relevant checks under root `AGENTS.md`. For a requested full
   QA pass, consult `public/agent-docs/workflows/verify.md`. Do not repeat passing
   checks unless subsequent changes or new evidence invalidate them.

8. **Code Commentary Check**: Review changed code using
   `.codex/skills/code-commentary/SKILL.md`; documentation-only tasks skip this step.

9. **Log Session**: Use `/log-session` when a chronicle update is requested or required
   by the active handoff. Ordinary completion reports belong in the task response and
   any owning tracker that actually changed status.
