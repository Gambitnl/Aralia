---
schema_version: 1
handoff_type: agent_to_agent
project: Religion System
slug: religion
Status: active
last_updated: 2026-06-10
iteration: 6
source_agent: Codex / gpt-5
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/religion/NORTH_STAR.md
tracker: docs/projects/religion/TRACKER.md
gaps: docs/projects/religion/GAPS.md
---
# Religion System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-10

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/religion/NORTH_STAR.md

agent_comments: none

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | local foreman docs pass | certain | 2026-06-09 | Schema repair, required-doc creation, and dashboard verification in this thread |
| 3 | Codex / gpt-5 | CLI agent | certain | 2026-06-09 | G1 reducer compatibility helper, focused reducer/default-state tests, and Religion docs proof refresh |
| 4 | Codex / gpt-5 | CLI agent | certain | 2026-06-09 | G2 typed temple service effect union, non-heal regression test, and Religion docs refresh in this thread |
| 5 | Codex / gpt-5 | CLI agent | certain | 2026-06-09 | G3 combat taxonomy expansion, focused CombatReligionAdapter regression tests, and Religion docs refresh in this thread |

---BEGIN NEXT AGENT HANDOFF---
Project: Religion System
Project folder: docs/projects/religion
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/religion/NORTH_STAR.md
Tracker: docs/projects/religion/TRACKER.md
Gaps: docs/projects/religion/GAPS.md

## Previous Agent Handoff

Iteration 5 resolved G3 with deity-authored combat taxonomy labels, legacy trigger fallbacks, and focused CombatReligionAdapter regression tests. That left G4 as the next implementation slice until source review showed the ritual consequence contract is shared with the Rituals project.

## Current Mission

Active task:
Pause forward Religion implementation until the ritual ownership decision is recorded in the Required Review Brief. Keep the G1 compatibility helper, G2 temple service adapter, and G3 combat taxonomy map intact.

Acceptance criteria:
Religion is marked review-required. The Required Review Brief is present in `NORTH_STAR.md`, the tracker and gap rows point to it, and no further sub-agent assignment should happen for Religion until the owner boundary is decided.

Key files touched:
- `docs/projects/religion/NORTH_STAR.md`
- `docs/projects/religion/TRACKER.md`
- `docs/projects/religion/GAPS.md`
- `docs/projects/religion/COLD_START_AGENT_PROMPT.md`
- `docs/projects/religion/DECISIONS.md`
- `docs/projects/religion/AUDIT_OR_PROOF.md`
- `docs/projects/religion/RUNBOOK.md`
- `docs/projects/PROJECT_TRACKER.md`

Scoped verification:
Run the living-project docs audit and a diff check after the review-gate edits. No runtime ritual tests are expected until the owner boundary is decided.

Blocking dependencies / do-not-touch:
Stay inside the Religion docs boundary. Do not touch runtime ritual consequence code, and do not assign forward Religion work until the Required Review Brief is answered.

Recent progress:
The ritual interruption path in `ritualReducer` and `RitualManager` still shows placeholder backlash logic, but the same consequence gap is already tracked in the Rituals project. The Religion project now carries a review gate rather than pretending the ownership is settled.

Workflow-gap review result:
A Required Review Brief is now required because the ritual consequence contract crosses the Religion and Rituals project boundary.

Dashboard schema updates:
Religion is now review-required. The gap signal names the G4 ownership decision, the next step points at the Required Review Brief, and the schema wrapper should remain valid after the docs refresh.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard schema updates. Keep only the current handoff between the same BEGIN/END markers, account for every required doc, mention optional docs touched or skipped, and leave `agent_comments` empty unless an out-of-flow note is actually useful.

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

## Project Prompt Conformance Notes

Last updated: 2026-06-10

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_iteration_ledger.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original religion handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/religion/NORTH_STAR.md
- docs/projects/religion/TRACKER.md
- docs/projects/religion/GAPS.md
- docs/projects/religion/COLD_START_AGENT_PROMPT.md
- docs/projects/religion/DECISIONS.md
- docs/projects/religion/AUDIT_OR_PROOF.md
- docs/projects/religion/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
