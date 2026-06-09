# Command Factory Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-06

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/command-factory-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Command Factory Runtime
Project folder: docs/projects/command-factory-runtime
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/command-factory-runtime/NORTH_STAR.md
Tracker: docs/projects/command-factory-runtime/TRACKER.md
Gaps: docs/projects/command-factory-runtime/GAPS.md

## Iteration Ledger

| Iteration | Agent / model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

## Previous Handoff

Iteration 2 kept the Command Factory Runtime docs source-anchored and then
advanced one concrete gap: `AbilityCommandFactory` now calls
`TargetValidationUtils.matchesFilter(...)` directly, while
`SpellCommandFactory.matchesFilter(...)` remains only as a legacy wrapper for
spell callers.

## Current Mission

Active task:
T2 - Monitor drift after source edits and keep gaps updated

Acceptance criteria:
Keep the dashboard card schema current, preserve the source-anchored file map,
and record any new project blocker or scope drift in `GAPS.md`.

Key files to touch:
- docs/projects/command-factory-runtime/NORTH_STAR.md
- docs/projects/command-factory-runtime/TRACKER.md
- docs/projects/command-factory-runtime/GAPS.md
- docs/projects/command-factory-runtime/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by `TRACKER.md` or
`NORTH_STAR.md`. For this slice, the focused factory tests and a call-site
search confirmed the shared validator path.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
`AbilityCommandFactory` now uses the shared target validator directly, the
gap log was updated to show G2 as a lower-risk follow-up, and the focused
factory tests passed.

Workflow-gap review result:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read
and left unchanged; WFG-001 still applies but did not change the safety of
this iteration.

Dashboard schema updates:
`NORTH_STAR.md` and `TRACKER.md` were refreshed with the new date, proof
status, and source-backed note about the shared validator path.

Optional docs:
`DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` are not present for this
project yet, so they were not needed this iteration.

Next safe resume path:
Re-check `src/commands/factory` and `src/hooks/useAbilitySystem.ts` after the
next source edit, then close G2 only if the legacy wrapper loses its last
caller.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---
