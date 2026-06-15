# Crime UI Living Tracker

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
|---|---|---|---|---|---|---|---|
| T2 | done | Convert docs from scaffold-only to implementation state snapshot | Qoder | 2026-06-15 | `src/components/Crime/**`, `src/state/reducers/{crimeReducer,uiReducer}.ts`, `src/components/layout/GameModals.tsx`, `src/types/crime/index.ts`, `src/systems/crime/ThievesGuildSystem.ts` | Docs are now evidence-backed; GAPS.md statuses reconciled (all active); NORTH_STAR.md refreshed with source-verified state | verify with updated `TRACKER.md` and `GAPS.md` |
| T3 | not_started | Validate any future UI work against `docs/projects/crime` for core contract changes | Worker B | 2026-05-31 | `docs/projects/crime/TRACKER.md` | Check compatibility before coding job/fence/heist UI changes | Add regression test notes in `TRACKER.md` before merge |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | active | support_needed_now | Qoder | `docs/projects/crime-ui/GAPS.md` | docs pass + 2026-06-15 code re-scan | Fence sale contract dispatches generic `SELL_ITEM` with no crime-specific handler in `crimeReducer.ts` | `FenceInterface.tsx:42-48`, `actionTypes.ts:109`, `crimeReducer.ts` (no SELL_ITEM case) | Core criminal consequence model (heat, exposure) cannot be enforced from UI currently | Decide whether to keep generic action or add `FENCE_SELL_ITEM` crime-specific action with heat/bounty side-effects | confirm behavior tests around heat/bounty side-effects |
| G3 | active | in_scope_now | Qoder | `docs/projects/crime-ui/GAPS.md` | docs pass + 2026-06-15 code re-scan | Heist planning modal uses local cast to enforce non-optionality on `HeistPlan.approaches` and `HeistPlan.intelGathered` (both optional in type definition) | `HeistPlanningModal.tsx:26-29`, `types/crime/index.ts:149-150`, `crimeReducer.ts` | Fragile type boundary: cast bypasses TS null-safety; can block stable UI-system editing | Narrow plan types to required when in planning phase or add runtime guard; remove casts in UI component | update reducer and type test coverage |
| G4 | active | support_needed_now | Qoder | `docs/projects/crime-ui/GAPS.md` | docs pass + 2026-06-15 code re-scan | Safehouse service list hardcoded in `ThievesGuildSafehouse.tsx:17-22` while `ThievesGuildSystem.getAvailableServices()` is the authoritative source used by `ThievesGuildInterface.tsx:50` | `ThievesGuildSafehouse.tsx:17-22`, `ThievesGuildSystem.ts:133+`, `ThievesGuildInterface.tsx:50` | Service names/rank/cost can drift between safehouse component and system | Replace hardcoded array with `ThievesGuildSystem.getAvailableServices()` call | add unit or snapshot check for service list consistency |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
