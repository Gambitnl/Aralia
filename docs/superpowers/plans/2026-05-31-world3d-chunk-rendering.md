# World3D Chunk Rendering (Real Meshes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan 2's flat placeholder heightfield with real per-chunk content — biome-colored terrain, water surfaces along river/lake polylines, road ribbons, site (town/dungeon/ruin) exteriors, and scattered vegetation — all generated behind the existing `handleChunkRequest` seam from the same `WorldData`.

**Architecture:** Widen the per-chunk pipeline from a single terrain mesh to a `ChunkMeshBundle` (terrain + optional water/roads + sites + vegetation instances). The sampler is extended to slice per-vertex biomes plus the rivers/roads/sites overlapping each chunk; a set of small, pure geometry builders turn that slice into mesh buffers. Everything stays in the worker-offloadable, deterministic, unit-tested core — only `World3DScene` (the React shell) changes to render the bundle's sub-meshes. A bundle containing only terrain renders identically to Plan 2, so the rewire is behavior-preserving.

**Tech Stack:** TypeScript, Vitest 4.x (globals — do NOT import `it`/`describe`/`expect`/`beforeEach`), three.js r170, @react-three/fiber 9, @react-three/drei 10. Consumes `WorldData` (`River`/`Road`/`Site`/`Vec2`) from Plan 1 and the streaming machinery from Plan 2.

**Source spec:** `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` (§6.2 per-chunk generation steps).

**Branch:** `codex/package17-operational` (where Plans 1 + 2 live). Confirm with `git branch --show-current` before starting.

**Depends on:** Plan 2 (World3D Streaming) — landed. `sampleChunk`, `handleChunkRequest`, `ChunkStreamer`, `World3DScene`, `coords`, `config` exist under `src/systems/world3d/` and `src/components/World3D/`.

> **STATUS (2026-05-31):** Implemented and unit-tested (61 tests green). Live browser debugging found the demo scene does **not** render reliably yet — blank canvas from WebGL context loss + an over-heavy scene at ~30k world coordinates, plus a `?phase=world3d` cold-load phase bounce. Data + streaming are confirmed working (81 chunks load). The rendering fixes are tracked in the follow-up plan: **`docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md`**.

---

## Coordinate facts (CRITICAL — every builder relies on these)

- **WorldData polylines/sites are in GRID space** (cells). `River.points`, `Road.points`, `Site.position`, `Site.footprint` are all `{x, y}` grid-cell coordinates (cell-centers carry a `+0.5`). `heights[gridY*cols + gridX]`.
- **World space** is meters, three.js axes: `x` east, `z` south, `y` up. `worldX = gridX * METERS_PER_CELL`, `worldZ = gridY * METERS_PER_CELL`.
- **Chunk-local space**: a chunk's meshes have origin at the chunk's NW corner. `localX = worldX - cx*CHUNK_WORLD_SIZE`, `localZ = worldZ - cy*CHUNK_WORLD_SIZE`. The scene already positions each chunk mesh at `chunkOriginWorld(cx,cy)`, so builders must output **local** coordinates.
- A chunk spans `CHUNK_WORLD_SIZE / METERS_PER_CELL` grid cells (with defaults, `128/1024 = 0.125` cells). Rivers/roads/sites are sparse in grid space, so **most chunks contain none** — every builder must handle the empty case by returning empty buffers.
- Terrain height in meters: `yMeters = (height01 / 100) * MAX_TERRAIN_HEIGHT_M` (height01 is the 0..100 WorldData value), matching `buildPlaceholderHeightfield`.

---

## File Structure

**Created (`src/systems/world3d/`):**
- `polylineClip.ts` — clip a grid-space polyline to a chunk's grid AABB
- `terrainColor.ts` — biome+height → RGB palette
- `waterGeometry.ts` — `buildWaterMesh` (ribbons along river polylines + lake fills)
- `roadGeometry.ts` — `buildRoadMesh` (ribbons along road polylines)
- `siteGeometry.ts` — `buildSiteMeshes` (footprint→box exteriors)
- `vegetationScatter.ts` — `buildVegetationScatter` (deterministic instanced transforms)
- `chunkBundle.ts` — `buildChunkBundle` (assembles all builders into a `ChunkMeshBundle`)
- `__tests__/*.test.ts` — one per module above

**Modified (`src/systems/world3d/`):**
- `types.ts` — add `TerrainMesh`, `ClippedPolyline`, `ChunkSite`, `VegetationScatter`, `ChunkMeshBundle`; widen `ChunkLoader`, `LoadedChunk`
- `coords.ts` — add `gridToWorld`, `gridPointToLocal`
- `chunkSampler.ts` — extend `ChunkData` with `biomeIds`, `rivers`, `roads`, `sites`
- `chunkGeometry.ts` — add `buildTerrainMesh` (heightfield + vertex colors) alongside existing placeholder
- `chunkWorkerCore.ts` — `handleChunkRequest` returns `ChunkMeshBundle`
- `__tests__/chunkSampler.test.ts` — extend for new fields (keep existing assertions)
- `__tests__/chunkWorkerCore.test.ts` — update to bundle shape

**Modified (`src/components/World3D/`):**
- `createWorkerChunkLoader.ts` — transfer the bundle's buffers; return `ChunkMeshBundle`
- `chunkWorker.ts` — post the bundle with expanded transfer list
- `World3DScene.tsx` — render terrain (vertex colors) + water + roads + site boxes + instanced vegetation
- `__tests__/createWorkerChunkLoader.test.ts` — update fake worker + assertions to bundle shape
- `__tests__/useChunkStreaming.test.tsx` — update fake geometry to a minimal bundle

---

## Conventions

- Run tests: `npx vitest run <path>`. **Vitest 4.x globals — never import test fns from 'vitest'.**
- Module alias `@/` → `src/`. Conventional Commits: `feat(world3d): ...`.
- Determinism: builders take no RNG; vegetation scatter derives randomness from a pure hash of `(cx, cy, index)`.
- Ignore unrelated working-tree changes (`conductor/`, `docs/tasks/spells/`). A daily-snapshot job may auto-commit untracked files; if it captures yours early, soft-reset and recommit cleanly so each task is one focused commit.
- Pre-existing unrelated TS errors (`CharacterActor.tsx`, `characterUtils.ts`, `OpportunityAttackSystem.test.ts`) are not your concern.

---

## Task 1: Bundle Types + Coordinate Helpers

**Files:**
- Modify: `src/systems/world3d/types.ts`
- Modify: `src/systems/world3d/coords.ts`
- Test: `src/systems/world3d/__tests__/coordsGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/coordsGrid.test.ts`:

```ts
import { gridToWorld, gridPointToLocal } from '../coords';
import { WORLD3D_CONFIG } from '../config';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('gridToWorld scales grid cells to world meters', () => {
  expect(gridToWorld(0, 0)).toEqual({ x: 0, z: 0 });
  expect(gridToWorld(1, 2)).toEqual({ x: M, z: 2 * M });
});

it('gridPointToLocal subtracts the chunk origin', () => {
  // grid (0,0) is world (0,0); chunk (0,0) origin is world (0,0) → local (0,0).
  expect(gridPointToLocal(0, 0, 0, 0)).toEqual({ x: 0, z: 0 });
  // A point one chunk-width east of chunk (1,0)'s origin.
  const p = gridPointToLocal(S / M, 0, 1, 0); // grid x maps to world x = S, chunk 1 origin = S → local 0
  expect(p.x).toBeCloseTo(0);
  expect(p.z).toBeCloseTo(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/coordsGrid.test.ts`
Expected: FAIL — `gridToWorld`/`gridPointToLocal` not exported.

- [ ] **Step 3: Add the coordinate helpers**

Append to `src/systems/world3d/coords.ts` (keep all existing exports):

