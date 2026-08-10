# Sub-spec: Vegetation migration

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** BUILT 2026-07-04 — first slice: owned seeded procedural trees (3 species × 3 variants, instanced, `src/systems/worldforge/vegetation/`) replace the cone placeholders on the existing scatter positions; near-camera instanced biome-tinted grass (`grassField.ts` + `GrassLayer.tsx`), deterministic, WebGL/WebGPU-safe (no TSL). Open items below (wind, impostor LOD) remain.

## Decision
The battle map's tree fidelity (EzTree, MIT, seedable — survey confirmed still best-in-class for runtime JS) moves into the streamed world chunks, keeping realism per the art direction. Grass: trial `procedural-grass-threejs` (WebGL2 fallback exists — VERIFY LICENSE first) or port its instancing/wind technique; the MIT R3F stylized-scene repo is the technique reference for instanced wind-driven grass. Trial GPU-instanced L-system forests for mid/far LOD behind EzTree hero trees.

## Open
- License verification on the grass repo before any code adoption.
- LOD strategy: hero trees near, instanced impostors far.
- Chunk-streaming integration (vegetation per chunk, deterministic per cell).

## Drift found 2026-07-27: the ez-tree decision above never shipped

The Decision says ez-tree moves into the streamed world. It did not. Ez-tree renders on the battle map only (`EzTreeLayer.tsx`); the streamed world got a NEW owned cone generator (`treeMeshGenerator.ts`), logged as replacing "cone placeholders" while being cone-based itself. Nobody recorded the reversal, so both Remy and a later reader expected ez-tree to be in the world.

**Cost was measured rather than assumed, and it is not the blocker.** On an RTX 2070 SUPER, timed by driving a private renderer over the live scene (rAF timing is vsync-locked at 16.6 ms and hid everything; instance bounding spheres also had to be recomputed or three.js culled the test meshes and the first run measured air):

| Scenario | Triangles drawn | Median render |
|---|---|---|
| shipped cone trees | 2,489,806 | 3.3 ms |
| + all 2,340 trees as ez-tree Oak Medium | 34,795,846 | 3.3 ms |

A 14× triangle increase cost nothing measurable. Per-tree counts: cones 66–504 tris, ez-tree 7,200–19,872. Untested: ez-tree's CPU generation time, per-chunk streaming integration, shadow passes, alpha-tested leaf cards, and dense-forest cells (Hajdured holds 2,340 trees; an ancient forest holds far more).

**What the measurement did find:** batching fragmentation. Trees drew 2,340 instances through **379 instanced meshes** (~6 each) because the old layer built one mesh per (species, variant) per chunk — 379 of the scene's 571 draw calls, all with `frustumCulled={false}`. Fixed 2026-07-27 by batching field-wide (`treeBatching.ts` + `VegetationTreeField.tsx`), keeping the shadow tier as a separate axis because one InstancedMesh has a single castShadow flag:

| | tree meshes | instances/mesh | scene draw calls | median render |
|---|---|---|---|---|
| before | 379 | 6.2 | 571 | 3.3 ms |
| after | 16 | 146.3 | 208 | **1.2 ms** |

Triangles drawn stayed 2,489,806 and instances stayed 2,340 — proof nothing was dropped or double-drawn — and the in-game frame is visually identical. The old per-chunk layer was deleted rather than left as a second path. Note the earlier variant bump 3→4 had made the fragmentation 33% worse (9 → 12 buckets per chunk); batching makes variant count cost nothing.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/subspecs/beautification--vegetation-migration.md","sha256WithoutMarker":"fa3d30820dae64a924cbadb2b24b7607962f74202912fff7fe00810265ecf801","markedAtUtc":"2026-08-09T20:24:28.237Z"} -->
