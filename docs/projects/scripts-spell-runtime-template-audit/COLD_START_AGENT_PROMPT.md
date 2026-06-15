---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Spell Runtime Template Audit"
slug: scripts-spell-runtime-template-audit
status: review-required
last_updated: 2026-06-12
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
tracker: docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
gaps: docs/projects/scripts-spell-runtime-template-audit/GAPS.md
---
# Scripts: Spell Runtime Template Audit Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-12

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Spell Runtime Template Audit
Project folder: docs/projects/scripts-spell-runtime-template-audit
iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
Tracker: docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
Gaps: docs/projects/scripts-spell-runtime-template-audit/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project handoff files and the initial audit
baseline. The current pass refreshed the dashboard card schema, compacted the
queue, and kept the recurring-mechanics decision open for the next agent.

## Current Mission

Active task:
T2 - Resolve recurring warning follow-up by deciding the schema path for Recurring Mechanics labels and documenting execution handoff

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria in NORTH_STAR.md.
The next agent should leave with one explicit schema-path decision, a matching
gap entry, and an audit rerun target.

Key files to touch:
- docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
- docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
- docs/projects/scripts-spell-runtime-template-audit/GAPS.md
- docs/projects/scripts-spell-runtime-template-audit/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use `npm run audit:spell-template` and the tracker evidence chain named in the
North Star. If the task is only documented, make that clear instead of
claiming runtime completion.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. No new blocker was found in this pass.

Recent progress:
Dashboard card schema added to NORTH_STAR.md; TRACKER.md and GAPS.md were
refreshed for the current recurring-mechanics warning family; workflow gaps
were reviewed and no new workflow-level ambiguity was opened.

Key files to touch:
- docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
- docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
- docs/projects/scripts-spell-runtime-template-audit/GAPS.md
- docs/projects/scripts-spell-runtime-template-audit/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-spell-runtime-template-audit/DECISIONS.md
- docs/projects/scripts-spell-runtime-template-audit/AUDIT_OR_PROOF.md
- docs/projects/scripts-spell-runtime-template-audit/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/scripts-spell-runtime-template-audit plus source/docs named by the active tracker task

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
