# NORTHSTAR: Scripts: Tooling Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-tooling/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Tooling
Project folder: docs/projects/scripts-tooling
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-tooling/NORTH_STAR.md
Tracker: docs/projects/scripts-tooling/TRACKER.md
Gaps: docs/projects/scripts-tooling/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project docs baseline. This pass refreshed the
North Star dashboard card schema, the tracker queue, and the cold-start handoff
so the next agent starts from current state rather than stale prose. Use
NORTH_STAR.md for project scope and intent, TRACKER.md for the active queue, and
GAPS.md for unresolved findings.

## Current Mission

Active task:
ST-2 remains the highest-value open task. Read TRACKER.md and decide whether
`trackRun()` adoption should expand or remain intentionally selective.

Acceptance criteria:
Use the active TRACKER.md row and the Dashboard Card Schema in NORTH_STAR.md.
If the active task lacks acceptance criteria, define scoped criteria before
implementation and record that documentation gap.

Key files to touch:
- docs/projects/scripts-tooling/NORTH_STAR.md
- docs/projects/scripts-tooling/TRACKER.md
- docs/projects/scripts-tooling/GAPS.md
- docs/projects/scripts-tooling/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof. Current doc-state proof is
`git diff --check` plus the updated schema fields in NORTH_STAR.md.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now carries a dashboard card schema, the tracker surfaces the open
ST-2 decision point, and GAPS notes that no new project-local gaps were added in
this pass. The shared-path ambiguity remains centralized in
WORKFLOW_GAPS.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