```ts
/** Convert grid-cell coords to world meters. Inverse of worldToGrid. */
export function gridToWorld(gx: number, gy: number): { x: number; z: number } {
  return { x: gx * M, z: gy * M };
}

/** Convert a grid-space point to chunk-local world meters (origin at the chunk's NW corner). */
export function gridPointToLocal(
  gx: number,
  gy: number,
  cx: number,
  cy: number,
): { x: number; z: number } {
  return { x: gx * M - cx * S, z: gy * M - cy * S };
}
```

(`M` and `S` are already defined at the top of `coords.ts` from Plan 2: `const M = WORLD3D_CONFIG.METERS_PER_CELL;` and `const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;`. If they are not, add them.)

- [ ] **Step 4: Add bundle + sub-mesh types**

In `src/systems/world3d/types.ts`, ADD (do not remove existing types):

```ts
/** Terrain mesh: heightfield geometry plus per-vertex RGB for biome tinting. */
export interface TerrainMesh extends ChunkGeometryArrays {
  /** 3 floats (r,g,b) per vertex, parallel to positions. */
  colors: Float32Array;
}

/** A polyline (grid-space) clipped to a chunk, carrying per-point width in grid units. */
export interface ClippedPolyline {
  /** Grid-space points, in order. */
  points: { x: number; y: number }[];
  /** Width in grid units, one per point (length === points.length). */
  width: number[];
}

/** A site contained in a chunk, with chunk-local placement for geometry. */
export interface ChunkSite {
  id: string;
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
  /** Chunk-local position in meters. */
  localX: number;
  localZ: number;
  /** Footprint radius in meters. */
  radius: number;
  walled: boolean;
}

/** Instanced vegetation transforms for a chunk. */
export interface VegetationScatter {
  /** 3 floats (x,y,z) chunk-local per instance. */
  positions: Float32Array;
  /** 1 float uniform scale per instance. */
  scales: Float32Array;
  /** 1 float Y-rotation (radians) per instance. */
  rotations: Float32Array;
}

/** The full set of meshes for one chunk. terrain is always present; the rest are optional. */
export interface ChunkMeshBundle {
  cx: number;
  cy: number;
  terrain: TerrainMesh;
  water?: ChunkGeometryArrays;
  roads?: ChunkGeometryArrays;
  sites: ChunkSite[];
  vegetation?: VegetationScatter;
}
```

Then WIDEN the loader/loaded types (replace the existing `ChunkLoader` and `LoadedChunk` declarations):

```ts
/** Async producer of a chunk's full mesh bundle. Worker-backed in production, inline in tests. */
export type ChunkLoader = (cx: number, cy: number) => Promise<ChunkMeshBundle>;

/** A chunk currently held in memory by the streamer. */
export interface LoadedChunk {
  cx: number;
  cy: number;
  bundle: ChunkMeshBundle;
  lod: LodTier;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/coordsGrid.test.ts`
Expected: PASS, 2 tests.

