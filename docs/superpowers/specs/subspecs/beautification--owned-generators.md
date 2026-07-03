# Sub-spec: Owned rock + prop generators

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** specced, not built.

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
- Per-family parameter spaces (what varies per seed: proportions, wear, color).
- Texture strategy per generator (seeded triplanar shaders vs baked maps).
