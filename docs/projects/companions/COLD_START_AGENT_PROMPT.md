---
schema_version: 1
handoff_type: agent_to_agent
project: Companions System
slug: companions
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
north_star: docs/projects/companions/NORTH_STAR.md
tracker: docs/projects/companions/TRACKER.md
gaps: docs/projects/companions/GAPS.md
---
# Companions System Cold Start Agent Handoff

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
docs/projects/companions/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Companions System
Project folder: docs/projects/companions
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/companions/NORTH_STAR.md
Tracker: docs/projects/companions/TRACKER.md
Gaps: docs/projects/companions/GAPS.md

## Previous Agent Handoff

Iteration 1 established the baseline project docs and the initial gap map. This
pass refreshed the cold-start packet, added the dashboard card schema, and
imported two validated follow-ups from `Companions_Ralph.md` into `GAPS.md`.

## Current Mission

Active task:
T2 - Clarify/route in-project gaps for implementation handoff and risk control.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap. This pass
also imported the validated romance-lock and runtime-ID issues from
`Companions_Ralph.md`.

Key files to touch:
- docs/projects/companions/NORTH_STAR.md
- docs/projects/companions/TRACKER.md
- docs/projects/companions/GAPS.md
- docs/projects/companions/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof. This pass only refreshed
docs; no code verification was run.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Added a `Dashboard Card Schema` to `NORTH_STAR.md` and imported two validated
follow-ups from `Companions_Ralph.md` into the project gap map: romance lock-in
(`G6`) and runtime-safe IDs (`G7`).

Key files to touch:
- docs/projects/companions/NORTH_STAR.md
- docs/projects/companions/TRACKER.md
- docs/projects/companions/GAPS.md
- docs/projects/companions/COLD_START_AGENT_PROMPT.md
- docs/projects/companions/DECISIONS.md
- docs/projects/companions/AUDIT_OR_PROOF.md
- docs/projects/companions/RUNBOOK.md
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
