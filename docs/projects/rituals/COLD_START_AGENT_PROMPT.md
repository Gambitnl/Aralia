---
schema_version: 1
handoff_type: agent_to_agent
project: Rituals System
slug: rituals
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
north_star: docs/projects/rituals/NORTH_STAR.md
tracker: docs/projects/rituals/TRACKER.md
gaps: docs/projects/rituals/GAPS.md
---
# Rituals System Cold Start Agent Handoff

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
docs/projects/rituals/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Rituals System
Project folder: docs/projects/rituals
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/rituals/NORTH_STAR.md
Tracker: docs/projects/rituals/TRACKER.md
Gaps: docs/projects/rituals/GAPS.md

## Previous Agent Handoff

The first pass established the project docs and gap surface. This iteration
refreshed the dashboard schema and tightened the tracker/gap handoff without
expanding scope. Use NORTH_STAR.md for project scope and intent, TRACKER.md for
the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
RIT-3 - Capture and verify ritual execution coupling between combat spell casting and ritual start flow.

Acceptance criteria:
Use the active TRACKER.md row and the Dashboard Card Schema / Next Checks in
NORTH_STAR.md. Keep the live caller-chain evidence and type-ownership notes in
sync with GAPS.md before making any source change.

Key files to touch:
- docs/projects/rituals/NORTH_STAR.md
- docs/projects/rituals/TRACKER.md
- docs/projects/rituals/GAPS.md
- docs/projects/rituals/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done.
This pass only refreshed docs, so keep proof limited to docs consistency unless
the next agent makes a source change.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Initial handoff file created as part of the living-project cold-start handoff
system split. This pass added the North Star dashboard card schema and compacted
the tracker/gap language so the next agent can resume RIT-3 or RIT-4 quickly.

Key files to touch:
- docs/projects/rituals/NORTH_STAR.md
- docs/projects/rituals/TRACKER.md
- docs/projects/rituals/GAPS.md
- docs/projects/rituals/COLD_START_AGENT_PROMPT.md
- docs/projects/rituals/DECISIONS.md
- docs/projects/rituals/AUDIT_OR_PROOF.md
- docs/projects/rituals/RUNBOOK.md
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
