---
schema_version: 1
handoff_type: agent_to_agent
project: Script Tests
slug: script-tests
status: active
last_updated: "2026-06-06"
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/script-tests/NORTH_STAR.md
tracker: docs/projects/script-tests/TRACKER.md
gaps: docs/projects/script-tests/GAPS.md
---
# Script Tests Cold Start Agent Handoff

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
docs/projects/script-tests/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Script Tests
Project folder: docs/projects/script-tests
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/script-tests/NORTH_STAR.md
Tracker: docs/projects/script-tests/TRACKER.md
Gaps: docs/projects/script-tests/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial living-project split for this folder. The packet now points at the real shared workflow entry point, and the dashboard-facing schema has been refreshed for the next agent.

## Current Mission

Active task:
T2 - Add follow-up test coverage for uncovered script integration risks

This pass was docs-only; the active task remains open and the next agent should continue from the gap list rather than treat the packet refresh as completion.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/script-tests/NORTH_STAR.md
- docs/projects/script-tests/TRACKER.md
- docs/projects/script-tests/GAPS.md
- docs/projects/script-tests/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or NORTH_STAR.md. If none is named, add one before claiming the task is done. This iteration did not run tests; the next agent should use the named narrow Vitest check or add a new one if the safer gap changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
This iteration refreshed the dashboard-facing docs, added the North Star card schema, and corrected the shared workflow entry point. No code or tests were run in this pass.

Key files to touch:
- docs/projects/script-tests/NORTH_STAR.md
- docs/projects/script-tests/TRACKER.md
- docs/projects/script-tests/GAPS.md
- docs/projects/script-tests/COLD_START_AGENT_PROMPT.md
- docs/projects/script-tests/DECISIONS.md
- docs/projects/script-tests/AUDIT_OR_PROOF.md
- docs/projects/script-tests/RUNBOOK.md
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
