# Azgaar-Driven 3D Streamed World — Map Layer Redesign

**Date:** 2026-05-28
**Status:** Design approved, implementation pending
**Supersedes (partial):** Grid-mode world map in `MapPane`, the entire Submap layer
**Inspired by:** Veloren's worldsim / column architecture (GPL-3.0 — study only, do not copy)

---

## 1. Goal

Replace Aralia's current three-tier exploration stack (grid-mode world map → submap → combat) with a two-tier stack: **a 2D Azgaar atlas at world scale, and a single streamed 3D world at every smaller scale**. The 3D world is massive, traversable across chunks without scene transitions, faithful to the Azgaar atlas (every river, town, road, coastline you see in 2D exists in the same place in 3D), and the player's 3D position is bidirectionally synchronized with a marker on the atlas.

The motivating constraint: when you zoom in from the atlas to a region with a river, that river must be in the same place, flow the same direction, and connect the same way in 3D — and the same for towns, roads, biomes, coastlines, and lakes.

---

## 2. Current State and What's Being Replaced

### Kept (with extensions)

- **`MapPane.tsx`** — the embedded Azgaar atlas. Default mode stays. Pan/zoom in 2D stays.
- **`azgaarDerivedMapService.ts`** — the world generator. Extended (not replaced) to produce richer artifacts (see §5).
- **`BattleMap3D.tsx`** and its subtree (`terrain/`, `camera/`, `characters/`, `vfx/`) — reused as the rendering toolkit for the 3D world. Combat keeps its own tactical instance; the 3D world reuses the same primitives.
- **`TownCanvas.tsx`** — town rendering stays as-is. Approaching a town in the 3D world hands off to TownCanvas (for now; merging towns into the world is future work, see §13).

### Removed

- **Grid-mode world map** in `MapPane` (the `MapTile` rendering path). Azgaar atlas becomes the only world view.
- **The entire Submap layer**:
  - `src/components/Submap/` (SubmapPane, SubmapTile, painters, all colocated hooks)
  - `src/hooks/useSubmapProceduralData.ts`
  - `src/services/cellularAutomataService.ts` (was used by submap caves; reassessed for combat reuse before deletion)
  - `src/services/wfcService.ts` (was used by submap; same reassessment)
  - `src/config/submapVisualsConfig.ts`
  - Related tests under `src/components/Submap/__tests__/`

### Added

- **A "world sim" output**, persisted per-save, carrying polyline rivers, sites with footprints, road graph, biome polygons. Extends the existing `MapData.azgaarWorld` payload.
- **A new 3D-world subsystem** under `src/components/World3D/` with `World3DScene.tsx` as the entry, plus a `ChunkManager`, chunk generator, LOD system, and persistence layer.
- **A 2D ↔ 3D transition controller** that handles the dive animation, the camera handoff, and the Azgaar marker sync.
- **Migration hooks** for converting saves created before this redesign (see §14).

---

## 3. Locked-In Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Zoom model | **Hybrid** — 2D Azgaar atlas pans/zooms continuously, then a single threshold drops the player into a continuous 3D world | Sidesteps the "magic middle" of true continuous zoom; keeps Azgaar at its strengths; matches BG3's actual world-map → zone model |
| World data source | **Procedural per-seed** — extend `azgaarDerivedMapService` to produce all rich artifacts | Keeps Aralia's per-seed identity; one engineering effort delivers both 2D enrichment and 3D fidelity |
| World sim ↔ chunk render split | **Strict separation, Veloren-style** | Adherence is structural: chunks sample from world sim output, so they cannot disagree with the atlas |
| 3D scope | **Streamed massive world** — chunks loaded around the player, LOD for distance | "Massive in scope, surrounding chunks accessible by traversing" is a hard requirement |
| 3D renderer | **R3F (reuse BattleMap3D primitives)** | Engine already exists; same biome lighting, terrain shaders, vegetation system |
| Combat | **Separate scene, still BattleMap3D** | Combat is its own bounded tactical scene; transitioning into it from the 3D world is fine and matches existing flow |
| Towns | **Separate scene, still TownCanvas** for v1; merge later | Town rendering is mature and not the bottleneck; merging into the 3D world is a future polish |
| Licensing reference | **Veloren as architecture reference only** (GPL-3.0) | Study patterns, write our own code |

---

## 4. Architecture

### 4.1 The two-stage pattern