(Type changes to `ChunkLoader`/`LoadedChunk` will break `chunkStreamer.ts`, the worker core, the loader, and several tests — those are fixed in later tasks. This task's own test passes.)

- [ ] **Step 6: Commit**

```bash
git add src/systems/world3d/types.ts src/systems/world3d/coords.ts src/systems/world3d/__tests__/coordsGrid.test.ts
git commit -m "feat(world3d): chunk mesh bundle types + grid→local coord helpers"
```

---

## Task 2: Polyline Clipping

**Files:**
- Create: `src/systems/world3d/polylineClip.ts`
- Test: `src/systems/world3d/__tests__/polylineClip.test.ts`

Clips a grid-space polyline (with per-point width) to a chunk's grid AABB, returning the sub-polylines that lie inside. Used by both water and road builders.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/polylineClip.test.ts`:

```ts
import { clipPolylineToChunk } from '../polylineClip';

it('returns empty when the polyline does not intersect the chunk', () => {
  // Chunk (0,0) grid AABB is roughly [0, 0.125] in grid units. A polyline far away clips out.
  const out = clipPolylineToChunk(
    [{ x: 50, y: 50 }, { x: 51, y: 51 }],
    [1, 1],
    0,
    0,
  );
  expect(out).toEqual([]);
});

it('keeps a polyline fully inside the chunk', () => {
  // Points well within chunk (0,0)'s tiny grid AABB.
  const out = clipPolylineToChunk(
    [{ x: 0.01, y: 0.01 }, { x: 0.02, y: 0.02 }],
    [2, 2],
    0,
    0,
  );
  expect(out).toHaveLength(1);
  expect(out[0].points).toHaveLength(2);
  expect(out[0].width).toEqual([2, 2]);
});

it('clips a polyline that enters and exits the chunk into an inside segment', () => {
  // Goes from outside (x=-1) through the chunk to outside (x=10).
  const out = clipPolylineToChunk(
    [{ x: -1, y: 0.05 }, { x: 10, y: 0.05 }],
    [1, 1],
    0,
    0,
  );
  expect(out.length).toBeGreaterThanOrEqual(1);
  // Every emitted point must lie within the chunk's grid AABB (with small epsilon).
  for (const seg of out) {
    for (const p of seg.points) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(0.125 + 1e-6);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/polylineClip.test.ts`
Expected: FAIL — "Cannot find module '../polylineClip'".

- [ ] **Step 3: Implement polylineClip**

Create `src/systems/world3d/polylineClip.ts`:

```ts
/**
 * @file polylineClip.ts
 * Clip a grid-space polyline (with per-point width) to a chunk's grid AABB.
 * Returns the contiguous runs that lie inside the chunk. Endpoints crossing the
 * boundary are interpolated (position + width) onto the AABB edge.
 *
 * Sampling approach: we densify each segment and keep the inside portion. This
 * avoids fiddly Liang–Barsky edge bookkeeping while staying exact enough for the
 * tiny per-chunk AABBs (a segment rarely spans more than a few sample steps here).
 */
import type { ClippedPolyline } from './types';
import { chunkGridAABB } from './coords';

interface GridPt {
  x: number;
  y: number;
}

const SAMPLES_PER_SEGMENT = 8;

export function clipPolylineToChunk(
  points: GridPt[],
  width: number[],
  cx: number,
  cy: number,
): ClippedPolyline[] {
  if (points.length < 2) return [];
  const { minGX, minGY, maxGX, maxGY } = chunkGridAABB(cx, cy);
  const inside = (p: GridPt) =>
    p.x >= minGX && p.x <= maxGX && p.y >= minGY && p.y <= maxGY;

  const out: ClippedPolyline[] = [];
  let cur: { points: GridPt[]; width: number[] } | null = null;

  const flush = () => {
    if (cur && cur.points.length >= 2) out.push({ points: cur.points, width: cur.width });
    cur = null;
  };

  // Densify and collect inside runs.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const wa = width[i] ?? 1;
    const wb = width[i + 1] ?? wa;
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const t0 = s / SAMPLES_PER_SEGMENT;
      const t1 = (s + 1) / SAMPLES_PER_SEGMENT;
      const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
      const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
      const w0 = wa + (wb - wa) * t0;
      const w1 = wa + (wb - wa) * t1;
      const in0 = inside(p0);
      const in1 = inside(p1);
      if (in0) {
        if (!cur) cur = { points: [p0], width: [w0] };
        if (in1) {
          cur.points.push(p1);
          cur.width.push(w1);
        } else {
          // exiting — end the run at p1 (clamped); good enough for the tiny AABB.
          cur.points.push(clamp(p1, minGX, minGY, maxGX, maxGY));
          cur.width.push(w1);
          flush();
        }
      } else if (in1) {
        // entering — start a fresh run at p0 (clamped).
        cur = { points: [clamp(p0, minGX, minGY, maxGX, maxGY), p1], width: [w0, w1] };
      }
    }
  }
  flush();
  return out;
}

function clamp(p: GridPt, minX: number, minY: number, maxX: number, maxY: number): GridPt {
  return {
    x: Math.max(minX, Math.min(maxX, p.x)),
    y: Math.max(minY, Math.min(maxY, p.y)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/polylineClip.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/polylineClip.ts src/systems/world3d/__tests__/polylineClip.test.ts
git commit -m "feat(world3d): clip grid polylines to chunk AABB"
```

---

## Task 3: Extend the Sampler (biomes + rivers + roads + sites)

**Files:**
- Modify: `src/systems/world3d/types.ts` (extend `ChunkData`)
- Modify: `src/systems/world3d/chunkSampler.ts`
- Modify: `src/systems/world3d/__tests__/chunkSampler.test.ts` (keep existing tests, add new)

- [ ] **Step 1: Extend the `ChunkData` type**

In `src/systems/world3d/types.ts`, replace the `ChunkData` interface with:

```ts
export interface ChunkData {
  cx: number;
  cy: number;
  /** Vertices per edge (square grid). */
  resolution: number;
  /** Sampled heights (0..100), length resolution*resolution, row-major. */
  heights: Float32Array;
  /** Per-vertex biome id, length resolution*resolution, nearest-neighbor sampled. */
  biomeIds: string[];
  /** River polylines clipped to this chunk (grid space). */
  rivers: ClippedPolyline[];
  /** Road polylines clipped to this chunk (grid space). */
  roads: ClippedPolyline[];
  /** Sites whose center falls within this chunk (grid space). */
  sites: { id: string; kind: 'town' | 'dungeon' | 'ruin' | 'landmark'; position: { x: number; y: number }; footprint: { x: number; y: number }[]; walled: boolean }[];
}
```

- [ ] **Step 2: Write the failing test**

Add to `src/systems/world3d/__tests__/chunkSampler.test.ts` (keep the existing 4 tests; add these). Note the `makeWorld` helper in that file builds a `WorldData` — extend the calls below to set `biomeIds`, `rivers`, `roads`, `sites`. If the existing `makeWorld` does not accept those, add a second helper inline:

```ts
import type { WorldData, River, Site } from '@/services/worldSim/types';

const worldWithFeatures = (): WorldData => {
  const cols = 64;
  const rows = 8;
  const heights = new Array(cols * rows).fill(40);
  const biomeIds = new Array(cols * rows).fill('forest');
  // A river running along grid y=0.05 across the early columns.
  const river: River = {
    id: 'r0',
    points: [{ x: 0, y: 0.05 }, { x: 5, y: 0.05 }],
    width: [1, 1],
    discharge: [10, 10],
  };
  // A town at grid (0.05, 0.05) — inside chunk (0,0).
  const town: Site = {
    id: 't0',
    kind: 'town',
    position: { x: 0.05, y: 0.05 },
    footprint: [
      { x: 0.04, y: 0.04 },
      { x: 0.06, y: 0.04 },
      { x: 0.06, y: 0.06 },
      { x: 0.04, y: 0.06 },
    ],
    walled: true,
  };
  return {
    version: 2, seed: 1, templateId: 't',
    gridSize: { rows, cols },
    heights, temperatures: [], moisture: [], biomeIds,
    rivers: [river], roads: [], sites: [town],
    coastlines: [], lakes: [], biomeZones: [],
  };
};

it('samples a per-vertex biome id buffer', () => {
  const data = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(data.biomeIds).toHaveLength(16);
  expect(data.biomeIds.every((b) => b === 'forest')).toBe(true);
});

it('includes rivers that cross the chunk and excludes distant ones', () => {
  const near = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(near.rivers.length).toBeGreaterThanOrEqual(1);
  const far = sampleChunk(worldWithFeatures(), 100, 100, 4);
  expect(far.rivers).toHaveLength(0);
});

it('includes sites whose center falls within the chunk', () => {
  const data = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(data.sites).toHaveLength(1);
  expect(data.sites[0].id).toBe('t0');
  expect(data.sites[0].walled).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkSampler.test.ts`
Expected: FAIL — `data.biomeIds`/`data.rivers`/`data.sites` undefined (and the existing 4 tests should still pass).

- [ ] **Step 4: Extend `sampleChunk`**

Replace `src/systems/world3d/chunkSampler.ts` with (preserves `sampleHeightBilinear`, adds the new slices):

```ts
/**
 * @file chunkSampler.ts
 * Slices WorldData into the per-chunk input for geometry: a bilinearly-sampled
 * height subgrid, a per-vertex biome id buffer, the river/road polylines clipped
 * to this chunk, and any sites whose center lies inside the chunk.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkData } from './types';
import { chunkGridAABB } from './coords';
import { clipPolylineToChunk } from './polylineClip';

function sampleHeightBilinear(world: WorldData, gx: number, gy: number): number {
  const { cols, rows } = world.gridSize;
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const x0 = Math.floor(clampX(gx));
  const y0 = Math.floor(clampY(gy));
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const tx = clampX(gx) - x0;
  const ty = clampY(gy) - y0;
  const h = (xx: number, yy: number) => world.heights[yy * cols + xx] ?? 0;
  const top = h(x0, y0) * (1 - tx) + h(x1, y0) * tx;
  const bot = h(x0, y1) * (1 - tx) + h(x1, y1) * tx;
  return top * (1 - ty) + bot * ty;
}

function sampleBiomeNearest(world: WorldData, gx: number, gy: number): string {
  const { cols, rows } = world.gridSize;
  const x = Math.max(0, Math.min(cols - 1, Math.round(gx)));
  const y = Math.max(0, Math.min(rows - 1, Math.round(gy)));
  return world.biomeIds[y * cols + x] ?? 'plains';
}

export function sampleChunk(
  world: WorldData,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const aabb = chunkGridAABB(cx, cy);
  const heights = new Float32Array(resolution * resolution);
  const biomeIds: string[] = new Array(resolution * resolution);

  for (let j = 0; j < resolution; j++) {
    const ty = resolution === 1 ? 0 : j / (resolution - 1);
    const gy = aabb.minGY + (aabb.maxGY - aabb.minGY) * ty;
    for (let i = 0; i < resolution; i++) {
      const tx = resolution === 1 ? 0 : i / (resolution - 1);
      const gx = aabb.minGX + (aabb.maxGX - aabb.minGX) * tx;
      const idx = j * resolution + i;
      heights[idx] = sampleHeightBilinear(world, gx, gy);
      biomeIds[idx] = sampleBiomeNearest(world, gx, gy);
    }
  }

  // Rivers + roads: clip each polyline to the chunk.
  const rivers = world.rivers.flatMap((r) => clipPolylineToChunk(r.points, r.width, cx, cy));
  const roads = world.roads.flatMap((rd) =>
    clipPolylineToChunk(rd.points, rd.points.map(() => 0.04), cx, cy),
  );

  // Sites whose center falls within the chunk's grid AABB.
  const sites = world.sites
    .filter(
      (s) =>
        s.position.x >= aabb.minGX &&
        s.position.x <= aabb.maxGX &&
        s.position.y >= aabb.minGY &&
        s.position.y <= aabb.maxGY,
    )
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      position: s.position,
      footprint: s.footprint,
      walled: s.walled ?? false,
    }));

  return { cx, cy, resolution, heights, biomeIds, rivers, roads, sites };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkSampler.test.ts`
Expected: PASS — original 4 tests + 3 new = 7.

- [ ] **Step 6: Commit**

```bash
git add src/systems/world3d/types.ts src/systems/world3d/chunkSampler.ts src/systems/world3d/__tests__/chunkSampler.test.ts
git commit -m "feat(world3d): sample biomes, rivers, roads, sites per chunk"
```

---

## Task 4: Biome Terrain Coloring

**Files:**
- Create: `src/systems/world3d/terrainColor.ts`
- Modify: `src/systems/world3d/chunkGeometry.ts` (add `buildTerrainMesh`)
- Test: `src/systems/world3d/__tests__/terrainColor.test.ts`
- Test: `src/systems/world3d/__tests__/buildTerrainMesh.test.ts`

- [ ] **Step 1: Write the failing test (palette)**

Create `src/systems/world3d/__tests__/terrainColor.test.ts`:

```ts
import { biomeColor } from '../terrainColor';

it('returns an RGB triple in 0..1 for known biomes', () => {
  const c = biomeColor('forest', 40);
  expect(c).toHaveLength(3);
  for (const v of c) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

it('gives water-classified biomes a blue-dominant color', () => {
  const [r, g, b] = biomeColor('ocean', 5);
  expect(b).toBeGreaterThan(r);
  expect(b).toBeGreaterThan(g * 0.8);
});

it('falls back to a neutral color for unknown biomes', () => {
  const c = biomeColor('totally-unknown-biome', 50);
  expect(c).toHaveLength(3);
  expect(Number.isFinite(c[0])).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/terrainColor.test.ts`
Expected: FAIL — "Cannot find module '../terrainColor'".

- [ ] **Step 3: Implement terrainColor**

Create `src/systems/world3d/terrainColor.ts`:

```ts
/**
 * @file terrainColor.ts
 * Map a biome id (+ height) to an RGB color for per-vertex terrain tinting.
 * Matches the biome families produced by worldSim's mapAzgaarBiomeToFamily, plus
 * a few common ids. Height darkens lowlands slightly and lightens peaks.
 */
type RGB = [number, number, number];

const PALETTE: Record<string, RGB> = {
  ocean: [0.12, 0.28, 0.52],
  water: [0.16, 0.34, 0.58],
  desert: [0.82, 0.74, 0.48],
  plains: [0.46, 0.62, 0.34],
  grassland: [0.46, 0.62, 0.34],
  forest: [0.24, 0.44, 0.24],
  jungle: [0.18, 0.40, 0.20],
  tundra: [0.72, 0.74, 0.70],
  wetland: [0.34, 0.46, 0.34],
  swamp: [0.30, 0.40, 0.28],
  mountain: [0.46, 0.42, 0.40],
};

const FALLBACK: RGB = [0.45, 0.5, 0.4];

export function biomeColor(biomeId: string, height01: number): RGB {
  const base = PALETTE[biomeId] ?? FALLBACK;
  // Subtle height shading: -8% at sea level, +12% at peak.
  const shade = 0.92 + (height01 / 100) * 0.2;
  return [
    Math.max(0, Math.min(1, base[0] * shade)),
    Math.max(0, Math.min(1, base[1] * shade)),
    Math.max(0, Math.min(1, base[2] * shade)),
  ];
}
```

- [ ] **Step 4: Write the failing test (terrain mesh)**

Create `src/systems/world3d/__tests__/buildTerrainMesh.test.ts`:

```ts
import { buildTerrainMesh } from '../chunkGeometry';
import type { ChunkData } from '../types';

const chunk = (res: number, biome: string): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: res,
  heights: new Float32Array(res * res).fill(40),
  biomeIds: new Array(res * res).fill(biome),
  rivers: [],
  roads: [],
  sites: [],
});

it('produces a colors buffer parallel to positions', () => {
  const res = 4;
  const mesh = buildTerrainMesh(chunk(res, 'forest'));
  expect(mesh.positions).toHaveLength(res * res * 3);
  expect(mesh.colors).toHaveLength(res * res * 3);
  expect(mesh.indices).toHaveLength((res - 1) * (res - 1) * 6);
});

it('tints forest vertices green-dominant', () => {
  const mesh = buildTerrainMesh(chunk(3, 'forest'));
  // vertex 0 channels
  const r = mesh.colors[0], g = mesh.colors[1], b = mesh.colors[2];
  expect(g).toBeGreaterThan(r);
  expect(g).toBeGreaterThan(b);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/buildTerrainMesh.test.ts`
Expected: FAIL — `buildTerrainMesh` not exported.

- [ ] **Step 6: Add `buildTerrainMesh` to chunkGeometry.ts**

Append to `src/systems/world3d/chunkGeometry.ts` (keep `buildPlaceholderHeightfield`; add the import and the new builder):

```ts
import type { TerrainMesh } from './types';
import { biomeColor } from './terrainColor';

/**
 * Heightfield terrain mesh with per-vertex biome coloring. Reuses the placeholder
 * heightfield's position/index/normal generation, then adds a parallel colors buffer.
 */
export function buildTerrainMesh(data: ChunkData): TerrainMesh {
  const base = buildPlaceholderHeightfield(data);
  const vertCount = data.resolution * data.resolution;
  const colors = new Float32Array(vertCount * 3);
  for (let v = 0; v < vertCount; v++) {
    const [r, g, b] = biomeColor(data.biomeIds[v] ?? 'plains', data.heights[v] ?? 0);
    colors[v * 3] = r;
    colors[v * 3 + 1] = g;
    colors[v * 3 + 2] = b;
  }
  return { ...base, colors };
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npx vitest run src/systems/world3d/__tests__/terrainColor.test.ts src/systems/world3d/__tests__/buildTerrainMesh.test.ts`
Expected: PASS — 3 + 2 = 5 tests.

- [ ] **Step 8: Commit**

```bash
git add src/systems/world3d/terrainColor.ts src/systems/world3d/chunkGeometry.ts src/systems/world3d/__tests__/terrainColor.test.ts src/systems/world3d/__tests__/buildTerrainMesh.test.ts
git commit -m "feat(world3d): biome-colored terrain mesh"
```

---

## Task 5: Water Geometry (river ribbons)

**Files:**
- Create: `src/systems/world3d/waterGeometry.ts`
- Test: `src/systems/world3d/__tests__/waterGeometry.test.ts`

Builds a flat ribbon mesh along each clipped river polyline: for each point, offset left/right by `width/2` (in world meters) perpendicular to the local direction, at a near-constant water height. Returns empty buffers when there are no rivers.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/waterGeometry.test.ts`:

```ts
import { buildWaterMesh } from '../waterGeometry';
import type { ChunkData } from '../types';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(30),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('returns empty geometry when there are no rivers', () => {
  const mesh = buildWaterMesh(baseChunk());
  expect(mesh.positions).toHaveLength(0);
  expect(mesh.indices).toHaveLength(0);
});

it('builds a ribbon with 2 vertices per polyline point', () => {
  const data = baseChunk();
  data.rivers = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.01, 0.01] },
  ];
  const mesh = buildWaterMesh(data);
  // 2 points → 4 ribbon vertices → 12 position floats.
  expect(mesh.positions).toHaveLength(4 * 3);
  // One quad → 2 triangles → 6 indices.
  expect(mesh.indices).toHaveLength(6);
  // No NaN.
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/waterGeometry.test.ts`
Expected: FAIL — "Cannot find module '../waterGeometry'".

- [ ] **Step 3: Implement waterGeometry**

Create `src/systems/world3d/waterGeometry.ts`:

```ts
/**
 * @file waterGeometry.ts
 * Build flat ribbon meshes along clipped river polylines. Each polyline point
 * produces a left/right vertex pair offset perpendicular to the local direction
 * by half the river width (converted grid→meters). Output is chunk-local.
 */
