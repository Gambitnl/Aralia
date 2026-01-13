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
- [x] Shader-based world grid + 5 ft outline highlight.
- [x] Party composition spawn + enemy placeholders with outlines.
- [x] Party AI v1: formation slots, separation, combat hold posture (no auto-aggro).
- [x] HUD speed indicator (ft/round + dash detection).
- [x] Biome catalogue expanded to 10 families × 5 variants (50 biomes) with hazards/resources; map gen uses weighted spawn and towns read biome families.

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

## Risks and Mitigations

- **Large tile footprint**: use chunked LOD + instancing + culling; no hard clip.
- **Content repetition**: mix asset variants and seeded rotations/scales; add hero props.
- **Performance spikes**: precompute seeds at game start and cache scene data.
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

## References

- `src/hooks/useSubmapProceduralData.ts`
- `src/config/submapVisualsConfig.ts`
- `src/services/mapService.ts`
- `src/services/wfcService.ts`
- `src/services/cellularAutomataService.ts`
