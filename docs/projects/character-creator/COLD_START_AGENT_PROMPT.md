---
schema_version: 1
handoff_type: agent_to_agent
project: Character Creator
slug: character-creator
Status: active
last_updated: 2026-06-12
iteration: 5
source_agent: Gemini 3.5 Flash (Medium)
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/character-creator/NORTH_STAR.md
tracker: docs/projects/character-creator/TRACKER.md
gaps: docs/projects/character-creator/GAPS.md
---
# Character Creator Cold Start Agent Handoff

Status: active
Last updated: 2026-06-12

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/character-creator/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 5 | Gemini 3.5 Flash (Medium) | CLI agent | certain | 2026-06-12 | Reconciled T4 documentation drift and registered racial trait gaps G18, G19 |

---BEGIN NEXT AGENT HANDOFF---
Project: Character Creator
Project folder: docs/projects/character-creator
iteration: 5
North Star: docs/projects/character-creator/NORTH_STAR.md
Tracker: docs/projects/character-creator/TRACKER.md
Gaps: docs/projects/character-creator/GAPS.md

## Current Mission

The T4 documentation harmonization is resolved (drift reconciled to reflect G2 permissive navigation). Two new racial trait gaps are registered (G18 base-race validation dead-code, G19 rest-choices mapping/type bugs). Next mission: Proceed to address G18 (redundant base-race checks in validation) and G19 (rest choices mapping/type bugs).

## Required End State For This Iteration

- Redundant base-race validation checks are removed from `useCharacterAssembly.ts` and `sidebarSteps.ts` (resolving G18).
- `RacialRestChoiceData` interface is updated with `weaponIds`, and `characterReducer.ts` is fixed to map rest skill choices to valid `Skill` objects using `SKILLS_DATA` lookup (resolving G19).
- Run `npm run typecheck` and `npm run test` to verify that character creator and state tests pass.

## Evidence

- `useCharacterAssembly.ts:293-296` and `sidebarSteps.ts:52-55` (G18 redundant checks evidence)
- `characterReducer.ts:626-628,638,644` and `types/character.ts:473-480` (G19 rest choices mapping and type bugs evidence)

## agent_comments

- G2 is resolved and documented; sidebar navigation is intentionally permissive.
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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original character-creator handoff predates the ledger requirement. |
| 5 | Gemini 3.5 Flash (Medium) | CLI agent | certain | 2026-06-12 | Reconciled T4 documentation drift and registered racial trait gaps G18, G19 |

### Required project docs to account for

- docs/projects/character-creator/NORTH_STAR.md
- docs/projects/character-creator/TRACKER.md
- docs/projects/character-creator/GAPS.md
- docs/projects/character-creator/COLD_START_AGENT_PROMPT.md
- docs/projects/character-creator/DECISIONS.md
- docs/projects/character-creator/AUDIT_OR_PROOF.md
- docs/projects/character-creator/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
