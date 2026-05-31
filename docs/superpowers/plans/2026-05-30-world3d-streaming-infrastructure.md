# World3D Streaming Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the chunk-streaming machinery for the massive 3D world — coordinate transforms, a sliding-window chunk manager, LOD selection, a WorldData→chunk sampler, a worker-backed loader, and a thin R3F `World3DScene` shell that streams cheap placeholder heightfield chunks around a free-roam camera.

**Architecture:** All decision logic (which chunks to load/unload, what LOD, how to sample WorldData for a chunk, how to build placeholder geometry) lives in pure, unit-tested modules under `src/systems/world3d/`. Chunk geometry is produced by a pure function that runs equally in a Web Worker (production) or inline (tests), via an injected `ChunkLoader`. The React layer (`src/components/World3D/`) is a thin shell: a free-roam camera that reports its world position, a `useChunkStreaming` hook, and meshes rendered straight from the geometry arrays. Real terrain/river/road meshes are explicitly deferred to Plan 3 — this plan ships flat-shaded placeholder heightfields to prove streaming works end to end.

**Tech Stack:** TypeScript, Vitest 4.x (globals enabled — do NOT import `it`/`describe`/`expect`/`beforeEach` from 'vitest'), three.js r170, @react-three/fiber 9, @react-three/drei 10. Consumes `WorldData` from Plan 1 (`src/services/worldSim/`).

**Source spec:** `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` (§4.3 component map, §6 chunk render, §7 streaming/LOD).

**Depends on:** Plan 1 (World Sim Extensions) — landed. `runWorldSim`, `WorldData`, `Vec2` are available from `@/services/worldSim`.

---

## File Structure

**Created (pure logic — `src/systems/world3d/`):**
- `config.ts` — `WORLD3D_CONFIG` constants + derived values
- `coords.ts` — world↔chunk↔grid coordinate transforms, chunk-key encoding
- `chunkManager.ts` — `computeChunkDiff` (sliding-window load/unload set logic)
- `lod.ts` — `selectLodTier` (chunk distance → LOD tier)
- `chunkSampler.ts` — `sampleChunk` (slice WorldData heights for one chunk)
- `chunkGeometry.ts` — `buildPlaceholderHeightfield` (ChunkData → vertex/index/normal arrays)
- `chunkWorkerCore.ts` — `handleChunkRequest` (pure: sample + build, the Plan 3 seam)
- `chunkStreamer.ts` — `ChunkStreamer` class (stateful sliding-window orchestrator)
- `types.ts` — shared `ChunkCoord`, `ChunkData`, `ChunkGeometryArrays`, `LodTier`, `ChunkLoader`, `LoadedChunk`
- `__tests__/*.test.ts` — one per module above

**Created (React shell — `src/components/World3D/`):**
- `chunkWorker.ts` — thin Web Worker entry (glue around `handleChunkRequest`; browser-only)
- `createWorkerChunkLoader.ts` — worker-pool-backed `ChunkLoader` factory (browser-only)
- `useChunkStreaming.ts` — React hook wrapping `ChunkStreamer`
- `FreeRoamCameraController.tsx` — unconstrained orbit/pan camera that reports world position
- `World3DScene.tsx` — top-level R3F `<Canvas>` shell rendering streamed placeholder chunks
- `World3DDemo.tsx` — self-contained demo host (generates a world, mounts the scene)

**Modified:**
- `src/App.tsx` — add a `?phase=world3d` branch that lazy-loads `World3DDemo` (mirrors the existing `?phase=combat` → `BattleMapDemo` pattern)

---

## Conventions

- Run tests: `npx vitest run <path>` (one-shot; `vitest` alone watches).
- **Vitest 4.x globals are injected** — never `import { it, describe, expect, beforeEach } from 'vitest'` (breaks the runner).
- Module alias `@/` → `src/`.
- Conventional Commits: `feat(world3d): ...`, `test(world3d): ...`.
- Coordinate conventions (CRITICAL — keep consistent across every module):
  - **World space** uses three.js axes: `x` = east, `z` = south, `y` = up (height). The horizontal plane is `(x, z)`.
  - **Grid space** is WorldData's coordinate system: `gridX` along columns, `gridY` along rows. `heights[gridY * cols + gridX]`.
  - Mapping: `gridX = worldX / METERS_PER_CELL`, `gridY = worldZ / METERS_PER_CELL`.
  - Chunk coords `(cx, cy)`: integer; chunk covers world `x ∈ [cx·S, (cx+1)·S)`, `z ∈ [cy·S, (cy+1)·S)` where `S = CHUNK_WORLD_SIZE`.
- There may be a daily-snapshot mechanism that auto-commits untracked files between edits. If it captures your files early, soft-reset and recommit cleanly so each task is one focused commit. Ignore unrelated working-tree changes (`conductor/`, `docs/tasks/spells/`).
- Pre-existing TS errors in unrelated files (`CharacterActor.tsx`, `characterUtils.ts`, `OpportunityAttackSystem.test.ts`) are NOT your problem.

---

## Task 1: Config + Shared Types

**Files:**
- Create: `src/systems/world3d/config.ts`
- Create: `src/systems/world3d/types.ts`
- Test: `src/systems/world3d/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/config.test.ts`:

```ts
import { WORLD3D_CONFIG, CHUNKS_PER_CELL } from '../config';

it('exposes coherent chunk sizing constants', () => {
  expect(WORLD3D_CONFIG.CHUNK_WORLD_SIZE).toBeGreaterThan(0);
  expect(WORLD3D_CONFIG.METERS_PER_CELL).toBeGreaterThan(0);
  // One grid cell must be an integer number of chunks.
  expect(WORLD3D_CONFIG.METERS_PER_CELL % WORLD3D_CONFIG.CHUNK_WORLD_SIZE).toBe(0);
  expect(CHUNKS_PER_CELL).toBe(WORLD3D_CONFIG.METERS_PER_CELL / WORLD3D_CONFIG.CHUNK_WORLD_SIZE);
});

it('unload radius is at least the load radius (hysteresis)', () => {
  expect(WORLD3D_CONFIG.UNLOAD_RADIUS).toBeGreaterThanOrEqual(WORLD3D_CONFIG.LOAD_RADIUS);
});

it('heightfield resolution is at least 2 vertices per edge', () => {
  expect(WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/config.test.ts`
Expected: FAIL with "Cannot find module '../config'".

- [ ] **Step 3: Create config + types**

Create `src/systems/world3d/config.ts`:

```ts
/**
 * @file config.ts
 * Central tunables for the 3D streamed world. Keep all magic numbers here so the
 * coordinate math, sampler, LOD, and streamer stay in agreement.
 */
export const WORLD3D_CONFIG = {
  /** World-space edge length of one chunk, in meters. */
  CHUNK_WORLD_SIZE: 128,
  /** How many world meters one WorldData grid cell spans. Must be a multiple of CHUNK_WORLD_SIZE. */
  METERS_PER_CELL: 1024,
  /** Vertices per chunk edge for the placeholder heightfield (Plan 3 refines per-LOD). */
  HEIGHTFIELD_RESOLUTION: 16,
  /** WorldData height (0..100) maps linearly to [0, MAX_TERRAIN_HEIGHT_M] meters. */
  MAX_TERRAIN_HEIGHT_M: 150,
  /** Chunks within this Chebyshev radius of the camera chunk are loaded. */
  LOAD_RADIUS: 4,
  /** Chunks beyond this Chebyshev radius are unloaded (>= LOAD_RADIUS for hysteresis). */
  UNLOAD_RADIUS: 6,
  /** Max chunk loads in flight at once (throttles the worker pool). */
  MAX_CONCURRENT_LOADS: 4,
} as const;

/** Derived: number of chunks spanning one grid cell along each axis. */
export const CHUNKS_PER_CELL = WORLD3D_CONFIG.METERS_PER_CELL / WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
```