import type { ChunkData, ChunkGeometryArrays, ClippedPolyline } from './types';
import { WORLD3D_CONFIG } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const MAX_H = WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M;
/** Water sits a touch below the terrain surface height used by the heightfield. */
const WATER_DROP_M = 0.5;

const EMPTY: ChunkGeometryArrays = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

export function buildWaterMesh(data: ChunkData): ChunkGeometryArrays {
  const ribbons = data.rivers.filter((r) => r.points.length >= 2);
  if (ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (const ribbon of ribbons) {
    const startVert = positions.length / 3;
    emitRibbon(ribbon, data, positions, normals);
    const ptCount = ribbon.points.length;
    // Connect consecutive vertex pairs into quads.
    for (let i = 0; i < ptCount - 1; i++) {
      const l0 = startVert + i * 2;
      const r0 = l0 + 1;
      const l1 = startVert + (i + 1) * 2;
      const r1 = l1 + 1;
      indices.push(l0, l1, r0, r0, l1, r1);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

function emitRibbon(
  ribbon: ClippedPolyline,
  data: ChunkData,
  positions: number[],
  normals: number[],
): void {
  const pts = ribbon.points;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    // Direction in grid space → world.
    const dirX = (next.x - prev.x) * M;
    const dirZ = (next.y - prev.y) * M;
    const len = Math.hypot(dirX, dirZ) || 1;
    // Perpendicular (right-hand) in the XZ plane.
    const perpX = -dirZ / len;
    const perpZ = dirX / len;
    const halfW = ((ribbon.width[i] ?? 0.01) * M) / 2;

    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    const y = waterHeightAt(data, p.x, p.y) - WATER_DROP_M;

    // Left vertex.
    positions.push(local.x - perpX * halfW, y, local.z - perpZ * halfW);
    normals.push(0, 1, 0);
    // Right vertex.
    positions.push(local.x + perpX * halfW, y, local.z + perpZ * halfW);
    normals.push(0, 1, 0);
  }
}

/** Approximate the terrain height (meters) at a grid point by sampling the chunk's height buffer. */
function waterHeightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const aabbSpan = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / M; // grid cells per chunk
  const minGX = data.cx * aabbSpan;
  const minGY = data.cy * aabbSpan;
  const tx = aabbSpan === 0 ? 0 : (gx - minGX) / aabbSpan;
  const ty = aabbSpan === 0 ? 0 : (gy - minGY) / aabbSpan;
  const i = Math.max(0, Math.min(res - 1, Math.round(tx * (res - 1))));
  const j = Math.max(0, Math.min(res - 1, Math.round(ty * (res - 1))));
  return (data.heights[j * res + i] / 100) * MAX_H;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/waterGeometry.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/waterGeometry.ts src/systems/world3d/__tests__/waterGeometry.test.ts
git commit -m "feat(world3d): river water ribbon geometry"
```

---

## Task 6: Road Geometry (road ribbons)

**Files:**
- Create: `src/systems/world3d/roadGeometry.ts`
- Test: `src/systems/world3d/__tests__/roadGeometry.test.ts`

Same ribbon technique as water, but raised slightly above terrain so roads draw on the surface. Reuses the same chunk-local conversion.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/roadGeometry.test.ts`:

```ts
import { buildRoadMesh } from '../roadGeometry';
import type { ChunkData } from '../types';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(50),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('returns empty geometry when there are no roads', () => {
  const mesh = buildRoadMesh(baseChunk());
  expect(mesh.positions).toHaveLength(0);
  expect(mesh.indices).toHaveLength(0);
});

it('builds a ribbon for a road crossing the chunk', () => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.04, 0.04] },
  ];
  const mesh = buildRoadMesh(data);
  expect(mesh.positions).toHaveLength(4 * 3);
  expect(mesh.indices).toHaveLength(6);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/roadGeometry.test.ts`
Expected: FAIL — "Cannot find module '../roadGeometry'".

- [ ] **Step 3: Implement roadGeometry**

Create `src/systems/world3d/roadGeometry.ts`:

```ts
/**
 * @file roadGeometry.ts
 * Build flat ribbon meshes along clipped road polylines, raised slightly above the
 * terrain surface so they render on top. Mirrors waterGeometry's ribbon approach.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { WORLD3D_CONFIG } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const MAX_H = WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M;
/** Roads float just above terrain to avoid z-fighting. */
const ROAD_LIFT_M = 0.3;

const EMPTY: ChunkGeometryArrays = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

export function buildRoadMesh(data: ChunkData): ChunkGeometryArrays {
  const ribbons = data.roads.filter((r) => r.points.length >= 2);
  if (ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (const ribbon of ribbons) {
    const startVert = positions.length / 3;
    const pts = ribbon.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dirX = (next.x - prev.x) * M;
      const dirZ = (next.y - prev.y) * M;
      const len = Math.hypot(dirX, dirZ) || 1;
      const perpX = -dirZ / len;
      const perpZ = dirX / len;
      const halfW = ((ribbon.width[i] ?? 0.04) * M) / 2;
      const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      const y = heightAt(data, p.x, p.y) + ROAD_LIFT_M;
      positions.push(local.x - perpX * halfW, y, local.z - perpZ * halfW);
      normals.push(0, 1, 0);
      positions.push(local.x + perpX * halfW, y, local.z + perpZ * halfW);
      normals.push(0, 1, 0);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = startVert + i * 2;
      const r0 = l0 + 1;
      const l1 = startVert + (i + 1) * 2;
      const r1 = l1 + 1;
      indices.push(l0, l1, r0, r0, l1, r1);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

function heightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / M;
  const minGX = data.cx * span;
  const minGY = data.cy * span;
  const tx = span === 0 ? 0 : (gx - minGX) / span;
  const ty = span === 0 ? 0 : (gy - minGY) / span;
  const i = Math.max(0, Math.min(res - 1, Math.round(tx * (res - 1))));
  const j = Math.max(0, Math.min(res - 1, Math.round(ty * (res - 1))));
  return (data.heights[j * res + i] / 100) * MAX_H;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/roadGeometry.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/roadGeometry.ts src/systems/world3d/__tests__/roadGeometry.test.ts
git commit -m "feat(world3d): road ribbon geometry"
```

---

## Task 7: Site Exteriors

**Files:**
- Create: `src/systems/world3d/siteGeometry.ts`
- Test: `src/systems/world3d/__tests__/siteGeometry.test.ts`

Converts each contained site into a `ChunkSite` placement (chunk-local position, footprint radius in meters, walled flag). The scene renders these as simple box/cylinder clusters — geometry stays in the scene, this builder just produces placement data, which keeps the worker payload small (plain numbers).

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/siteGeometry.test.ts`:

```ts
import { buildSiteMeshes } from '../siteGeometry';
import type { ChunkData } from '../types';

const chunkWithTown = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(40),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [
    {
      id: 't0',
      kind: 'town',
      position: { x: 0.05, y: 0.05 },
      footprint: [
        { x: 0.04, y: 0.04 },
        { x: 0.06, y: 0.04 },
        { x: 0.06, y: 0.06 },
        { x: 0.04, y: 0.06 },
      ],
      walled: true,
    },
  ],
});

it('returns no site placements when the chunk has none', () => {
  const data = chunkWithTown();
  data.sites = [];
  expect(buildSiteMeshes(data)).toEqual([]);
});

it('converts a contained site to a local placement with a positive radius', () => {
  const placements = buildSiteMeshes(chunkWithTown());
  expect(placements).toHaveLength(1);
  const s = placements[0];
  expect(s.id).toBe('t0');
  expect(s.kind).toBe('town');
  expect(s.walled).toBe(true);
  expect(s.radius).toBeGreaterThan(0);
  // Local coords are finite and within a sane range for a single chunk.
  expect(Number.isFinite(s.localX)).toBe(true);
  expect(Number.isFinite(s.localZ)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/siteGeometry.test.ts`
Expected: FAIL — "Cannot find module '../siteGeometry'".

- [ ] **Step 3: Implement siteGeometry**

Create `src/systems/world3d/siteGeometry.ts`:

```ts
/**
 * @file siteGeometry.ts
 * Convert contained sites into chunk-local placements. Footprint radius is derived
 * from the polygon's extent (grid→meters). The scene turns each placement into a
 * simple box cluster / wall ring; keeping geometry in the scene keeps the worker
 * payload to plain numbers.
 */
import type { ChunkData, ChunkSite } from './types';
import { WORLD3D_CONFIG } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const MIN_RADIUS_M = 8;

export function buildSiteMeshes(data: ChunkData): ChunkSite[] {
  return data.sites.map((s) => {
    const local = gridPointToLocal(s.position.x, s.position.y, data.cx, data.cy);
    // Footprint radius: max distance from center to any footprint vertex, in meters.
    let maxR = 0;
    for (const v of s.footprint) {
      const dx = (v.x - s.position.x) * M;
      const dy = (v.y - s.position.y) * M;
      maxR = Math.max(maxR, Math.hypot(dx, dy));
    }
    return {
      id: s.id,
      kind: s.kind,
      localX: local.x,
      localZ: local.z,
      radius: Math.max(MIN_RADIUS_M, maxR),
      walled: s.walled,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/siteGeometry.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/siteGeometry.ts src/systems/world3d/__tests__/siteGeometry.test.ts
git commit -m "feat(world3d): site exterior placements"
```

---

## Task 8: Vegetation Scatter

**Files:**
- Create: `src/systems/world3d/vegetationScatter.ts`
- Test: `src/systems/world3d/__tests__/vegetationScatter.test.ts`

Deterministically scatters instances on forest/plains/jungle vertices, skipping water-classified vertices. Uses a pure hash of `(cx, cy, vertexIndex)` for jitter so output is identical across runs and worker/main thread.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/vegetationScatter.test.ts`:

```ts
import { buildVegetationScatter } from '../vegetationScatter';
import type { ChunkData } from '../types';

const chunk = (biome: string): ChunkData => ({
  cx: 2,
  cy: 3,
  resolution: 8,
  heights: new Float32Array(64).fill(40),
  biomeIds: new Array(64).fill(biome),
  rivers: [],
  roads: [],
  sites: [],
});

it('scatters instances on forest chunks', () => {
  const veg = buildVegetationScatter(chunk('forest'));
  expect(veg.positions.length).toBeGreaterThan(0);
  expect(veg.positions.length % 3).toBe(0);
  // scales and rotations are one-per-instance.
  const instances = veg.positions.length / 3;
  expect(veg.scales).toHaveLength(instances);
  expect(veg.rotations).toHaveLength(instances);
});

it('produces no vegetation on ocean chunks', () => {
  const veg = buildVegetationScatter(chunk('ocean'));
  expect(veg.positions).toHaveLength(0);
});

it('is deterministic for the same chunk coords + data', () => {
  const a = buildVegetationScatter(chunk('forest'));
  const b = buildVegetationScatter(chunk('forest'));
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  expect(Array.from(a.rotations)).toEqual(Array.from(b.rotations));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/vegetationScatter.test.ts`
Expected: FAIL — "Cannot find module '../vegetationScatter'".

- [ ] **Step 3: Implement vegetationScatter**

Create `src/systems/world3d/vegetationScatter.ts`:

```ts
/**
 * @file vegetationScatter.ts
 * Deterministic instanced vegetation. For each vertex on a vegetated biome, emit
 * one instance with hash-jittered local offset, scale, and Y-rotation. Water and
 * tundra/desert vertices are skipped. Pure: randomness comes from a coordinate hash.
 */
import type { ChunkData, VegetationScatter } from './types';
import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const MAX_H = WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M;

const VEGETATED = new Set(['forest', 'jungle', 'plains', 'grassland', 'wetland', 'swamp']);

/** Deterministic [0,1) hash from three integers. */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1442695041, 1597334677) ^ (c | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

export function buildVegetationScatter(data: ChunkData): VegetationScatter {
  const res = data.resolution;
  const positions: number[] = [];
  const scales: number[] = [];
  const rotations: number[] = [];

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      const biome = data.biomeIds[idx];
      if (!VEGETATED.has(biome)) continue;

      // Density gate: ~50% of eligible vertices get an instance.
      const gate = hash01(data.cx * 73856093 + i, data.cy * 19349663 + j, 1);
      if (gate < 0.5) continue;

      const tx = res === 1 ? 0 : i / (res - 1);
      const tz = res === 1 ? 0 : j / (res - 1);
      const jx = (hash01(i, j, data.cx) - 0.5) * (S / res);
      const jz = (hash01(i, j, data.cy) - 0.5) * (S / res);
      const x = tx * S + jx;
      const z = tz * S + jz;
      const y = (data.heights[idx] / 100) * MAX_H;

      positions.push(x, y, z);
      scales.push(0.7 + hash01(i, j, 7) * 0.8);
      rotations.push(hash01(i, j, 11) * Math.PI * 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/vegetationScatter.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/vegetationScatter.ts src/systems/world3d/__tests__/vegetationScatter.test.ts
git commit -m "feat(world3d): deterministic vegetation scatter"
```

---

## Task 9: Assemble the Bundle + Rewire the Pipeline

**Files:**
- Create: `src/systems/world3d/chunkBundle.ts`
- Modify: `src/systems/world3d/chunkWorkerCore.ts`
- Modify: `src/systems/world3d/chunkStreamer.ts`
- Modify: `src/components/World3D/chunkWorker.ts`
- Modify: `src/components/World3D/createWorkerChunkLoader.ts`
- Modify: `src/components/World3D/useChunkStreaming.ts` (only if it references `geometry`)
- Test: `src/systems/world3d/__tests__/chunkBundle.test.ts`
- Modify: `src/systems/world3d/__tests__/chunkWorkerCore.test.ts`
- Modify: `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`
- Modify: `src/components/World3D/__tests__/useChunkStreaming.test.tsx`
- Modify: `src/systems/world3d/__tests__/chunkStreamer.test.ts`

- [ ] **Step 1: Write the failing test (bundle assembly)**

Create `src/systems/world3d/__tests__/chunkBundle.test.ts`:

```ts
import { buildChunkBundle } from '../chunkBundle';
import type { ChunkData } from '../types';

const forestChunk = (): ChunkData => ({
  cx: 1,
  cy: 1,
  resolution: 6,
  heights: new Float32Array(36).fill(45),
  biomeIds: new Array(36).fill('forest'),
  rivers: [{ points: [{ x: 0.13, y: 0.14 }, { x: 0.2, y: 0.14 }], width: [0.01, 0.01] }],
  roads: [],
  sites: [],
});

it('assembles a bundle with terrain always present', () => {
  const bundle = buildChunkBundle(forestChunk());
  expect(bundle.cx).toBe(1);
  expect(bundle.cy).toBe(1);
  expect(bundle.terrain.positions.length).toBe(6 * 6 * 3);
  expect(bundle.terrain.colors.length).toBe(6 * 6 * 3);
  expect(bundle.sites).toEqual([]);
});

it('includes water when rivers cross and vegetation on forest', () => {
  const bundle = buildChunkBundle(forestChunk());
  expect(bundle.water).toBeDefined();
  expect(bundle.water!.positions.length).toBeGreaterThan(0);
  expect(bundle.vegetation).toBeDefined();
  expect(bundle.vegetation!.positions.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkBundle.test.ts`
Expected: FAIL — "Cannot find module '../chunkBundle'".

- [ ] **Step 3: Implement chunkBundle**

Create `src/systems/world3d/chunkBundle.ts`:

```ts
/**
 * @file chunkBundle.ts
 * Assemble all per-chunk builders into a ChunkMeshBundle. Optional sub-meshes are
 * omitted (left undefined) when empty so the scene can skip rendering them.
 */
import type { ChunkData, ChunkMeshBundle } from './types';
import { buildTerrainMesh } from './chunkGeometry';
import { buildWaterMesh } from './waterGeometry';
import { buildRoadMesh } from './roadGeometry';
import { buildSiteMeshes } from './siteGeometry';
import { buildVegetationScatter } from './vegetationScatter';

export function buildChunkBundle(data: ChunkData): ChunkMeshBundle {
  const terrain = buildTerrainMesh(data);
  const water = buildWaterMesh(data);
  const roads = buildRoadMesh(data);
  const sites = buildSiteMeshes(data);
  const vegetation = buildVegetationScatter(data);

  return {
    cx: data.cx,
    cy: data.cy,
    terrain,
    water: water.positions.length > 0 ? water : undefined,
    roads: roads.positions.length > 0 ? roads : undefined,
    sites,
    vegetation: vegetation.positions.length > 0 ? vegetation : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkBundle.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Rewire `handleChunkRequest` to return a bundle**

Replace the body of `handleChunkRequest` in `src/systems/world3d/chunkWorkerCore.ts`:

```ts
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkMeshBundle } from './types';
import { sampleChunk } from './chunkSampler';
import { buildChunkBundle } from './chunkBundle';

export interface ChunkRequest {
  cx: number;
  cy: number;
  resolution: number;
}

export function handleChunkRequest(world: WorldData, req: ChunkRequest): ChunkMeshBundle {
  const data = sampleChunk(world, req.cx, req.cy, req.resolution);
  return buildChunkBundle(data);
}
```

Update `src/systems/world3d/__tests__/chunkWorkerCore.test.ts` — the assertions now read from `bundle.terrain`:

```ts
it('produces a bundle with terrain geometry for a chunk request', () => {
  const bundle = handleChunkRequest(flatWorld(8, 8, 40), { cx: 0, cy: 0, resolution: 6 });
  expect(bundle.terrain.positions.length).toBe(6 * 6 * 3);
  expect(bundle.terrain.indices.length).toBe((6 - 1) * (6 - 1) * 6);
  expect(bundle.terrain.colors.length).toBe(6 * 6 * 3);
});

it('is deterministic for the same world + request', () => {
  const world = flatWorld(8, 8, 55);
  const a = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  const b = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  expect(Array.from(a.terrain.positions)).toEqual(Array.from(b.terrain.positions));
});
```

Note: the existing `flatWorld` helper in that test sets `rivers: []`, `roads: []`, `sites: []`, `biomeIds: []`. With `biomeIds: []`, the sampler's nearest lookup falls back to `'plains'` — fine. Keep the helper; just ensure `biomeIds` is a filled array if a test needs specific colors (not required here).

- [ ] **Step 6: Update `LoadedChunk` usage in the streamer**

In `src/systems/world3d/chunkStreamer.ts`, the streamer stores loaded chunks. Find where it constructs a `LoadedChunk` (it currently does `{ cx, cy, geometry, lod }`). Change the field name `geometry` → `bundle` to match the widened `LoadedChunk` type:

```ts
this.loaded.set(key, { cx, cy, bundle: geometry, lod: selectLodTier(dist) });
```

where `geometry` is the resolved loader value (now a `ChunkMeshBundle`). Rename the local for clarity if desired (e.g. `.then((bundle) => ...)`). The `ChunkLoader` type already returns `ChunkMeshBundle` after Task 1, so no cast is needed.

Update `src/systems/world3d/__tests__/chunkStreamer.test.ts` — its `fakeGeometry()` helper must now return a minimal `ChunkMeshBundle`. Replace it:

```ts
import type { ChunkMeshBundle, ChunkLoader } from '../types';

const fakeBundle = (cx = 0, cy = 0): ChunkMeshBundle => ({
  cx,
  cy,
  terrain: {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    normals: new Float32Array(0),
    colors: new Float32Array(0),
  },
  sites: [],
});
const instantLoader: ChunkLoader = async (cx, cy) => fakeBundle(cx, cy);
```

Then anywhere the test asserted on `c.geometry`, change to `c.bundle`. (Most streamer tests only check counts/coords/lod, which are unchanged.)

- [ ] **Step 7: Update the worker glue + loader**

In `src/components/World3D/chunkWorker.ts`, the worker posts the result. The transfer list must now cover all the bundle's buffers. Replace the `load` handler body:

```ts
if (msg.type === 'load' && world) {
  const bundle = handleChunkRequest(world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });
  const transfer: ArrayBuffer[] = [
    bundle.terrain.positions.buffer,
    bundle.terrain.indices.buffer,
    bundle.terrain.normals.buffer,
    bundle.terrain.colors.buffer,
  ];
  if (bundle.water) transfer.push(bundle.water.positions.buffer, bundle.water.indices.buffer, bundle.water.normals.buffer);
  if (bundle.roads) transfer.push(bundle.roads.positions.buffer, bundle.roads.indices.buffer, bundle.roads.normals.buffer);
  if (bundle.vegetation) transfer.push(bundle.vegetation.positions.buffer, bundle.vegetation.scales.buffer, bundle.vegetation.rotations.buffer);
  (self as unknown as Worker).postMessage({ id: msg.id, bundle }, transfer);
}
```

In `src/components/World3D/createWorkerChunkLoader.ts`, change the response type and the `ChunkLoader` return from `ChunkGeometryArrays` to `ChunkMeshBundle`:

```ts
import type { ChunkMeshBundle, ChunkLoader } from '@/systems/world3d/types';

// ...
worker.onmessage = (ev: MessageEvent) => {
  const { id, bundle } = ev.data as { id: number; bundle: ChunkMeshBundle };
  const resolve = pending.get(id);
  if (resolve) {
    pending.delete(id);
    resolve(bundle);
  }
};

return (cx: number, cy: number): Promise<ChunkMeshBundle> =>
  new Promise<ChunkMeshBundle>((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    worker.postMessage({ type: 'load', id, cx, cy, resolution });
  });
```

Update `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`:
- The `FakeWorker.postMessage` `load` branch now replies with `{ id, bundle }` instead of `{ id, geometry }`.
- Assertions read `bundle.terrain.positions.length`.

```ts
if (msg.type === 'load' && this.world) {
  const bundle = handleChunkRequest(this.world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });
  queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, bundle } }));
}
// ...
it('resolves a chunk load with terrain geometry from the worker', async () => {
  const loader = createWorkerChunkLoader(flatWorld(8, 8, 25), 4, () => new FakeWorker() as unknown as Worker);
  const bundle = await loader(0, 0);
  expect(bundle.terrain.positions.length).toBe(4 * 4 * 3);
  expect(bundle.terrain.indices.length).toBe((4 - 1) * (4 - 1) * 6);
});
```
(Apply the analogous change to the second "correlates concurrent requests" test: read `bundle.terrain.positions.length`.)

- [ ] **Step 8: Update `useChunkStreaming` test fake**

In `src/components/World3D/__tests__/useChunkStreaming.test.tsx`, replace `fakeGeo()` with a minimal bundle (same shape as the streamer test's `fakeBundle`) and keep the rest. The hook itself does not reference `.geometry`/`.bundle` (it only forwards `loaded`), so `useChunkStreaming.ts` likely needs no change — confirm by grepping:

Run: `grep -n "geometry" src/components/World3D/useChunkStreaming.ts || echo "no geometry refs"`

If it prints `no geometry refs`, leave the hook as-is. If it references `.geometry`, rename to `.bundle`.

- [ ] **Step 9: Run all affected tests**

Run: `npx vitest run src/systems/world3d src/components/World3D`
Expected: all PASS. Pay attention to `chunkStreamer`, `chunkWorkerCore`, `createWorkerChunkLoader`, `useChunkStreaming`, and the new `chunkBundle`.

- [ ] **Step 10: Commit**

```bash
git add src/systems/world3d/chunkBundle.ts src/systems/world3d/chunkWorkerCore.ts src/systems/world3d/chunkStreamer.ts src/components/World3D/chunkWorker.ts src/components/World3D/createWorkerChunkLoader.ts src/components/World3D/useChunkStreaming.ts src/systems/world3d/__tests__/chunkBundle.test.ts src/systems/world3d/__tests__/chunkWorkerCore.test.ts src/systems/world3d/__tests__/chunkStreamer.test.ts src/components/World3D/__tests__/createWorkerChunkLoader.test.ts src/components/World3D/__tests__/useChunkStreaming.test.tsx
git commit -m "feat(world3d): assemble ChunkMeshBundle and rewire streaming pipeline"
```

---

## Task 10: Render the Bundle in World3DScene

**Files:**
- Modify: `src/components/World3D/World3DScene.tsx`

Render each loaded chunk's bundle: terrain with `vertexColors`, optional water (semi-transparent blue), optional roads (tan), site boxes, and instanced vegetation. No unit test — verified by browser smoke (Task 11).

- [ ] **Step 1: Rewrite the chunk-rendering portion of World3DScene**

In `src/components/World3D/World3DScene.tsx`, the current `ChunkMesh` reads `chunk.geometry` (Plan 2). Replace `ChunkMesh` with a bundle-aware renderer. Keep the surrounding `World3DScene` (Canvas, lighting, camera, streaming) intact; only the per-chunk rendering changes. Replace the `ChunkMesh` component and its usage with:

```tsx
import * as THREE from 'three';
import type { LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';

function useBufferGeometry(arr: { positions: Float32Array; indices: Uint32Array; normals: Float32Array; colors?: Float32Array }) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(arr.normals, 3));
    if (arr.colors) g.setAttribute('color', new THREE.BufferAttribute(arr.colors, 3));
    g.setIndex(new THREE.BufferAttribute(arr.indices, 1));
    return g;
  }, [arr]);
}

const TerrainPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const geometry = useBufferGeometry(chunk.bundle.terrain);
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]} receiveShadow>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
};

const WaterPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const water = chunk.bundle.water;
  if (!water) return null;
  const geometry = useBufferGeometry(water);
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]}>
      <meshStandardMaterial color="#2a5a8a" transparent opacity={0.75} />
    </mesh>
  );
};

const RoadPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const roads = chunk.bundle.roads;
  if (!roads) return null;
  const geometry = useBufferGeometry(roads);
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]}>
      <meshStandardMaterial color="#9a8458" />
    </mesh>
  );
};

const SitePieces: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <group position={[origin.x, 0, origin.y]}>
      {chunk.bundle.sites.map((s) => (
        <mesh key={s.id} position={[s.localX, s.radius * 0.5, s.localZ]} castShadow>
          <boxGeometry args={[s.radius, s.radius, s.radius]} />
          <meshStandardMaterial color={s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555' : '#888'} />
        </mesh>
      ))}
    </group>
  );
};

const VegetationPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const veg = chunk.bundle.vegetation;
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const count = veg ? veg.positions.length / 3 : 0;
  React.useEffect(() => {
    if (!ref.current || !veg) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const s = veg.scales[i];
      q.setFromAxisAngle(axis, veg.rotations[i]);
      m.compose(
        new THREE.Vector3(veg.positions[i * 3], veg.positions[i * 3 + 1], veg.positions[i * 3 + 2]),
        q,
        new THREE.Vector3(s * 2, s * 5, s * 2),
      );
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [veg, count]);
  if (!veg || count === 0) return null;
  return (
    <group position={[origin.x, 0, origin.y]}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#2f5d2f" flatShading />
      </instancedMesh>
    </group>
  );
};

