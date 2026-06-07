# Environment System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-06

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/environment/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Environment System
Project folder: docs/projects/environment
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/environment/NORTH_STAR.md
Tracker: docs/projects/environment/TRACKER.md
Gaps: docs/projects/environment/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project doc set and identified the current
determinism and runtime-coupling gaps. This pass refreshed the dashboard schema
and tightened the resume path so the next agent can start from `G1` without
rebuilding context.

## Current Mission

Active task:
T3 - Begin the first runtime slice by wiring weather progression from `G1`
into a real runtime call path.

Acceptance criteria:
Use the active `TRACKER.md` row and `G1` in `GAPS.md`. If the runtime slice
lacks a precise scheduler boundary, define one before implementation and record
that decision in the tracker or gap log.

Key files to touch:
- `src/systems/environment/WeatherSystem.ts`
- `src/state/reducers/worldReducer.ts`
- `src/systems/world/WorldEventManager.ts`
- `src/state/reducers/navalReducer.ts`
- `docs/projects/environment/GAPS.md`

Scoped verification:
Use the proof named by `G1` or the nearest runtime evidence source named in the
tracker/North Star. If the change is observable, collect empirical proof; if
not, keep the task open and record the missing check.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has the dashboard card schema. Tracker points directly at the
first runtime slice, and the gap registry still names the known blockers in the
same order.

Key files to touch:
- docs/projects/environment/NORTH_STAR.md
- docs/projects/environment/TRACKER.md
- docs/projects/environment/GAPS.md
- docs/projects/environment/COLD_START_AGENT_PROMPT.md
- docs/projects/environment/DECISIONS.md
- docs/projects/environment/AUDIT_OR_PROOF.md
- docs/projects/environment/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- <source/docs named by the active tracker task>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---
