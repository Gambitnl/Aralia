# Encounter Generator Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-09

This file is the active handoff for the next agent. It replaces this previous iteration record.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/encounter-generator/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Encounter Generator
Project folder: docs/projects/encounter-generator
Iteration: 3
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
---END NEXT AGENT HANDOFF---
