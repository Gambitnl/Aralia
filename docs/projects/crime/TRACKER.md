# Crime System Living Tracker

Status: active
Last updated: 2026-06-25

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T3 | done | Resolve in-scope crime gap set in `docs/projects/crime/GAPS.md` after implementation handoff. | Codex | 2026-06-25 | `docs/projects/crime/GAPS.md`, `src/systems/crime/CrimeSystem.ts`, `src/systems/crime/HeistManager.ts`, `src/state/reducers/crimeReducer.ts`, `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/reducers/characterReducer.ts`, `src/systems/crime/BlackMarketSystem.ts`, `src/systems/crime/fencing/FenceSystem.ts` | G1-G6 complete; no current Crime-owned gaps remain | Run a fresh source-backed Crime scan before assigning more Crime work |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/projects/crime/GAPS.md` | This pass | Expired bounty cleanup is missing. | `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts`, focused tests | Prevents stale bounties from persisting indefinitely. | Completed 2026-06-25: bounty expiration uses game time and expired timed bounties prune during `ADVANCE_TIME`. | `npm exec vitest run src/systems/crime/__tests__/CrimeSystem.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed. |
| G2 | done | in_scope_now | Codex | `docs/projects/crime/GAPS.md` | This pass | Fence sell path bypasses dedicated crime outcome contract. | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts`, `src/state/reducers/crimeReducer.ts` | Heat/suspicion no longer diverges from fence sales. | Completed 2026-06-25: `SELL_FENCED_ITEM` pays gold/removes item and raises local/global heat. | Focused reducer/system tests passed 28/28. |
| G3 | done | ownership | Codex | `docs/projects/crime/GAPS.md` | This pass | Orphan/isolated criminal market systems are not actively consumed. | `BlackMarketSystem.ts` and `fencing/FenceSystem.ts` dependency headers refreshed 2026-06-25; caller scan finds tests/docs only | Missed maintainability and dead-path risk now has an explicit ownership status. | Completed 2026-06-25: preserve as tested future scaffolding, not active caller behavior. | Utility tests passed 10/10 and dependency headers remain orphan/isolated. |
| G4 | done | mechanics | Codex | `docs/projects/crime/GAPS.md` | This pass | Heat scale and severity math assumptions drift across reducer and core system comments. | `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts`, focused tests | Produces inconsistent gameplay tuning and test interpretation risk. | Completed 2026-06-25: centralized severity normalization and heat calculation in `CrimeSystem`. | Focused CrimeSystem/crimeReducer tests passed 15/15 after TDD red/green. |
| G5 | done | typing-safety | Codex | `docs/projects/crime/GAPS.md` | This pass | Type/TODO debt remained intentionally unresolved in several crime files. | `src/systems/crime/HeistManager.ts`, `src/state/reducers/crimeReducer.ts`, `docs/projects/crime/GAPS.md` G5 classification table | Heist reducer behavior no longer relies on local `any` casts, and remaining Crime TODOs have owner/action notes. | Completed 2026-06-25: typed heist planner/intel flow and classified preserved scaffolding. | Focused heist/crime reducer tests passed 19/19. |
| G6 | done | design_decision_deferred | Codex | `docs/projects/crime/GAPS.md` | This pass | Crime has no dedicated suspect/report aggregate model. | `src/types/crime/index.ts`, `src/types/state.ts`, `src/state/reducers/crimeReducer.ts`, `rg` scan for suspect/report/witness terms | The absence is now explicit and should not be mistaken for missing implementation in this slice. | Completed 2026-06-25: defer canonical report types until a real guard, memory, faction, or UI caller needs structured reports. | Source-backed decision recorded; focused heist/crime reducer tests passed 19/19. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
