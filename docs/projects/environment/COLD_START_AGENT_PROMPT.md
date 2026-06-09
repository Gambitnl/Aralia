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

---BEGIN NEXT AGENT HANDOFF---
Project: Environment System
Project folder: docs/projects/environment
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/environment/NORTH_STAR.md
Tracker: docs/projects/environment/TRACKER.md
Gaps: docs/projects/environment/GAPS.md

## Previous Agent Handoff

Iteration 2 established the living-project doc stack and identified runtime/weather gaps.
This pass closed `G1` by wiring `updateWeather` into the day-boundary `ADVANCE_TIME`
flow and adding reducer coverage for biome resolution and scheduler behavior.

## Current Mission

Active task:
T4 - Define a deterministic randomness policy for weather/naval systems by reviewing `G2`
in `docs/projects/environment/GAPS.md`.

Acceptance criteria:
Keep the existing runtime scheduler boundary in `worldReducer.ts` unless product approves
an alternate turn-based tick. The pass should classify each weather/naval random path as
seeded or explicitly non-replay and document that split in `docs/projects/environment/GAPS.md`
and `docs/projects/environment/TRACKER.md`.

Key files to touch:
- `src/systems/environment/WeatherSystem.ts`
- `src/systems/environment/EnvironmentSystem.ts`
- `src/systems/naval/VoyageManager.ts`
- `src/state/reducers/worldReducer.ts`
- `src/state/reducers/__tests__/worldReducer.test.ts`
- `src/state/reducers/navalReducer.ts` (if policy requires coupling changes)
- `docs/projects/environment/GAPS.md`
- `docs/projects/environment/TRACKER.md`
- `docs/projects/environment/NORTH_STAR.md`
- `docs/projects/environment/COLD_START_AGENT_PROMPT.md`

Scoped verification:
Run targeted tests and in-repo proof files:
- `src/state/reducers/__tests__/worldReducer.test.ts`
- `docs/projects/environment/GAPS.md`
- `docs/projects/environment/NORTH_STAR.md`
- `docs/projects/environment/TRACKER.md`

Blocking dependencies / do-not-touch:
Do not expand scope beyond Environment System and direct runtime couplings.
Do not edit unrelated project docs unless this task is explicitly re-routed by
`docs/projects/PROJECT_TRACKER.md`.

Recent progress:
`G1` is resolved across `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` with
production weather progression in `src/state/reducers/worldReducer.ts`.

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

Final response must update all required end-state fields above and keep only this handoff
content inside the `---BEGIN`/`---END` block.
---END NEXT AGENT HANDOFF---
