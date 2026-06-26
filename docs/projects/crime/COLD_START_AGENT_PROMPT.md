---
schema_version: 1
handoff_type: agent_to_agent
project: Crime System
slug: crime
status: complete_for_current_gap_set
last_updated: 2026-06-25
iteration: 8
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
| 6 | Codex | application agent | certain | 2026-06-25 | Resolved G5 TODO/type-debt classification with heist typing cleanup and preserved-scaffold notes |
| 7 | Codex | application agent | certain | 2026-06-25 | Resolved G6 suspect/report aggregate decision as intentionally deferred until an active caller needs structured reports |

---BEGIN NEXT AGENT HANDOFF---
Project: Crime
Project folder: docs/projects/crime
iteration: 8
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
and heat calculation now live in `CrimeSystem`. Iteration 6 completed G5:
heist planning/intel typing is tightened, reducer `any` casts are gone, and the
remaining Crime TODO markers are classified in `GAPS.md`. Iteration 7 completed
G6: no suspect/report aggregate is added yet because no guard, memory, faction,
or UI caller currently consumes structured Crime reports.

## Current Mission

Active task:
None in current Crime gap set. T3 and G1-G6 are complete.

Acceptance criteria:
Before assigning more Crime work, run a fresh source-backed scan and open a new
gap if the source evidence supports it. Do not add canonical suspect/report
types unless a concrete caller needs structured reports.

Key files to touch:
- `docs/projects/crime/NORTH_STAR.md`
- `docs/projects/crime/TRACKER.md`
- `docs/projects/crime/GAPS.md`
- `docs/projects/crime/COLD_START_AGENT_PROMPT.md`
- `docs/projects/crime/AUDIT_OR_PROOF.md`
- `src/state/reducers/crimeReducer.ts`
- `src/systems/crime/CrimeSystem.ts`
- `src/systems/crime/HeistManager.ts`
- `src/systems/crime/SmugglingSystem.ts`
- `src/systems/crime/fencing/FenceSystem.ts`
- Any source/docs named by the selected implementation path

Scoped verification:
If changing code, run focused tests for the touched behavior. If policy-only,
record source-backed ownership and proof expectations before opening or closing
any new gap.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of copying them here. Do not reopen G1-G6 unless their focused tests
fail or the source contract has changed.

Recent progress:
G1-G6 are resolved. `CrimeSystem.test.ts` covers deterministic bounty
expiration, pruning, severity normalization, and heat scaling;
`crimeReducer.test.ts` covers `ADVANCE_TIME` cleanup, fence heat, and heist
typing behavior; `characterReducer.test.ts` covers fence item/gold handling;
BlackMarket/Fence utility tests cover preserved scaffolding. `TRACKER.md` now
marks T3 done, and `GAPS.md` has zero open Crime-owned entries.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, active task,
acceptance criteria, key files, verification method, blockers, recent progress,
workflow-gap review result, and dashboard-schema updates. Account for every
required doc, mention optional docs touched or skipped, update `agent_comments`
only when an out-of-flow note is useful, and keep only the current handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
