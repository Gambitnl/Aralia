# 3D Combat Map Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/3d-combat-map/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: 3D Combat Map
Project folder: docs/projects/3d-combat-map
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/3d-combat-map/NORTH_STAR.md
Tracker: docs/projects/3d-combat-map/TRACKER.md
Gaps: docs/projects/3d-combat-map/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project handoff, but the dashboard schema
was still missing from the North Star and the MVP gate was not yet surfaced as
a compact acceptance section. Use NORTH_STAR.md for project scope and intent,
TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T4 - Add next-check list for future slices.

Acceptance criteria:
Use the active TRACKER.md row. Add one explicit visual smoke check and one
integration check, and keep them evidence-backed in the tracker or a durable
proof note.

Key files to touch:
- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Docs-only refresh. Use the verification command or evidence source named by
TRACKER.md or NORTH_STAR.md if the active row requires one. If none is named,
add one before claiming the task is done. If the change is observable, collect
empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes a Dashboard Card Schema section and explicit MVP
acceptance criteria. T2 and T3 are marked done in the tracker. G1 is closed in
GAPS; G2 through G5 remain open and still need implementation follow-up.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