Create `src/systems/world3d/types.ts`:

```ts
/**
 * @file types.ts
 * Shared types for the 3D world streaming system.
 */

/** Integer chunk coordinate on the chunk grid. */
export interface ChunkCoord {
  cx: number;
  cy: number;
}

/**
 * The slice of WorldData needed to build one chunk's geometry.
 * Plan 3 extends this with intersecting rivers/roads and contained sites.
 */
export interface ChunkData {
  cx: number;
  cy: number;
  /** Vertices per edge (square grid). */
  resolution: number;
  /** Sampled heights (0..100), length resolution*resolution, row-major (z-major, x-minor). */
  heights: Float32Array;
}

/** Transferable geometry buffers for a chunk mesh, local to the chunk origin. */
export interface ChunkGeometryArrays {
  /** 3 floats (x,y,z) per vertex, local-space (chunk origin at 0,0). */
  positions: Float32Array;
  /** Triangle indices into positions. */
  indices: Uint32Array;
  /** 3 floats per vertex. */
  normals: Float32Array;
}

/** LOD tier for a loaded chunk, by chunk-distance from the camera. */
export type LodTier = 'full' | 'mid' | 'low' | 'culled';

/** Async producer of chunk geometry. Worker-backed in production, inline in tests. */
export type ChunkLoader = (cx: number, cy: number) => Promise<ChunkGeometryArrays>;

/** A chunk currently held in memory by the streamer. */
export interface LoadedChunk {
  cx: number;
  cy: number;
  geometry: ChunkGeometryArrays;
  lod: LodTier;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/config.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/config.ts src/systems/world3d/types.ts src/systems/world3d/__tests__/config.test.ts
git commit -m "feat(world3d): config constants and shared streaming types"
```

---

## Task 2: Coordinate Transforms

**Files:**
- Create: `src/systems/world3d/coords.ts`
- Test: `src/systems/world3d/__tests__/coords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/coords.test.ts`:

```ts
import {
  worldToChunk,
  chunkKey,
  parseChunkKey,
  chunkOriginWorld,
  worldToGrid,
  chunkGridAABB,
} from '../coords';
import { WORLD3D_CONFIG } from '../config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('worldToChunk floors world meters into integer chunk coords', () => {
  expect(worldToChunk(0, 0)).toEqual({ cx: 0, cy: 0 });
  expect(worldToChunk(S - 1, S - 1)).toEqual({ cx: 0, cy: 0 });
  expect(worldToChunk(S, S)).toEqual({ cx: 1, cy: 1 });
  expect(worldToChunk(-1, -1)).toEqual({ cx: -1, cy: -1 });
});

it('chunkKey round-trips through parseChunkKey', () => {
  const k = chunkKey(3, -7);
  expect(typeof k).toBe('string');
  expect(parseChunkKey(k)).toEqual({ cx: 3, cy: -7 });
});

it('chunkOriginWorld returns the min corner in meters', () => {
  expect(chunkOriginWorld(0, 0)).toEqual({ x: 0, y: 0 });
  expect(chunkOriginWorld(2, 3)).toEqual({ x: 2 * S, y: 3 * S });
});

it('worldToGrid divides by METERS_PER_CELL', () => {
  const g = worldToGrid(WORLD3D_CONFIG.METERS_PER_CELL, WORLD3D_CONFIG.METERS_PER_CELL * 2);
  expect(g.x).toBeCloseTo(1);
  expect(g.y).toBeCloseTo(2);
});

it('chunkGridAABB bounds a chunk in grid space', () => {
  const aabb = chunkGridAABB(0, 0);
  expect(aabb.minGX).toBeCloseTo(0);
  expect(aabb.minGY).toBeCloseTo(0);
  // One chunk spans CHUNK_WORLD_SIZE / METERS_PER_CELL grid cells.
  const span = S / WORLD3D_CONFIG.METERS_PER_CELL;
  expect(aabb.maxGX).toBeCloseTo(span);
  expect(aabb.maxGY).toBeCloseTo(span);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/coords.test.ts`
Expected: FAIL with "Cannot find module '../coords'".

- [ ] **Step 3: Implement coords**

Create `src/systems/world3d/coords.ts`:

```ts
/**
 * @file coords.ts
 * Pure coordinate transforms between world space (meters, x/z plane, y up),
 * chunk space (integer cx/cy), and WorldData grid space (gridX/gridY cells).
 *
 * See the plan's "Coordinate conventions" note. worldX→gridX, worldZ→gridY.
 */
import type { Vec2 } from '@/services/worldSim/types';
import type { ChunkCoord } from './types';
import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const M = WORLD3D_CONFIG.METERS_PER_CELL;

/** Which chunk a world-space (x, z) position falls in. */
export function worldToChunk(worldX: number, worldZ: number): ChunkCoord {
  return { cx: Math.floor(worldX / S), cy: Math.floor(worldZ / S) };
}

/** Stable string key for a chunk coordinate (used as Map/Set key). */
export function chunkKey(cx: number, cy: number): string {
  return `${cx}|${cy}`;
}

/** Inverse of chunkKey. */
export function parseChunkKey(key: string): ChunkCoord {
  const [cx, cy] = key.split('|');
  return { cx: Number(cx), cy: Number(cy) };
}

/** Min (north-west) corner of a chunk in world meters. Returned as {x, y} where y is the world Z. */
export function chunkOriginWorld(cx: number, cy: number): Vec2 {
  return { x: cx * S, y: cy * S };
}

/** Convert a world-space (x, z) position to fractional grid-cell coordinates. */
export function worldToGrid(worldX: number, worldZ: number): Vec2 {
  return { x: worldX / M, y: worldZ / M };
}

/** Grid-space axis-aligned bounding box for a chunk. */
export function chunkGridAABB(cx: number, cy: number): {
  minGX: number;
  minGY: number;
  maxGX: number;
  maxGY: number;
} {
  const minGX = (cx * S) / M;
  const minGY = (cy * S) / M;
  const maxGX = ((cx + 1) * S) / M;
  const maxGY = ((cy + 1) * S) / M;
  return { minGX, minGY, maxGX, maxGY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/coords.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/coords.ts src/systems/world3d/__tests__/coords.test.ts
git commit -m "feat(world3d): world/chunk/grid coordinate transforms"
```

---

## Task 3: Chunk Diff (Sliding Window)

**Files:**
- Create: `src/systems/world3d/chunkManager.ts`
- Test: `src/systems/world3d/__tests__/chunkManager.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/chunkManager.test.ts`:

```ts
import { computeChunkDiff } from '../chunkManager';
import { chunkKey } from '../coords';

it('loads the full square window around the center when nothing is loaded', () => {
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, new Set());
  // Chebyshev radius 1 → 3x3 = 9 chunks.
  expect(diff.toLoad).toHaveLength(9);
  expect(diff.toUnload).toHaveLength(0);
});

it('does not reload already-loaded chunks', () => {
  const loaded = new Set([chunkKey(0, 0), chunkKey(1, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toLoad).toHaveLength(7); // 9 in window - 2 already loaded
  expect(diff.toLoad.some((c) => c.cx === 0 && c.cy === 0)).toBe(false);
});

it('unloads chunks beyond the unload radius', () => {
  // A chunk far away (cx 10) should be unloaded; one inside the window kept.
  const loaded = new Set([chunkKey(10, 10), chunkKey(0, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toUnload).toEqual([{ cx: 10, cy: 10 }]);
});

it('keeps chunks within unload radius even if outside load radius (hysteresis)', () => {
  // Chunk at distance 2: outside loadRadius 1 but inside unloadRadius 2 → not unloaded, not reloaded.
  const loaded = new Set([chunkKey(2, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toUnload).toHaveLength(0);
  expect(diff.toLoad.some((c) => c.cx === 2 && c.cy === 0)).toBe(false);
});

it('orders toLoad closest-first', () => {
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 2, 3, new Set());
  // First entry must be the center itself (distance 0).
  expect(diff.toLoad[0]).toEqual({ cx: 0, cy: 0 });
  // Distances must be non-decreasing.
  const dist = (c: { cx: number; cy: number }) => Math.max(Math.abs(c.cx), Math.abs(c.cy));
  for (let i = 1; i < diff.toLoad.length; i++) {
    expect(dist(diff.toLoad[i])).toBeGreaterThanOrEqual(dist(diff.toLoad[i - 1]));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkManager.test.ts`