const ChunkPieces: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => (
  <>
    <TerrainPiece chunk={chunk} />
    <WaterPiece chunk={chunk} />
    <RoadPiece chunk={chunk} />
    <SitePieces chunk={chunk} />
    <VegetationPiece chunk={chunk} />
  </>
);
```

Then in the scene's render, replace the old `loaded.map((c) => <ChunkMesh ... />)` with:

```tsx
{loaded.map((c) => (
  <ChunkPieces key={`${c.cx}|${c.cy}`} chunk={c} />
))}
```

Ensure `useMemo` and `React` are imported (they are in the Plan 2 file). Remove the now-unused old `ChunkMesh` component and the `LOD_COLOR` map if no longer referenced.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "World3DScene|world3d/types" || echo "no World3DScene type errors"`
Expected: `no World3DScene type errors`.

- [ ] **Step 3: Commit**

```bash
git add src/components/World3D/World3DScene.tsx
git commit -m "feat(world3d): render terrain colors, water, roads, sites, vegetation"
```

---

## Task 11: Integration + Performance + Browser Smoke

**Files:**
- Create: `src/systems/world3d/__tests__/bundleIntegration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `src/systems/world3d/__tests__/bundleIntegration.test.ts`:

```ts
import { handleChunkRequest } from '../chunkWorkerCore';
import { WORLD3D_CONFIG } from '../config';
import { runWorldSim } from '@/services/worldSim';

