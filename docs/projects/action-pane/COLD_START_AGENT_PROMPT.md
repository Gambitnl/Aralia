# Action Pane Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/action-pane/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Action Pane
Project folder: docs/projects/action-pane
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/action-pane/NORTH_STAR.md
Tracker: docs/projects/action-pane/TRACKER.md
Gaps: docs/projects/action-pane/GAPS.md

## Previous Agent Handoff

Iteration 1 created the first cold-start packet and established the living
project doc set. This pass refreshed the dashboard schema and resume metadata
without changing runtime code.

## Current Mission

Active task:
T2 - Confirm full ActionPane action contract coverage against runtime handlers

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/action-pane/NORTH_STAR.md
- docs/projects/action-pane/TRACKER.md
- docs/projects/action-pane/GAPS.md
- docs/projects/action-pane/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
NORTH_STAR.md now has a Dashboard Card Schema section, the tracker dates
are current, and the open Action Pane gaps still point at contract coverage,
prop contract cleanup, and move.targetId normalization.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.

## Resume Reminder

Start with TRACKER.md, then GAPS.md, then the runtime contract surfaces in
NORTH_STAR.md before changing behavior. Keep the next pass on T2 unless a
real blocker or new evidence changes the queue.
---END NEXT AGENT HANDOFF---