Expected: FAIL with "Cannot find module '../chunkManager'".

- [ ] **Step 3: Implement chunkManager**

Create `src/systems/world3d/chunkManager.ts`:

```ts
/**
 * @file chunkManager.ts
 * Pure sliding-window logic: given the camera's chunk and the currently-loaded
 * set, compute which chunks to load and which to unload.
 *
 * Uses Chebyshev (square ring) distance — the natural metric for a chunk grid.
 * Hysteresis: load within LOAD_RADIUS, unload only beyond UNLOAD_RADIUS, so
 * chunks in the band between don't thrash as the camera jitters at a boundary.
 */
import type { ChunkCoord } from './types';
import { chunkKey, parseChunkKey } from './coords';

export interface ChunkDiff {
  toLoad: ChunkCoord[];
  toUnload: ChunkCoord[];
}

const chebyshev = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function computeChunkDiff(
  center: ChunkCoord,
  loadRadius: number,
  unloadRadius: number,
  currentlyLoaded: Set<string>,
): ChunkDiff {
  // Desired window: every chunk within Chebyshev loadRadius of center.
  const toLoad: ChunkCoord[] = [];
  for (let dy = -loadRadius; dy <= loadRadius; dy++) {
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      const cx = center.cx + dx;
      const cy = center.cy + dy;
      if (currentlyLoaded.has(chunkKey(cx, cy))) continue;
      toLoad.push({ cx, cy });
    }
  }
  // Closest-first so the worker pool fills the area around the camera before the edges.
  toLoad.sort(
    (a, b) =>
      chebyshev(a.cx, a.cy, center.cx, center.cy) - chebyshev(b.cx, b.cy, center.cx, center.cy),
  );

  // Unload anything strictly beyond unloadRadius.
  const toUnload: ChunkCoord[] = [];
  for (const key of currentlyLoaded) {
    const { cx, cy } = parseChunkKey(key);
    if (chebyshev(cx, cy, center.cx, center.cy) > unloadRadius) {
      toUnload.push({ cx, cy });
    }
  }

  return { toLoad, toUnload };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkManager.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/chunkManager.ts src/systems/world3d/__tests__/chunkManager.test.ts
git commit -m "feat(world3d): sliding-window chunk load/unload diff"
```

---

## Task 4: LOD Selection

**Files:**
- Create: `src/systems/world3d/lod.ts`
- Test: `src/systems/world3d/__tests__/lod.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/lod.test.ts`:

```ts
import { selectLodTier, LOD_RINGS } from '../lod';

it('classifies chunk distance into tiers', () => {
  expect(selectLodTier(0)).toBe('full');
  expect(selectLodTier(LOD_RINGS.full)).toBe('full');
  expect(selectLodTier(LOD_RINGS.full + 1)).toBe('mid');
  expect(selectLodTier(LOD_RINGS.mid)).toBe('mid');
  expect(selectLodTier(LOD_RINGS.mid + 1)).toBe('low');
  expect(selectLodTier(LOD_RINGS.low)).toBe('low');
  expect(selectLodTier(LOD_RINGS.low + 1)).toBe('culled');
});

it('tiers are ordered full < mid < low by ring distance', () => {
  expect(LOD_RINGS.full).toBeLessThan(LOD_RINGS.mid);
  expect(LOD_RINGS.mid).toBeLessThan(LOD_RINGS.low);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/lod.test.ts`
Expected: FAIL with "Cannot find module '../lod'".

- [ ] **Step 3: Implement lod**

Create `src/systems/world3d/lod.ts`:

```ts
/**
 * @file lod.ts
 * Pure LOD-tier selection by Chebyshev chunk distance from the camera chunk.
 *
 * Plan 2 only uses the tier to tag LoadedChunk; Plan 3 will swap geometry detail
 * (full mesh / impostor vegetation / coarse heightfield) based on it.
 */
import type { LodTier } from './types';

/** Inclusive max chunk distance for each tier. */
export const LOD_RINGS = {
  full: 1,
  mid: 3,
  low: 6,
} as const;

export function selectLodTier(chunkDistance: number): LodTier {
  if (chunkDistance <= LOD_RINGS.full) return 'full';
  if (chunkDistance <= LOD_RINGS.mid) return 'mid';
  if (chunkDistance <= LOD_RINGS.low) return 'low';
  return 'culled';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/lod.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/lod.ts src/systems/world3d/__tests__/lod.test.ts
git commit -m "feat(world3d): LOD tier selection by chunk distance"
```

---

## Task 5: Chunk Data Sampler

**Files:**
- Create: `src/systems/world3d/chunkSampler.ts`
- Test: `src/systems/world3d/__tests__/chunkSampler.test.ts`

Samples WorldData heights across a chunk's world AABB into a `resolution × resolution` grid via bilinear interpolation. This is the only place that reads `WorldData` for chunk geometry — Plan 3 extends it to also collect intersecting rivers/roads and contained sites.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/chunkSampler.test.ts`:

```ts
import { sampleChunk } from '../chunkSampler';
import type { WorldData } from '@/services/worldSim/types';

const makeWorld = (cols: number, rows: number, fill: (x: number, y: number) => number): WorldData => {
  const heights: number[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) heights.push(fill(x, y));
  return {
    version: 2,
    seed: 1,
    templateId: 't',
    gridSize: { rows, cols },
    heights,
    temperatures: [],
    moisture: [],
    biomeIds: [],
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
};

it('produces a resolution*resolution height buffer', () => {
  const world = makeWorld(4, 4, () => 50);
  const data = sampleChunk(world, 0, 0, 8);
  expect(data.resolution).toBe(8);
  expect(data.heights).toHaveLength(64);
});

it('samples a flat world as a constant height', () => {
  const world = makeWorld(4, 4, () => 42);
  const data = sampleChunk(world, 0, 0, 5);
  for (const h of data.heights) expect(h).toBeCloseTo(42);
});

it('reflects a horizontal height gradient across the world', () => {
  // Height rises with grid X. A chunk far east should sample higher than a chunk at the origin.
  const world = makeWorld(64, 4, (x) => x); // height == column index
  const near = sampleChunk(world, 0, 0, 4);
  const far = sampleChunk(world, 20, 0, 4);
  const avg = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
  expect(avg(far)).toBeGreaterThan(avg(near));
});

it('clamps samples that fall outside the grid to the edge value', () => {
  const world = makeWorld(2, 2, () => 30);
  // A chunk well beyond the grid still returns finite, clamped heights (no NaN).
  const data = sampleChunk(world, 9999, 9999, 4);
  for (const h of data.heights) {
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeCloseTo(30);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkSampler.test.ts`
Expected: FAIL with "Cannot find module '../chunkSampler'".

- [ ] **Step 3: Implement chunkSampler**

Create `src/systems/world3d/chunkSampler.ts`:

