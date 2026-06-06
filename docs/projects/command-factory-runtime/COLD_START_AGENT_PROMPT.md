# NORTHSTAR: Command Factory Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/command-factory-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Command Factory Runtime
Project folder: docs/projects/command-factory-runtime
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/command-factory-runtime/NORTH_STAR.md
Tracker: docs/projects/command-factory-runtime/TRACKER.md
Gaps: docs/projects/command-factory-runtime/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project handoff files and refreshed the North Star
with a dashboard card schema. The project now has a compact resume path and a
clear open-gap queue. Use `NORTH_STAR.md` for scope and intent, `TRACKER.md`
for the active queue, and `GAPS.md` for unresolved findings.

## Current Mission

Active task:
T2 - Monitor drift after source edits and keep gaps updated

Acceptance criteria:
Use the active `TRACKER.md` row and the acceptance criteria listed in
`NORTH_STAR.md`. Keep the dashboard card schema current, preserve the source-
anchored file map, and record any new project blocker in `GAPS.md`.

Key files to touch:
- docs/projects/command-factory-runtime/NORTH_STAR.md
- docs/projects/command-factory-runtime/TRACKER.md
- docs/projects/command-factory-runtime/GAPS.md
- docs/projects/command-factory-runtime/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by `TRACKER.md` or
`NORTH_STAR.md`. If none is named, add one before claiming the task is done.
If the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
`NORTH_STAR.md` now has a dashboard card schema and the tracker/gap dates are
synced to the latest cold-start pass. No project-specific blocker was added in
this iteration.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
