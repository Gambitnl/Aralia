---
schema_version: 1
handoff_type: agent_to_agent
project: Crime UI
slug: crime-ui
status: active
last_updated: 2026-06-15
iteration: 2
source_agent: Qoder
target_agent: next cold-start agent
runtime_surface: application agent
certainty: inferred
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
gaps: docs/projects/crime-ui/GAPS.md
---
# Crime UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-15

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crime-ui/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Qoder | application agent | inferred | 2026-06-15 | IDE-integrated agent (Qoder/Qoder IDE) |

---BEGIN NEXT AGENT HANDOFF---
Project: Crime UI
Project folder: docs/projects/crime-ui
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crime-ui/NORTH_STAR.md
Tracker: docs/projects/crime-ui/TRACKER.md
Gaps: docs/projects/crime-ui/GAPS.md

## Previous Agent Handoff

Iteration 2 (2026-06-15, Qoder, application agent): Completed T2 by re-verifying
all 5 gaps against source code, reconciling GAPS.md statuses from not_started to
active, refreshing NORTH_STAR.md with evidence-backed implementation state
snapshot, marking T2 done in TRACKER.md, and updating AUDIT_OR_PROOF.md with
verification proof. All docs are now evidence-based rather than scaffold-only.

## Current Mission

Active task:
T3 - Validate any future UI work against `docs/projects/crime` for core contract changes

Acceptance criteria:
Check compatibility between Crime UI changes and `docs/projects/crime` core
contracts before coding job/fence/heist UI changes. Add regression test notes
in `TRACKER.md` before merge.

Key files to touch:
- docs/projects/crime-ui/NORTH_STAR.md
- docs/projects/crime-ui/TRACKER.md
- docs/projects/crime-ui/GAPS.md
- docs/projects/crime-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/crime-ui/DECISIONS.md
- docs/projects/crime-ui/AUDIT_OR_PROOF.md
- docs/projects/crime-ui/RUNBOOK.md
- docs/projects/crime/TRACKER.md (cross-project check)
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- Source/docs named by the active tracker task

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Check compatibility with `docs/projects/crime` before coding. Add regression
test notes in TRACKER.md.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
T2 completed on 2026-06-15. All project docs converted from scaffold-only to
evidence-backed implementation state snapshot. All 5 gaps re-verified against
source code. GAPS.md statuses reconciled. NORTH_STAR.md confidence raised to
high. Next step: T3 (cross-project validation against crime-core) or tackle
G3/G4 as most actionable in-scope implementation gaps.

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