```ts
/**
 * @file chunkSampler.ts
 * Slice WorldData into the per-chunk input needed for geometry. For Plan 2 that
 * is just a bilinearly-sampled height subgrid; Plan 3 adds rivers/roads/sites.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkData } from './types';
import { chunkGridAABB } from './coords';

/** Bilinear sample of the height grid at fractional grid coords, edge-clamped. */
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

export function sampleChunk(
  world: WorldData,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const aabb = chunkGridAABB(cx, cy);
  const heights = new Float32Array(resolution * resolution);

  for (let j = 0; j < resolution; j++) {
    const ty = resolution === 1 ? 0 : j / (resolution - 1);
    const gy = aabb.minGY + (aabb.maxGY - aabb.minGY) * ty;
    for (let i = 0; i < resolution; i++) {
      const tx = resolution === 1 ? 0 : i / (resolution - 1);
      const gx = aabb.minGX + (aabb.maxGX - aabb.minGX) * tx;
      heights[j * resolution + i] = sampleHeightBilinear(world, gx, gy);
    }
  }

  return { cx, cy, resolution, heights };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkSampler.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/chunkSampler.ts src/systems/world3d/__tests__/chunkSampler.test.ts
git commit -m "feat(world3d): sample WorldData heights into per-chunk subgrid"
```

---

## Task 6: Placeholder Heightfield Geometry

**Files:**
- Create: `src/systems/world3d/chunkGeometry.ts`
- Test: `src/systems/world3d/__tests__/chunkGeometry.test.ts`

Builds a flat-shaded heightfield mesh from a `ChunkData`. Positions are local to the chunk origin (the scene places the mesh at `chunkOriginWorld`). This is intentionally simple — Plan 3 replaces it with textured terrain + water + props, consuming the same `ChunkData`.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/chunkGeometry.test.ts`:

```ts
import { buildPlaceholderHeightfield } from '../chunkGeometry';
import type { ChunkData } from '../types';
import { WORLD3D_CONFIG } from '../config';

const flatChunk = (resolution: number, height: number): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution,
  heights: new Float32Array(resolution * resolution).fill(height),
});

it('produces res*res vertices and (res-1)^2*2 triangles', () => {
  const res = 4;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 0));
  expect(geo.positions).toHaveLength(res * res * 3);
  expect(geo.normals).toHaveLength(res * res * 3);
  expect(geo.indices).toHaveLength((res - 1) * (res - 1) * 6);
});

it('spreads vertices across the chunk world size on x and z', () => {
  const res = 3;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 0));
  // Last vertex x should be CHUNK_WORLD_SIZE; first should be 0.
  const lastIdx = (res * res - 1) * 3;
  expect(geo.positions[0]).toBeCloseTo(0); // x of vertex 0
  expect(geo.positions[lastIdx]).toBeCloseTo(WORLD3D_CONFIG.CHUNK_WORLD_SIZE); // x of last vertex
});

it('maps height 0..100 to 0..MAX_TERRAIN_HEIGHT_M on the y axis', () => {
  const res = 2;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 100));
  // Every vertex y should equal MAX_TERRAIN_HEIGHT_M.
  for (let v = 0; v < res * res; v++) {
    expect(geo.positions[v * 3 + 1]).toBeCloseTo(WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M);
  }
});