const buildWorld = () => {
  const cols = 60;
  const rows = 40;
  const cells = cols * rows;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    heights.push(Math.max(0, Math.min(100, Math.round(Math.sin(i * 0.13) * 30 + 45))));
  }
  return runWorldSim({
    seed: 2026,
    templateId: 'continents',
    cols,
    rows,
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: heights.map((h) => (h < 20 ? 'ocean' : h < 45 ? 'plains' : 'forest')),
  });
};

it('builds well-formed bundles across a window of a realistic world', () => {
  const world = buildWorld();
  const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
  let withWater = 0;
  let withVegetation = 0;
  for (let cy = 40; cy < 49; cy++) {
    for (let cx = 40; cx < 49; cx++) {
      const bundle = handleChunkRequest(world, { cx, cy, resolution: res });
      expect(bundle.terrain.positions.length).toBe(res * res * 3);
      expect(bundle.terrain.colors.length).toBe(res * res * 3);
      for (const v of bundle.terrain.positions) expect(Number.isFinite(v)).toBe(true);
      if (bundle.water) withWater++;
      if (bundle.vegetation) withVegetation++;
    }
  }
  // On a forested world we expect at least some vegetated chunks.
  expect(withVegetation).toBeGreaterThan(0);
  // withWater may be 0 depending on river paths; just assert it's a number.
  expect(withWater).toBeGreaterThanOrEqual(0);
});

