---
schema_version: 1
project: Compass Pane
slug: compass-pane
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: active
last_updated: 2026-06-24
iteration: 6
confidence: medium
evidence: docs/projects/compass-pane
gap_signal: "0 open gaps; G1/G3/G4/G5/G6 resolved"
protocol: living project doc set
next_step: Run a fresh source-backed Compass Pane gap scan before assigning more forward work
agent_comments: "G5 resolved by restoring the main-context submap toggle and adding toggle-visibility regression coverage."
active_agent: "Codex application agent"
agent_pass_status: finished
agent_pass_started_at: "2026-06-24T22:00:00+02:00"
agent_pass_ended_at: "2026-06-24T22:22:00+02:00"
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-24
workflow_gaps_reviewed: 2026-06-20
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Compass Pane North Star

Status: active  
Last updated: 2026-06-24

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

## Dashboard Card Schema

Project: Compass Pane  
Slug: compass-pane  
Category: Feature/UI Projects  
Status: active  
Confidence: medium  
Evidence: docs/projects/compass-pane  
Gap signal: 0 open gaps; G1/G3/G4/G5/G6 resolved
Protocol: living project doc set
Next step: Run a fresh source-backed Compass Pane gap scan before assigning more forward work
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-24
Workflow gaps reviewed: 2026-06-20

## Concrete File Map

