# Environment System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/environment/NORTH_STAR.md

agent_comments: none

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 4 | Hegel / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019ea9f8-5201-7240-9280-aa92fc362d96` |
| 5 | Heisenberg / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019eaa2d-174d-7383-ab47-decae14e099f` |
| 6 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Local combat-movement integration and proof |

---BEGIN NEXT AGENT HANDOFF---
Project: Environment System
Project folder: docs/projects/environment
Iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/environment/NORTH_STAR.md
Tracker: docs/projects/environment/TRACKER.md
Gaps: docs/projects/environment/GAPS.md
Decisions: docs/projects/environment/DECISIONS.md
Audit or proof: docs/projects/environment/AUDIT_OR_PROOF.md
Runbook: docs/projects/environment/RUNBOOK.md

## Previous Agent Handoff

Iteration 4 normalized the legacy weather bridge and left terrain/hazard integration as the next open slice.
This pass resolved `G4` by adding a shared weather summary helper, reattaching `currentWeather` as a derived compatibility field on writes, and moving world/commentary/NPC-interaction consumers onto `GameState.environment`. Focused tests now prove the canonical weather summary still resolves from structured weather state, the compatibility bridge survives for older consumers, and `WorldEventManager` now reads the canonical environment instead of `(state as any).weather`.
Iteration 6 closed `G5` by wiring battle-map landing tiles through the environment terrain/hazard helpers in the combat movement path. Mud now carries quicksand metadata in the terrain registry, the movement command applies the resulting status effect on landing, and focused tests prove the helper output is consumed in live flow.

## Current Mission

Active task:
No open Environment gap remains after `G5`; wait for a fresh Environment gap or an explicitly re-routed adjacent slice.

Acceptance criteria:
Satisfied in source and tests for the combat movement landing path. The live path now consumes terrain/hazard helper output and keeps the weather bridge policy intact.

Files touched this pass:
- `src/commands/effects/MovementCommand.ts`
- `src/systems/environment/EnvironmentSystem.ts`
- `src/systems/environment/TerrainSystem.ts`
- `src/commands/effects/__tests__/MovementCommand.test.ts`
- `src/systems/environment/__tests__/EnvironmentSystem.test.ts`
- `src/systems/environment/__tests__/TerrainSystem.test.ts`
- `src/systems/environment/__tests__/hazards.test.ts`
- `docs/projects/environment/GAPS.md`
- `docs/projects/environment/TRACKER.md`
- `docs/projects/environment/NORTH_STAR.md`
- `docs/projects/environment/AUDIT_OR_PROOF.md`
- `docs/projects/environment/COLD_START_AGENT_PROMPT.md`

Scoped verification:
Run targeted tests and proof files relevant to the terrain/hazard wiring:
- `src/systems/environment/__tests__/*`
- `src/systems/world/__tests__/*` if the live path is touched
- `docs/projects/environment/GAPS.md`
- `docs/projects/environment/NORTH_STAR.md`
- `docs/projects/environment/TRACKER.md`

Blocking dependencies / do-not-touch:
Do not expand scope beyond Environment System and the terrain/hazard integration slice.
Do not edit unrelated project docs unless this task is explicitly re-routed by `docs/projects/PROJECT_TRACKER.md`.

Recent progress:
`G3` and `G4` are resolved in source and docs. `TerrainSystem.TERRAIN_RULES` is now the canonical shared registry, and `EnvironmentSystem.TERRAIN_RULES` remains a battle-map compatibility overlay.
`G5` is now resolved in source and docs. Combat movement landings consume the battle-map terrain overlay and hazard helpers, with explicit preservation tests covering the mud/quicksand path.

## Required End State For This Iteration

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

Final response must update all required end-state fields above and keep only this handoff content inside the `---BEGIN`/`---END` block.
---END NEXT AGENT HANDOFF---