it('a flat field yields upward (+Y) normals', () => {
  const res = 4;
  const geo = buildPlaceholderHeightfield(flatChunk(res, 30));
  for (let v = 0; v < res * res; v++) {
    expect(geo.normals[v * 3 + 1]).toBeGreaterThan(0.9); // dominant +Y
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkGeometry.test.ts`
Expected: FAIL with "Cannot find module '../chunkGeometry'".

- [ ] **Step 3: Implement chunkGeometry**

Create `src/systems/world3d/chunkGeometry.ts`:

```ts
/**
 * @file chunkGeometry.ts
 * Build a flat-shaded heightfield mesh (positions/indices/normals) from a ChunkData.
 * Positions are local to the chunk origin; the scene translates the mesh into place.
 *
 * Placeholder for Plan 2 — Plan 3 replaces this with textured terrain, water, and
 * scattered props, consuming the same ChunkData input.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const MAX_H = WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M;

export function buildPlaceholderHeightfield(data: ChunkData): ChunkGeometryArrays {
  const res = data.resolution;
  const vertCount = res * res;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);

  // Vertex positions: x/z spread across [0, S], y from height (0..100) → (0..MAX_H).
  for (let j = 0; j < res; j++) {
    const tz = res === 1 ? 0 : j / (res - 1);
    for (let i = 0; i < res; i++) {
      const tx = res === 1 ? 0 : i / (res - 1);
      const idx = (j * res + i) * 3;
      positions[idx] = tx * S;
      positions[idx + 1] = (data.heights[j * res + i] / 100) * MAX_H;
      positions[idx + 2] = tz * S;
    }
  }

  // Indices: two triangles per quad.
  const indices = new Uint32Array((res - 1) * (res - 1) * 6);
  let t = 0;
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i;
      const b = j * res + i + 1;
      const c = (j + 1) * res + i;
      const d = (j + 1) * res + i + 1;
      indices[t++] = a;
      indices[t++] = c;
      indices[t++] = b;
      indices[t++] = b;
      indices[t++] = c;
      indices[t++] = d;
    }
  }

  // Per-vertex normals via accumulated face normals.
  for (let f = 0; f < indices.length; f += 3) {
    const ia = indices[f] * 3;
    const ib = indices[f + 1] * 3;
    const ic = indices[f + 2] * 3;
    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    // Cross product e1 × e2.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const vi of [ia, ib, ic]) {
      normals[vi] += nx;
      normals[vi + 1] += ny;
      normals[vi + 2] += nz;
    }
  }
  // Normalize.
  for (let v = 0; v < vertCount; v++) {
    const o = v * 3;
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1;
    normals[o] /= len;
    normals[o + 1] /= len;
    normals[o + 2] /= len;
  }

  return { positions, indices, normals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkGeometry.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/chunkGeometry.ts src/systems/world3d/__tests__/chunkGeometry.test.ts
git commit -m "feat(world3d): placeholder heightfield geometry builder"
```

---

## Task 7: Worker Core (the Plan 3 seam)

**Files:**
- Create: `src/systems/world3d/chunkWorkerCore.ts`
- Test: `src/systems/world3d/__tests__/chunkWorkerCore.test.ts`

A single pure function `handleChunkRequest(worldData, req)` that composes `sampleChunk` + `buildPlaceholderHeightfield`. The real Web Worker (Task 9) is a thin wrapper around this; tests exercise it directly with no Worker globals.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/chunkWorkerCore.test.ts`:

```ts
import { handleChunkRequest } from '../chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

const flatWorld = (cols: number, rows: number, h: number): WorldData => ({
  version: 2,
  seed: 1,
  templateId: 't',
  gridSize: { rows, cols },
  heights: new Array(cols * rows).fill(h),
  temperatures: [],
  moisture: [],
  biomeIds: [],
  rivers: [],
  roads: [],
  sites: [],
  coastlines: [],
  lakes: [],
  biomeZones: [],
});

it('produces geometry arrays for a chunk request', () => {
  const geo = handleChunkRequest(flatWorld(8, 8, 40), { cx: 0, cy: 0, resolution: 6 });
  expect(geo.positions.length).toBe(6 * 6 * 3);
  expect(geo.indices.length).toBe((6 - 1) * (6 - 1) * 6);
  expect(geo.normals.length).toBe(6 * 6 * 3);
});

it('is deterministic for the same world + request', () => {
  const world = flatWorld(8, 8, 55);
  const a = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  const b = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkWorkerCore.test.ts`
Expected: FAIL with "Cannot find module '../chunkWorkerCore'".

- [ ] **Step 3: Implement chunkWorkerCore**

Create `src/systems/world3d/chunkWorkerCore.ts`:

```ts
/**
 * @file chunkWorkerCore.ts
 * The pure heart of chunk generation. Runs identically on the main thread (tests,
 * fallback) and inside a Web Worker (production). This is the seam Plan 3 extends:
 * swap buildPlaceholderHeightfield for the full terrain/river/road/prop builder.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkGeometryArrays } from './types';
import { sampleChunk } from './chunkSampler';
import { buildPlaceholderHeightfield } from './chunkGeometry';

export interface ChunkRequest {
  cx: number;
  cy: number;
  resolution: number;
}

export function handleChunkRequest(world: WorldData, req: ChunkRequest): ChunkGeometryArrays {
  const data = sampleChunk(world, req.cx, req.cy, req.resolution);
  return buildPlaceholderHeightfield(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkWorkerCore.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/chunkWorkerCore.ts src/systems/world3d/__tests__/chunkWorkerCore.test.ts
git commit -m "feat(world3d): pure chunk-request handler (worker core)"
```

---

## Task 8: ChunkStreamer State Machine

**Files:**
- Create: `src/systems/world3d/chunkStreamer.ts`
- Test: `src/systems/world3d/__tests__/chunkStreamer.test.ts`

Stateful orchestrator: holds the loaded-chunk Map, computes diffs on `update(worldX, worldZ)`, drives an injected async `ChunkLoader` (closest-first, throttled), unloads far chunks, and notifies subscribers. Fully testable with a synchronous fake loader.

- [ ] **Step 1: Write the failing test**

Create `src/systems/world3d/__tests__/chunkStreamer.test.ts`:

```ts
import { ChunkStreamer } from '../chunkStreamer';
import type { ChunkGeometryArrays, ChunkLoader } from '../types';
import { WORLD3D_CONFIG } from '../config';

// A loader that resolves immediately with trivial geometry.
const fakeGeometry = (): ChunkGeometryArrays => ({
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
});
const instantLoader: ChunkLoader = async () => fakeGeometry();

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('loads the window around the initial position', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  expect(streamer.getLoaded()).toHaveLength(9); // 3x3
});

it('unloads chunks that fall outside the unload radius after moving', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 1, maxConcurrent: 8 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  // Move far east so the original window is well outside unloadRadius.
  streamer.update(S * 20, 0);
  await streamer.whenSettled();
  const loaded = streamer.getLoaded();
  // None of the loaded chunks should be near the origin anymore.
  expect(loaded.every((c) => c.cx >= 19)).toBe(true);
});

it('does not double-load a chunk already loaded or in flight', async () => {
  let calls = 0;
  const countingLoader: ChunkLoader = async (cx, cy) => {
    calls++;
    return fakeGeometry();
  };
  const streamer = new ChunkStreamer(countingLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  streamer.update(0, 0);
  streamer.update(0, 0); // same position again before settle
  await streamer.whenSettled();
  expect(calls).toBe(9); // exactly one load per chunk, no duplicates
});

it('notifies subscribers when the loaded set changes', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  let notifications = 0;
  streamer.onChange(() => { notifications++; });
  streamer.update(0, 0);
  await streamer.whenSettled();
  expect(notifications).toBeGreaterThan(0);
});

it('tags loaded chunks with an LOD tier', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 2, unloadRadius: 3, maxConcurrent: 16 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  const center = streamer.getLoaded().find((c) => c.cx === 0 && c.cy === 0);
  expect(center?.lod).toBe('full');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/world3d/__tests__/chunkStreamer.test.ts`
Expected: FAIL with "Cannot find module '../chunkStreamer'".

- [ ] **Step 3: Implement chunkStreamer**

Create `src/systems/world3d/chunkStreamer.ts`:

```ts
/**
 * @file chunkStreamer.ts
 * Stateful sliding-window orchestrator. Holds loaded chunks, drives an injected
 * async ChunkLoader (closest-first, throttled by maxConcurrent), unloads chunks
 * beyond the unload radius, and notifies subscribers on any change.
 *
 * Pure of React — the useChunkStreaming hook (Task 10) wraps this.
 */
import type { ChunkLoader, LoadedChunk } from './types';
import { WORLD3D_CONFIG } from './config';
import { chunkKey, worldToChunk } from './coords';
import { computeChunkDiff } from './chunkManager';
import { selectLodTier } from './lod';

export interface ChunkStreamerOptions {
  loadRadius?: number;
  unloadRadius?: number;
  maxConcurrent?: number;
  resolution?: number;
}

export class ChunkStreamer {
  private loader: ChunkLoader;
  private loadRadius: number;
  private unloadRadius: number;
  private maxConcurrent: number;

  private loaded = new Map<string, LoadedChunk>();
  private pending = new Set<string>();
  private queue: Array<{ cx: number; cy: number }> = [];
  private centerCx = 0;
  private centerCy = 0;
  private listeners = new Set<() => void>();
  private settleResolvers: Array<() => void> = [];
  private disposed = false;

  constructor(loader: ChunkLoader, opts: ChunkStreamerOptions = {}) {
    this.loader = loader;
    this.loadRadius = opts.loadRadius ?? WORLD3D_CONFIG.LOAD_RADIUS;
    this.unloadRadius = opts.unloadRadius ?? WORLD3D_CONFIG.UNLOAD_RADIUS;
    this.maxConcurrent = opts.maxConcurrent ?? WORLD3D_CONFIG.MAX_CONCURRENT_LOADS;
  }

  /** Recompute the desired window for a world-space position and start loading/unloading. */
  update(worldX: number, worldZ: number): void {
    if (this.disposed) return;
    const { cx, cy } = worldToChunk(worldX, worldZ);
    this.centerCx = cx;
    this.centerCy = cy;

    const loadedKeys = new Set([...this.loaded.keys(), ...this.pending]);
    const diff = computeChunkDiff({ cx, cy }, this.loadRadius, this.unloadRadius, loadedKeys);

    // Unload.
    let changed = false;
    for (const { cx: ux, cy: uy } of diff.toUnload) {
      if (this.loaded.delete(chunkKey(ux, uy))) changed = true;
    }
    if (changed) this.notify();

    // Enqueue loads (diff.toLoad already excludes loaded + pending and is closest-first).
    this.queue.push(...diff.toLoad);
    this.pump();

    if (this.pending.size === 0 && this.queue.length === 0) this.resolveSettled();
  }

  private pump(): void {
    while (this.pending.size < this.maxConcurrent && this.queue.length > 0) {
      const { cx, cy } = this.queue.shift()!;
      const key = chunkKey(cx, cy);
      if (this.loaded.has(key) || this.pending.has(key)) continue;
      this.pending.add(key);
      this.loader(cx, cy)
        .then((geometry) => {
          this.pending.delete(key);
          if (this.disposed) return;
          // Drop results for chunks that scrolled out of range while loading.
          const dist = Math.max(Math.abs(cx - this.centerCx), Math.abs(cy - this.centerCy));
          if (dist <= this.unloadRadius) {
            this.loaded.set(key, { cx, cy, geometry, lod: selectLodTier(dist) });
            this.notify();
          }
          this.pump();
          if (this.pending.size === 0 && this.queue.length === 0) this.resolveSettled();
        })
        .catch(() => {
          this.pending.delete(key);
          this.pump();
          if (this.pending.size === 0 && this.queue.length === 0) this.resolveSettled();
        });
    }
  }

  getLoaded(): LoadedChunk[] {
    return [...this.loaded.values()];
  }

  get pendingCount(): number {
    return this.pending.size + this.queue.length;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Resolves when there are no pending or queued loads. */
  whenSettled(): Promise<void> {
    if (this.pending.size === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.settleResolvers.push(resolve));
  }

  dispose(): void {
    this.disposed = true;
    this.loaded.clear();
    this.pending.clear();
    this.queue = [];
    this.listeners.clear();
    this.resolveSettled();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private resolveSettled(): void {
    const resolvers = this.settleResolvers;
    this.settleResolvers = [];
    for (const r of resolvers) r();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/world3d/__tests__/chunkStreamer.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/world3d/chunkStreamer.ts src/systems/world3d/__tests__/chunkStreamer.test.ts
git commit -m "feat(world3d): ChunkStreamer sliding-window orchestrator"
```

---

## Task 9: Web Worker + Worker-Backed Loader (browser glue)

**Files:**
- Create: `src/components/World3D/chunkWorker.ts`
- Create: `src/components/World3D/createWorkerChunkLoader.ts`
- Test: `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`

The worker file is thin glue around `handleChunkRequest`. The loader factory wraps a single Worker, sends an `init` message with the WorldData, then maps each `load` request to a Promise keyed by chunk. Because real Web Workers can't run in jsdom/vitest, the factory accepts an **injected worker factory** so we can test the request/response correlation with a fake worker; production passes the real worker.

- [ ] **Step 1: Write the failing test**

Create `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`:

```ts
import { createWorkerChunkLoader } from '../createWorkerChunkLoader';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

const flatWorld = (cols: number, rows: number, h: number): WorldData => ({
  version: 2, seed: 1, templateId: 't',
  gridSize: { rows, cols },
  heights: new Array(cols * rows).fill(h),
  temperatures: [], moisture: [], biomeIds: [],
  rivers: [], roads: [], sites: [], coastlines: [], lakes: [], biomeZones: [],
});

/**
 * Minimal fake Worker that runs handleChunkRequest synchronously in-process and
 * posts the result back via the message event. Mirrors the real worker protocol:
 *   { type: 'init', world }   → store world
 *   { type: 'load', id, cx, cy, resolution } → reply { id, geometry }
 */
class FakeWorker {
  onmessage: ((ev: { data: any }) => void) | null = null;
  private world: WorldData | null = null;
  postMessage(msg: any) {
    if (msg.type === 'init') {
      this.world = msg.world;
      return;
    }
    if (msg.type === 'load' && this.world) {
      const geometry = handleChunkRequest(this.world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });
      // Simulate async dispatch.
      queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, geometry } }));
    }
  }
  terminate() {}
}

it('resolves a chunk load with geometry from the worker', async () => {
  const loader = createWorkerChunkLoader(flatWorld(8, 8, 25), 4, () => new FakeWorker() as unknown as Worker);
  const geo = await loader(0, 0);
  expect(geo.positions.length).toBe(4 * 4 * 3);
  expect(geo.indices.length).toBe((4 - 1) * (4 - 1) * 6);
});

it('correlates concurrent requests to the right responses', async () => {
  const loader = createWorkerChunkLoader(flatWorld(64, 8, 10), 3, () => new FakeWorker() as unknown as Worker);
  const [a, b] = await Promise.all([loader(0, 0), loader(5, 1)]);
  expect(a.positions.length).toBe(3 * 3 * 3);
  expect(b.positions.length).toBe(3 * 3 * 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`
Expected: FAIL with "Cannot find module '../createWorkerChunkLoader'".

- [ ] **Step 3: Implement the worker glue + loader factory**

Create `src/components/World3D/chunkWorker.ts`:

```ts
/**
 * @file chunkWorker.ts
 * Web Worker entry. Thin glue around handleChunkRequest — receives the WorldData
 * once via an `init` message, then answers `load` requests with geometry arrays.
 *
 * Not unit-tested directly (no Worker in jsdom). The logic it runs is covered by
 * chunkWorkerCore.test.ts; the messaging protocol is covered by the fake-worker
 * test in createWorkerChunkLoader.test.ts.
 */
/// <reference lib="webworker" />
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

let world: WorldData | null = null;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    world = msg.world as WorldData;
    return;
  }
  if (msg.type === 'load' && world) {
    const geometry = handleChunkRequest(world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });
    // Transfer the underlying buffers to avoid a copy.
    (self as unknown as Worker).postMessage(
      { id: msg.id, geometry },
      [geometry.positions.buffer, geometry.indices.buffer, geometry.normals.buffer],
    );
  }
};
```

Create `src/components/World3D/createWorkerChunkLoader.ts`:

```ts
/**
 * @file createWorkerChunkLoader.ts
 * Build a ChunkLoader backed by a single Web Worker. The worker is initialized
 * once with the WorldData; each load() call sends a request tagged with a unique
 * id and resolves when the matching response arrives.
 *
 * The workerFactory parameter is injected so tests can substitute a fake worker
 * (real Workers don't run under jsdom). Production callers omit it and get the
 * bundled chunkWorker via Vite's `new URL(..., import.meta.url)` form.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkGeometryArrays, ChunkLoader } from '@/systems/world3d/types';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';

type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' });

export function createWorkerChunkLoader(
  world: WorldData,
  resolution: number = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): ChunkLoader {
  const worker = workerFactory();
  worker.postMessage({ type: 'init', world });

  let nextId = 1;
  const pending = new Map<number, (geo: ChunkGeometryArrays) => void>();

  worker.onmessage = (ev: MessageEvent) => {
    const { id, geometry } = ev.data as { id: number; geometry: ChunkGeometryArrays };
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve(geometry);
    }
  };

  return (cx: number, cy: number): Promise<ChunkGeometryArrays> =>
    new Promise<ChunkGeometryArrays>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      worker.postMessage({ type: 'load', id, cx, cy, resolution });
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/createWorkerChunkLoader.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/World3D/chunkWorker.ts src/components/World3D/createWorkerChunkLoader.ts src/components/World3D/__tests__/createWorkerChunkLoader.test.ts
git commit -m "feat(world3d): web worker + worker-backed chunk loader"
```

---

## Task 10: useChunkStreaming Hook

**Files:**
- Create: `src/components/World3D/useChunkStreaming.ts`
- Test: `src/components/World3D/__tests__/useChunkStreaming.test.tsx`

A thin hook: owns a `ChunkStreamer` for the lifetime of the component, subscribes to its changes via `useSyncExternalStore`, and exposes `loaded` + an `update(x, z)` callback. The streamer is created from an injected loader so the hook is testable without a worker.

- [ ] **Step 1: Write the failing test**

Create `src/components/World3D/__tests__/useChunkStreaming.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChunkStreaming } from '../useChunkStreaming';
import type { ChunkGeometryArrays, ChunkLoader } from '@/systems/world3d/types';

const fakeGeo = (): ChunkGeometryArrays => ({
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
});
const loader: ChunkLoader = async () => fakeGeo();

it('exposes loaded chunks after an update', async () => {
  const { result } = renderHook(() => useChunkStreaming(loader, { loadRadius: 1, unloadRadius: 2 }));
  expect(result.current.loaded).toHaveLength(0);
  act(() => { result.current.update(0, 0); });
  await waitFor(() => expect(result.current.loaded.length).toBe(9));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/useChunkStreaming.test.tsx`
Expected: FAIL with "Cannot find module '../useChunkStreaming'".

- [ ] **Step 3: Implement the hook**

Create `src/components/World3D/useChunkStreaming.ts`:

```ts
/**
 * @file useChunkStreaming.ts
 * React binding for ChunkStreamer. Creates one streamer per mount, re-renders
 * when its loaded set changes (via useSyncExternalStore), and exposes update().
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ChunkStreamer, type ChunkStreamerOptions } from '@/systems/world3d/chunkStreamer';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';

export interface UseChunkStreamingResult {
  loaded: LoadedChunk[];
  update: (worldX: number, worldZ: number) => void;
  pendingCount: number;
}

export function useChunkStreaming(
  loader: ChunkLoader,
  options?: ChunkStreamerOptions,
): UseChunkStreamingResult {
  // One streamer for the component's lifetime. loader/options changes are ignored
  // after mount (callers should keep them stable; remount to reconfigure).
  const streamer = useMemo(() => new ChunkStreamer(loader, options), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => streamer.dispose(), [streamer]);

  // Cache the snapshot so getSnapshot returns a stable reference between changes
  // (useSyncExternalStore requires referential stability when nothing changed).
  const snapshotRef = useRef<LoadedChunk[]>([]);
  const subscribe = useCallback((cb: () => void) => streamer.onChange(cb), [streamer]);
  const getSnapshot = useCallback(() => {
    const next = streamer.getLoaded();
    snapshotRef.current = next;
    return snapshotRef.current;
  }, [streamer]);

  // We rebuild the snapshot on each notify; onChange fires on every set/delete.
  const loaded = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const update = useCallback((worldX: number, worldZ: number) => streamer.update(worldX, worldZ), [streamer]);

  return { loaded, update, pendingCount: streamer.pendingCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/useChunkStreaming.test.tsx`
Expected: PASS, 1 test.

If the test flakes on snapshot identity (React warns "getSnapshot should be cached"), it indicates `getLoaded()` returns a new array each call — that's expected here because `onChange` only fires on actual changes, so React re-reads only when notified. If a warning appears, it's non-fatal for the test; leave the implementation as-is.

- [ ] **Step 5: Commit**

```bash
git add src/components/World3D/useChunkStreaming.ts src/components/World3D/__tests__/useChunkStreaming.test.tsx
git commit -m "feat(world3d): useChunkStreaming React hook"
```

---

## Task 11: Free-Roam Camera Controller (browser shell)

**Files:**
- Create: `src/components/World3D/FreeRoamCameraController.tsx`

A drei `MapControls`-based camera with no character snapping and no distance clamp suited to a walkable world. Each frame it reports the controls' target world position via an `onPositionChange` callback (throttled to ~10 Hz) so the scene can drive chunk streaming. Adapted from `src/components/BattleMap/camera/CameraController.tsx` (which is character-centric). No unit test — verified by the scene smoke test in Task 12.

- [ ] **Step 1: Implement the component**

Create `src/components/World3D/FreeRoamCameraController.tsx`:

```tsx
/**
 * @file FreeRoamCameraController.tsx
 * Free-roam orbit/pan camera for the streamed 3D world. Reports its look-at
 * world position to the parent (throttled) so chunk streaming can follow it.
 *
 * Adapted from src/components/BattleMap/camera/CameraController.tsx, stripped of
 * character snapping / cinematic modes which don't apply to free exploration.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';

interface FreeRoamCameraControllerProps {
  /** Initial look-at target in world space. */
  initialTarget: readonly [number, number, number];
  /** Called (throttled) with the controls' current target world position. */
  onPositionChange: (worldX: number, worldZ: number) => void;
}

const REPORT_INTERVAL = 0.1; // seconds (~10 Hz)

const FreeRoamCameraController: React.FC<FreeRoamCameraControllerProps> = ({
  initialTarget,
  onPositionChange,
}) => {
  const controlsRef = useRef<any>(null);
  const sinceReport = useRef(0);
  const lastReported = useRef(new THREE.Vector2(NaN, NaN));

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls?.target) return;
    sinceReport.current += delta;
    if (sinceReport.current < REPORT_INTERVAL) return;
    sinceReport.current = 0;
    const t = controls.target as THREE.Vector3;
    if (lastReported.current.x !== t.x || lastReported.current.y !== t.z) {
      lastReported.current.set(t.x, t.z);
      onPositionChange(t.x, t.z);
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      target={[initialTarget[0], initialTarget[1], initialTarget[2]]}
      minDistance={20}
      maxDistance={400}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.48}
      enableDamping
      dampingFactor={0.08}
    />
  );
};

