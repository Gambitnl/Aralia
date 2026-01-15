# 1A-3D-EXPLORATION-ROADMAP

**Purpose**: Roadmap for adding a 3D exploration and combat mode using React Three Fiber (R3F), with procedural world/submap/town/dungeon generation at game start.

**Last Updated**: Jan 13, 2026
**Status**: Active
**Owner**: TBD

---

## Goals

- Ship a full 3D exploration modal for each submap tile, plus towns and dungeons.
- Keep the existing React UI; render combat/spell UI as overlays inside the modal.
- Support continuous movement (WASD) and third-person follow/orbit camera.
- Enforce DnD-style distance mechanics (feet, movement budget, AoE shapes).
- Generate all 3D scenes procedurally at game start and cache by seed.

## Non-Goals (for v1)

- Full open-world streaming across multiple submap tiles without re-entry.
- Multiplayer synchronization.
- VR support.

---

## Core Constraints and Decisions

- **Units**: 1 unit = 1 foot.
- **Combat grid**: 5 ft tile lines; range/ruler snap to 5 ft lattice.
- **Submap tile footprint**: ~9000 ft x 9000 ft.
  - Base speed: 30 ft / 6 sec = 5 ft/sec.
  - Walk crossing time: ~30 min edge-to-edge.
  - Dash: ~15 min edge-to-edge.
- **Camera**: third-person follow + orbit; free-cam in combat with 500 ft cap.
- **Fog**: atmospheric only (biome/time-of-day); not a hard clip.
- **Time-of-day**: driven by game clock; lighting/fog lerp on throttled ticks.
- **Generation timing**: world/submap/town/dungeon seeds and layouts are created at game start; scenes are cached for reuse.
- **Combat grid rendering**: shader-based world grid projected onto terrain, aligned to 5 ft lattice (full-tile, world-space).

---

## Current Progress (Jan 2026)

- [x] R3F dependencies and 3D modal scaffold (ThreeDModal + Scene3D).
- [x] Player movement + follow/orbit camera + feet-based speed.
- [x] Heightfield terrain (Perlin) with biome-tinted props (instanced).
- [x] Height-based terrain shading + sky dome + biome water planes.
- [x] Terrain slope + moisture samplers wired into shader tinting for richer gradients.
- [x] Shader-based world grid + 5 ft outline highlight.
- [x] Party composition spawn + enemy placeholders with outlines.
- [x] Party AI v1: formation slots, separation, combat hold posture (no auto-aggro).
- [x] HUD speed indicator (ft/round + dash detection).
- [x] Biome catalogue expanded to 10 families × 5 variants (50 biomes) with hazards/resources; map gen uses weighted spawn and towns read biome families.
- [x] Submap vs combat grid terminology clarified in the 3D UI (combat grid toggle + submap seed label).
- [x] Kenney tree kit props loaded, merged, rebased, and instanced with scale + density tuning; shader grid still grooves through terrain.
- [x] Ez-tree procedural tree pipeline integrated (seeded variant pool + instanced trunks/leaves), replacing GLB reliance (no fallbacks).
- [x] Plains sampler amplitude boosted; player controller height-samples to follow hills so trees align with ground.
- [x] Spawn-safe radius for props to keep the player start area clear (no trees/rocks at spawn).

---

## Known Issues / Blockers

- **Firefox WebGL context creation failures** were observed (`FEATURE_FAILURE_EGL_NO_CONFIG`, `FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`) and resolved locally by restarting Firefox and updating `webgl.*` prefs (`webgl.forbid-software=false`, `webgl.force-enabled=true`). Documented in README for future devs; keep monitoring for regressions.

---

## Architecture Sketch

- **ThreeDModal**: React modal shell hosting the R3F Canvas and UI overlays.
- **SceneController**: owns scene lifecycle, lighting, fog, and combat/explore modes.
- **Generators**:
  - TerrainGenerator (outdoor heightfield + water)
  - PropsGenerator (seeded features, biome props, instancing/variants)
  - DungeonGenerator (CA/WFC room layout, corridors, levels)
  - TownGenerator (village layout -> 3D blocks/streets)
