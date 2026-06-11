# World 3D UI Living Tracker

Status: active
Last updated: 2026-06-10

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`
Scope (clarified 2026-06-01): the **2D->3D transition + in-3D HUD** layer that drives and
overlays the `world3d` rendering engine. Gaps are authoritative in
`docs/projects/world-3d-ui/GAPS.md`.

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
| T1 | done | Initial living-project scaffold + doc refresh | Worker B | 2026-05-31 | `docs/projects/world-3d-ui/` | - | protocol files exist |
| T4 | done | Fix `?phase=world3d` cold-load entry bounce (intermittent -> main_menu) | claude (claimed) | 2026-06-01 | live debug; app-level phase race (GAPS W3DUI-5) | Fix verified: 3/3 consecutive cold loads stick on world3d | - |
| T5 | done | Author Plan 4: 2D->3D transition + camera dive + scene mount/unmount handoff + `playerWorldPos` + atlas marker sync | claude (claimed) | 2026-06-01 | spec §7-§9 (GAPS W3DUI-6/7) | Plan 4 committed: `docs/superpowers/plans/2026-06-01-world-3d-ui-transition-and-marker-sync.md` | - |
| T6 | superseded | Define + build the in-3D HUD (control panel, view-mode toggle, nameplates, minimap, debug) | unassigned | 2026-06-01 | Superseded by T9 (Plan 4 Slice 3) | - | - |
| T7 | done | Implement Plan 4 Slice 1: Game-state anchors (`playerWorldPos`, `worldViewMode`, actions, reducer) | unassigned | 2026-06-01 | Plan 4 §State Flow Diagram | Types + actions + reducer + initialState + hooks implemented | Types compile; actions dispatch correctly; hooks return `{ mode, setMode }` and `{ position, setPosition, clearPosition }` |
| T8 | done | Implement Plan 4 Slice 2: `TransitionController` + entry/exit sequences | unassigned | 2026-06-01 | Plan 4 §Transition Controller | TransitionController + World3DWrapper + worldCoords + PLAYING phase wiring + W3DUI-14/15 fixes | Entry/exit animations play; scene mounts/unmounts; playerWorldPos includes Y height; save/load preserves 3D state |
| T9 | done | Implement Plan 4 Slice 3: `InWorldHUD` (control panel, toggle, debug) | unassigned | 2026-06-01 | `InWorldHUD.tsx`, `HUDControlPanel.tsx`, `ViewModeToggle.tsx`, `DebugHUD.tsx`; inline loader in `World3DWrapper` (W3DUI-16/17) | - | HUD overlays 3D canvas; Open Map -> atlas; Exit -> main menu; debug HUD in dev mode |
| T10 | done | Implement Plan 4 Slice 4: `AtlasPlayerMarker` + atlas click-to-travel | unassigned | 2026-06-01 | `AtlasPlayerMarker.tsx`, MapPane Enter 3D mode, `worldCoords` tests; W3DUI-20/21 wired | - | Marker on map; Enter 3D cell -> 3D mode; compass Enter 3D uses worldViewMode |
| T11 | done | Implement Plan 4 Slice 5: Integration testing + perf optimization | unassigned | 2026-06-01 | `TransitionController.lifecycle.test.tsx`, `world-3d-ui-transition.spec.ts`, `PERF.md`, `transitionTiming.ts`; W3DUI-3 done | - | Vitest green; Playwright skips without dev PLAYING; entry budget documented |
| T12 | done | W3DUI-22: gate legacy `ThreeDModal` when PLAYING uses `worldViewMode` | unassigned | 2026-06-01 | `GameModals.tsx`, `appState.ts`, `uiReducer.ts`, `worldViewModeLegacy3d.test.ts` | - | Vitest green |
| T13 | done | W3DUI-18: MapData->WorldData adapter for PLAYING 3D chunk streaming | unassigned | 2026-06-01 | `mapDataToWorldData.ts`, `App.tsx`, `World3DWrapper.tsx`, `mapDataToWorldData.test.ts` | - | Vitest green; no mapData `as any` |
| T14 | done | W3DUI-23: always-visible world atlas strip with 3D marker on GameLayout | unassigned | 2026-06-01 | `WorldAtlasStrip.tsx`, `GameLayout.tsx`, `WorldAtlasStrip.test.tsx` | - | Strip shows when `playerWorldPos` set; opens MapPane on click |
| T15 | done | W3DUI-24: remove unused `entryPosition` from TransitionController API | unassigned | 2026-06-02 | `TransitionController.tsx`, `App.tsx`, lifecycle test | - | Entry coords only on `World3DWrapper`; Vitest green |
| T16 | done | W3DUI-1: worker-backed chunk loader for PLAYING `World3DWrapper` | unassigned | 2026-06-02 | `World3DWrapper.tsx`, `World3DWrapper.loader.test.tsx`, `PERF.md` | - | Vitest green; demo sandbox still inline |
| T17 | done | W3DUI-25: E2E marker sync after 3D movement (MapPane/Azgaar harness) | claude | 2026-06-02 | `tests/world-3d-ui-transition.spec.ts` | - | Playwright test updated to simulate 3D pan and verify marker movement |
| T18 | done | W3DUI-26: in-3D minimap (deferred Plan 4 UX) -> compact WorldData top-down view + live player marker in HUD | claude | 2026-06-02 | `World3DMinimap.tsx`, `InWorldHUD.tsx`, `World3DWrapper.tsx`, `World3DMinimap.test.tsx` | - | Vitest green (29/29 in suite); minimap mounts bottom-left of HUD when worldData + playerWorldPos present; nameplates now tracked by T20 |
| T19 | done | DebugHUD world-generation provenance indicator (consumes worldsim-service WSS-004 `MapData.generation`) -> shows world source and fallback reason | claude | 2026-06-02 | `DebugHUD.tsx`, `InWorldHUD.tsx`, `World3DWrapper.tsx`, `DebugHUD.worldGen.test.tsx` | - | Vitest 30/30 in World3D suite; live: DebugHUD renders in 3D dev mode, hides world line gracefully when `generation` absent. Diagnostic source/policy owned by worldsim-service |
| T20 | done | W3DUI-27: in-3D nameplates over visible `world3d.sites` (LOD, distance, and max-visible gates) | gpt-5.3-codex-spark (MCP-subagent) | 2026-06-08 | `World3DNameplates.tsx`, `World3DScene.tsx`, `World3DWrapper.tsx`, `World3DNameplates.test.tsx` | - | Unit tests cover LOD gate + distance + max-visible cap; full World3D suite green |
| T21 | done | Iteration 4 monitor pass: re-run scoped World3D verification, bounded gap sweep, close seeded Gap Log row G1 | claude-fable-5 (Claude Code CLI) | 2026-06-10 | `World3DNameplates.test.tsx` 2/2; full `src/components/World3D/__tests__` 11 files/25 tests green; `AUDIT_OR_PROOF.md` 2026-06-10 row | - | Re-run scoped suite before starting any new slice |
| T22 | not_started | Triage inherited ThreeD Modal entrypoint gaps after the D5 merge (entry/close/focus policy, shared `onMove` contract, submap 3D test coverage, CMA-G14 split route) into W3DUI gap rows | unassigned | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D5; `docs/projects/three-d-modal/GAPS.md` (merged-reference); `src/components/ThreeDModal/*`, `src/components/Submap/SubmapPane.tsx`, `src/components/layout/GameModals.tsx` | Open W3DUI rows for the inherited items that get scheduled; keep the merged-reference inventory intact | Inherited items appear as W3DUI rows or an explicit defer note in `GAPS.md` |

Gaps are tracked in `docs/projects/world-3d-ui/GAPS.md` (W3DUI-1..28) - see it for the full gap log, including the routed entry/transition gaps from `world3d`.

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/world-3d-ui/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | claude-fable-5 (Claude Code) | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization; closed 2026-06-10 | Seeded placeholder row from schema normalization; the 2026-06-10 bounded gap sweep found no remaining project-specific finding to replace it with | 2026-06-10 sweep: W3DUI-1..28 all done; full `src/components/World3D/__tests__` suite 11 files/25 tests green; GLOBAL_GAPS GG-16..GG-27 triaged with none owned by this surface | The workflow requires durable gaps to have a consistent table shape and evidence path | — | GAPS.md and TRACKER.md agree: no open project gaps |
