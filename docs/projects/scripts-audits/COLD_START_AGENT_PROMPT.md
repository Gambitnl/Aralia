---
schema_version: 1
handoff_type: agent_to_agent
project: "Scripts: Audits"
slug: scripts-audits
Status: active
last_updated: 2026-06-12
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

Status: active
Last updated: 2026-06-12

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
iteration: 3
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
Required docs to account for before closeout:
- NORTH_STAR.md
- TRACKER.md
- GAPS.md
- COLD_START_AGENT_PROMPT.md
- DECISIONS.md
- AUDIT_OR_PROOF.md
- RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-12

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_decisions_reference, missing_proof_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original scripts-audits handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/scripts-audits/NORTH_STAR.md
- docs/projects/scripts-audits/TRACKER.md
- docs/projects/scripts-audits/GAPS.md
- docs/projects/scripts-audits/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-audits/DECISIONS.md
- docs/projects/scripts-audits/AUDIT_OR_PROOF.md
- docs/projects/scripts-audits/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