| File | Role | Notes |
|---|---|---|
| `src/components/CompassPane/index.tsx` | Navigation UI | Implements compass layout, movement disable logic, action dispatch, pass-time modal wiring. |
| `src/components/Submap/SubmapPane.tsx` | Integration surface | Embeds Compass Pane in submap modal context, disables controls during inspect/quick travel. |
| `src/components/layout/GameLayout.tsx` | Integration surface | Renders Compass Pane in normal exploration layout. |
| `src/components/ui/TimeWidget.tsx` | Time display + action entry | Provides clock, moon/season display, and pass-time button callback. |
| `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Test coverage | Covers time widget rendering, main/submap context toggle visibility, submap toggle dispatch, move/look-around dispatch, edge disablement, current-location boundary pre-checks, impassable adjacent world tiles, and pass-time wait confirmation. |
| `src/hooks/actions/actionHandlers.ts` | Action dispatch registry | Maps `move`, `look_around`, `toggle_map`, `toggle_submap_visibility`, `toggle_three_d`, `wait` to handlers. |
| `src/hooks/actions/handleMovement.ts` | Movement contract | Performs submap/world movement, wrap and bounds logic, map tile validation, time advancement, and location dispatch. |
| `src/hooks/actions/handleObservation.ts` | Look around contract | Generates `look_around` descriptions and sets custom actions. |
| `src/hooks/actions/handleSystemAndUi.ts` | UI system contract | Implements map/submap/3D toggle handlers and save/menu actions. |
| `src/hooks/useGameActions.ts` | Action orchestrator | Loads handler registry and treats compass toggles as UI non-loading actions. |
| `src/state/actionTypes.ts` | Redux action surface | Declares `TOGGLE_MAP_VISIBILITY`, `TOGGLE_SUBMAP_VISIBILITY`, `TOGGLE_THREE_D_VISIBILITY`, `ADVANCE_TIME`, and related actions. |
| `src/state/reducers/uiReducer.ts` | UI state contract | Applies map/submap/3D visibility transitions and closes conflicting panes. |
| `src/types/actions.ts` | Compass action schema | Defines `move`, `look_around`, `toggle_map`, `toggle_submap_visibility`, `toggle_three_d`, `wait`. |
| `src/types/ui.ts` | Toggle routing | `UIToggleAction` includes map/submap/3D toggles used by `useGameActions`. |
| `src/components/CompassPane/README.md` | Component surface docs | Synced to current source on 2026-06-20: covers file name, props, pass-time modal, submap context, toggle rules, and imports. |

## Validated Navigation Affordances

**Context-Aware Toggle Visibility Rules (T3 Resolution):**

| Context | World Map Toggle | Submap Toggle | 3D Toggle | Rationale |
|---|---|---|---|---|
| GameLayout (main exploration) | ✅ Visible | ✅ Visible | ✅ Visible | All navigation options should be available during standard exploration |
| SubmapPane (submap modal) | ✅ Visible | ❌ Hidden | ❌ Hidden | World map provides global context; submap/3D toggles are redundant since user is already in submap view |

**G3 UI Pre-check Semantics:**

| UI Case | CompassPane Pre-check | Handler Responsibility | Proof |
|---|---|---|---|
| Global disabled state | Movement, look-around, pass-time, and toggle buttons disabled when `disabled` is true | No movement handler runs from disabled UI controls | Existing CompassPane tests cover disabled edge behavior and pass-time flow |
| In-bounds submap move | Button remains enabled so the player can ask to move | `handleMovement` validates submap terrain, blocks impassable terrain, and emits terrain-specific messages | Dispatch test verifies in-bounds submap move emits `move`; G3 resolution states submap terrain remains handler-owned |
| World-boundary transition | Uses `currentLocation.mapCoordinates`, not the display-only `worldMapCoords`, to reject moves outside `mapData.gridSize` | Handler uses the current location/world coordinate source to reject unknown-world movement | New test covers boundary pre-check when `worldMapCoords` differs from `currentLocation.mapCoordinates` |
| Impassable adjacent world tile | Disables the direction when adjacent world tile biome is not passable | Handler performs the same passability check before changing location | New test covers disabled movement into an adjacent `ocean` world tile |

**Implementation Evidence:**
- `CompassPane/index.tsx` lines 148-187: Conditional rendering based on `isSubmapContext` prop
- `GameLayout.tsx`: Renders CompassPane without `isSubmapContext` (defaults to false)
- `SubmapPane.tsx` line 513: Renders CompassPane with `isSubmapContext={true}`
- `src/components/CompassPane/__tests__/CompassPane.test.tsx`: Covers current-location boundary pre-checks, impassable adjacent world tiles, and context-aware map/submap/3D toggle visibility.
- Scoped verification: Tests pass for all navigation behaviors

**Decision:** Current implementation is correct and intentional. No Required Review Brief needed.

## Implemented State (Verified)

- `CompassPane` renders an 8-direction grid with a center action (line logic and labels in `CompassPane/index.tsx`).
- Direction movement is disabled when:
  - Global `disabled` flag is true.
  - Target world tile is outside map bounds using `currentLocation.mapCoordinates`.
  - Target world tile biome is not passable.
- In-bounds submap movement is not pre-blocked by CompassPane; `handleMovement` owns submap terrain validation and messaging.
- `look_around` action is currently never movement-blocked by direction checks.
- Time section is rendered through `TimeWidget` and pass-time launches `PassTimeModal`.
- On pass-time confirm, Compass dispatches `wait` with seconds (`handlePassTimeConfirm`).
- Regression proof now covers move dispatch, look-around dispatch, edge disablement, context-aware map/submap/3D toggle visibility, submap toggle dispatch, and pass-time wait confirmation in `src/components/CompassPane/__tests__/CompassPane.test.tsx`.
- Toggling map/submap/3D actions are emitted from button handlers.
- In `GameLayout`, compass sits in the left column and is wrapped by an `ErrorBoundary`.
- In `SubmapPane`, compass is rendered in right-column controls with `isSubmapContext=true`.
- When in submap context, the world-map toggle remains visible while the submap and 3D controls stay hidden.
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
  folder and is refreshed as of 2026-06-20.
- `docs/projects/compass-pane/GAPS.md` should remain the durable gap home until scope
  is assigned to implementation owners.
- `src/components/CompassPane/README.md` was verified as current on 2026-06-20;
  treat it as a living surface doc and re-verify against source before trusting
  after further component changes.

## Resume Path

1. Compass Pane currently has no open project-owned gaps after G5.
2. Keep the movement/action, G3 pre-check, and G5 toggle-visibility regression proof in `AUDIT_OR_PROOF.md` as the durable reference for future work.
3. Run a fresh source-backed gap scan before assigning more forward Compass Pane work.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
