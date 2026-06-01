# World 3D UI Gaps

Status: active
Last updated: 2026-06-01

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`

Scope: unresolved findings for the **2D↔3D transition + in-3D HUD** layer. Rendering-engine
gaps belong in `docs/projects/world3d/GAPS.md`; generation gaps in `docs/projects/worldsim-service/GAPS.md`.

| Gap ID | Status | Classification | Owner | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| W3DUI-5 | not_started | blocked_human_decision | claude | 2026-06-01 live debug; routed from world3d (W3D-G7) | `?phase=world3d` cold-load intermittently bounces to `main_menu` | live nav this session; `optimizeDeps` change did not fix; server logs show no Vite re-optimize → app-level phase race | The 3D world's entry path is unreliable; blocks testing/demo and the future real transition | Instrument mount-time phase dispatch order (`useHistorySync` initial-mount vs `App` game-init effects); fix what overrides the URL phase | 3 consecutive clean cold loads land on world3d with terrain |
| W3DUI-6 | not_started | adjacent_follow_up | claude | 2026-06-01 re-scope; routed from world3d (W3D-G3) | The 3D world is a sandbox (`WORLD3D_DEMO`), not entered from real gameplay/atlas | `src/App.tsx`, `useHistorySync.ts` | Without a real transition it ships test-only; this is the project's core deliverable | Author Plan 4: atlas→3D transition, camera dive, scene mount/unmount handoff with `world3d`, `playerWorldPos` | Plan 4 doc committed + reviewed |
| W3DUI-7 | not_started | adjacent_follow_up | claude | 2026-06-01 re-scope | Bidirectional Azgaar atlas ↔ 3D position marker sync unbuilt | spec §9; no code | The atlas and 3D view must agree on player position both ways | Design marker projection (3D pos → atlas) + atlas click → entry, in Plan 4 | Marker tracks in both directions in a prototype |
| W3DUI-8 | not_started | adjacent_follow_up | claude | 2026-06-01 re-scope | No in-3D HUD: control panel, view-mode toggle, nameplates, minimap, debug overlay | `World3DDemo.tsx` has static header only | Expected UX is unstated and easy to break in handoffs | Define HUD scope + acceptance in Plan 4; build incrementally over `world3d`'s canvas | HUD components mount over the scene without disturbing rendering |
| W3DUI-3 | not_started | adjacent_follow_up | claude | 2026-05-31 scan | No mount/unmount + control-lifecycle test for the 3D scene entry | `World3DScene.tsx`, `useChunkStreaming.ts` | Entry/exit regressions escape unit tests | Add one non-flaky RTL/Playwright lifecycle proof for scene mount + camera + cleanup | Lifecycle test green |
| W3DUI-1 | not_started | adjacent_follow_up | claude | 2026-05-31 scan | Demo entry uses inline loader, not `createWorkerChunkLoader` | `World3DDemo.tsx`, `createWorkerChunkLoader.ts` | Entry-strategy choice affects transition perf; loader impl itself is `world3d`'s | Decide inline vs worker for the live entry (coordinate with `world3d`) | Entry-strategy decision recorded in Plan 4 |
| W3DUI-2 | done | in_scope_now | — | 2026-05-31 scan | `ChunkLoader` expected `Promise<ChunkMeshBundle>` while callers returned `ChunkGeometryArrays` | Whole pipeline now carries `ChunkMeshBundle` | Was a contract-migration blocker | — | Resolved by world3d Plan 3 Task 9 (bundle rewire) |
