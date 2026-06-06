# NORTHSTAR: Gemini Service Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/gemini-service/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Gemini Service
Project folder: docs/projects/gemini-service
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/gemini-service/NORTH_STAR.md
Tracker: docs/projects/gemini-service/TRACKER.md
Gaps: docs/projects/gemini-service/GAPS.md

## Previous Agent Handoff

Iteration 1 created the first cold-start packet and split the workflow rules
out into the shared iteration guide. This pass refreshed the durable project
docs, added the dashboard schema, and left the active Gemini gap set unchanged.

## Current Mission

Active task:
T2 - Validate and prioritize Gemini cost/error resilience gaps for next work slice

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/gemini-service/NORTH_STAR.md
- docs/projects/gemini-service/TRACKER.md
- docs/projects/gemini-service/GAPS.md
- docs/projects/gemini-service/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this docs refresh pass, docs consistency is the only completed verification;
the next code slice still needs scoped proof if behavior changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
`NORTH_STAR.md` now includes the dashboard card schema required by the shared
project-card schema. `TRACKER.md` and `GAPS.md` were refreshed for 2026-06-05.
No new project-specific blocker was found in this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
