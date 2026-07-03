# World Beautification Wave — Design Spec (2026-07-02)

**Status:** grilled out in session (Remy + Fable), not yet built. This wave is
the head of the dependency chain — it lands BEFORE fight-in-place combat
slice 1 (see `2026-07-02-fight-in-place-combat-design.md`).

## Goal (player-visible)

The streamed 3D world stops being sparse and plain. Towns get lived-in clutter,
wilderness gets real cover, trees stop being cones, lighting gets the battle
map's atmosphere — one campaign, one visible transformation, in exploration
AND (later) combat.

## Locked decisions (interview, 2026-07-02)

1. **One wave, both catalogs.** A single prop SYSTEM (semantics + placement
   engine) ships with town clutter (crates, carts, barrels, market stalls,
   wells, fences, woodpiles…) and wilderness cover (rocks, fallen logs,
   thickets, ruins…) from day one. No town-first/wilderness-later split.
2. **Vegetation + lighting migration rides in the same wave.** The battle
   map's visual tech — volumetric tree canopies (EzTree-class), atmosphere/
   lighting — moves into the streamed world as part of this campaign. The
   biggest "ugly" delta is trees, not crates; fixing props without vegetation
   would miss the point.
3. **Full referee data on every prop from day one.** Every catalog entry
   declares: cover, blocks-sight, blocks-movement, material + thickness
   (the exact vocabulary the combat extraction and spell corpus already
   consume — `BattleMapTile.providesCover/blocksLoS/blocksMovement/material/
   thicknessInches`). This is the entire reason props precede combat.
4. **Beauty first, perf later — conscious deferral.** No performance gate on
   this wave (Remy's explicit call over a recommended hard gate). Entry FPS
   was ~13 in towns BEFORE this wave; every visual eyeball must still RECORD
   the FPS readout (information, not a gate), and a dedicated optimization
   campaign follows.
5. **Art direction: REALISM CLIMBS EVERYWHERE (2026-07-02).** The battle
   map's fidelity is the bar, not a ceiling: props are built detailed, the
   migrated vegetation keeps its realism, and buildings/terrain get upgraded
   toward that bar in later waves (building generator inherits this target).
   Interim mixed fidelity (detailed trees beside boxy houses) is ACCEPTED as a
   transition state — chosen over unified-stylized-low-poly and over
   deliberate-contrast.
6. **Visual anchor: Baldur's Gate 3.** Density + mood calibration for every
   eyeball: dense, readable clutter where every object is plausibly owned by
   someone. Screenshot-compare against BG3 town/wilderness shots during
   packet review.
7. **Asset sourcing: adopt-where-proven, build-where-gap (surveyed 2026-07-02).**
   - Trees: **EzTree stays** (MIT, seedable, still best-in-class for runtime
     JS) + trial GPU-instanced L-system forests for mid/far LOD.
   - Grass: trial `procedural-grass-threejs` (WebGL2 fallback exists —
     VERIFY LICENSE before adoption) or port the instancing/wind technique.
   - Rocks: **genuine gap — build owned**: icomesh (MIT) base + seeded
     FBM/Worley displacement; THREE.Terrain techniques for cliffs/scree.
   - Small props: **genuine gap — build owned** parametric generators
     (crate/barrel/cart/stall families) on `three-bvh-csg` (MIT) for boolean
     detailing. No adoptable prop-mesh library exists in the JS ecosystem —
     this validates the owned-generator strategy.
   - Buildings (later project): no adopt-ready open CGA/shape-grammar engine —
     custom lightweight CGA-subset interpreter (split/extrude/repeat, seeded),
     per the 2006 Müller CGA paper, reusing three-bvh-csg.
   - Textures: runtime seeded triplanar/noise shaders as primary; Material
     Maker (MIT) or Blender headless bake (GPL toolchain, outputs safe) for
     hero-asset PBR maps.
   - Sky: adopt three.js `Sky` (in-tree, MIT); clouds: trial the Nubis-port /
     WebGPU-fallback repos (verify licenses); fog: port the analytic
     volumetric-primitive technique (re-derive, don't copy).
8. **Renderer: WebGPURenderer migration first (DECIDED 2026-07-03).** Aralia's
   3D moves to three.js `WebGPURenderer` + TSL as the head slice of this wave
   (chosen order: props/catalogs are renderer-agnostic, but every visual
   packet should be built once, on the final renderer). What this unlocks:
   direct MIT code lifts from `Braffolk/fable5-world-demo` (a browser 4×4 km
   procedural world proving the fidelity ceiling: procedurally-grown trees w/
   impostor LOD, ~1M instanced grass, hierarchical wind, volumetric clouds,
   Hillaire sky, GI probes + shadow-color bounce) — plus erosion as a DETAIL
   PASS over our FMG-derived heightfields (never replacing world-canon
   terrain). Budgets re-scoped for a real game loop (the demo spends its whole
   frame on scenery). REJECTED alternative: WASM/native engine (Rust wgpu,
   C++ Emscripten) — an engine rewrite that forks the codebase into two
   languages, kills the TSL code reuse, and buys nothing for GPU-bound
   rendering; WASM stays the documented escape hatch for CPU-bound kernels
   (erosion sim, mass pathfinding) IF profiling ever demands it.
   Pending decision: adopting the demo's LAAS verification practices (ranked
   DELTA loop, scripted visual checks, banned-outcomes list, DEVIATIONS.md).
9. **Reproducibility is non-negotiable.** All placement seeded from the
   existing seed-path discipline: same world + same town → same props,
   forever. Placement is rule-driven (dock → crates/nets, smithy → woodpile,
   market plaza → stalls, biome → cover-scatter with clustering), not uniform
   scatter.

## Shape of the work (packet-friendly partition)

- **Prop schema + catalog format** — the contract: visual form + referee data
  + placement tags. (Everything else depends on this; do first.)
- **Placement engine** — seeded rules mapping town plan roles / building
  types / biomes → prop instances in the ground artifact.
- **Town catalog** / **wilderness catalog** — parallel packets once schema
  exists.
- **Vegetation migration** — battle-map tree tech into streamed chunks.
- **Lighting/atmosphere migration** — battle-map theme lighting in ground mode.
- **Referee integration** — extractLocalTerrainPatch reads prop semantics into
  tiles (proves decision 3 end-to-end).
- Each visual packet closes with a rendered eyeball (visual-inspection rule)
  including the FPS readout.

## Explicitly out of scope

- Performance optimization (own campaign, after).
- Combat mechanics (fight-in-place slice 1 — next campaign, depends on this).
- Building generator (separate project; its output will later feed the same
  prop/referee schema).
- Interactivity beyond combat semantics (lootable/searchable props — later).

## Related

- `2026-07-02-fight-in-place-combat-design.md` — the consumer of prop
  semantics; also records the locked mesh-LOS/cover decision this wave's
  blocks-sight data feeds.
- Plan-map nodes: `world-props` (this wave), `battlemap-polish-migration`
  (absorbed into this wave), downstream `fip-slice1`, `ambush-generation`.
