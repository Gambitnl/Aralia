# History System Living Tracker

Status: active
Last updated: 2026-06-15

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
|---|---|---|---|---|---|---|
| T2 | done | Audit all current world-history producers and map intended event sources against `WorldHistoryEventType`. | Worker A | 2026-06-15 | `src/types/history.ts`, `src/services/WorldHistoryService.ts`, `src/systems/world/WorldEventManager.ts`, `src/systems/history/HistoryService.ts`, `src/hooks/useGameInitialization.ts`, `src/state/reducers/worldReducer.ts` | Source map complete; producer map aligned with code scan. | Keep gap classifications aligned with updated map. |
| T3 | active | Define retention and lifecycle policy for `worldHistory` and its save compatibility impact. | Worker A | 2026-05-31 | `src/utils/world/historyUtils.ts`, `src/types/world.ts`, `src/systems/world/WorldEventManager.ts` | Decide policy (no prune, periodic archive, external rollup, etc.) and document acceptance criteria. | Identify migration risks for save/load and test coverage targets for pruning behavior. |
| T4 | active | Validate read/query contract for timeline behavior and consumer expectations. | Worker A | 2026-05-31 | `src/utils/world/historyUtils.ts`, `src/types/history.ts`, `src/systems/world/World_Ralph.md` | Decide whether timeline view, replay, or replay-like query paths are in this project scope. | Add a concrete gap or in-scope note for each missing consumer contract. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker A | `docs/projects/history/GAPS.md` | T2 | No retention/pruning policy for permanent world history. | `src/utils/world/historyUtils.ts` lacks prune logic; `src/types/world.ts` rumors include expiration while world history does not. | Define explicit policy and add acceptance proof before any policy touchpoints (save/load, replay, memory cap). | Add `history size/lifecycle` decision row in `GAPS.md` with explicit follow-up. |
| G2 | active | support_needed_now | Worker A | `docs/projects/history/GAPS.md` | T2 | Only skirmishes are persistently written to `worldHistory`; other history types are factory-only or missing entirely. | `WorldEventManager.ts` calls `createSkirmishEvent`; `HistoryService.ts` has other creators with no runtime producer call sites in this scan; `WorldHistoryEventType` also declares `HEROIC_DEED` and `MYSTERY_SOLVED`. | Missing event classes reduce chronology completeness and downstream replay quality. | Decide whether the missing types need emitters or should be marked out of scope, then close the matrix gap. | Update source map and close G2 once the producer-to-type decision is documented. |
| G3 | active | support_needed_now | Worker A | `docs/projects/history/GAPS.md` | T3/T4 | No timeline/replay/UI contract for `worldHistory`; query methods are helper-only. | `historyUtils.ts` offers sort/filter utilities; no export consumers for timeline rendering/replay have been found in this slice. | Harder to reason about observability and player-facing chronology. | Define contract for whether this layer feeds player/diagnostic timeline outputs. | Add one concrete in-project read-path gap row with verification criteria. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
