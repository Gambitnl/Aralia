# Crime UI Gap Registry

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings specific to Crime UI ownership.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/crime/TRACKER.md` | scope scan | No dedicated suspect/report flow implementation was found in `src/components/Crime` or `src/systems/crime` | `src/components/Crime`, `src/systems/crime`, `rg suspect|report` output | Future UI work may assume reporting flow exists and bypass core design | Route decision to core Crime tracker; keep scope in this project as adjacency note | Decision note recorded in `docs/projects/crime` |
| G2 | not_started | support_needed_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan | Fence sales use `SELL_ITEM` generic action and text message; no dedicated crime outcome contract in UI path | `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts` | Risk of heat/notice consequences being disconnected from UI flow | Define UI-to-domain event contract (or explicit no-op boundary) for sale actions | Add regression check for heat and bounty impact of fence sales |
| G3 | not_started | in_scope_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan | Heist planning modal relies on local casting to include approaches/intel shape | `src/components/Crime/ThievesGuild/HeistPlanningModal.tsx`, `src/state/reducers/crimeReducer.ts`, `src/types/crime/index.ts` | Weak typing can hide incompatible plan changes and increase UI breakage risk | Normalize plan contract and remove interface cast fallback | Type test for plan shape in `src/state/reducers` and UI compile check |
| G4 | not_started | support_needed_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan | Thieves guild safehouse list is hardcoded in component while system also defines service data | `src/components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx`, `src/systems/crime/ThievesGuildSystem.ts` | Data drift risk across services and rank/cost requirements | Choose one source of truth (component fetches from system or snapshot test) | Manual or unit consistency check before next UI pass |
| G5 | not_started | support_needed_now | Worker B | `docs/projects/crime/TRACKER.md` | code scan | `state.uiReducer` and `crimeReducer` close heist modal and planning with implicit assumptions | `src/components/layout/GameModals.tsx`, `src/state/reducers/uiReducer.ts`, `src/state/reducers/crimeReducer.ts` | New UI slices cannot safely compose if visibility and plan lifecycle assumptions are undocumented | Capture explicit modal lifecycle and phase transition rules in docs before editing flow | add acceptance check in implementation slice |

## Classification Notes

- `adjacent_follow_up`: keeps intent and avoid scope collapse, but not a direct stop condition for Crime UI.
- `in_scope_now`: required to continue any UI heist/job flow edit without type breaks.
- `support_needed_now`: needed for safe continuation but can be resolved in the next implementation slice.

## Global Routing

- Cross-project gaps currently best handled in `docs/projects/crime` are:
  - core suspect/report schema
  - heat/notice/bounty side effects for fence and bribe services