export default FreeRoamCameraController;
```

- [ ] **Step 2: Type-check the component compiles**

Run: `npx tsc --noEmit 2>&1 | grep "FreeRoamCameraController" || echo "no errors in FreeRoamCameraController"`
Expected: `no errors in FreeRoamCameraController`.

- [ ] **Step 3: Commit**

```bash
git add src/components/World3D/FreeRoamCameraController.tsx
git commit -m "feat(world3d): free-roam camera controller reporting world position"
```

---

## Task 12: World3DScene Shell + Demo Host

**Files:**
- Create: `src/components/World3D/World3DScene.tsx`
- Create: `src/components/World3D/World3DDemo.tsx`
- Modify: `src/App.tsx` (add `?phase=world3d` lazy branch)

The scene mounts a `<Canvas>`, the free-roam camera, lighting, and a mesh per loaded chunk built from its geometry arrays and positioned at `chunkOriginWorld`. The demo generates a small world via `runWorldSim` and feeds an inline (main-thread) loader so it runs without worker plumbing complexity in the demo; the worker-backed loader from Task 9 is wired in production scenes later (Plan 3/4). No unit test — manual browser smoke + build check.

- [ ] **Step 1: Implement World3DScene**

Create `src/components/World3D/World3DScene.tsx`:

```tsx
/**
 * @file World3DScene.tsx
 * Thin R3F shell for the streamed 3D world. Renders one mesh per loaded chunk
 * from the streamer's geometry arrays. Placeholder material — Plan 3 adds real
 * terrain texturing, water, roads, and props.
 */
