---
schema_version: 1
handoff_type: agent_to_agent
project: Encounter Generator
slug: encounter-generator
Status: review-required
last_updated: 2026-06-12
iteration: 3
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/encounter-generator/NORTH_STAR.md
tracker: docs/projects/encounter-generator/TRACKER.md
gaps: docs/projects/encounter-generator/GAPS.md
---
# Encounter Generator Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-12

This file is the active handoff for the next agent. It replaces this previous iteration record.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/encounter-generator/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Encounter Generator
Project folder: docs/projects/encounter-generator
iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/encounter-generator/NORTH_STAR.md
Tracker: docs/projects/encounter-generator/TRACKER.md
Gaps: docs/projects/encounter-generator/GAPS.md

## Previous Agent Handoff

Iteration 2 completed the tracker/card refresh and started the first deterministic slice:
- Added seed threading across AI trigger, fallback, process validation, and bestiary generation.
- Added bestiary seed counter resets for reroll/difficulty/lair state transitions.
- Added scoped tests for deterministic fallback and deterministic bestiary outputs.
- Updated tracker and gaps, and documented AI determinism as an unresolved decision in G4.

## Current Mission

Active task:
T3 - Close seeded encounter generation and difficulty contract slice

Acceptance criteria:
- Keep implementation scoped to encounter seedability and shared difficulty contract only.
- Verify seeded fallback + bestiary reproducibility through focused tests.
- Confirm docs reflect implemented status and the new open gap G4.
- Ensure tracker/NORTH_STAR/TASK docs stay aligned and compact.
- Do not continue beyond T3 implementation until the G4 review decision is recorded.

Key files to touch:
- docs/projects/encounter-generator/NORTH_STAR.md
- docs/projects/encounter-generator/TRACKER.md
- docs/projects/encounter-generator/GAPS.md
- docs/projects/encounter-generator/COLD_START_AGENT_PROMPT.md
- src/components/Combat/EncounterModal.tsx
- src/hooks/actions/handleEncounter.ts
- src/services/gemini/encounters.ts
- src/services/geminiServiceFallback.ts
- src/utils/world/bestiaryEncounterGenerator.ts
- src/utils/world/encounterUtils.ts
- src/utils/world/__tests__/bestiaryEncounterGenerator.test.ts
- src/services/__tests__/geminiServiceFallback.test.ts

Scoped verification:
- Run targeted Vitest files for the two added tests.
- Run docs consistency check for encounter-generator docs.

Blockers / do-not-touch:
- Stay inside encounter-generator scope.
- Do not edit unrelated projects or global workflow trackers unless they are direct blockers.

Recent progress:
- Seed flow is active for local generation and fallback.
- Difficulty display/rebuild logic is consistently sourced.
- Open gap now limited to optional end-to-end AI determinism policy (G4).

Workflow gap review result:
- Reviewed `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
- Current workflow gates unchanged.

Dashboard schema fields updated:
- `Last updated`: 2026-06-09
- `Next step`, `Gap signal`, `Required verification`, `Completed verification`, `Workflow gaps reviewed`, `Last proof`

Optional docs:
- Encounter-generator optional docs are intentionally absent in this scope.

## Documentation compaction status

Compaction status: done
Rationale: replaced prior multi-entry handoff text with one live handoff block.

Agent comments:
Project is currently review-required. Do not continue forward implementation past this handoff until G4 human decision is recorded.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original encounter-generator handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/encounter-generator/NORTH_STAR.md
- docs/projects/encounter-generator/TRACKER.md
- docs/projects/encounter-generator/GAPS.md
- docs/projects/encounter-generator/COLD_START_AGENT_PROMPT.md
- docs/projects/encounter-generator/DECISIONS.md
- docs/projects/encounter-generator/AUDIT_OR_PROOF.md
- docs/projects/encounter-generator/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
