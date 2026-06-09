# World 3D System Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/world3d/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: World 3D System
Project folder: docs/projects/world3d
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/world3d/NORTH_STAR.md
Tracker: docs/projects/world3d/TRACKER.md
Gaps: docs/projects/world3d/GAPS.md

## Previous Agent Handoff

The first project packet was established earlier. This pass closed W3D-G19 (town footprint scale) and refreshed the packet.
Use NORTH_STAR.md for scope and intent, TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T15 (W3D-G23) and T16 (W3D-G24) are complete. Next active task is T9 (W3D-G12): biome-color seam blending.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.
This iteration validated T15/T16 by confirming visible road-width variation by type and scoped polyline work clipping by chunk AABB before geometry clipping, with no regression to existing chunk behavior.

Key files to touch:
- docs/projects/world3d/NORTH_STAR.md
- docs/projects/world3d/TRACKER.md
- docs/projects/world3d/GAPS.md
- docs/projects/world3d/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
T15 (road-width mapping) and T16 (pre-filtered polyline clipping) are complete in code and docs. T14 also complete in docs (`siteGeometry` radius is now bounded by kind/population; no active `MAX_RADIUS_M` cap dependence). Workflow rules remain in ITERATION_AGENT_WORKFLOW.md.

Key files to touch:
- docs/projects/world3d/NORTH_STAR.md
- docs/projects/world3d/TRACKER.md
- docs/projects/world3d/GAPS.md
- docs/projects/world3d/COLD_START_AGENT_PROMPT.md
- docs/projects/world3d/DECISIONS.md
- docs/projects/world3d/AUDIT_OR_PROOF.md
- docs/projects/world3d/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- <source/docs named by the active tracker task>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.

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
