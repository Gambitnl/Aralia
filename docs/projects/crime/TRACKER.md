# Crime System Living Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Create and initialize the Crime living-project docs. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` row; initial scaffold commit | Not needed | Not needed |
| T2 | done | Enrich the three Crime project docs with evidence-backed state map, gaps, and resume path. | Worker A | 2026-05-31 | `src/systems/crime/**`, `src/state/reducers/crimeReducer.ts`, `src/components/Crime/ThievesGuild` | Pause for implementation handoff | `git diff --check` and file-to-evidence reconciliation |
| T3 | active | Resolve in-scope crime gap set in `docs/projects/crime/GAPS.md` after implementation handoff. | Worker A | 2026-06-05 | `docs/projects/crime/GAPS.md` | Start with G1 expired bounty cleanup, then reassess G2 fence semantics if the slice expands | Add/refresh regression tests |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Expired bounty cleanup is missing. | `src/systems/crime/CrimeSystem.ts` comments; `src/systems/crime/Crime_Ralph.md` | Prevents stale bounties from persisting indefinitely. | Add cleanup process to daily/world tick and test expiry behavior. | bounty test suite with seeded expiration. |
| G2 | not_started | in_scope_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Fence sell path bypasses dedicated crime outcome contract. | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts` | Heat/suspicion may diverge from criminal consequences. | Decide and implement dedicated action contract if needed. | reducer/integration tests covering heat/item impact. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Orphan/isolated criminal market systems are not actively consumed. | dependency headers on `BlackMarketSystem.ts`, `FenceSystem.ts` | Missed maintainability and dead-path risk. | Clarify ownership and remove/imported debt path. | `rg`/dependency map update after decisions. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Heat scale and severity math assumptions drift across reducer and core system comments. | `src/systems/crime/CrimeSystem.ts`, `src/state/reducers/crimeReducer.ts` | Produces inconsistent gameplay tuning and test interpretation risk. | Normalize numeric expectations and doc them in contract comments/tests. | Add edge-case unit tests for heat/severity conversions. |
| G5 | not_started | support_needed_now | Worker A | `docs/projects/crime/GAPS.md` | This pass | Type/TODO debt remains intentionally unresolved in several crime files. | `src/systems/crime/CrimeSystem.ts`, `src/systems/crime/SmugglingSystem.ts`, `src/systems/crime/fencing/FenceSystem.ts`, `src/state/reducers/crimeReducer.ts` | Weakens refactor safety and can hide real behavior hooks. | Resolve each TODO as intentional debt vs wiring tasks. | Reduced lint-intent count and explicit comments on deferred items. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
