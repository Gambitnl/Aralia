---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Tooling"
slug: scripts-tooling
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
north_star: docs/projects/scripts-tooling/NORTH_STAR.md
tracker: docs/projects/scripts-tooling/TRACKER.md
gaps: docs/projects/scripts-tooling/GAPS.md
---
# Scripts: Tooling Cold Start Agent Handoff

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
docs/projects/scripts-tooling/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Tooling
Project folder: docs/projects/scripts-tooling
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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
this pass. The shared-path ambiguity remains centrali

Key files to touch:
- docs/projects/scripts-tooling/NORTH_STAR.md
- docs/projects/scripts-tooling/TRACKER.md
- docs/projects/scripts-tooling/GAPS.md
- docs/projects/scripts-tooling/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-tooling/DECISIONS.md
- docs/projects/scripts-tooling/AUDIT_OR_PROOF.md
- docs/projects/scripts-tooling/RUNBOOK.md
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
