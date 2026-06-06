# NORTHSTAR: Scripts: Archive Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-archive/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Archive
Project folder: docs/projects/scripts-archive
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-archive/NORTH_STAR.md
Tracker: docs/projects/scripts-archive/TRACKER.md
Gaps: docs/projects/scripts-archive/GAPS.md

## Previous Agent Handoff

Iteration 1 established the archive project packet, the shared workflow split,
and the first pass at the deprecation/cleanup policy question.

## Current Mission

Active task:
T2 - Verify deprecation/cleanup policy for archived scripts and temporary auth artifacts

Acceptance criteria:
Use the active TRACKER.md row and the dashboard fields in NORTH_STAR.md. If the
task still needs a clearer retention decision, record that decision in the
project docs instead of leaving the handoff vague.

Key files to touch:
- docs/projects/scripts-archive/NORTH_STAR.md
- docs/projects/scripts-archive/TRACKER.md
- docs/projects/scripts-archive/GAPS.md
- docs/projects/scripts-archive/COLD_START_AGENT_PROMPT.md

Scoped verification:
Use the tracker proof source named in TRACKER.md. The latest direct evidence
check was `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json`,
which returned `False` on 2026-06-05.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. Do not edit shared workflow docs unless a
workflow-level ambiguity is actually found.

Recent progress:
The project docs were refreshed with a dashboard card schema, a tighter current
state summary, a refreshed tracker row, and a compact gap log. The temp auth
artifact was confirmed absent on the latest pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
