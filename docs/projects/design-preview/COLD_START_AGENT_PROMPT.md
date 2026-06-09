# Design Preview Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for
the next cold-start agent. It does not duplicate the full workflow rules. The
agent must follow the shared workflow file and use this file for current
project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/design-preview/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Design Preview
Project folder: docs/projects/design-preview
Iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/design-preview/NORTH_STAR.md
Tracker: docs/projects/design-preview/TRACKER.md
Gaps: docs/projects/design-preview/GAPS.md
Runbook: docs/projects/design-preview/RUNBOOK.md
Audit/proof: docs/projects/design-preview/AUDIT_OR_PROOF.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Gemini CLI | CLI agent | certain | 2026-06-08 | T2 closure, self-contained workflow update |

## Previous Agent Handoff

Iteration 5 updated `NORTH_STAR.md` to include a fully self-contained workflow loop for cold-start agents, allowing them to bypass reading the generic shared protocol. It closed task T2 and updated `TRACKER.md` to reflect that all tracked implementation and workflow capture tasks are complete.

## Current Mission

Active task:
None.

Acceptance criteria:
The project is currently in a steady state. The next agent should focus on resolving G3 (assigning stable local owners for lanes) or awaiting new feature requests. Maintain doc consistency if addressing G3.

Key files to touch:
- docs/projects/design-preview/NORTH_STAR.md
- docs/projects/design-preview/TRACKER.md
- docs/projects/design-preview/GAPS.md
- docs/projects/design-preview/COLD_START_AGENT_PROMPT.md
- docs/projects/design-preview/RUNBOOK.md
- docs/projects/design-preview/AUDIT_OR_PROOF.md

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
- `git diff --check` for all touched files, including any new file.
- Visual checks using `RUNBOOK.md` if any runtime or styling features are added.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not implement large new lanes without a registered task or explicitly updating the scope in `NORTH_STAR.md`.

Recent progress:
T2 is closed. A self-contained cold-start resume path exists in `NORTH_STAR.md`. The manual launch and smoke checklist is maintained in `RUNBOOK.md`. G1 and G3 remain open, waiting for domain owner decisions.

Workflow gaps reviewed:
Checked `WORKFLOW_GAPS.md` and `GLOBAL_GAPS.md`. No new workflow-level gaps were found affecting this state. 

Dashboard schema updates:
`gap_signal` is still 3 open gaps. `next_step` changed to indicate G3 is the primary candidate for future work.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Account for every required doc, mention optional docs
touched or skipped, update `agent_comments` only when an out-of-flow note is
useful, and keep only the current handoff between the same BEGIN/END markers;
do not preserve old handoff transcripts in this file.

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
