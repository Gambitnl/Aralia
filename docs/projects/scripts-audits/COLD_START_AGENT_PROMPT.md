---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Audits"
slug: scripts-audits
status: review-required
last_updated: "2026-06-08"
iteration: 3
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/scripts-audits/NORTH_STAR.md
tracker: docs/projects/scripts-audits/TRACKER.md
gaps: docs/projects/scripts-audits/GAPS.md
---
# Scripts: Audits Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/scripts-audits/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Audits
Project folder: docs/projects/scripts-audits
Iteration: 3
North Star: docs/projects/scripts-audits/NORTH_STAR.md
Tracker: docs/projects/scripts-audits/TRACKER.md
Gaps: docs/projects/scripts-audits/GAPS.md

## Current Mission

Do not assign forward automation or CI-gating work yet. The project is blocked on S4: decide which audit checks are mandatory gates and which remain optional/manual maintenance tools.

## Required End State For This Iteration

- A human/policy decision is recorded for S4.
- After the decision, T2 can validate command/report paths and T3 can refresh the durable gap list.
- Any new CI gate must name the command, expected cadence, owner, and failure policy.

## Evidence

- `docs/projects/scripts-audits/GAPS.md` S4
- `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`
- `docs/portraits/race_portrait_regen_handoff.md`

## agent_comments

- Assignment hold: no forward sub-agent iteration until S4 is decided.
---END NEXT AGENT HANDOFF---
