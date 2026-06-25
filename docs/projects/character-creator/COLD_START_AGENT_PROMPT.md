---
schema_version: 1
handoff_type: agent_to_agent
project: Character Creator
slug: character-creator
status: active
last_updated: 2026-06-25
iteration: 12
source_agent: Codex
target_agent: next cold-start agent
runtime_surface: application agent
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
Last updated: 2026-06-25

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/character-creator/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 5 | Gemini 3.5 Flash (Medium) | CLI agent | certain | 2026-06-12 | Reconciled T4 documentation drift and registered racial trait gaps G18, G19 |
| 6 | Antigravity | CLI agent | certain | 2026-06-14 | Resolved G18 redundant validation checks and G19 rest choices mapping/type bugs |
| 7 | Codex | application agent | certain | 2026-06-24 | Resolved G7 by updating CreationSidebar tests for human-only Racial Feat visibility and navigation |
| 8 | Codex | application agent | certain | 2026-06-24 | Resolved G20 as already-current after verifying skillSelectionUtils checks Skillful with matching `raceId: 'human'` |
| 9 | Codex | application agent | certain | 2026-06-25 | Resolved G14 by changing CreationSidebar footer progress to ignore future default-complete steps |
| 10 | Codex | application agent | certain | 2026-06-25 | Resolved G15 by keeping background-granted class skill rows visible with source badges while preserving replacement choices |
| 11 | Codex | application agent | certain | 2026-06-25 | Resolved G4 by removing unused alias imports from the CharacterCreator flow test and updating Changeling size selection |
| 12 | Codex | application agent | certain | 2026-06-25 | Resolved G17 by keeping legacy Rusty Sword out of mastery choices and making weapon details reachable by focus/click |

---BEGIN NEXT AGENT HANDOFF---
Project: Character Creator
Project folder: docs/projects/character-creator
iteration: 12
North Star: docs/projects/character-creator/NORTH_STAR.md
Tracker: docs/projects/character-creator/TRACKER.md
Gaps: docs/projects/character-creator/GAPS.md

## Current Mission

Redundant base-race validation checks are removed (G18), rest choices are fully resolved and typed (G19), the sidebar racial-feat visibility test now matches the live UI contract (G7), the Skillful raceId test mismatch is already resolved in the current checkout (G20), the sidebar progress counter no longer credits future default-complete steps (G14), background-granted class skills now remain visible with source badges (G15), the CharacterCreator flow test lint-intent cleanup is complete (G4), and Weapon Mastery selection now hides legacy Rusty Sword while exposing details by focus/click (G17). Next mission: proceed to the next audited Character Creator gap, likely G16.

## Required End State For This Iteration

- Pick one remaining audited Character Creator gap from `GAPS.md`, keeping the slice small and source-backed.
- Run focused Character Creator tests for the touched files and typecheck when production state/types are changed.

## Evidence

- Spell card surfaces across creator/sheet views (G16 evidence)
- `SpellCard`/spell list components across `*FeatureSelection`, `FeatSpellPicker`, and `CharacterSheet` Spellbook (G16 evidence)

## agent_comments

- Iteration 12 resolved G17. `WeaponMasterySelection.tsx` now uses current weapon categories for eligibility, excludes only the legacy `rusty_sword` duplicate from mastery choices, and previews details by hover, focus, or click/tap.
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
| 6 | Antigravity | CLI agent | certain | 2026-06-14 | Resolved G18 redundant validation checks and G19 rest choices mapping/type bugs |
| 7 | Codex | application agent | certain | 2026-06-24 | Resolved G7 by updating CreationSidebar tests for human-only Racial Feat visibility and navigation |
| 8 | Codex | application agent | certain | 2026-06-24 | Resolved G20 as already-current after verifying skillSelectionUtils checks Skillful with matching `raceId: 'human'` |
| 9 | Codex | application agent | certain | 2026-06-25 | Resolved G14 by changing CreationSidebar footer progress to ignore future default-complete steps |
| 10 | Codex | application agent | certain | 2026-06-25 | Resolved G15 by keeping background-granted class skill rows visible with source badges while preserving replacement choices |
| 11 | Codex | application agent | certain | 2026-06-25 | Resolved G4 by removing unused alias imports from the CharacterCreator flow test and updating Changeling size selection |
| 12 | Codex | application agent | certain | 2026-06-25 | Resolved G17 by keeping legacy Rusty Sword out of mastery choices and making weapon details reachable by focus/click |

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
