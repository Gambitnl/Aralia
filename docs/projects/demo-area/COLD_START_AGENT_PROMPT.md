# Demo Area Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/demo-area/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Demo Area
Project folder: docs/projects/demo-area
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/demo-area/NORTH_STAR.md
Tracker: docs/projects/demo-area/TRACKER.md
Gaps: docs/projects/demo-area/GAPS.md

## Previous Agent Handoff

The prior pass refreshed the Demo Area handoff docs, added the dashboard schema
to `NORTH_STAR.md`, and kept the retention decision open. Use
`NORTH_STAR.md` for scope and current state, `TRACKER.md` for the active queue,
and `GAPS.md` for unresolved findings.

## Current Mission

Active task:
T3 - Resolve demo area retention decision

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/demo-area/NORTH_STAR.md
- docs/projects/demo-area/TRACKER.md
- docs/projects/demo-area/GAPS.md
- docs/projects/demo-area/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Demo Area docs were compacted for resume clarity. The active blocker remains the
retention decision for `src/components/demo/CombatMessagingDemo.tsx`.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