import React, { useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import FreeRoamCameraController from './FreeRoamCameraController';
import { useChunkStreaming } from './useChunkStreaming';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';

interface World3DSceneProps {
  loader: ChunkLoader;
  /** World-space position to center streaming on at mount. */
  start: readonly [number, number, number];
}

const LOD_COLOR: Record<string, string> = {
  full: '#5a7a4a',
  mid: '#4a6a44',
  low: '#3a5038',
  culled: '#2a3a2a',
};

const ChunkMesh: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(chunk.geometry.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(chunk.geometry.normals, 3));
    g.setIndex(new THREE.BufferAttribute(chunk.geometry.indices, 1));
    return g;
  }, [chunk.geometry]);

  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]} receiveShadow>
      <meshStandardMaterial color={LOD_COLOR[chunk.lod] ?? '#5a7a4a'} flatShading />
    </mesh>
  );
};

const World3DScene: React.FC<World3DSceneProps> = ({ loader, start }) => {
  const { loaded, update } = useChunkStreaming(loader);

  // Kick off the first window once.
  React.useEffect(() => {
    update(start[0], start[2]);
  }, [update, start]);

  const onPositionChange = useCallback((x: number, z: number) => update(x, z), [update]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas shadows camera={{ fov: 55, near: 1, far: 2000, position: [start[0] + 120, 160, start[2] + 120] }}>
        <hemisphereLight args={[0x88bbff, 0x556644, 0.9]} />
        <directionalLight position={[200, 300, 100]} intensity={1.6} castShadow />
        <fog attach="fog" args={[0x9fb8d0, 300, 1200]} />
        <FreeRoamCameraController initialTarget={start} onPositionChange={onPositionChange} />
        {loaded.map((c) => (
          <ChunkMesh key={`${c.cx}|${c.cy}`} chunk={c} />
        ))}
      </Canvas>
    </div>
  );
};

export default World3DScene;
```

- [ ] **Step 2: Implement World3DDemo**

Create `src/components/World3D/World3DDemo.tsx`:

```tsx
/**
 * @file World3DDemo.tsx
 * Self-contained host for the streamed 3D world. Generates a deterministic world
 * via runWorldSim and feeds World3DScene an inline (main-thread) chunk loader.
 *
 * Mounted via ?phase=world3d (see App.tsx). Production scenes (Plan 4) will use the
 * worker-backed loader and the player's real world position instead of this demo.
 */
import React, { useMemo } from 'react';
import World3DScene from './World3DScene';
import { runWorldSim } from '@/services/worldSim';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';

const DEMO_COLS = 60;
const DEMO_ROWS = 40;
const DEMO_SEED = 2026;