```
┌──────────────────────────────────────────────────────────────┐
│  WORLD SIM  (runs ONCE per worldSeed, at world creation)     │
│  src/services/worldSim/                                      │
│                                                              │
│   worldSeed  ─►  heightmap (per-cell elevation)              │
│                  climate (temp, humidity)                    │
│                  biomes (per-cell + polygon zones)           │
│                  RIVER NETWORK (polylines, flow, discharge)  │
│                  SITES (towns, dungeons, ruins; footprints)  │
│                  ROAD GRAPH (graph of sites, edge polylines) │
│                  coastlines + lakes (polygons)               │
│                                                              │
│   Output: WorldData (persisted in the save file)             │
└──────────────────────────────┬───────────────────────────────┘
                               │
              ┌────────────────┴───────────────────┐
              │                                    │
              ▼                                    ▼
┌──────────────────────────┐      ┌────────────────────────────┐
│  AZGAAR ATLAS (2D)       │      │  CHUNK RENDER (3D)         │
│  src/components/MapPane  │      │  src/components/World3D    │
│                          │      │                            │
│  reads WorldData         │      │  for each loaded chunk:    │
│  renders SVG atlas       │      │    (worldSeed, cx, cy)     │
│  player marker = world   │      │    + slice of WorldData    │
│    position projection   │      │      overlapping chunk     │
│                          │      │    ──► heightfield mesh    │
│                          │      │        water from rivers   │
│                          │      │        roads from graph    │
│                          │      │        buildings from      │
│                          │      │          sites             │
│                          │      │        vegetation by biome │
└──────────────────────────┘      └────────────────────────────┘
```

### 4.2 Adherence by construction

The atlas SVG and the 3D mesh both draw from the same WorldData object. A river polyline is one object: the SVG renders a stroked path, the 3D layer extrudes a water mesh along the same polyline. They cannot drift because they are the same data.

### 4.3 Top-level component map

```
App.tsx
├── MapPane.tsx                  (2D atlas — unchanged externally; reads new WorldData fields)
├── World3DScene.tsx             (NEW — top-level R3F <Canvas> for the streamed world)
│   ├── ChunkManager             (NEW — sliding window of loaded chunks around player)
│   ├── Chunk[] (instanced)      (NEW — per-chunk subtree)
│   │   ├── ChunkTerrainMesh     (reuses TerrainMesh patterns at chunk scale)
│   │   ├── ChunkRivers          (NEW — water mesh extruded along river polylines)
│   │   ├── ChunkRoads           (NEW — road mesh extruded along graph edges)
│   │   ├── ChunkSites           (NEW — building footprints; full town hands off to TownCanvas)
│   │   ├── ChunkVegetation      (reuses GrassLayer + EzTreeLayer per chunk)
│   │   └── ChunkScatter         (reuses GroundScatter per chunk)
│   ├── PlayerActor              (reuses CharacterActor)
│   ├── CameraController         (extends combat CameraController with free-roam mode)
│   ├── DistanceLOD              (NEW — selects render mode per chunk by distance)
│   └── SkyAtmosphere            (takram atmosphere + clouds at world scale)
├── TransitionController.tsx     (NEW — handles 2D ↔ 3D dive animation + camera handoff)
├── CombatView.tsx               (unchanged — BattleMap / BattleMap3D toggle stays)
└── TownCanvas.tsx               (unchanged)
```

---

## 5. World Sim — What It Produces

### 5.1 Extended WorldData shape

```ts
// Replaces the current MapData.azgaarWorld payload.
interface WorldData {
  version: 2;
  seed: number;
  templateId: string;

  // Existing per-cell scalars (kept)
  gridSize: { rows: number; cols: number };
  heights: number[];          // 0-100 per cell
  temperatures: number[];     // °C per cell
  moisture: number[];         // 0-100 per cell
  biomeIds: string[];         // resolved per cell

  // NEW: polyline networks
  rivers: River[];
  roads: Road[];

  // NEW: site placements (towns, dungeons, ruins)
  sites: Site[];

  // NEW: polygons
  coastlines: Polygon[];      // closed loops, one per landmass
  lakes: Polygon[];
  biomeZones: BiomeZone[];    // contiguous biome polygons for fast spatial query
}

interface River {
  id: string;
  points: Array<{ x: number; y: number }>;    // world coords, ordered source → mouth
  width: number[];            // per-segment width in world meters
  discharge: number[];        // per-segment flow volume (for water shader)
  parentId?: string;          // tributary relationship
}

interface Road {
  id: string;
  points: Array<{ x: number; y: number }>;
  type: 'major' | 'minor' | 'trail';
  fromSiteId: string;
  toSiteId: string;
}

interface Site {
  id: string;
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
  position: { x: number; y: number };         // world coords
  footprint: Polygon;                          // outer boundary in world coords
  population?: number;
  walled?: boolean;
  // Town-only: link to the TownCanvas seed/data
  townSeed?: number;
}

type Polygon = Array<{ x: number; y: number }>;

interface BiomeZone {
  biomeId: string;
  polygon: Polygon;
}
```

