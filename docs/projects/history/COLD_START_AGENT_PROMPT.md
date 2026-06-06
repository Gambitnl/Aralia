# History System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/history/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: History System
Project folder: docs/projects/history
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/history/NORTH_STAR.md
Tracker: docs/projects/history/TRACKER.md
Gaps: docs/projects/history/GAPS.md

## Previous Agent Handoff

The previous pass refreshed the living project packet and source map. North
Star now carries the dashboard schema plus the producer-to-type matrix, while
G2 remains the active blocker for unwired history types.

## Current Mission

Active task:
T2 - Audit all current world-history producers and map intended event sources against WorldHistoryEventType.

Acceptance criteria:
Use the active TRACKER.md row and the source map in NORTH_STAR.md. Every live
producer touching permanent world history should be mapped to a concrete
WorldHistoryEventType, and any declared type without a producer should be
recorded as a gap or out-of-scope note.

Key files to touch:
- docs/projects/history/NORTH_STAR.md
- docs/projects/history/TRACKER.md
- docs/projects/history/GAPS.md
- docs/projects/history/COLD_START_AGENT_PROMPT.md
- src/types/history.ts
- src/services/WorldHistoryService.ts
- src/systems/world/WorldEventManager.ts
- src/systems/history/HistoryService.ts

Scoped verification:
Re-run the bounded source search for world-history producers, then confirm the
North Star matrix and tracker/gap rows match that evidence. If the change is
observable, collect concise proof in the project docs.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Iteration 1 created the first durable handoff and split workflow rules into
ITERATION_AGENT_WORKFLOW.md. This pass added the dashboard schema and explicit
event-source matrix, and the next agent should continue the producer audit.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
