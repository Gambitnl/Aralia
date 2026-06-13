---
schema_version: 1
handoff_type: agent_to_agent
project: RealmSmith Service
slug: realmsmith-service
Status: active
last_updated: 2026-06-05
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/realmsmith-service/NORTH_STAR.md
tracker: docs/projects/realmsmith-service/TRACKER.md
gaps: docs/projects/realmsmith-service/GAPS.md
---
# RealmSmith Service Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/realmsmith-service/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: RealmSmith Service
Project folder: docs/projects/realmsmith-service
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/realmsmith-service/NORTH_STAR.md
Tracker: docs/projects/realmsmith-service/TRACKER.md
Gaps: docs/projects/realmsmith-service/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial project packet. This pass refreshed the
dashboard schema, compacted the tracker/gap wording, and recorded the shared
workflow path mismatch as a workflow testimony. No source or code changes were
made.

## Current Mission

Active task:
T2 - Confirm RealmSmith service contract and retry policy before next implementation change

Acceptance criteria:
- TRACKER.md and NORTH_STAR.md agree on the active contract/retry state.
- The next agent can point to the named source files and explain the current
  service contract surface.
- Any new ambiguity found during source review is recorded in GAPS.md or
  routed to the shared workflow / global gap docs.

Key files to touch:
- docs/projects/realmsmith-service/NORTH_STAR.md
- docs/projects/realmsmith-service/TRACKER.md
- docs/projects/realmsmith-service/GAPS.md
- docs/projects/realmsmith-service/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md if the
  workflow-path ambiguity recurs
- Any source/docs named by T2

Scoped verification:
- Docs consistency is already refreshed.
- The next agent should perform the source scan or documented proof named by
  TRACKER.md / NORTH_STAR.md before claiming T2 is ready.

Blocking dependencies / do-not-touch:
- Stay inside this project's docs and source boundaries.
- Do not broaden into sibling project docs unless a real cross-project gap is
  found.

Recent progress:
- Dashboard Card Schema added to NORTH_STAR.md.
- TRACKER.md and GAPS.md were compacted to the current active contract/retry
  gap set.
- Workflow-level path ambiguity was encountered and testified in
  WORKFLOW_GAPS.md.

Key files to touch:
- docs/projects/realmsmith-service/NORTH_STAR.md
- docs/projects/realmsmith-service/TRACKER.md
- docs/projects/realmsmith-service/GAPS.md
- docs/projects/realmsmith-service/COLD_START_AGENT_PROMPT.md
- docs/projects/realmsmith-service/DECISIONS.md
- docs/projects/realmsmith-service/AUDIT_OR_PROOF.md
- docs/projects/realmsmith-service/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/realmsmith-service plus source/docs named by the active tracker task

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
