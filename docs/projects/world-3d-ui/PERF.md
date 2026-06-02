# World 3D UI — Performance Budget (T11)

Status: active  
Last updated: 2026-06-02

Source of truth for timing constants: `src/components/World3D/transitionTiming.ts`.

## Entry transition

| Phase | Budget (ms) | Constant |
|-------|-------------|----------|
| Atlas fade-out | 300 | `ATLAS_FADE_OUT_MS` |
| Camera dive (after scene mount) | 1500 | `CAMERA_DIVE_MS` |
| Buffer | 200 | (included in budget) |
| **Total** | **2000** | `ENTRY_TRANSITION_BUDGET_MS` |

**Automated checks**

- RTL: `TransitionController.lifecycle.test.tsx` advances fake timers through fade + dive and asserts `onComplete` fires once.
- Playwright: `tests/world-3d-ui-transition.spec.ts` measures wall-clock until `world-3d-hud` is visible; asserts `< ENTRY_TRANSITION_BUDGET_MS + 800ms` slack (dev machines, lazy `TransitionController` chunk).

**Manual check**

1. Dev PLAYING → compass **Enter 3D World**.
2. Note when **3D World View** / HUD appears; should feel ≤ ~2s before full control.

## Exit transition

| Phase | Budget (ms) | Constant |
|-------|-------------|----------|
| Camera lerp up | 800 | `CAMERA_LERP_UP_MS` |
| Atlas fade-in | 400 | `ATLAS_FADE_IN_MS` |
| **Total** | **1200** | `EXIT_TRANSITION_BUDGET_MS` |

## `playerWorldPos` dispatch rate

- Interval: **100 ms** → max **10 Hz** (`POSITION_DISPATCH_INTERVAL_MS`).
- Unit guard: `World3DWrapper.throttle.test.ts`.

**Manual check (dev tools)**

1. Enter 3D with debug HUD enabled.
2. Move camera continuously; Redux/logger should not exceed ~10 `SET_PLAYER_WORLD_POS` events per second.

## Chunk loading (W3DUI-1)

| Entry | Loader | Location |
|-------|--------|----------|
| PLAYING (`worldViewMode === '3d'`) | Worker (`createWorkerChunkLoader`) | `World3DWrapper.tsx` |
| Sandbox `?phase=world3d` | Inline (`handleChunkRequest` on main thread) | `World3DDemo.tsx` |

Worker is terminated when `worldData` changes or `World3DWrapper` unmounts.

## Deferred / out of scope (T11)

- Chunk-ready-before-dive-end (needs streamer instrumentation).
