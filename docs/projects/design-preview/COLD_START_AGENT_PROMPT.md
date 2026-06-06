# Design Preview Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared
workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/design-preview/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Design Preview
Project folder: docs/projects/design-preview
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/design-preview/NORTH_STAR.md
Tracker: docs/projects/design-preview/TRACKER.md
Gaps: docs/projects/design-preview/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project handoff skeleton. This pass added the
Dashboard Card Schema, refreshed the tracker and gap rows, and kept the active
objective visible for the next cold-start agent.

## Current Mission

Active task:
T2 - Capture design workflow and owners in a durable place

Acceptance criteria:
Use the active TRACKER.md row and the Dashboard Card Schema in NORTH_STAR.md
to keep the workflow, provisional owners, open questions, and next checks
explicit. If a required owner map or check path is still missing, record it as
a gap instead of guessing.

Key files to touch:
- docs/projects/design-preview/NORTH_STAR.md
- docs/projects/design-preview/TRACKER.md
- docs/projects/design-preview/GAPS.md
- docs/projects/design-preview/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this docs pass, `docs_consistency` is the minimum check.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Dashboard Card Schema is explicit in NORTH_STAR.md. Workflow and owner notes
are documented, but G1 still tracks the unresolved steward map and G2 still
tracks the missing launch/checklist runbook.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