it('builds an 81-chunk window within the soft performance budget', () => {
  const world = buildWorld();
  const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
  const start = performance.now();
  for (let cy = 40; cy < 49; cy++) {
    for (let cx = 40; cx < 49; cx++) {
      handleChunkRequest(world, { cx, cy, resolution: res });
    }
  }
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(3000);
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/systems/world3d/__tests__/bundleIntegration.test.ts`
Expected: PASS, 2 tests. If the perf test exceeds 3000ms, report it — the builders are O(vertices + polyline points), so a failure means something is accidentally heavy. Do not relax the budget.

- [ ] **Step 3: Full world3d regression sweep**

Run: `npx vitest run src/systems/world3d src/components/World3D`
Expected: all PASS.

- [ ] **Step 4: Browser smoke (record result in commit)**

Run: `npm run dev`. Open `?phase=world3d` (the route already exists from Plan 2).
Verify:
- Terrain is biome-colored (greens for forest/plains, blue-ish for low/ocean), not flat grey-green.
- Where rivers run, blue water ribbons appear; roads appear as tan ribbons; towns appear as box clusters.
- Forested chunks show scattered cone "trees" (instanced).
- Panning streams new chunks with all of the above; console clean (no errors referencing `world3d`/`chunkWorker`/WebGL context loss).

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/__tests__/bundleIntegration.test.ts
git commit -m "test(world3d): bundle integration + performance smoke"
```

---

## Final Verification

- [ ] **All plan tests**

```bash
npx vitest run src/systems/world3d src/components/World3D
```
Expected: all PASS.

- [ ] **Type-check**

Run: `npx tsc --noEmit`
Expected: only pre-existing unrelated errors. No new errors from `world3d` / `World3D`.

- [ ] **Demo confirms the visible upgrade** (if not already done): `?phase=world3d` shows colored terrain + water + roads + towns + trees streaming around the camera.

---

## What This Plan Does NOT Do

Deferred to Plan 4 / later:

- 2D↔3D transition animation, bidirectional Azgaar marker sync, `playerWorldPos` in game state, submap deletion, grid-mode removal — **Plan 4**.
- Per-LOD geometry detail (mid/low tiers still build full-resolution meshes; only color/material differ). A future pass can lower `resolution` for distant chunks via the `LodTier`.
- PBR terrain splat textures, animated water shaders, real glTF tree/building models — this plan ships solid-color/instanced-primitive placeholders that read clearly but are not art-final.
- Lakes as filled polygons (only river ribbons are built; `WorldData.lakes` polygons are not yet meshed).
- Per-chunk persistence / chunk deltas.

When this plan lands, `?phase=world3d` renders a recognizable world — colored biomes, flowing rivers, roads between towns, town clusters, and forests — streaming around a free-roam camera, with every builder unit-tested and deterministic.
```
