# Sub-spec: Owned rock + prop generators

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** built 2026-07-04 — wilderness slice (rock/log/bush) plus TOWN slice: 6 seeded vertex-colored generators (`gravestoneGeometry`, `postGeometry`, `statueGeometry`, `anvilGeometry`, `scarecrowGeometry`, `brazierGeometry` on shared `partBuilder.ts`) giving real meshes to 13 defs that previously reused boulder/barrel/crate forms (gravestone, tomb, stone-cross, statue, milestone, wayside-shrine, lantern-post, tavern-sign, fingerpost, anvil, grindstone, scarecrow, brazier).

## Decision
The 2026-07-02 tooling survey found GENUINE ECOSYSTEM GAPS: no adoptable JS
procedural generator exists for rocks or small props (or buildings). Build
owned, seeded generators:
- Rocks: icosphere base (`icomesh`, MIT) + seeded FBM/Worley displacement;
  THREE.Terrain techniques for cliffs/scree.
- Props: parametric generator functions per family (crate, barrel, cart,
  stall…) composed from primitives with `three-bvh-csg` (MIT) for boolean
  detailing (notches, holes, joinery).
This validates the owned-generator strategy the separate building-generator
project also follows.

## Open
None. Per-family parameter spaces landed with the generators (each file
documents what varies per seed: proportions, lean/wear, tone pick, variant
branch). Texture strategy resolved: baked per-vertex colors on flat-shaded
merged geometry (`partBuilder.ts`) — no shaders or maps needed at the
world's low-poly style. Verified in-scene 2026-07-04 (headless shots in
`.agent/scratch/townprops-*.png`).
