# Crime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/crime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crime
Project folder: docs/projects/crime
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/crime/NORTH_STAR.md
Tracker: docs/projects/crime/TRACKER.md
Gaps: docs/projects/crime/GAPS.md

## Previous Agent Handoff

Iteration 1 established the Crime living-project doc set and left T3 unresolved.
Use NORTH_STAR.md for project scope and intent, TRACKER.md for the active
queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T3 - Resolve the in-scope Crime gap set, starting with G1 expired bounty
cleanup.

Acceptance criteria:
Use the T3 row in TRACKER.md and the open entries in GAPS.md. If the selected
gap lacks testable acceptance criteria, define them before implementation and
record the gap note.

Key files to touch:
- docs/projects/crime/NORTH_STAR.md
- docs/projects/crime/TRACKER.md
- docs/projects/crime/GAPS.md
- docs/projects/crime/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Crime now has a compact North Star front matter block with a dashboard schema
and resume path. TRACKER.md now points the next agent at T3 and the GAPS file
remains the authoritative blocker list.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