### 5.2 Algorithms (procedural, per-seed)

| Artifact | Algorithm | Notes |
|----------|-----------|-------|
| Heightmap | **Existing** template engine in `azgaarDerivedMapService` | Already produces 0-100 per cell |
| Climate, biomes | **Existing** | Already produces temp / moisture / biomeId |
| Rivers (polylines + flow) | **Hydraulic-erosion-style flow accumulation**: for each cell, compute steepest-descent neighbor; accumulate upstream cells; cells with flow > threshold become river segments; trace polylines along the steepest-descent graph | This is the canonical river algorithm Azgaar itself uses; we'd reimplement |
| Sites | **Score + Poisson-disk placement**: cells score on `flatness * (river_proximity + coast_proximity + road_potential)`; top scorers placed with min spacing | Towns hug rivers/coasts; dungeons placed in low-score cells (wilderness) |
| Road graph | **A* over heightfield between every pair of important sites**, prune by minimum spanning tree + a few extra edges for redundancy | Roads avoid steep terrain |
| Coastlines / lakes | **Marching squares** on the height = sea_level threshold | Standard polygon extraction from scalar field |
| Biome zones | **Marching squares per biome class** | Same as coastlines, per biome boundary |

These are well-trodden algorithms. None require novel research. Estimated implementation per artifact: 2–5 days each.

### 5.3 Persistence

WorldData is computed at world creation and stored in the save file. Re-generation only happens if the user explicitly regenerates the world. The atlas SVG and the 3D chunks both read from the persisted WorldData.

---

## 6. Chunk Render — Building a 3D Chunk from WorldData

### 6.1 Chunk size and world dimensions

- **Default chunk size:** 128m × 128m in world space.
- **Default world size:** 60 cols × 40 rows from the Azgaar grid. Each Azgaar cell corresponds to 8 × 8 = 64 chunks, so the world is ~480 × 320 chunks (~61km × 41km).
- These are tunable via constants. Smaller chunks = more streaming overhead; larger chunks = more per-chunk content.

### 6.2 Per-chunk generation steps

For `(worldSeed, chunkX, chunkY)`:

1. **Compute the chunk's world AABB.** Sample WorldData layers overlapping this box.
2. **Heightfield mesh.** A `PlaneGeometry` at chunk size, ~64×64 subdivisions, with vertex Y from bilinear interpolation of WorldData.heights. Borders sample from the same source as neighbors, so seams stitch by construction.
3. **Water meshes.** For each river polyline intersecting the chunk, extrude a strip along the polyline with per-segment width. Snap polyline vertex Y to terrain height. Apply the existing water shader.
4. **Road meshes.** Same pattern as rivers but using the road type for texture (cobble / dirt / trail).
5. **Site rendering.** For each site with footprint intersecting the chunk:
   - `kind: 'town'` — render only the wall + outer buildings here; clicking handed off to TownCanvas
   - `kind: 'dungeon'` / `'ruin'` — render the entrance and exterior; interior is its own scene (or a future submap-style instance)
   - `kind: 'landmark'` — render the prop directly
6. **Vegetation.** Use existing `GrassLayer` and `EzTreeLayer` patterns, scoped to the chunk. Density and species table come from the chunk's dominant biome zones.
7. **Decoration scatter.** Reuse `GroundScatter` per-chunk.

All deterministic from `(worldSeed, chunkX, chunkY)`.

### 6.3 Per-chunk persistence

Player-introduced changes (kills, picked-up loot, talked-to NPCs) are stored as a per-chunk delta keyed by `(chunkX, chunkY)`. On chunk re-load, the delta is applied over the deterministic base. Save file size scales with chunks-visited, not world size.

---

## 7. Streaming, LOD, Persistence

### 7.1 ChunkManager

```ts
class ChunkManager {
  loadRadius: number;    // chunks loaded within this radius of player
  unloadRadius: number;  // chunks beyond this radius are unloaded (>= loadRadius)

  update(playerWorldPos: Vec2): void;
  // diff target loaded set vs current set
  // schedule chunk loads / unloads on a worker pool
}
```

