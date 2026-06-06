# UI Primitives Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/ui-primitives/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: UI Primitives
Project folder: docs/projects/ui-primitives
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/ui-primitives/NORTH_STAR.md
Tracker: docs/projects/ui-primitives/TRACKER.md
Gaps: docs/projects/ui-primitives/GAPS.md

## Previous Agent Handoff

The first project packet is now established. This pass refreshed the packet and preserved the current queue. Use
NORTH_STAR.md for project scope and intent, TRACKER.md for the active queue, and
GAPS.md for unresolved findings.

## Current Mission

Active task:
No open task selected. Read TRACKER.md and choose the highest-value open task.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/ui-primitives/NORTH_STAR.md
- docs/projects/ui-primitives/TRACKER.md
- docs/projects/ui-primitives/GAPS.md
- docs/projects/ui-primitives/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Initial handoff file created as part of the living-project cold-start handoff
system split. Workflow rules now live in ITERATION_AGENT_WORKFLOW.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
