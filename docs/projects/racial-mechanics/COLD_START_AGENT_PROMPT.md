# Racial Mechanics / Race Hierarchy Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/racial-mechanics/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Racial Mechanics / Race Hierarchy
Project folder: docs/projects/racial-mechanics
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/racial-mechanics/NORTH_STAR.md
Tracker: docs/projects/racial-mechanics/TRACKER.md
Gaps: docs/projects/racial-mechanics/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project doc set and the baseline queue.
This iteration refreshed the dashboard schema, aligned the tracker with the
gap log, and recorded one workflow-level ambiguity in the shared workflow-gap
register. Use NORTH_STAR.md for project scope and intent, TRACKER.md for the
active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
RM-032 - inscopenow

Acceptance criteria:
Use the active TRACKER.md row and the current state notes in NORTH_STAR.md.
The next implementation slice is complete only when Character Creator surfaces
every required race-granted choice step without skipping any required
selection path. If a choice family lacks explicit acceptance criteria, define
the scoped criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/racial-mechanics/NORTH_STAR.md
- docs/projects/racial-mechanics/TRACKER.md
- docs/projects/racial-mechanics/GAPS.md
- docs/projects/racial-mechanics/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this docs-only pass, verify by checking the project docs for consistency and
the workflow-gap entry for the path ambiguity.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. Do not touch runtime code in this iteration.

Recent progress:
Dashboard schema added to NORTH_STAR.md, tracker/gap status aligned,
RM-LR-CHOICE-001 moved into completed context in the tracker, and one shared
workflow ambiguity was recorded for the canonical workflow-path mismatch.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