- **Default load radius:** 4 chunks (~512m visible at full detail). Tunable per quality preset.
- **Default unload radius:** 6 chunks. Hysteresis prevents thrash at the edge.
- **Loading is async** via a worker pool (`new Worker(...)` with `?worker` import). Each worker generates one chunk at a time.
- **Loading priority:** chunks in front of the camera load first.

### 7.2 LOD rings

| Distance from player | Render mode |
|----------------------|-------------|
| 0 ≤ d < load radius | Full detail — heightfield + vegetation + water + sites |
| load ≤ d < far radius | Mid LOD — heightfield + impostor vegetation (billboards) + water as flat mesh |
| far ≤ d < horizon | Low LOD — coarse heightfield only, no vegetation, sites as marker billboards |
| beyond horizon | Skybox / atmosphere only |

The far rings let the player see mountains 5km away without loading their content.

### 7.3 Save format

```ts
interface WorldSave {
  worldData: WorldData;                          // computed once
  chunkDeltas: Record<ChunkKey, ChunkDelta>;     // grows with exploration
  playerWorldPos: Vec3;
  playerOrientation: Quat;
  // ... existing save fields
}
```

ChunkKey is `${cx}_${cy}`. ChunkDelta is an opaque diff (entity additions/removals, loot taken, etc.).

---

## 8. 2D ↔ 3D Transition

### 8.1 Entering 3D

Trigger: user clicks "Enter world" on a discovered Azgaar tile, or zooms past a threshold (atlas-zoom level configurable).

1. Fade-out the atlas SVG over ~300ms.
2. `TransitionController` resolves the click target to a world position `(wx, wy)`.
3. `World3DScene` mounts with `playerWorldPos = (wx, wy, terrainHeight)`.
4. ChunkManager begins loading the surrounding chunks (8 chunks within load radius). The dive animation runs over ~1500ms while chunks load.
5. Camera lerps from a top-down framing to the BG3-style orbit around the player.
6. Player gains 3D input control.

If chunks haven't loaded by the time the dive completes, the camera waits at the destination until the first chunk is ready, then proceeds.

### 8.2 Exiting to 2D

Trigger: user opens the world map (existing keybind).

1. Camera lerps up to a high orbit.
2. Fade in atlas SVG over ~400ms.
3. `World3DScene` is kept mounted but paused (chunks stay loaded for fast re-entry; configurable).

The player can also leave the world entirely (back to menu) which fully unmounts `World3DScene`.

### 8.3 Click-on-atlas teleport

In atlas mode, clicking a discovered tile with the "fast travel" affordance teleports the player to that world position. Internally this is the same path as Entering 3D but with a chosen destination.

---

## 9. Azgaar Marker Sync

A bidirectional binding between 3D player position and a marker on the atlas SVG.

### 9.1 3D → atlas (live position)

- The atlas pane subscribes to `playerWorldPos` from game state.
- Projects `(wx, wy)` to atlas SVG coords via a simple scalar transform (world meters → SVG units).
- Renders a `<circle>` marker that updates as the player moves.

When the atlas is mounted, this updates in real time. When the atlas is unmounted (3D mode active), no updates fire.

### 9.2 atlas → 3D (click-to-travel)

- User clicks on a discovered atlas cell.
- The click handler reverse-projects the SVG click to `(wx, wy)`.
- The transition controller (see §8.3) takes over.

Both directions are O(1) math; no complex sync logic, no event bus, no race conditions.

---

## 10. Town Map Relationship

For v1, towns stay as the existing `TownCanvas`:

- The 3D world renders the *exterior* of a town: walls, outer buildings, gates.
- Approaching a gate close enough triggers a prompt; entering hands off to `TownCanvas`, exiting returns to the 3D world at the same gate.
- Town's `townSeed` is stored on the `Site` so the town map is deterministic from the world sim.

Future work (out of scope for this spec): merge town interiors into the 3D world's streamed chunks — but that's a large effort and the existing `TownCanvas` is mature.

---

## 11. Combat Relationship

For v1, combat stays as the existing `BattleMap3D`:

- Encounters trigger in the 3D world (via `useEncounters` or proximity to enemy NPCs).
- The encounter transition saves the 3D world state and loads `BattleMap3D` with `(biome, encounterSeed)` derived from the world position + worldSeed.
- After combat, the player returns to the 3D world at the same position.

