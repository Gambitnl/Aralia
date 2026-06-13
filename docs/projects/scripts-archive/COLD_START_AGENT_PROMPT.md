---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Archive"
slug: scripts-archive
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
north_star: docs/projects/scripts-archive/NORTH_STAR.md
tracker: docs/projects/scripts-archive/TRACKER.md
gaps: docs/projects/scripts-archive/GAPS.md
---
# Scripts: Archive Cold Start Agent Handoff

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
docs/projects/scripts-archive/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Archive
Project folder: docs/projects/scripts-archive
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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

Key files to touch:
- docs/projects/scripts-archive/NORTH_STAR.md
- docs/projects/scripts-archive/TRACKER.md
- docs/projects/scripts-archive/GAPS.md
- docs/projects/scripts-archive/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-archive/DECISIONS.md
- docs/projects/scripts-archive/AUDIT_OR_PROOF.md
- docs/projects/scripts-archive/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/scripts-archive plus source/docs named by the active tracker task

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
