---
schema_version: 1
handoff_type: agent_to_agent
project: Party UI
slug: party-ui
status: partial
last_updated: 2026-06-24
iteration: 11
source_agent: Codex application agent
target_agent: next cold-start agent
runtime_surface: MCP/subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/party-ui/NORTH_STAR.md
tracker: docs/projects/party-ui/TRACKER.md
gaps: docs/projects/party-ui/GAPS.md
---
# Party UI Cold Start Agent Handoff

Status: partial
Last updated: 2026-06-24

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/party-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Party UI
Project folder: docs/projects/party-ui
iteration: 11
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/party-ui/NORTH_STAR.md
Tracker: docs/projects/party-ui/TRACKER.md
Gaps: docs/projects/party-ui/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker; reducer-backed companion-context regression tests and Party UI docs refresh |
| 4 | Qoder | MCP/subagent | certain | 2026-06-08 | Living-project iteration worker; T5 companion-context verification and mismatch-warning evaluation; G8 resolved |
| 5 | Qoder | MCP/subagent | certain | 2026-06-08 | G3 resolved: both Party READMEs rewritten from source audit to match current implementation; G9 and G10 registered from gap sweep |
| 6 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G7 resolved by threading companion relationship data into PartyOverlay and PartyMemberCard; added unit test coverage. |
| 7 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G9 resolved by adding comprehensive unit test suite in PartyMemberCard.test.tsx. |
| 8 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G10 resolved by wiring RestModal to PartyOverlay short rest button; G4 resolved by adding warning placement rules. |
| 9 | Gemini 3.5 Flash (Medium) | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G6 resolved by conducting state/save/load modularization audit. |
| 10 | Codex | application agent | certain | 2026-06-24 | Current Codex app session; G11 resolved by wiring active combat state into PartyOverlay rest controls and adding focused tests. |
| 11 | Codex | application agent | certain | 2026-06-24 | Current Codex app session; G12 resolved by rendering and routing all missing-choice warnings in PartyMemberCard. |

## Previous Agent Handoff

Iteration 11 resolved G12 (multiple choice warnings display on card). `PartyMemberCard` now renders one compact fix action per pending missing choice and passes the selected `MissingChoice` to `onMissingChoiceClick`. The portrait warning remains as a compact summary/first-choice shortcut.

## Current Mission

Active task:
The project has no currently registered open Party UI gaps. The next safe work is to run a fresh Party UI expansion sweep, register any real gaps in `GAPS.md`, and only then select the next implementation slice.

Acceptance criteria:
- New findings are evidence-backed and registered before implementation.
- If no valid Party UI gaps are found, route cross-project findings to `docs/projects/GLOBAL_GAPS.md`.

Key files to touch:
- docs/projects/party-ui/NORTH_STAR.md
- docs/projects/party-ui/TRACKER.md
- docs/projects/party-ui/GAPS.md
- docs/projects/party-ui/COLD_START_AGENT_PROMPT.md

Scoped verification:
For discovery-only passes, run docs consistency/audit checks if available. For implementation passes, run the targeted tests for the touched Party UI files plus `git diff --check`.

Blocking dependencies / do-not-touch:
None. Stay inside the Party UI scope.

Recent progress:
Iteration 11 resolved the multiple missing-choice warning flow and recorded proof in `AUDIT_OR_PROOF.md`.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers. Keep the iteration agent ledger as one compact row per completed iteration; do not preserve old handoff transcripts in this file.
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

Last updated: 2026-06-24

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original party-ui handoff predates the ledger requirement. |
| 6 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G7 resolved by threading companion relationship data into PartyOverlay and PartyMemberCard; added unit test coverage. |
| 7 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G9 resolved by adding comprehensive unit test suite in PartyMemberCard.test.tsx. |
| 8 | Gemini 3.5 Flash | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G10 resolved by wiring RestModal to PartyOverlay short rest button; G4 resolved by adding warning placement rules. |
| 9 | Gemini 3.5 Flash (Medium) | CLI agent | certain | 2026-06-22 | Invoked as iteration worker; G6 resolved by conducting state/save/load modularization audit. |
| 10 | Codex | application agent | certain | 2026-06-24 | Current Codex app session; G11 resolved by wiring active combat state into PartyOverlay rest controls and adding focused tests. |
| 11 | Codex | application agent | certain | 2026-06-24 | Current Codex app session; G12 resolved by rendering and routing all missing-choice warnings in PartyMemberCard. |

### Required project docs to account for

- docs/projects/party-ui/NORTH_STAR.md
- docs/projects/party-ui/TRACKER.md
- docs/projects/party-ui/GAPS.md
- docs/projects/party-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/party-ui/DECISIONS.md
- docs/projects/party-ui/AUDIT_OR_PROOF.md
- docs/projects/party-ui/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