The biome passed to `battleMapGenerator` now comes from the world sim's per-cell biome data, so the battle map biome matches what the player saw in 3D right before combat. (Bridge from §1 of the original brainstorm — solved as a byproduct of this design.)

Future work: make combat happen in-place in the 3D world (no scene transition). Out of scope for v1.

---

## 12. Migration: What Goes Away

The following files are deleted as part of this work:

```
src/components/Submap/                          (entire directory)
src/hooks/useSubmapProceduralData.ts
src/hooks/useSubmapProceduralData.README.md
src/services/cellularAutomataService.ts         (reassess: if combat doesn't need it, delete)
src/services/wfcService.ts                      (reassess: if combat doesn't need it, delete)
src/config/submapVisualsConfig.ts
docs/architecture/domains/submap.md             (replaced by World3D domain doc)
```

In `MapPane.tsx`:

- The grid-mode rendering path (`MapTile`-based fallback) is removed.
- The Azgaar atlas mode becomes the only mode.
- Adds: the world-position marker subscription, the click-to-travel handler.

Save format migration: a one-shot loader detects v1 saves (no `WorldData` or with `azgaarWorld.version: 1`), runs the world sim once on the existing `worldSeed`, writes a `WorldData` payload, and saves back. Existing chunk deltas don't exist yet, so nothing to migrate.

---

## 13. MVP Scope

### In for v1 ("first playable streamed 3D world")

- World sim extensions: polyline rivers + flow, sites with footprints, road graph, coastlines/lakes/biome polygons
- WorldData persistence in saves
- `World3DScene` with chunk streaming, LOD rings, async worker generation
- Chunk rendering of terrain, rivers, roads, vegetation
- Site rendering: town exteriors, dungeon/ruin landmarks
- 2D ↔ 3D transition controller
- Bidirectional Azgaar marker sync
- Deletion of submap layer and grid-mode world map
- Save migration for existing v1 saves

### Deferred to v2+

- Caves and underground (separate worldgen pass)
- Cultures / states / religions / dynamic history (Azgaar exports these; we don't use yet)
- Weather sim integrated into 3D world (existing `WeatherSystem` is data-only; 3D presentation comes later)
- Towns merged into 3D world (interior rendering)
- In-place combat (no scene transition)
- Dynamic regeneration / world-editor in-game

---

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chunk generation is too slow → player walks into unloaded chunks | Medium | High | Worker pool, prioritize chunks in camera direction, generate impostor terrain first then refine |
| LOD rings still drop below 60fps on target hardware | Medium | Medium | Aggressive InstancedMesh; KTX2 textures; quality presets; profile early |
| River polyline extraction produces ugly artifacts at chunk borders | Medium | Medium | Polylines sampled from continuous WorldData, not per-chunk; tested with explicit cross-border cases |
| Save file bloat from chunk deltas | Low | Medium | Delta-compress; periodic prune of distant chunks player hasn't visited in a long time |
| WorldData persistence + chunk delta logic introduces save corruption bugs | Medium | High | Strict version field; one-shot migration; round-trip save/load tests as part of CI |
| Submap deletion breaks dependents we haven't enumerated | Medium | Medium | Pre-flight: grep all imports of `Submap`, `useSubmapProceduralData`, `cellularAutomataService`, `wfcService`; ensure each is either deleted with the submap or moved to a clear new home |
| WorldData schema v2 breaks tests | Low | Low | Schema versioned; existing tests adjusted as part of the same PR series |

---

## 15. Out of Scope (v1)

- Multiplayer / networked exploration
- Mobile / tablet support
- Procedural worldgen quality matching Azgaar's atlas exactly in every detail (we target *fidelity to atlas geometry*, not visual style matching)
- Day/night cycle in the 3D world (existing day/night state is rendered as a lighting tint only)
- Audio / spatial sound

---

## 16. References

### Pattern reference (study only, GPL-3.0)
- [Veloren worldgen architecture](https://gitlab.com/veloren/veloren) — particularly `world/src/sim/` (world sim) and `world/src/column/` (chunk render)

### Algorithms
- Flow accumulation / hydraulic erosion: Tarboton (1997) D∞ flow direction
- Poisson-disk sampling: Bridson (2007)
- A* over heightfield: standard
- Marching squares: standard

### Existing Aralia surfaces this design reuses
- `docs/architecture/COMBAT_MAP_ENGINE.md`
- `src/components/BattleMap/BattleMap3D.tsx` and its `terrain/`, `camera/`, `vfx/` subtrees
- `src/services/azgaarDerivedMapService.ts`
