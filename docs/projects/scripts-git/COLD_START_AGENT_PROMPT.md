---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Git"
slug: scripts-git
Status: partial
last_updated: 2026-06-12
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/scripts-git/NORTH_STAR.md
tracker: docs/projects/scripts-git/TRACKER.md
gaps: docs/projects/scripts-git/GAPS.md
---
# Scripts: Git Cold Start Agent Handoff

Status: partial
Last updated: 2026-06-12

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/scripts-git/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Git
Project folder: docs/projects/scripts-git
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/scripts-git/NORTH_STAR.md
Tracker: docs/projects/scripts-git/TRACKER.md
Gaps: docs/projects/scripts-git/GAPS.md

## Previous Agent Handoff

No prior project iteration handoff was preserved. Use the North Star for scope, TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
No implementation slice is open yet. If you continue beyond docs maintenance,
start with G1 in `GAPS.md`: define the smallest believable verification path
for the hook-policy scripts.

Acceptance criteria:
The next agent should be able to resume from `TRACKER.md` and `GAPS.md`
without hunting for the project state. If work begins on G1, document the
verification path before claiming completion.

Key files to touch:
- docs/projects/scripts-git/NORTH_STAR.md
- docs/projects/scripts-git/TRACKER.md
- docs/projects/scripts-git/GAPS.md
- docs/projects/scripts-git/COLD_START_AGENT_PROMPT.md

Scoped verification:
Use the verification source named by the next chosen task. For the current
docs state, the proof is the refreshed markdown set plus `git diff --check`.

Blocking dependencies / do-not-touch:
Stay inside `docs/projects/scripts-git/*` unless the task explicitly expands.

Recent progress:
Added the dashboard schema to the North Star and compacted the tracker/gaps for
the next agent. Shared workflow gaps were reviewed; the stale moved-path issue
remains a process concern, not a project blocker.

Key files to touch:
- docs/projects/scripts-git/NORTH_STAR.md
- docs/projects/scripts-git/TRACKER.md
- docs/projects/scripts-git/GAPS.md
- docs/projects/scripts-git/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-git/DECISIONS.md
- docs/projects/scripts-git/AUDIT_OR_PROOF.md
- docs/projects/scripts-git/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/scripts-git plus source/docs named by the active tracker task

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
