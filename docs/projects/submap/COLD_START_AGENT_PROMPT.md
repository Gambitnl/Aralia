---
schema_version: 1
handoff_type: agent_to_agent
project: Submap and Tile-Grid Retirement
slug: submap
status: active
last_updated: 2026-06-15
iteration: 6
source_agent: Antigravity
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
# Submap and Tile-Grid Retirement Cold Start Agent Handoff

Status: active
Last updated: 2026-06-15

Shared workflow:
[ITERATION_AGENT_WORKFLOW.md](file:///f:/Repos/Aralia/docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md)

Workflow gaps:
[WORKFLOW_GAPS.md](file:///f:/Repos/Aralia/docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md)

Dashboard schema:
[PROJECT_CARD_SCHEMA.md](file:///f:/Repos/Aralia/docs/projects/PROJECT_CARD_SCHEMA.md)

Project entry point:
[NORTH_STAR.md](file:///f:/Repos/Aralia/docs/projects/submap/NORTH_STAR.md)

## Iteration Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 6 | Antigravity / Gemini 3.5 Flash | application agent | certain | 2026-06-15 | Antigravity IDE agent executing project setup and grid retirement registration. |
| 5 | Cursor / Composer | application agent | certain | 2026-06-10 | Cursor IDE agent executing COLD_START_AGENT_PROMPT.md T3/T4/T5 extraction slice. |
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original submap handoff predates the ledger requirement. |

## Current State

- DOM/tile Submap remains in place; grid and Submap retirement starts.
- MapPane is decoupled from square-grid hover readouts and the yellow target overlay.
- `submapActionContracts.ts` provides UI-independent quick-travel and inspect payload helpers.
- Decisions D-007 (project upgrade) and D-008 (Worldforge placement and cell-native travel seams) are recorded.
- Gaps G9-G12 covering grid dependencies are registered in GAPS.md.
- Cell-native travel is routed as global gap GG-28.

## Active Task

Task:
T6 — Inventory every load-bearing consumer of MapData.tiles + the Submap panes and record a retirement order.

Acceptance criteria:
- Every tiles/grid consumer is listed in `DEPENDENCY_CONTRACT.md`.
- A classification and retirement order is defined for each dependent system.
- Do not delete or replace any components yet.

Key files:
- `src/types/world.ts`
- `src/components/MapPane.tsx`
- `docs/projects/submap/DEPENDENCY_CONTRACT.md`

Scoped verification:
- Validate that codebase search hits for `MapData.tiles` and `gridSize` match the matrix in `DEPENDENCY_CONTRACT.md`.

Blocking dependencies / do-not-touch:
- Do not delete legacy Submap/grid components; per D21, they must stay in-tree but unmounted.
- Do not implement cell-native travel directly; that is owned by travel system (GG-28).

Recent progress:
- Upgraded project surface, registered decisions, and added grid-retirement gaps.

Workflow gap review:
- Read `WORKFLOW_GAPS.md`; no new workflow-level ambiguity introduced.

agent_comments: Project upgraded. Next agent should build the comprehensive dependent matrix for `MapData.tiles` before starting any unmounting or deletion.

## Required End State For This Iteration

- Update the project docs in place.
- Keep the current handoff only; do not preserve older transcript blocks between the markers.

---BEGIN NEXT AGENT HANDOFF---
Project: Submap and Tile-Grid Retirement
Project folder: docs/projects/submap
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/submap/NORTH_STAR.md
Tracker: docs/projects/submap/TRACKER.md
Gaps: docs/projects/submap/GAPS.md

## Previous Agent Handoff
The Submap project was upgraded to own the legacy rectangular tile-grid world model retirement. Decisions D-007 and D-008, plus gaps G9-G12, were added to formalize the retirement plan, the Worldforge placement, and the cell-native travel seam (GG-28).

## Current Mission

Active task:
T6 — Inventory every load-bearing consumer of MapData.tiles + the Submap panes and record a retirement order.

Acceptance criteria:
- Map all grid/submap consumers in the dependency matrix.
- Classify each dependency and define a planned retirement order.
- Do not perform any code deletion or replacement.

Key files to touch:
- docs/projects/submap/DEPENDENCY_CONTRACT.md
- docs/projects/submap/TRACKER.md

Scoped verification:
- Verify that all grid-dependent callers are accounted for.

Blocking dependencies / do-not-touch:
Do not delete Submap/grid components yet; keep them unmounted in-tree when retired (D21). Do not implement cell-native travel (GG-28).
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-15

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 6 | Antigravity / Gemini 3.5 Flash | application agent | certain | 2026-06-15 | Antigravity IDE agent executing project setup and grid retirement registration. |
| 5 | Cursor / Composer | application agent | certain | 2026-06-10 | Cursor IDE agent executing COLD_START_AGENT_PROMPT.md T3/T4/T5 extraction slice. |
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original submap handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/submap/NORTH_STAR.md
- docs/projects/submap/TRACKER.md
- docs/projects/submap/GAPS.md
- docs/projects/submap/COLD_START_AGENT_PROMPT.md
- docs/projects/submap/DECISIONS.md
- docs/projects/submap/AUDIT_OR_PROOF.md
- docs/projects/submap/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
