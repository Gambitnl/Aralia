# Dice Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared
workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/dice/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Dice
Project folder: docs/projects/dice
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/dice/NORTH_STAR.md
Tracker: docs/projects/dice/TRACKER.md
Gaps: docs/projects/dice/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial Dice handoff packet and established the current
doc set. This refresh adds the dashboard schema and aligns the active task with
the current project gaps.

## Current Mission

Active task:
D-2 - Add deterministic RNG + roll history plan

Acceptance criteria:
- Define one deterministic roll policy that covers silent and visual Dice paths.
- Decide the roll-history scope: session-only, persisted, or export-only.
- Record any unresolved project blocker in `GAPS.md` before implementation starts.

Key files to touch:
- docs/projects/dice/NORTH_STAR.md
- docs/projects/dice/TRACKER.md
- docs/projects/dice/GAPS.md
- docs/projects/dice/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this planning slice, keep verification docs-only unless the task moves into
runtime changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes the dashboard card schema and the current resume
target. Tracker and gaps were refreshed to match the active D-2 planning
slice. No new project-specific blocker was discovered in this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
