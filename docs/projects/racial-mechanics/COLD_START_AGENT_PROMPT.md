---
schema_version: 1
handoff_type: agent_to_agent
project: Racial Mechanics / Race Hierarchy
slug: racial-mechanics
status: active
last_updated: 2026-06-05
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/racial-mechanics/NORTH_STAR.md
tracker: docs/projects/racial-mechanics/TRACKER.md
gaps: docs/projects/racial-mechanics/GAPS.md
---
# Racial Mechanics / Race Hierarchy Cold Start Agent Handoff

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
docs/projects/racial-mechanics/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Racial Mechanics / Race Hierarchy
Project folder: docs/projects/racial-mechanics
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/racial-mechanics/NORTH_STAR.md
Tracker: docs/projects/racial-mechanics/TRACKER.md
Gaps: docs/projects/racial-mechanics/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project doc set and the baseline queue.
This iteration refreshed the dashboard schema, aligned the tracker with the
gap log, and recorded one workflow-level ambiguity in the shared workflow-gap
register. Use NORTH_STAR.md for project scope and intent, TRACKER.md for the
active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
RM-032 - inscopenow

Acceptance criteria:
Use the active TRACKER.md row and the current state notes in NORTH_STAR.md.
The next implementation slice is complete only when Character Creator surfaces
every required race-granted choice step without skipping any required
selection path. If a choice family lacks explicit acceptance criteria, define
the scoped criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/racial-mechanics/NORTH_STAR.md
- docs/projects/racial-mechanics/TRACKER.md
- docs/projects/racial-mechanics/GAPS.md
- docs/projects/racial-mechanics/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this docs-only pass, verify by checking the project docs for consistency and
the workflow-gap entry for the path ambiguity.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. Do not touch runtime code in this iteration.

Recent progress:
Dashboard schema added to NORTH_STAR.md, tracker/gap status aligned,
RM-LR-CHOICE-001 moved into completed context in the tracker, and one shared
workflow ambiguity was recorded for the canonical workflow-path mismatch.

Key files to touch:
- docs/projects/racial-mechanics/NORTH_STAR.md
- docs/projects/racial-mechanics/TRACKER.md
- docs/projects/racial-mechanics/GAPS.md
- docs/projects/racial-mechanics/COLD_START_AGENT_PROMPT.md
- docs/projects/racial-mechanics/DECISIONS.md
- docs/projects/racial-mechanics/AUDIT_OR_PROOF.md
- docs/projects/racial-mechanics/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/racial-mechanics plus source/docs named by the active tracker task

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
