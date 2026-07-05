# Sub-spec: Vegetation migration

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** BUILT 2026-07-04 — first slice: owned seeded procedural trees (3 species × 3 variants, instanced, `src/systems/worldforge/vegetation/`) replace the cone placeholders on the existing scatter positions; near-camera instanced biome-tinted grass (`grassField.ts` + `GrassLayer.tsx`), deterministic, WebGL/WebGPU-safe (no TSL). Open items below (wind, impostor LOD) remain.

## Decision
The battle map's tree fidelity (EzTree, MIT, seedable — survey confirmed still best-in-class for runtime JS) moves into the streamed world chunks, keeping realism per the art direction. Grass: trial `procedural-grass-threejs` (WebGL2 fallback exists — VERIFY LICENSE first) or port its instancing/wind technique; the MIT R3F stylized-scene repo is the technique reference for instanced wind-driven grass. Trial GPU-instanced L-system forests for mid/far LOD behind EzTree hero trees.

## Open
- License verification on the grass repo before any code adoption.
- LOD strategy: hero trees near, instanced impostors far.
- Chunk-streaming integration (vegetation per chunk, deterministic per cell).
