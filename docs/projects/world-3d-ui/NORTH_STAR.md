# World 3D UI North Star

Status: active
Last updated: 2026-05-31

## Why this project exists

This project owns the docs for the UI-facing World 3D sandbox, so future work does not lose context about what is currently mounted, how chunks stream, and where the UI boundaries sit versus the broader `World 3D System`.

## Purpose and scope

This project is for the "World 3D UI" slice only:

- `src/components/World3D/*` behavior and lifecycle
- phase entry wiring that makes the sandbox user-visible
- direct controls and scene lifecycle contracts
- open UI-facing gaps for the next implementation slice

Not in scope:

- full gameplay integration of chunk content
- new 3D content systems (water, roads, sites, vegetation) beyond existing placeholders
- system-level architecture changes under `src/systems/world3d/*`

## Implemented state

- `src/components/World3D/World3DDemo.tsx` is the entry component for `GamePhase.WORLD3D_DEMO`. It currently builds deterministic terrain (`runWorldSim`) and calls `World3DScene` with inline loader logic.
- `src/components/World3D/World3DScene.tsx` mounts one `Canvas` scene with lights, fog, and one mesh per loaded chunk.
- `src/components/World3D/useChunkStreaming.ts` owns streaming subscription and teardown. It keeps one `ChunkStreamer` per mount and returns `{ loaded, update, pendingCount }`.
- `src/systems/world3d/` owns coordinate transforms, chunk diff math, LOD, sampler, and placeholder mesh generation; these are shared with other world-3d work and tests.
- `src/components/World3D/FreeRoamCameraController.tsx` is the active scene control surface: right-click drag pan via `MapControls`, with target updates throttled to ~10 Hz.
- Worker modules exist (`createWorkerChunkLoader.ts`, `chunkWorker.ts`, `chunkWorkerCore.ts`) but the demo scene currently uses inline loader code, so worker-backed runtime parity is not complete.
- Scene mount lifecycle cleanup exists in the hook (`streamer.dispose()` on unmount), but there is no dedicated visual assertion yet for mount/unmount and camera focus behavior.

## File map

- `docs/projects/world-3d-ui/NORTH_STAR.md` - cold-start context, purpose, scope, and resume path
- `docs/projects/world-3d-ui/TRACKER.md` - task queue and stale state control
- `docs/projects/world-3d-ui/GAPS.md` - unresolved UI-facing findings
- `src/components/World3D/World3DDemo.tsx` - sandbox host and UI entry
- `src/components/World3D/World3DScene.tsx` - rendered scene shell
- `src/components/World3D/FreeRoamCameraController.tsx` - map-style control input
- `src/components/World3D/useChunkStreaming.ts` - React streaming hook
- `src/components/World3D/createWorkerChunkLoader.ts` - worker loader wrapper
- `src/components/World3D/chunkWorker.ts` - WebWorker adapter
- `src/systems/world3d/*` - streaming geometry contracts and world transforms
- `src/App.tsx` - phase switch to sandbox
- `src/hooks/useHistorySync.ts` - `world3d` URL slug mapping

## Integrations

- **App phase integration:** `GamePhase.WORLD3D_DEMO` routes to `<World3DDemo />` in `src/App.tsx`.
- **History integration:** `useHistorySync` maps `GamePhase.WORLD3D_DEMO` to URL slug `world3d`.
- **Runtime integration:** demo feeds `WorldData` from `runWorldSim` directly into streaming geometry generation.

## Relationship to `docs/projects/world3d`

- `world3d` owns the broader system and baseline implementation state.
- `world-3d-ui` should track only UI-facing ownership: mounted scene behavior, controls, mode entry, and immediate UI gaps.
- When a gap reaches systems-level scope (for example full chunk bundle contract migration), route it back to `docs/projects/world3d`.

## Active task

| Field | Value |
|---|---|
| Task | Replace scaffold docs with current UI implementation state and durable gap list |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` in this folder capture purpose, implemented state, integrations, cross-project relationship, and concrete in-project gaps |
| Allowed boundaries | `docs/projects/world-3d-ui/` only |
| Stop condition | Docs reflect current runtime references and include next checks with owners |
| Verification | `Get-Content docs/projects/world-3d-ui/{NORTH_STAR.md,TRACKER.md,GAPS.md}` |
| Owner | Worker B |

## What must not be lost

- URL slug `world3d` for demo entry.
- Scene controls are currently map-orbit only, with no view-mode switch in this feature.
- Existing worker utilities exist but are not currently used by the primary demo entry.
- Registry row in `docs/projects/PROJECT_TRACKER.md` remains authoritative for ownership.

## Gaps and uncertainties

- Loader type contract consistency between `ChunkLoader` and `ChunkMeshBundle`.
- Whether the sandbox should move from inline loader to `createWorkerChunkLoader` for production parity.
- Scene lifecycle and mount/unmount behavior are currently not covered by a visual/interaction test.
- No UI-level view toggle (for example 2D/3D mode) is present in `World3DDemo`.

## Resume path

1. Read this file.
2. Read `docs/projects/world-3d-ui/TRACKER.md`.
3. Read `docs/projects/world-3d-ui/GAPS.md`.
4. Compare with `docs/projects/world3d/TRACKER.md` and `docs/projects/world3d/GAPS.md` before editing implementation.
5. Continue by resolving next in-project gap rows in priority order.