const World3DDemo: React.FC = () => {
  const { loader, start } = useMemo(() => {
    const cells = DEMO_COLS * DEMO_ROWS;
    const heights: number[] = [];
    for (let i = 0; i < cells; i++) {
      const v = Math.sin(i * 0.13) * 30 + Math.cos(i * 0.21) * 20 + 40;
      heights.push(Math.max(0, Math.min(100, Math.round(v))));
    }
    const world = runWorldSim({
      seed: DEMO_SEED,
      templateId: 'continents',
      cols: DEMO_COLS,
      rows: DEMO_ROWS,
      heights,
      temperatures: new Array(cells).fill(15),
      moisture: new Array(cells).fill(25),
      biomeIds: new Array(cells).fill('plains'),
    });
    const inlineLoader: ChunkLoader = async (cx, cy) =>
      handleChunkRequest(world, { cx, cy, resolution: WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION });
    // Start the camera near the middle of the world (in meters).
    const midX = (DEMO_COLS / 2) * WORLD3D_CONFIG.METERS_PER_CELL;
    const midZ = (DEMO_ROWS / 2) * WORLD3D_CONFIG.METERS_PER_CELL;
    return { loader: inlineLoader, start: [midX, 0, midZ] as const };
  }, []);

  return <World3DScene loader={loader} start={start} />;
};

export default World3DDemo;
```

- [ ] **Step 3: Wire the demo into App.tsx**

Open `src/App.tsx`. Find where the existing `?phase=combat` branch lazy-loads `BattleMapDemo` (search for `phase` and `BattleMapDemo`). Mirror that pattern. Near the other `React.lazy` imports add:

```tsx
const World3DDemo = React.lazy(() => import('./components/World3D/World3DDemo'));
```

Then in the same place the combat phase is checked (a URL param read like `new URLSearchParams(window.location.search).get('phase')`), add a branch that returns `<World3DDemo />` (wrapped in the same `<Suspense fallback={...}>` the combat demo uses) when `phase === 'world3d'`.

If the combat demo is mounted with a specific Suspense wrapper, copy it exactly, substituting `World3DDemo`. The goal: visiting `?phase=world3d` renders the streamed world the same way `?phase=combat` renders the battle map.

- [ ] **Step 4: Verify the build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "World3D|world3d" || echo "no World3D type errors"`
Expected: `no World3D type errors`.

Then verify Vite can build the worker + scene (catches the `new URL(..., import.meta.url)` worker resolution):

Run: `npm run build 2>&1 | tail -20`
Expected: build completes. (Note: the repo has a known pre-existing build failure on `dev_hub.html` per project memory — if that is the ONLY error, it is unrelated to this task. Any error mentioning `World3D`, `chunkWorker`, or `world3d` IS your responsibility.)

- [ ] **Step 5: Manual browser smoke (record result)**

Run the dev server: `npm run dev`
Open `http://localhost:3000/Aralia/?phase=world3d` (match the base path the combat demo uses — check the URL the project serves).

Verify:
- A 3D terrain of flat-shaded green chunks renders.
- Dragging to pan the camera causes new chunks to appear at the leading edge and disappear behind (watch the chunk count stabilize, not grow unbounded).
- The browser console shows no errors referencing `world3d`, `chunkWorker`, or WebGL context loss.

Record the outcome in the commit message. If chunks don't stream on camera move, the `onPositionChange` → `update` wiring is the first place to look.

- [ ] **Step 6: Commit**

```bash
git add src/components/World3D/World3DScene.tsx src/components/World3D/World3DDemo.tsx src/App.tsx
git commit -m "feat(world3d): World3DScene shell + demo host wired to ?phase=world3d"
```

---

## Task 13: Streaming Integration + Performance Smoke Test

**Files:**
- Create: `src/systems/world3d/__tests__/integration.test.ts`

End-to-end test of the pure streaming pipeline (config → coords → diff → sample → geometry → streamer) with an inline loader, plus a soft performance budget for streaming a realistic window.

- [ ] **Step 1: Write the test**

Create `src/systems/world3d/__tests__/integration.test.ts`:

```ts
import { ChunkStreamer } from '../chunkStreamer';
import { handleChunkRequest } from '../chunkWorkerCore';
import { WORLD3D_CONFIG } from '../config';
import type { ChunkLoader } from '../types';
import type { WorldData } from '@/services/worldSim/types';

const buildWorld = (): WorldData => {
  const cols = 60;
  const rows = 40;
  const cells = cols * rows;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    heights.push(Math.max(0, Math.min(100, Math.round(Math.sin(i * 0.13) * 30 + 40))));
  }
  return {
    version: 2, seed: 1, templateId: 'continents',
    gridSize: { rows, cols },
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: new Array(cells).fill('plains'),
    rivers: [], roads: [], sites: [], coastlines: [], lakes: [], biomeZones: [],
  };
};

const inlineLoader = (world: WorldData): ChunkLoader => async (cx, cy) =>
  handleChunkRequest(world, { cx, cy, resolution: WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION });

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('streams a full window of well-formed chunk geometry', async () => {
  const world = buildWorld();
  const streamer = new ChunkStreamer(inlineLoader(world), { loadRadius: 4, unloadRadius: 6, maxConcurrent: 8 });
  streamer.update(S * 200, S * 100); // somewhere inside the world
  await streamer.whenSettled();

  const loaded = streamer.getLoaded();
  expect(loaded.length).toBe(9 * 9); // (2*4+1)^2
  for (const c of loaded) {
    const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
    expect(c.geometry.positions.length).toBe(res * res * 3);
    expect(c.geometry.indices.length).toBe((res - 1) * (res - 1) * 6);
    // No NaN in positions.
    for (const v of c.geometry.positions) expect(Number.isFinite(v)).toBe(true);
  }
});

it('streams the window within the soft performance budget', async () => {
  const world = buildWorld();
  const streamer = new ChunkStreamer(inlineLoader(world), { loadRadius: 4, unloadRadius: 6, maxConcurrent: 8 });
  const startMs = performance.now();
  streamer.update(S * 200, S * 100);
  await streamer.whenSettled();
  const elapsed = performance.now() - startMs;
  expect(elapsed).toBeLessThan(2000); // 81 placeholder chunks well under 2s on the main thread
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/systems/world3d/__tests__/integration.test.ts`
Expected: PASS, 2 tests.

If the perf test exceeds 2000ms, that's a real signal — report it (the placeholder geometry is cheap, so a failure means something is accidentally quadratic). Do not relax the budget.

- [ ] **Step 3: Run the full world3d suite for a regression sweep**

Run: `npx vitest run src/systems/world3d src/components/World3D`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/systems/world3d/__tests__/integration.test.ts
git commit -m "test(world3d): streaming pipeline integration + perf smoke"
```

---

## Final Verification

- [ ] **Run all tests touched by this plan**

```bash
npx vitest run src/systems/world3d src/components/World3D
```

Expected: all PASS.

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: only pre-existing unrelated errors (`CharacterActor.tsx`, `characterUtils.ts`, `OpportunityAttackSystem.test.ts`). No new errors from `world3d` / `World3D`.

- [ ] **Confirm the demo runs** (if not already done in Task 12): `npm run dev`, open `?phase=world3d`, pan the camera, confirm chunks stream and the console is clean.

---

## What This Plan Does NOT Do

Deferred to later plans (see spec §13):

- Real terrain texturing, water meshes from river polylines, road meshes, site/building exteriors, vegetation — **Plan 3** (extends `chunkSampler` to collect rivers/roads/sites, and replaces `buildPlaceholderHeightfield` behind the `handleChunkRequest` seam).
- 2D↔3D transition animation, bidirectional Azgaar marker sync, `playerWorldPos` in game state, submap deletion, grid-mode removal — **Plan 4**.
- Per-LOD geometry detail (currently LOD only tints color) — Plan 3.
- Per-chunk persistence / chunk deltas (kills, loot) — later.

When this plan lands, you can open `?phase=world3d` and free-roam a massive procedural terrain that streams chunks in and out around the camera, with every streaming decision (load/unload window, LOD, WorldData sampling, geometry) covered by unit tests.
```
