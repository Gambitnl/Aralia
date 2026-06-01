# World 3D System North Star

Status: active
Last updated: 2026-05-31

## Purpose
This project owns Aralia's chunk-based 3D world viewer prototype: procedural chunk generation from `WorldData`, streaming orchestration, and R3F scene mount/render loop for the `WORLD3D_DEMO` phase.

## Why this project exists
- Preserve current implementation ownership before broader 3D expansion starts.
- Keep intent clear between placeholder terrain, planned per-chunk content expansion, and existing world simulation contracts.
- Provide a stable cold-start handoff for future slices.

## Current state
- Implemented as a sandbox phase (`GamePhase.WORLD3D_DEMO`) in `src/App.tsx`.
- Core 3D streaming pipeline exists and is tested.
- Output is currently placeholder heightfield terrain only; no 3D world systems (rivers, roads, sites, vegetation) are active in the scene.
- Worker and inline loaders both exist, but the demo entry currently uses inline `handleChunkRequest` for rendering.

## Concrete file map
- `src/systems/world3d/config.ts`: constants for chunk size, load/unload radii, world scales.
- `src/systems/world3d/coords.ts`: world/grid/chunk transforms and chunk key helpers.
- `src/systems/world3d/chunkManager.ts`: pure load/unload diff and hysteresis.
- `src/systems/world3d/lod.ts`: distance-to-LOD tier mapping.
- `src/systems/world3d/chunkSampler.ts`: bilinear sample slice from `WorldData` to chunk grid.
- `src/systems/world3d/chunkGeometry.ts`: placeholder heightfield mesh builder.
- `src/systems/world3d/chunkWorkerCore.ts`: pure request handler for chunk generation.
- `src/systems/world3d/chunkStreamer.ts`: stateful window orchestrator, max concurrent queue, settle promise.
- `src/systems/world3d/polylineClip.ts`: grid polyline clipping utility (not yet part of renderer).
- `src/systems/world3d/types.ts`: shared contracts, including bundle-oriented types for future expansion.
- `src/components/World3D/useChunkStreaming.ts`: hook wrapper around `ChunkStreamer`.
- `src/components/World3D/World3DScene.tsx`: R3F scene, camera, and chunk mesh mount.
- `src/components/World3D/FreeRoamCameraController.tsx`: map-style camera and position stream throttling.
- `src/components/World3D/World3DDemo.tsx`: standalone sandbox host with deterministic test world creation.
- `src/components/World3D/createWorkerChunkLoader.ts`: worker-backed `ChunkLoader` with request correlation.
- `src/components/World3D/chunkWorker.ts`: worker entry posting transferable geometry.
- `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`: loader mock and correlation checks.
- `src/components/World3D/__tests__/useChunkStreaming.test.tsx`: render-loop and loaded state checks.
- `src/systems/world3d/__tests__/*`: unit tests for coordinates, chunk diff, sampler, geometry, LOD, streamer, and integration smoke.

## Integration points
- `GamePhase.WORLD3D_DEMO` in `src/types/core.ts` and lazy mount in `src/App.tsx`.
- URL sync contract in `src/hooks/useHistorySync.ts`:
  - `WORLD3D_DEMO` -> `world3d` slug.
  - `world3d` URL slug -> `GamePhase.WORLD3D_DEMO`.
- `World3DDemo` constructs the `WorldData` input via `runWorldSim` (`src/services/worldSim/index.ts`).
- Rendering path is separate from combat (`components/BattleMap`) and `ThreeDModal`, though all are Three.js-based.

## Implemented state evidence
- Streaming behavior has test coverage for:
  - coords transforms and chunk keys,
  - load/unload window math,
  - chunk streaming settle behavior and duplicate suppression,
  - geometry output shape and finite values.
- The app route is in place and mounts the scene under demo phase.
- `useHistorySync` already exposes a dedicated public slug for the phase.

## Known uncertainties and follow-up
- The demo is isolated from the live world flow and save-state movement systems.
- `polylineClip.ts` and expansion-oriented types exist but are not yet consumed by `World3DScene`.
- Worker path is present but not used by `World3DDemo` today.
- Some existing types now describe richer chunk bundles, while active scene render and loader contracts still use placeholder geometry arrays.
- Planned content (`docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md`) must be reconciled with current file state before next implementation slice.

## Next checks
- Confirm phase path in app: run and verify `App.tsx` loads `World3DScene` under `GamePhase.WORLD3D_DEMO`.
- Confirm URL deep-link: open with `?phase=world3d` and verify history mapping in `useHistorySync.ts`.
- Run targeted tests before next implementation slice:
  - `npx vitest run src/systems/world3d/__tests__/coords.test.ts src/systems/world3d/__tests__/chunkStreamer.test.ts src/systems/world3d/__tests__/integration.test.ts`
  - `npx vitest run src/components/World3D/__tests__/useChunkStreaming.test.tsx src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`

## Resume path
1. Read this file.
2. Read `docs/projects/world3d/TRACKER.md`.
3. Read `docs/projects/world3d/GAPS.md`.
4. Continue from the active in-project gap list.
