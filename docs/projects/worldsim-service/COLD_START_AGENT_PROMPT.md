---
schema_version: 1
handoff_type: agent_to_agent
project: Worldsim Service
slug: worldsim-service
Status: active
last_updated: 2026-06-10
iteration: 4
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/worldsim-service/NORTH_STAR.md
tracker: docs/projects/worldsim-service/TRACKER.md
gaps: docs/projects/worldsim-service/GAPS.md
---
# Worldsim Service Cold Start Agent Handoff

Status: active
Last updated: 2026-06-10

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/worldsim-service/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: WorldSim Service
Project folder: docs/projects/worldsim-service
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/worldsim-service/NORTH_STAR.md
Tracker: docs/projects/worldsim-service/TRACKER.md
Gaps: docs/projects/worldsim-service/GAPS.md

## Previous Agent Handoff

This pass resolved WSS-007 by adding deterministic smoothing to biome-derived fallback
heights (cliff seams reduced at biome borders) while preserving seed determinism and broad
elevation ordering. WSS-006 remains closed from the prior pass.

## Current Mission

Active task:
T3 remains the tracker-owned active slice: grow first-build world history/story/events
generation. The migration/fidelity lane for WSS-007 is now complete; next work can return to
T3 world-story output.

Acceptance criteria:
For T3, define what "world story at first build" produces (seeded history, founding
events, lore) and how it attaches to `WorldData`/save. Keep the scope inside
`docs/projects/worldsim-service/*` plus the named source files. WSS-007 is already remediated in
this pass, so subsequent agents can resume T3 story-definition work without re-entering this
same migration lane.

Key files to touch:
- docs/projects/worldsim-service/NORTH_STAR.md
- docs/projects/worldsim-service/TRACKER.md
- docs/projects/worldsim-service/GAPS.md
- docs/projects/worldsim-service/COLD_START_AGENT_PROMPT.md
- src/services/worldSim/heightFromBiomes.ts
- src/services/worldSim/__tests__/heightFromBiomes.test.ts
- src/services/worldSim/__tests__ (focused suite)
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. For this pass, the climate fallback proof is:
`npm test -- --run src/services/worldSim/__tests__/climateFromBiomes.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts`.
This pass used:
`npm test -- --run src/services/worldSim/__tests__/heightFromBiomes.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts`
and `npm test -- --run src/services/worldSim/__tests__` (focused full worldSim suite).

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
WSS-006 is closed. The migration fallback now derives biome-based temperatures/moisture
from `src/services/worldSim/climateFromBiomes.ts`, and the direct helper + migration tests
passed. `TRACKER.md` now points future work at WSS-007 or the story/history slice.

Workflow-gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read and left
unchanged; WFG-001 still applies as a shared path-mismatch warning, but it did not alter this
project pass.

Dashboard-schema updates:
`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`, and the
`docs/projects/PROJECT_TRACKER.md` WorldSim Service row were refreshed. `agent_comments` was
left empty because no out-of-flow note was needed.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying
them here. WSS-007 is closed; only reopen this migration lane if a meaningful fallback fidelity
counterexample appears.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
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
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-10

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original worldsim-service handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/worldsim-service/NORTH_STAR.md
- docs/projects/worldsim-service/TRACKER.md
- docs/projects/worldsim-service/GAPS.md
- docs/projects/worldsim-service/COLD_START_AGENT_PROMPT.md
- docs/projects/worldsim-service/DECISIONS.md
- docs/projects/worldsim-service/AUDIT_OR_PROOF.md
- docs/projects/worldsim-service/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