- **CameraController**: follow/orbit camera with optional free-cam in combat.
- **InputController**: WASD movement, dash, interact; movement uses feet-based speed.
- **SceneEvents**: event bus between React UI and 3D scene (spells, attacks, LOS).
- **SceneCache**: stores generated scenes by tile seed and biome.

---

## Roadmap Phases

### Phase 0 - Foundations

**Tasks**
- Add R3F dependencies and a minimal 3D modal scaffold.
- Create ThreeDModal + SceneController + CameraController + InputController.
- Add a submap UI toggle to enter/exit 3D mode.

**Exit Criteria**
- Modal opens/closes cleanly, input disabled outside modal.
- Player moves on a flat ground plane with follow/orbit camera.

---

### Phase 1 - Data Pipeline and Caching

**Tasks**
- Define 3D scene input payload (seed, biome, features, time, weather, stats).
- Generate and store scene seeds at game start (world/submap/town/dungeon).
- Implement SceneCache keyed by tile seed + biome + scene type.
- Thread biome family/tags into world/submap/town seeds so encounter/resource hooks stay deterministic.

**Exit Criteria**
- Entering a tile reuses cached scene state.
- Deterministic visuals for a given seed.

---

### Phase 2 - Terrain and Environment

**Tasks**
- Outdoor heightfield terrain (biome-driven noise) and water bodies.
- Chunked LOD for terrain and props (near/mid/far impostors).
- Atmospheric fog, sky light, and sun light driven by game time.
- Height-based terrain shading and sky dome visuals.
- Shader-based 5 ft grid integrated into terrain material (world-space, full-tile).
- Grid anti-aliasing (fwidth smoothing) and distance-based fade.

**Exit Criteria**
- Outdoor scene spans ~9000 ft with continuous visuals.
- Lighting changes follow game time without large perf spikes.

---

### Phase 3 - Movement, Navigation, and Interaction

**Tasks**
- Continuous movement using feet-per-second; dash support.
- Collision with terrain and large props; basic slope limits.
- Basic interactables (entrances, POIs, feature triggers).
- Add placeholder enemy units with seeded placement and outline highlights.
- Spawn party members based on party composition and attach outline highlights.
- Party AI v1: formation slots that rotate with heading, spacing/separation, simple combat hook (engage/hold based on role).
- Add HUD speed indicator for movement (ft/round, dash state).

**Exit Criteria**
- Movement feels stable across long distances.
- Player can reach POI triggers and return without jitter.

---

### Phase 4 - Combat Mode and Measurement

**Tasks**
- Combat overlays: shader grid toggle + ruler + AoE shape previews (cone/cube/radius/emanation).
- Selection/highlight overlays for specific cells (outline style via decals/instanced quads), independent of grid shader.
- Movement budget enforcement in feet during combat.
- React UI overlays for spells/actions with SceneEvents bridge.
- Optional in-scene health bars (sprites) for combat clarity.

**Exit Criteria**
- Combat distances match tabletop rules.
- Spell UI triggers scene VFX and uses 3D distance/LOS.

---

### Phase 5 - Dungeons and Towns

**Tasks**
- DungeonGenerator: CA/WFC rooms, corridors, vertical levels, seed variants.
- TownGenerator: streets + building blocks + props; uses village layouts.
- Biome-specific combat styling (lighting/fog/props) while staying in same scene.

**Exit Criteria**
- Entering a dungeon/town tile spawns a distinct 3D layout.
- Combat retains tile scene but applies biome-specific combat visuals.

---

### Phase 6 - Performance and Scaling

**Tasks**
- Instancing for common props with multiple asset variants.
- Occlusion/frustum culling, chunk streaming, and draw-call budgets.
- Metrics panel (fps, draw calls, visible instances) for tuning.

**Exit Criteria**
- Stable frame time in large tiles on mid-range GPUs.

---

### Phase 7 - Content Expansion

