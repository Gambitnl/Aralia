---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Archive"
slug: scripts-archive
status: active
last_updated: 2026-06-17
iteration: 4
source_agent: Qoder CLI
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/scripts-archive/NORTH_STAR.md
tracker: docs/projects/scripts-archive/TRACKER.md
gaps: docs/projects/scripts-archive/GAPS.md
---
# Scripts: Archive Cold Start Agent Handoff

Status: active
Last updated: 2026-06-17

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
| 2 | Not recorded | unknown | unknown | 2026-06-05 | Prior handoff date from project docs |
| 3 | Qoder CLI | CLI agent | certain | 2026-06-17 | Shell-based Windows CLI session |
| 4 | Qoder CLI | CLI agent | certain | 2026-06-17 | Shell-based Windows CLI session |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Archive
Project folder: docs/projects/scripts-archive
iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/scripts-archive/NORTH_STAR.md
Tracker: docs/projects/scripts-archive/TRACKER.md
Gaps: docs/projects/scripts-archive/GAPS.md

## Previous Agent Handoff

Iteration 4 (Qoder CLI, 2026-06-17) checked DECISIONS.md for a recorded tombstone
policy decision and found none (only D1 schema init exists). Temp-auth artifact
re-verified absent (`Test-Path` returned `False`). WORKFLOW_GAPS.md has no active
gaps. GLOBAL_GAPS.md has no routes to scripts-archive. The project remains gated
on SARCH-001; no forward implementation was started.

## Current Mission

Active task:
T2 - review-required: implement the archive tombstone policy decision once recorded

Acceptance criteria:
Read the Required Review Brief in NORTH_STAR.md. If a decision has been recorded
in DECISIONS.md (Option A, B, or C), implement it and close SARCH-001. If no
decision is recorded, do not start forward implementation; keep the project
review-required and report the gate.

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
- scripts/tooling/script-registry.json (only if Option A is chosen)
- docs/projects/scripts-archive plus source/docs named by the active tracker task

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
The tombstone policy decision (SARCH-001) is `blocked_human_decision`. Do not
choose the policy unilaterally. If no decision is recorded, keep the project
review-required. Stay inside this project's scope boundaries.

Recent progress:
Iteration 4 (2026-06-17): DECISIONS.md checked — no tombstone policy decision
recorded; temp-auth artifact confirmed absent again; WORKFLOW_GAPS.md read (no
active gaps); GLOBAL_GAPS.md checked (no routes to scripts-archive); project
remains gated on SARCH-001; all required docs updated for gate-report pass.

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
