# Combat System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/combat/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Combat System
Project folder: docs/projects/combat
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/combat/NORTH_STAR.md
Tracker: docs/projects/combat/TRACKER.md
Gaps: docs/projects/combat/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial Combat living-project packet. This pass
refreshed the durable docs, added the dashboard schema, and selected G11 as
the active combat resume slice.

## Current Mission

Active task:
G11 - Class feature generation gap in `src/utils/combat/combatUtils.ts`.

Acceptance criteria:
Add the missing class-specific combat ability generation, then verify the
target classes named in G11. Minimum proof is that monk gains Flurry of Blows
and warlock gains Pact features in the combat palette.

Key files to touch:
- docs/projects/combat/NORTH_STAR.md
- docs/projects/combat/TRACKER.md
- docs/projects/combat/GAPS.md
- src/utils/combat/combatUtils.ts
- related combat tests under `src/utils/combat/**/__tests__` or neighboring
  combat test surfaces

Scoped verification:
Run the focused combat unit tests or equivalent proof named by the tracker
row. If the active slice changes, update the tracker before doing
implementation work.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Combat docs now include the Dashboard Card Schema, the North Star scope
explicitly includes `src/utils/combat/*`, and G11 is marked active in both
TRACKER.md and GAPS.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
