---
schema_version: 1
handoff_type: agent_to_agent
project: Crime System
slug: crime
status: active
last_updated: 2026-06-25
iteration: 6
source_agent: Codex
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/crime/NORTH_STAR.md
tracker: docs/projects/crime/TRACKER.md
gaps: docs/projects/crime/GAPS.md
---
# Crime System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-25

This file is the project-specific context package and directive checklist for
the next cold-start agent. It does not duplicate the full workflow rules. Follow
the shared workflow file and use this file for current project context, resume
state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crime/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Codex | application agent | certain | 2026-06-25 | Resolved G1 expired-bounty cleanup in `CrimeSystem.ts` and `crimeReducer.ts` |
| 3 | Codex | application agent | certain | 2026-06-25 | Resolved G2 fence outcome contract with `SELL_FENCED_ITEM` |
| 4 | Codex | application agent | certain | 2026-06-25 | Resolved G3 criminal market utility ownership as preserved tested scaffolding |
| 5 | Codex | application agent | certain | 2026-06-25 | Resolved G4 heat/severity unit boundary in `CrimeSystem.ts` and `crimeReducer.ts` |

---BEGIN NEXT AGENT HANDOFF---
Project: Crime
Project folder: docs/projects/crime
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crime/NORTH_STAR.md
Tracker: docs/projects/crime/TRACKER.md
Gaps: docs/projects/crime/GAPS.md

## Previous Agent Handoff

Iteration 1 established the Crime living-project doc set and left T3
unresolved. Iteration 2 completed G1 expired-bounty cleanup: bounty expiration
now uses in-game crime time, and expired timed bounties prune during
`ADVANCE_TIME`. Iteration 3 completed G2: fence sales now use
`SELL_FENCED_ITEM`, pay gold/remove items through character state, and raise
crime heat through crime state. Iteration 4 completed G3: `BlackMarketSystem.ts`
and `fencing/FenceSystem.ts` are preserved as tested future scaffolds with no
active product callers. Iteration 5 completed G4: crime severity normalization
and heat calculation now live in `CrimeSystem`.

## Current Mission

Active task:
T3 - Continue the in-scope Crime gap set with G5 TODO/type-debt classification.

Acceptance criteria:
Use the T3 row in `TRACKER.md` and the open entries in `GAPS.md`. G5 should
classify each remaining Crime TODO/lint-intent marker as either intentional
preserved debt with a clear next step or a narrow wiring/type cleanup that can
be implemented safely.

Key files to touch:
- `docs/projects/crime/NORTH_STAR.md`
- `docs/projects/crime/TRACKER.md`
- `docs/projects/crime/GAPS.md`
- `docs/projects/crime/COLD_START_AGENT_PROMPT.md`
- `docs/projects/crime/AUDIT_OR_PROOF.md`
- `src/state/reducers/crimeReducer.ts`
- `src/systems/crime/CrimeSystem.ts`
- `src/systems/crime/SmugglingSystem.ts`
- `src/systems/crime/fencing/FenceSystem.ts`
- `src/state/appState.ts`
- Any source/docs named by the selected implementation path

Scoped verification:
If changing code, run focused tests for the touched behavior. If policy-only,
record a source-backed classification table and proof expectations before
closing the gap.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of copying them here. Do not reopen G1-G4 unless their focused tests
fail or the source contract has changed.

Recent progress:
G1-G3 are resolved. `CrimeSystem.test.ts` covers deterministic bounty
expiration and pruning; `crimeReducer.test.ts` covers `ADVANCE_TIME` cleanup
and fence heat; `characterReducer.test.ts` covers fence item/gold handling;
BlackMarket/Fence utility tests cover preserved scaffolding. `TRACKER.md` now
points the next agent at G5, and `GAPS.md` remains the authoritative blocker
list for G5-G6.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, active task,
acceptance criteria, key files, verification method, blockers, recent progress,
workflow-gap review result, and dashboard-schema updates. Account for every
required doc, mention optional docs touched or skipped, update `agent_comments`
only when an out-of-flow note is useful, and keep only the current handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
