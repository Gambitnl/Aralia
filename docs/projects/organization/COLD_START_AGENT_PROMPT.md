# Organization Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/organization/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Organization
Project folder: docs/projects/organization
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/organization/NORTH_STAR.md
Tracker: docs/projects/organization/TRACKER.md
Gaps: docs/projects/organization/GAPS.md

## Previous Agent Handoff

Iteration 2 refreshed the dashboard schema, kept the tracker and gap dates in
sync, and confirmed the current blocker set still centers on permissions,
persistence, identity, faction, and succession transfer.

## Current Mission

Active task:
T2 - Capture concrete integration debt for organization slice before implementation

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/organization/NORTH_STAR.md
- docs/projects/organization/TRACKER.md
- docs/projects/organization/GAPS.md
- docs/projects/organization/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes explicit acceptance criteria for T2, the dashboard card
schema is current, and the five-gap surface still describes the resume path for
the next implementation slice. No workflow-level ambiguity was found in this
pass, and the active objective remains unchanged.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
