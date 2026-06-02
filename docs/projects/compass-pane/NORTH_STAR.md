# Compass Pane North Star

Status: active  
Last updated: 2026-05-31

## Purpose And Scope

Compass Pane is the player movement and orientation control for exploration workflows.
It is no longer a scaffold. The feature currently includes:

- 8-direction movement grid plus center "Look Around" action.
- Direction-aware action dispatch (`move`, `look_around`).
- World/submap position display and active time widget.
- Map, submap, and 3D view toggles.
- Modal-based pass-time controls that dispatch a `wait` action.
- Integration in both main Game layout and Submap modal context.

Scope is Feature/UI for `src/components/CompassPane` and its action/state wiring
through `src/hooks/actions/*` and `src/state/*`.

## Concrete File Map

| File | Role | Notes |
|---|---|---|
| `src/components/CompassPane/index.tsx` | Navigation UI | Implements compass layout, movement disable logic, action dispatch, pass-time modal wiring. |
| `src/components/Submap/SubmapPane.tsx` | Integration surface | Embeds Compass Pane in submap modal context, disables controls during inspect/quick travel. |
| `src/components/layout/GameLayout.tsx` | Integration surface | Renders Compass Pane in normal exploration layout. |
| `src/components/ui/TimeWidget.tsx` | Time display + action entry | Provides clock, moon/season display, and pass-time button callback. |
| `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Test coverage | Tests time widget rendering only, not movement action behavior. |
| `src/hooks/actions/actionHandlers.ts` | Action dispatch registry | Maps `move`, `look_around`, `toggle_map`, `toggle_submap_visibility`, `toggle_three_d`, `wait` to handlers. |
| `src/hooks/actions/handleMovement.ts` | Movement contract | Performs submap/world movement, wrap and bounds logic, map tile validation, time advancement, and location dispatch. |
| `src/hooks/actions/handleObservation.ts` | Look around contract | Generates `look_around` descriptions and sets custom actions. |
| `src/hooks/actions/handleSystemAndUi.ts` | UI system contract | Implements map/submap/3D toggle handlers and save/menu actions. |
| `src/hooks/useGameActions.ts` | Action orchestrator | Loads handler registry and treats compass toggles as UI non-loading actions. |
| `src/state/actionTypes.ts` | Redux action surface | Declares `TOGGLE_MAP_VISIBILITY`, `TOGGLE_SUBMAP_VISIBILITY`, `TOGGLE_THREE_D_VISIBILITY`, `ADVANCE_TIME`, and related actions. |
| `src/state/reducers/uiReducer.ts` | UI state contract | Applies map/submap/3D visibility transitions and closes conflicting panes. |
| `src/types/actions.ts` | Compass action schema | Defines `move`, `look_around`, `toggle_map`, `toggle_submap_visibility`, `toggle_three_d`, `wait`. |
| `src/types/ui.ts` | Toggle routing | `UIToggleAction` includes map/submap/3D toggles used by `useGameActions`. |
| `src/components/CompassPane/README.md` | Historical surface docs | Already describes compass, now partially stale on some wording. |

## Implemented State (Verified)

- `CompassPane` renders an 8-direction grid with a center action (line logic and labels in `CompassPane/index.tsx`).
- Direction movement is disabled when:
  - Global `disabled` flag is true.
  - Target world tile is outside map bounds.
  - Target world tile biome is not passable.
- `look_around` action is currently never movement-blocked by direction checks.
- Time section is rendered through `TimeWidget` and pass-time launches `PassTimeModal`.
- On pass-time confirm, Compass dispatches `wait` with seconds (`handlePassTimeConfirm`).
- Toggling map/submap/3D actions are emitted from button handlers.
- In `GameLayout`, compass sits in the left column and is wrapped by an `ErrorBoundary`.
- In `SubmapPane`, compass is rendered in right-column controls with `isSubmapContext=true`.
- When in submap context, compass hides map/submap toggles and 3D entry button remains hidden.
- Action registry and handlers already support map/submap/3D toggles and `wait`.

## Integration Points

- `App.tsx` owns action orchestration and dispatch and renders `GameLayout` during
  `GamePhase.PLAYING`.
- `useGameActions` builds handler registry then routes compass actions to concrete handlers.
- `handleMovement` applies movement state updates via `MOVE_PLAYER` and `ADVANCE_TIME`.
- `handleObservation` manages `look_around` side effects and Gemini-generated action payloads.
- `uiReducer` currently hard-resets competing UIs when map/submap/3D toggles fire.

## Known Continuity Notes

- This project is registered in the global tracker with persistent gap signal:
  `Compass Pane` row in `docs/projects/PROJECT_TRACKER.md` references this project
  folder and says gap signal is `define navigation affordances`.
- `docs/projects/compass-pane/GAPS.md` should remain the durable gap home until scope
  is assigned to implementation owners.

## Next Checks

1. Confirm whether current "look-around + movement action ordering" should be
   treated as a single UX pattern for all movement actions.
2. Add explicit proof for edge/wrap movement behavior in tests (existing tests are
   time-display only).
3. Decide whether to formalize compass affordance semantics for submap-embedded mode
   and 3D entry availability.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
