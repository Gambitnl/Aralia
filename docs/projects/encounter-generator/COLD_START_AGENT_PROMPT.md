# Encounter Generator Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/encounter-generator/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Encounter Generator
Project folder: docs/projects/encounter-generator
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/encounter-generator/NORTH_STAR.md
Tracker: docs/projects/encounter-generator/TRACKER.md
Gaps: docs/projects/encounter-generator/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project handoff scaffold, the active tracker queue,
and the first durable gap set. Use NORTH_STAR.md for project scope and intent,
TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T2 - Track implemented state and integration points for cold-start handoff

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria listed in
NORTH_STAR.md. Keep the handoff compact, current, and sufficient for a cold-start
resume. If the active task lacks acceptance criteria, define scoped criteria
before implementation and record that documentation gap.

Key files to touch:
- docs/projects/encounter-generator/NORTH_STAR.md
- docs/projects/encounter-generator/TRACKER.md
- docs/projects/encounter-generator/GAPS.md
- docs/projects/encounter-generator/COLD_START_AGENT_PROMPT.md

Scoped verification:
Use the docs-consistency evidence in NORTH_STAR.md and TRACKER.md. If the next
iteration adds code work, switch to the verification named by TRACKER.md or
NORTH_STAR.md before claiming completion.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes the Dashboard Card Schema. The tracker and gap dates
have been refreshed. The open project issues remain seedability, difficulty
policy, and EncounterGenerator scope naming.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
