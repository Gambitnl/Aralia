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
| T3 | active | Resolve in-scope crime gap set in `docs/projects/crime/GAPS.md` after implementation handoff. | Codex | 2026-06-25 | `docs/projects/crime/GAPS.md`, `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts`, `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/reducers/characterReducer.ts`, `src/systems/crime/BlackMarketSystem.ts`, `src/systems/crime/fencing/FenceSystem.ts` | G1-G4 complete; continue with G5 TODO/type-debt classification | Document closure decisions or implement narrow wiring for the remaining TODO markers |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/projects/crime/GAPS.md` | This pass | Expired bounty cleanup is missing. | `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts`, focused tests | Prevents stale bounties from persisting indefinitely. | Completed 2026-06-25: bounty expiration uses game time and expired timed bounties prune during `ADVANCE_TIME`. | `npm exec vitest run src/systems/crime/__tests__/CrimeSystem.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed. |
| G2 | done | in_scope_now | Codex | `docs/projects/crime/GAPS.md` | This pass | Fence sell path bypasses dedicated crime outcome contract. | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts`, `src/state/reducers/crimeReducer.ts` | Heat/suspicion no longer diverges from fence sales. | Completed 2026-06-25: `SELL_FENCED_ITEM` pays gold/removes item and raises local/global heat. | Focused reducer/system tests passed 28/28. |
| G3 | done | ownership | Codex | `docs/projects/crime/GAPS.md` | This pass | Orphan/isolated criminal market systems are not actively consumed. | `BlackMarketSystem.ts` and `fencing/FenceSystem.ts` dependency headers refreshed 2026-06-25; caller scan finds tests/docs only | Missed maintainability and dead-path risk now has an explicit ownership status. | Completed 2026-06-25: preserve as tested future scaffolding, not active caller behavior. | Utility tests passed 10/10 and dependency headers remain orphan/isolated. |
| G4 | done | mechanics | Codex | `docs/projects/crime/GAPS.md` | This pass | Heat scale and severity math assumptions drift across reducer and core system comments. | `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts`, focused tests | Produces inconsistent gameplay tuning and test interpretation risk. | Completed 2026-06-25: centralized severity normalization and heat calculation in `CrimeSystem`. | Focused CrimeSystem/crimeReducer tests passed 15/15 after TDD red/green. |
| G5 | not_started | support_needed_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Type/TODO debt remains intentionally unresolved in several crime files. | `src/systems/crime/CrimeSystem.ts`, `src/systems/crime/SmugglingSystem.ts`, `src/systems/crime/fencing/FenceSystem.ts`, `src/state/reducers/crimeReducer.ts` | Weakens refactor safety and can hide real behavior hooks. | Resolve each TODO as intentional debt vs wiring tasks. | Reduced lint-intent count and explicit comments on deferred items. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
