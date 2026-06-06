# Compass Pane Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/compass-pane/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Compass Pane
Project folder: docs/projects/compass-pane
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/compass-pane/NORTH_STAR.md
Tracker: docs/projects/compass-pane/TRACKER.md
Gaps: docs/projects/compass-pane/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial project handoff. This pass refreshed the North
Star dashboard schema, brought the tracker dates current, and clarified the
stale README note in GAPS so the next agent can resume without re-deriving the
documentation state.

## Current Mission

Active task:
T2 - Validate movement/action surface for Compass Pane end-to-end

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria already implied by the
North Star and gap log: confirm direction dispatch, `look_around`, and `wait`
behavior with focused proof. If implementation work begins and the task still
lacks a scoped check, record that documentation gap before widening scope.

Key files to touch:
- docs/projects/compass-pane/NORTH_STAR.md
- docs/projects/compass-pane/TRACKER.md
- docs/projects/compass-pane/GAPS.md
- docs/projects/compass-pane/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof. This pass did not run code
verification; the next agent should do that before closing T2.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has a Dashboard Card Schema, the tracker dates are current, and
the README-staleness gap is recorded in the project gap log. The resume path
points back to T2.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
