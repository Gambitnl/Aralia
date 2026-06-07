# Command Base Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-07

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/command-base-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Command Base Runtime
Project folder: docs/projects/command-base-runtime
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/command-base-runtime/NORTH_STAR.md
Tracker: docs/projects/command-base-runtime/TRACKER.md
Gaps: docs/projects/command-base-runtime/GAPS.md

## Previous Agent Handoff

Iteration 2 resolved the rollback policy decision (T3): `executeWithRollback`
is NOT adopted as the production path. Current immutable-state `execute` already
returns pre-failure state on error. `executeWithRollback` retained as explicit
fallback API only. G1/G2 closed with rationale. G3 retargeted to non-rollback
failure-path test coverage.

## Current Mission

Active task:
G3 - Expand `CommandExecutor.execute` failure-path test coverage (async errors,
partial execution state, error propagation, immutable-state guarantees)

Acceptance criteria:
Focused Vitest tests added for `CommandExecutor.execute` failure modes;
immutable-state guarantees verified; error-state integrity confirmed.

Key files to touch:
- docs/projects/command-base-runtime/NORTH_STAR.md
- docs/projects/command-base-runtime/TRACKER.md
- docs/projects/command-base-runtime/GAPS.md
- docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md
- src/commands/__tests__/CommandExecutor.test.ts

Scoped verification:
Run targeted `CommandExecutor` failure-path tests; verify docs consistency
against `TRACKER.md`/`GAPS.md`.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not edit shared workflow docs.
Route sibling-project blockers instead of copying them here.

Recent progress:
Rollback policy decided (not adopted). G1/G2 closed. G3 is the active work item.
G4 remains as state-freshness follow-up.

Key files to touch:
- docs/projects/command-base-runtime/NORTH_STAR.md
- docs/projects/command-base-runtime/TRACKER.md
- docs/projects/command-base-runtime/GAPS.md
- docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md
- docs/projects/command-base-runtime/DECISIONS.md
- docs/projects/command-base-runtime/AUDIT_OR_PROOF.md
- docs/projects/command-base-runtime/RUNBOOK.md
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
