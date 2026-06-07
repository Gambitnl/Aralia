# History System Cold Start Agent Handoff

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
docs/projects/history/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: History System
Project folder: docs/projects/history
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/history/NORTH_STAR.md
Tracker: docs/projects/history/TRACKER.md
Gaps: docs/projects/history/GAPS.md

## Previous Agent Handoff

The previous pass refreshed the living project packet and source map. North
Star now carries the dashboard schema plus the producer-to-type matrix, while
G2 remains the active blocker for unwired history types.

## Current Mission

Active task:
T2 - Audit all current world-history producers and map intended event sources against WorldHistoryEventType.

Acceptance criteria:
Use the active TRACKER.md row and the source map in NORTH_STAR.md. Every live
producer touching permanent world history should be mapped to a concrete
WorldHistoryEventType, and any declared type without a producer should be
recorded as a gap or out-of-scope note.

Key files to touch:
- docs/projects/history/NORTH_STAR.md
- docs/projects/history/TRACKER.md
- docs/projects/history/GAPS.md
- docs/projects/history/COLD_START_AGENT_PROMPT.md
- src/types/history.ts
- src/services/WorldHistoryService.ts
- src/systems/world/WorldEventManager.ts
- src/systems/history/HistoryService.ts

Scoped verification:
Re-run the bounded source search for world-history producers, then confirm the
North Star matrix and tracker/gap rows match that evidence. If the change is
observable, collect concise proof in the project docs.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Iteration 1 created the first durable handoff and split workflow rules into
ITERATION_AGENT_WORKFLOW.md. This pass added the dashboard schema and explicit
event-source matrix, and the next agent should continue the producer audit.

Key files to touch:
- docs/projects/history/NORTH_STAR.md
- docs/projects/history/TRACKER.md
- docs/projects/history/GAPS.md
- docs/projects/history/COLD_START_AGENT_PROMPT.md
- docs/projects/history/DECISIONS.md
- docs/projects/history/AUDIT_OR_PROOF.md
- docs/projects/history/RUNBOOK.md
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
