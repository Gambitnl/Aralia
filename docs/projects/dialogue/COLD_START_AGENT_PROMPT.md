---
schema_version: 1
handoff_type: agent_to_agent
project: Dialogue
slug: dialogue
status: active
last_updated: 2026-06-18
iteration: 4
source_agent: GitHub Copilot / MAI-Code-1-Flash
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/dialogue/NORTH_STAR.md
tracker: docs/projects/dialogue/TRACKER.md
gaps: docs/projects/dialogue/GAPS.md
---
# Dialogue Cold Start Agent Handoff

Status: active
Last updated: 2026-06-18

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/dialogue/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | qoder | application agent | certain | 2026-06-10 | Qoder IDE agent session |
| 3 | GitHub Copilot / MAI-Code-1-Flash | application agent | certain | 2026-06-18 | Current docs-consistency and D2 gap-alignment pass |

---BEGIN NEXT AGENT HANDOFF---
Project: Dialogue
Project folder: docs/projects/dialogue
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/dialogue/NORTH_STAR.md
Tracker: docs/projects/dialogue/TRACKER.md
Gaps: docs/projects/dialogue/GAPS.md

## Previous Agent Handoff

Iteration 3 (GitHub Copilot / MAI-Code-1-Flash, application agent, 2026-06-18): Completed the D2 docs-alignment pass for Dialogue. Verified the current project surface against the living-project audit, preserved the six evidence-backed gap entries, and refreshed the handoff packet without adding new project-local gaps.

## Current Mission

Primary active task:
D2 - Track unresolved dialogue gaps and keep this project-level gap list aligned

Acceptance criteria:
Keep NORTH_STAR.md, TRACKER.md, and GAPS.md mutually aligned. Preserve the
active objective, keep the dashboard card schema current, and only add gap rows
when evidence supports them.

Key files to touch:
- docs/projects/dialogue/NORTH_STAR.md
- docs/projects/dialogue/TRACKER.md
- docs/projects/dialogue/GAPS.md
- docs/projects/dialogue/COLD_START_AGENT_PROMPT.md
- docs/projects/dialogue/DECISIONS.md
- docs/projects/dialogue/AUDIT_OR_PROOF.md
- docs/projects/dialogue/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- Any source/docs named by the active tracker task

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs, and do not edit the shared workflow files.

Recent progress:
D3 is now documented and the current D2 gap inventory remains at 6 evidence-backed entries (DIAL-001 through DIAL-006). This pass refreshed the living-project docs and verified the current gap list without introducing new project-local gaps. The highest-value next action remains deciding the DIAL-002 unlock propagation model (DiscoveryLog vs NPC KnownFact path).

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Workflow-gap review result:
No new workflow-level gap was opened during this pass. The existing workflow gap file was reviewed for process ambiguity and no new WFG entry was required.

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
