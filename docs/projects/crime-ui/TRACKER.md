# Crime UI Tracker

Status: active
Last updated: 2026-05-31

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
| T1 | done | Create project docs and align with living-project protocol | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` row for Crime UI | No longer active | `docs/projects/crime-ui` now contains NORTH_STAR.md |
| T2 | active | Convert docs from scaffold-only to implementation state snapshot | Worker B | 2026-05-31 | `src/components/Crime/**`, `src/state/reducers/{crimeReducer,uiReducer}.ts`, `src/components/layout/GameModals.tsx` | Keep docs evidence-based and add explicit gaps + relationships | verify with updated `TRACKER.md` and `GAPS.md` |
| T3 | not_started | Validate any future UI work against `docs/projects/crime` for core contract changes | Worker B | 2026-05-31 | `docs/projects/crime/TRACKER.md` | Check compatibility before coding job/fence/heist UI changes | Add regression test notes in `TRACKER.md` before merge |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/crime-ui/GAPS.md` | scaffold-to-state upgrade | Track explicit suspect/report follow-up signal instead of leaving a placeholder | Existing crime UI evidence scan | Prevents accidental scope shrink from "already implemented" assumptions | Keep in `GAPS.md` and route to core if needed | cross-check `docs/projects/crime/GAPS.md` |
| G2 | active | support_needed_now | Worker B | `docs/projects/crime-ui/GAPS.md` | docs pass + code scan | Fence sale contract is UI->SELL_ITEM generic | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/crimeReducer.ts` | Core criminal consequence model cannot be enforced from UI currently | Decide whether to keep generic action or add UI-specific crime transaction action | confirm behavior tests around heat/bounty side-effects |
| G3 | active | in_scope_now | Worker B | `docs/projects/crime-ui/GAPS.md` | docs pass + code scan | Heist approach/intel shape is enforced via local cast in planning modal | `src/components/Crime/ThievesGuild/HeistPlanningModal.tsx`, `src/state/reducers/crimeReducer.ts`, `src/types/crime/index.ts` | Fragile type boundary can block stable UI-system editing | Align reducer/UI plan types and remove casts in UI component | update reducer and type test coverage |
| G4 | active | support_needed_now | Worker B | `docs/projects/crime-ui/GAPS.md` | docs pass + scan | Safehouse service source-of-truth is split between system and component mock list | `src/systems/crime/ThievesGuildSystem.ts`, `src/components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx` | Service names/rank/cost can drift and break discoverability | Choose one service authority for UI rendering | add unit or snapshot check for service list consistency |
