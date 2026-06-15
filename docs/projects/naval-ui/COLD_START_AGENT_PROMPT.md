---
schema_version: 1
handoff_type: agent_to_agent
project: Naval UI
slug: naval-ui
status: active
last_updated: 2026-06-15
iteration: 3
source_agent: Iteration Agent 2 (Devin CLI)
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/naval-ui/NORTH_STAR.md
tracker: docs/projects/naval-ui/TRACKER.md
gaps: docs/projects/naval-ui/GAPS.md
---
# Naval UI Cold Start Agent Handoff

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
docs/projects/naval-ui/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Devin CLI (SWE-1.6 Slow) | CLI agent | certain | 2026-06-15 | Executed task U2: verified naval UI implementation state documentation via source inspection. Confirmed all file map entries accurate, all 5 gaps valid, docs consistency passed. No new gaps discovered. |

---BEGIN NEXT AGENT HANDOFF---
Project: Naval UI
Project folder: docs/projects/naval-ui
iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/naval-ui/NORTH_STAR.md
Tracker: docs/projects/naval-ui/TRACKER.md
Gaps: docs/projects/naval-ui/GAPS.md

## Previous Agent Handoff

Iteration 2 executed task U2: documented naval UI implementation state, integration points, and current gaps. This was a docs-only verification pass that confirmed:
- All file map entries in NORTH_STAR.md are accurate against current source
- All 5 gaps in GAPS.md remain valid and match current code behavior
- Docs consistency check passed across NORTH_STAR/TRACKER/GAPS
- No new project-specific blockers discovered during source inspection
- Updated all project docs to 2026-06-15 with completion evidence

## Current Mission

Active task:
None - task U2 completed. The next agent should choose the highest-value in-scope gap from GAPS.md.

Suggested priority order (based on gap classifications):
1. NU-1 (in_scope_now): Implement NAVAL_REPAIR_SHIP reducer case or remove action contract
2. NU-5 (support_needed_now): Add ShipPane action controls or confirm read-only contract
3. NU-2 (in_scope_now): Add voyage start transition from movement path
4. NU-4 (in_scope_now): Choose canonical voyage event source
5. NU-3 (in_scope_now): Define combat/status handoff strategy

Acceptance criteria:
Select one gap from GAPS.md, implement the fix or documented next action, and record completion evidence in TRACKER.md and AUDIT_OR_PROOF.md. If the chosen gap requires a human decision first, create a Required Review Brief following the PROJECT_CARD_SCHEMA.md format.

Key files to touch:
- docs/projects/naval-ui/NORTH_STAR.md (update frontmatter dates and next_step)
- docs/projects/naval-ui/TRACKER.md (add new task row or update existing)
- docs/projects/naval-ui/GAPS.md (update resolved gap status or add new findings)
- docs/projects/naval-ui/COLD_START_AGENT_PROMPT.md (update for next handoff)
- docs/projects/naval-ui/DECISIONS.md (record any durable project decisions)
- docs/projects/naval-ui/AUDIT_OR_PROOF.md (record verification evidence)
- Source files named by the selected gap (e.g., navalReducer.ts, ShipPane.tsx, actionTypes.ts)

Scoped verification:
Use the verification method named by the selected gap's "next proof/check" column. For source changes, run relevant tests or provide empirical proof (screenshot, log excerpt, or deterministic replay evidence). For docs changes, a consistency check across the affected docs is sufficient.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers to GLOBAL_GAPS.md instead of editing their docs.

Recent progress:
Task U2 completed 2026-06-15: implementation state documentation verified accurate via source inspection. All 5 gaps confirmed current. No new gaps discovered. Docs refreshed with completion evidence across all required files.

Key files to touch:
- docs/projects/naval-ui/NORTH_STAR.md
- docs/projects/naval-ui/TRACKER.md
- docs/projects/naval-ui/GAPS.md
- docs/projects/naval-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/naval-ui/DECISIONS.md
- docs/projects/naval-ui/AUDIT_OR_PROOF.md
- docs/projects/naval-ui/RUNBOOK.md
- Source files named by the selected gap (navalReducer.ts, ShipPane.tsx, actionTypes.ts, voyageEvents files, etc.)

Optional docs to check when present or named by tracker:
- tasks/ (if any task-specific docs exist)
- architecture notes (if any exist in this project)
- migration notes (if any exist in this project)

Scoped verification:
Use the scoped verification named by the selected gap in GAPS.md. If verification cannot be run, record the blocker and next proof in the gap row before closing the iteration.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth. All 5 gaps are confirmed accurate as of 2026-06-15.

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
