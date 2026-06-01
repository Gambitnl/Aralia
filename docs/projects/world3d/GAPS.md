# World 3D System Gap Registry

Status: active
Last updated: 2026-06-01

North Star: `docs/projects/world3d/NORTH_STAR.md`

## Scope
In-project execution gaps rooted in current implementation evidence. Resolved gaps are
retained with `done`/`superseded` status as history; do not silently delete.

## Gap Log

| Gap ID | Status | Classification | Owner | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| W3D-G1 | not_started | adjacent_follow_up | unassigned | 2026-05-31 scan | `World3DDemo` uses inline `handleChunkRequest`, not the worker-backed loader | `src/components/World3D/World3DDemo.tsx`, `createWorkerChunkLoader.ts` | Worker path is unverified in the real scene entry | Decide inline vs worker for the demo; if worker, wire `createWorkerChunkLoader` | Trace loaded-chunk call stack under `WORLD3D_DEMO` |
| W3D-G2 | done | in_scope_now | — | 2026-05-31 scan | `polylineClip.ts` not integrated with any builder | `polylineClip.ts` now used by `waterGeometry`/`roadGeometry` via the sampler | Was blocking river/road detail | — | Resolved by Plan 3 (sampler clips rivers/roads; builders consume them) |
| W3D-G3 | routed | blocked_human_decision | world-3d-ui | 2026-05-31 scan | `WORLD3D_DEMO` is a sandbox, not connected to gameplay/saved world-actor state | `src/App.tsx`, `useHistorySync.ts` | Without routing from real play, the 3D world ships as test-only | **Routed to `world-3d-ui`** (entry/transition owner); tracked as its Plan 4 | see `docs/projects/world-3d-ui/GAPS.md` |
| W3D-G4 | done | in_scope_now | — | 2026-05-31 scan | Loader on placeholder `ChunkGeometryArrays` while `types.ts` had richer `ChunkMeshBundle` | `chunkWorkerCore`, `useChunkStreaming`, `createWorkerChunkLoader`, `chunkWorker` all now carry `ChunkMeshBundle` | Was API-drift risk | — | Resolved by Plan 3 Task 9 (full pipeline rewire to bundle) |
| W3D-G5 | done | adjacent_follow_up | — | 2026-05-31 scan | Rich content builders (roads/sites/vegetation/water) were type-only intent | All five builders implemented + rendered | Was scope-estimation risk | — | Resolved by Plan 3 + render in `World3DScene` |
| W3D-G6 | not_started | adjacent_follow_up | unassigned | 2026-05-31 scan | No scene-lifecycle/visual assertions on `World3DScene` mount/camera beyond unit streamer tests | `World3DScene.tsx`, `__tests__/useChunkStreaming.test.tsx` | Render-path regressions can escape unit tests | Add one non-flaky RTL/Playwright lifecycle proof | Lifecycle test green |
| W3D-G7 | routed | blocked_human_decision | world-3d-ui | 2026-06-01 live debug | `?phase=world3d` cold-load intermittently bounces to `main_menu` | live nav this session; `optimizeDeps` change did not fix; server logs show no Vite re-optimize → app-level race | Deep link is unreliable for testing/demo | **Routed to `world-3d-ui`** (entry/transition owner) | see `docs/projects/world-3d-ui/GAPS.md` (W3DUI-5) |
| W3D-G8 | not_started | adjacent_follow_up | unassigned | 2026-06-01 live debug | Demo world is all-`plains`, so rivers/roads/towns (built + tested) aren't visible in the demo | `World3DDemo.tsx` biome array | Demo undersells implemented content | Feed a varied biome `WorldData` into the demo loader | Screenshot shows water/roads/town boxes |
| W3D-G9 | not_started | adjacent_follow_up | unassigned | 2026-06-01 review | `WorldData.lakes` polygons are not meshed (only river ribbons) | `waterGeometry.ts` builds ribbons only | Lakes present in data but invisible | Add lake-fill geometry behind the bundle | Lake renders in a lake-containing chunk |
| W3D-G10 | not_started | adjacent_follow_up | unassigned | 2026-06-01 review | Per-LOD geometry detail not implemented; LOD tier only affects tint | `lod.ts` tier unused by sampler resolution | Distant chunks pay full vertex cost | Lower `resolution` for mid/low tiers in the sampler/bundle path | Perf delta + visible LOD falloff |
