# Environment System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/environment/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Environment System
Project folder: docs/projects/environment
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/environment/NORTH_STAR.md
Tracker: docs/projects/environment/TRACKER.md
Gaps: docs/projects/environment/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project doc set and identified the current
determinism and runtime-coupling gaps. This pass refreshed the dashboard schema
and tightened the resume path so the next agent can start from `G1` without
rebuilding context.

## Current Mission

Active task:
T3 - Begin the first runtime slice by wiring weather progression from `G1`
into a real runtime call path.

Acceptance criteria:
Use the active `TRACKER.md` row and `G1` in `GAPS.md`. If the runtime slice
lacks a precise scheduler boundary, define one before implementation and record
that decision in the tracker or gap log.

Key files to touch:
- `src/systems/environment/WeatherSystem.ts`
- `src/state/reducers/worldReducer.ts`
- `src/systems/world/WorldEventManager.ts`
- `src/state/reducers/navalReducer.ts`
- `docs/projects/environment/GAPS.md`

Scoped verification:
Use the proof named by `G1` or the nearest runtime evidence source named in the
tracker/North Star. If the change is observable, collect empirical proof; if
not, keep the task open and record the missing check.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has the dashboard card schema. Tracker points directly at the
first runtime slice, and the gap registry still names the known blockers in the
same order.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
