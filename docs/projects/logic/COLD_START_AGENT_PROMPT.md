# Logic System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It does not duplicate the workflow rules. The agent must follow the shared workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/logic/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Logic System
Project folder: docs/projects/logic
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/logic/NORTH_STAR.md
Tracker: docs/projects/logic/TRACKER.md
Gaps: docs/projects/logic/GAPS.md

## Previous Agent Handoff

Iteration 1 refreshed the project doc surface, added the dashboard card schema, and compacted the tracker and gap registry. No non-document files were touched in this pass.

## Current Mission

Active task:
L3 - Prepare implementation decision on where `ConditionEvaluator` is first called.

Acceptance criteria:
Record the first runtime entrypoint choice, the predicate-contract bridge that choice needs, and the canonical status-source decision in the Logic docs before any wiring work starts.

Key files to touch:
- docs/projects/logic/NORTH_STAR.md
- docs/projects/logic/TRACKER.md
- docs/projects/logic/GAPS.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the documented decision record and gap entry as the proof target. If code is touched in the next slice, capture empirical proof before claiming runtime behavior.

Blocking dependencies / do-not-touch:
Stay inside Logic scope boundaries. Route creature-type and spell-schema follow-ups to their owning projects instead of widening this slice.

Recent progress:
North Star now includes the Dashboard Card Schema, the tracker is status-accurate, and the gap registry is compact enough for the next agent to resume without re-deriving current state.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, active task, acceptance criteria, key files, verification method, blockers, and recent progress. End the response with the refreshed handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
