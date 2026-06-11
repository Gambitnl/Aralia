---
schema_version: 1
handoff_type: agent_to_agent
project: Submap
slug: submap
status: active
last_updated: "2026-06-10"
iteration: 5
source_agent: Cursor / Composer
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/submap/NORTH_STAR.md
tracker: docs/projects/submap/TRACKER.md
gaps: docs/projects/submap/GAPS.md
---
# Submap Cold Start Agent Handoff

Status: active
Last updated: 2026-06-10

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/submap/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Cursor / Composer | application agent | certain | 2026-06-10 | Cursor IDE agent executing COLD_START_AGENT_PROMPT.md T3/T4/T5 extraction slice. |

## Current State

- DOM/tile Submap remains in place; extraction-only work continues.
- `submapActionContracts.ts` provides UI-independent quick-travel and inspect
  payload helpers with 9 passing Vitest tests.
- `DEPENDENCY_CONTRACT.md` now includes an 18-row extraction matrix.
- `GENERATION_MODULARIZATION.md` names the `generateLocalTerrainData` path.
- T3/T4/T5 are in progress; G7 (SubmapPane wiring) and G8 (generation core)
  are the next safe slices.

## Active Task

Task:
Continue T3/T5 extraction — wire SubmapPane through `submapActionContracts`
and extract `generateLocalTerrainData` from `useSubmapProceduralData`.

Acceptance criteria:
- SubmapPane uses shared contract helpers without payload drift (G7).
- Non-React generation core matches hook output for plains/cave/wetland (G8).
- Project docs stay aligned; no component deletion.

Key files:
- `src/utils/spatial/submapActionContracts.ts`
- `src/components/Submap/SubmapPane.tsx`
- `src/hooks/useSubmapProceduralData.ts`
- `docs/projects/submap/GENERATION_MODULARIZATION.md`
- `docs/projects/submap/DEPENDENCY_CONTRACT.md`

Scoped verification:
- `npx vitest run src/utils/spatial/__tests__/submapActionContracts.test.ts`
- `git diff --check` for all touched files

Blocking dependencies / do-not-touch:
- Do not delete the DOM/tile Submap surface or replace components.
- Defer painter splits until G3/G6/CMA-G16 inventory is complete.

Recent progress:
- Action contract module and tests landed (T3 partial).
- Dependent-system matrix drafted (T4 partial).
- Generation modularization plan written (T5 partial).

Workflow gap review:
- Read `WORKFLOW_GAPS.md`; no new workflow-level ambiguity introduced.

agent_comments: Extraction-only pass. Next agent should wire SubmapPane (G7)
then extract generation core (G8) before any deprecation talk.

## Required End State For This Iteration

- Update the project docs in place.
- Keep the current handoff only; do not preserve older transcript blocks between the markers.

---BEGIN NEXT AGENT HANDOFF---
Project: Submap
Project folder: docs/projects/submap
Iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/submap/NORTH_STAR.md
Tracker: docs/projects/submap/TRACKER.md
Gaps: docs/projects/submap/GAPS.md

## Previous Agent Handoff

T3/T4/T5 extraction slice landed UI-independent action contract helpers with
tests, an 18-row dependent-system matrix, and a generation modularization plan.
SubmapPane is not yet wired through the shared module.

## Current Mission

Active task:
G7 + G8 — Wire SubmapPane through `submapActionContracts`, then extract
`generateLocalTerrainData` from `useSubmapProceduralData`.

Acceptance criteria:
- No payload field drift between SubmapPane dispatch and contract helpers.
- Generation core fixture parity for plains, cave, and wetland biomes.
- Do not delete or replace Submap components.

Key files to touch:
- src/utils/spatial/submapActionContracts.ts
- src/components/Submap/SubmapPane.tsx
- src/hooks/useSubmapProceduralData.ts
- docs/projects/submap/GENERATION_MODULARIZATION.md
- docs/projects/submap/NORTH_STAR.md
- docs/projects/submap/TRACKER.md
- docs/projects/submap/GAPS.md
- docs/projects/submap/AUDIT_OR_PROOF.md
- docs/projects/submap/COLD_START_AGENT_PROMPT.md

Scoped verification:
npx vitest run src/utils/spatial/__tests__/submapActionContracts.test.ts
git diff --check for all touched files

Blocking dependencies / do-not-touch:
Do not delete the DOM/tile Submap surface. Do not split painters before G6/CMA-G16.

Recent progress:
submapActionContracts.ts (9 tests pass), DEPENDENCY_CONTRACT matrix,
GENERATION_MODULARIZATION.md plan, G7/G8 registered.

agent_comments: Wire callers before deleting anything. Minimap is the first
consumer candidate for the extracted generation core.

Required closeout reminders:
- Keep NORTH_STAR, TRACKER, GAPS, and this handoff aligned.
- Keep the handoff compact; only the latest iteration ledger row should remain.
---END NEXT AGENT HANDOFF---
