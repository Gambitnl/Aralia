# Events System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/events/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Events System
Project folder: docs/projects/events
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/events/NORTH_STAR.md
Tracker: docs/projects/events/TRACKER.md
Gaps: docs/projects/events/GAPS.md

## Previous Agent Handoff

Iteration 1 was a docs-only living-project refresh. It updated the Events
North Star with the dashboard card schema, rechecked the tracker and gap set,
and kept the active objective unchanged. Use NORTH_STAR.md for project scope
and intent, TRACKER.md for the active queue, and GAPS.md for unresolved
findings.

## Current Mission

Active task:
T2 - Define and document replay/scheduling gaps for src/systems/events and adjacent combat event lanes.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/events/NORTH_STAR.md
- docs/projects/events/TRACKER.md
- docs/projects/events/GAPS.md
- docs/projects/events/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes the Dashboard Card Schema section required by the
shared project-card schema.
TRACKER.md and GAPS.md still carry the five evidence-backed replay/scheduling
gaps for event priority, dispatch ordering, replay persistence, lane split, and
hit/crit fidelity.
The bounded gap sweep also reviewed docs/projects/GLOBAL_GAPS.md and
WORKFLOW_GAPS.md; no new project-specific or workflow-level gaps were added.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
