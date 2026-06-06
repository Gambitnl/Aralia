# NORTHSTAR: Scripts: Workflows Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-workflows/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Workflows
Project folder: docs/projects/scripts-workflows
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-workflows/NORTH_STAR.md
Tracker: docs/projects/scripts-workflows/TRACKER.md
Gaps: docs/projects/scripts-workflows/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project packet for `scripts-workflows`.
Use `NORTH_STAR.md` for scope and intent, `TRACKER.md` for the active queue,
and `GAPS.md` for the durable docs gaps.

## Current Mission

Active task:
Continue with `TRACKER.md` row T3: canonical command matrix consolidation.

Acceptance criteria:
`NORTH_STAR.md` carries the dashboard schema, `TRACKER.md` exposes the open
command/env-var queue, `GAPS.md` stays compact and actionable, and the shared
workflow-path ambiguity stays in `WORKFLOW_GAPS.md` instead of being duplicated
here.

Key files to touch:
- docs/projects/scripts-workflows/NORTH_STAR.md
- docs/projects/scripts-workflows/TRACKER.md
- docs/projects/scripts-workflows/GAPS.md
- docs/projects/scripts-workflows/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md if the workflow gap needs a new testimony

Scoped verification:
Use `Get-Content` against the touched docs. Only check the registry row if the
dashboard card drifts. This is a docs-only pass; do not run code verification
unless the user explicitly asks.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. The shared workflow path mismatch is already
tracked in `WORKFLOW_GAPS.md`; do not re-open it as a project-local gap.

Recent progress:
The North Star schema is explicit, the tracker keeps T3/T4 queued, the gap
file is trimmed back to the real project gaps, and `WORKFLOW_GAPS.md` was read
but left unchanged because the stale-path ambiguity is already tracked.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
