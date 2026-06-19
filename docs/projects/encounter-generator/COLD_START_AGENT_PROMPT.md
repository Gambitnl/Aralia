---
schema_version: 1
handoff_type: agent_to_agent
project: Encounter Generator
slug: encounter-generator
status: review-required
last_updated: 2026-06-18
iteration: 4
source_agent: Codex CLI agent
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: inferred
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/encounter-generator/NORTH_STAR.md
tracker: docs/projects/encounter-generator/TRACKER.md
gaps: docs/projects/encounter-generator/GAPS.md
---
# Encounter Generator Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-18

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
| 4 | Codex CLI agent | CLI agent | inferred | 2026-06-18 | Shell-only Codex coding session with project workspace access |

---BEGIN NEXT AGENT HANDOFF---
Project: Encounter Generator
Project folder: docs/projects/encounter-generator
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/encounter-generator/NORTH_STAR.md
Tracker: docs/projects/encounter-generator/TRACKER.md
Gaps: docs/projects/encounter-generator/GAPS.md

## Previous Agent Context

Iteration 3/4 review-gate pass confirmed the project remains `review-required`:
- No G4 product decision is recorded in `DECISIONS.md`, `GLOBAL_GAPS.md`, or the decision blitz docs.
- Existing deterministic local generation and fallback tests still pass.
- Forward implementation was intentionally not continued because the handoff forbids work beyond T3 until the G4 review decision is recorded.

## Current Mission

Active task:
T3 - Close seeded encounter generation and difficulty contract slice only after G4 decision

Acceptance criteria:
- Keep implementation scoped to encounter seedability and shared difficulty contract only.
- Verify seeded fallback + bestiary reproducibility through focused tests.
- Confirm docs reflect implemented status and the open G4 review gate.
- Ensure tracker/NORTH_STAR/TASK docs stay aligned and compact.
- Do not continue forward implementation until the G4 review decision is recorded.

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
- Run targeted Vitest files for deterministic bestiary and fallback coverage.
- Run the living-project docs audit and confirm the encounter-generator block has no schema/doc/handoff issues.

Blockers / do-not-touch:
- Stay inside encounter-generator scope.
- Do not edit unrelated projects or global workflow trackers unless they are direct blockers.
- G4 is a product/human decision, not a code task. Do not choose strict AI replay or local-only replay on behalf of the owner.

Recent progress:
- Seed flow is active for local generation and fallback.
- Difficulty display/rebuild logic is consistently sourced.
- 2026-06-18 focused verification passed: `npx vitest run src/utils/world/__tests__/bestiaryEncounterGenerator.test.ts src/services/__tests__/geminiServiceFallback.test.ts` passed 2 files / 7 tests.
- `npm run projects:audit` reports `encounter-generator` schema valid, no missing required docs, no missing prompt needles, no tracker contract gaps, no gap contract gaps, and no dirty dates.
- G4 remains undecided; current review brief is in `NORTH_STAR.md` and `GAPS.md`.

Workflow gap review result:
- Reviewed `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
- Current workflow gates unchanged.

Dashboard schema fields updated:
- `Last updated`: 2026-06-18
- `Active agent`: Codex CLI agent
- `Agent pass status`: review_required
- `Agent pass started at`: 2026-06-18T21:26:50+02:00
- `Agent pass ended at`: 2026-06-18T21:29:31+02:00
- `Workflow gaps reviewed`: 2026-06-18
- `Last proof`: 2026-06-18

Optional docs:
- Encounter-generator optional docs are intentionally absent in this scope.

## Documentation compaction status

Compaction status: not_needed
Rationale: current handoff remains compact and only the active block is retained.

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

Last updated: 2026-06-18

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
