# Puzzles System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/puzzles/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Puzzles System
Project folder: docs/projects/puzzles
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/puzzles/NORTH_STAR.md
Tracker: docs/projects/puzzles/TRACKER.md
Gaps: docs/projects/puzzles/GAPS.md

## Previous Agent Handoff

Iteration 1 established the first cold-start pack for the puzzles project and
proved the runtime surface is broader than lockpicking alone. This pass kept
the handoff current, added the dashboard schema, and pointed the next agent at
the first production lockpicking entry slice. Use NORTH_STAR.md for project
scope and intent, TRACKER.md for the active queue, and GAPS.md for unresolved
findings.

## Current Mission

Active task:
T2 in TRACKER.md: implement the first production lockpicking dispatch path
from a real world encounter.

Acceptance criteria:
Use the active TRACKER.md row and the Active Task section in NORTH_STAR.md. The
slice is complete when a non-dev callsite can reach OPEN_LOCKPICKING_MODAL, or
the blocker is documented in GAPS.md with a next action.

Key files to touch:
- docs/projects/puzzles/NORTH_STAR.md
- docs/projects/puzzles/TRACKER.md
- docs/projects/puzzles/GAPS.md
- docs/projects/puzzles/COLD_START_AGENT_PROMPT.md
- src/App.tsx
- src/state/actionTypes.ts
- src/components/layout/GameModals.tsx
- src/systems/puzzles/lockSystem.ts
- Any source/docs named by the active tracker task

Scoped verification:
Use a source scan and one non-dev evidence path for the lock entry, or record
an explicit blocker with evidence if the path is not available yet.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Dashboard Card Schema is now present in NORTH_STAR.md. Tracker and gaps are
compact again, and the next implementation slice is clearly routed to PZ-001.
The shared workflow-gap file was reviewed; one cross-project path-clarity issue
was logged there instead of burying it in project-local docs.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