**Tasks**
- Asset library growth (biome prop sets, dungeon kits, town kits).
- AI-to-3D pipeline integration (placeholder hooks in asset loader).
- Biome/weather VFX library (rain, snow, spores, dust).

**Exit Criteria**
- Visual variety across many tiles without repetition.

---

## Research-Driven Proc-Gen Plan (2025/2026)

**Phase A - Terrain Context (masks + slopes)**
- Extend `terrainUtils.ts` to output height, slope, and moisture samplers per tile.
- Use slope/moisture masks in `Terrain.tsx` shader for richer biome gradients.

**Phase B - Rivers and Lakes (flow maps)**
- Build a coarse flow map per tile (height-based steepest descent).
- Carve riverbeds into the height sampler and lay spline/strip meshes for water.
- Spawn lakes by pooling at local minima and feed their water level to `WaterPlane`.

**Phase C - Caves and Underground**
- For cave biomes, drive geometry from CA grids (marching squares/cubes).
- For dungeons, keep WFC rooms and add connectors for multi-level layouts.

**Phase D - Prop Density and Biome Hooks**
- Use slope/moisture masks to gate prop density and spacing.
- Apply Poisson-disc style placement for trees/rocks to avoid overlaps.
- Keep hero assets (Kenney trees) layered after seeded features.

**Phase E - Caching + Perf**
- Cache height/flow/prop masks per `tileSeed` (SceneCache).
- Store low-res mask textures to sample in shaders and reduce CPU overhead.

---

## Risks and Mitigations

- **Large tile footprint**: use chunked LOD + instancing + culling; no hard clip.
- **Content repetition**: mix asset variants and seeded rotations/scales; add hero props.
- **Performance spikes**: precompute seeds at game start and cache scene data.
- **WebGL context creation failure**: cap geometry complexity per tree, reduce instance counts per biome, disable unnecessary GPU features (e.g., shadows/AA), and provide a strict low-GPU profile (still ez-tree, no fallbacks).
- **Shader grid aliasing/shimmer**: fwidth-based line smoothing + distance fade + thicker near lines.
- **Grid distortion on slopes**: use world-space projection and slope-aware line width; allow grid fade on steep inclines.
- **Chunk seams in grid**: compute grid lines from world-space coordinates (not chunk-local UVs).
- **Grid cell highlighting**: render selection overlays as separate decals/instanced planes to avoid shader complexity.

---

## Open Questions

- Final chunk size for LOD/culling (start with 400-600 ft).
- Indoor dungeon footprint per level.
- Target FPS and minimum GPU profile.
- Preferred highlight style for combat tiles: outline.

---

## Lessons Learned

- **Kenney assets require rebasing.** The downloaded `kenney_nature-kit.zip` held GLTF trees whose meshes sat inside nested scene nodes; we now traverse/trench the entire scene, merge children, and subtract `minY` so their bases align with the heightfield (the trunks no longer clip below the ground).
- **Player height should mirror terrain.** The controller already sampled heights, but the props were still offset—rebasing trees and keeping the player y-value tied to `heightSampler(x,z)` (plus offset) makes hills navigable without clipping into the lower plane.
- **Dev-only turbo toggle.** Adding the toggled button in the 3D top bar gave us a fast-paced run to stress-test large tiles without exposing it outside dev mode.
- **Submap vs combat grid clarity.** UI terminology now distinguishes the full 3D submap tile from the 5 ft combat grid.
- **Ez-tree complexity must be capped.** Procedural tree generation can overwhelm GPU context creation if branch/leaf detail and instance counts are too high; counts and topology must be tightly bounded.
- **Progressive tuning matters.** Start with small trees, increase scale, then adjust sampler amplitude/density; each iteration surfaces new issues (e.g., culling, bounding boxes) that we logged and fixed before moving on.

---

## References

- `src/hooks/useSubmapProceduralData.ts`
- `src/config/submapVisualsConfig.ts`
- `src/services/mapService.ts`
- `src/services/wfcService.ts`
- `src/services/cellularAutomataService.ts`
