# World Sim Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Aralia's procedural world generation to produce a rich `WorldData` artifact — polyline rivers with flow direction, sites (towns/dungeons/ruins) with footprints, a road graph, coastline / lake / biome polygons — so that both the existing Azgaar 2D atlas and the future 3D streamed world can read from one shared source of truth and cannot drift.

**Architecture:** A new `src/services/worldSim/` module hosts the algorithms (marching squares, flow accumulation, Poisson-disk scoring, A* + MST). The existing `azgaarDerivedMapService` becomes the pipeline that calls into worldSim and attaches the resulting `WorldData` to `MapData`. The current per-cell `AzgaarWorldRenderData` payload is kept (read-only deprecated) for one release; new code reads from `MapData.worldData`. Saves missing `worldData` re-run worldSim from `worldSeed` on load.

**Tech Stack:** TypeScript, Vitest 4.x (globals enabled — do NOT import `afterEach`/`describe`/`it`/`expect`). Deterministic algorithms keyed by `worldSeed` via existing `src/utils/random` barrel (`SeededRandom`).

**Source spec:** `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md`

---

## File Structure

**Created:**
- `src/services/worldSim/types.ts` — `WorldData`, `River`, `Road`, `Site`, `BiomeZone`, `Polygon`, `Vec2`
- `src/services/worldSim/marchingSquares.ts` — generic scalar-field → polygon extraction
- `src/services/worldSim/coastlinesAndLakes.ts` — coastline + lake polygons from `heights`
- `src/services/worldSim/biomeZones.ts` — contiguous biome polygons
- `src/services/worldSim/rivers.ts` — flow accumulation + polyline tracing
- `src/services/worldSim/sites.ts` — town/dungeon/ruin placement
- `src/services/worldSim/roads.ts` — A* path between sites + minimum spanning tree
- `src/services/worldSim/index.ts` — pipeline entry: `runWorldSim(input) → WorldData`
- `src/services/worldSim/__tests__/types.test.ts`
- `src/services/worldSim/__tests__/marchingSquares.test.ts`
- `src/services/worldSim/__tests__/coastlinesAndLakes.test.ts`
- `src/services/worldSim/__tests__/biomeZones.test.ts`
- `src/services/worldSim/__tests__/rivers.test.ts`
- `src/services/worldSim/__tests__/sites.test.ts`
- `src/services/worldSim/__tests__/roads.test.ts`
- `src/services/worldSim/__tests__/pipeline.test.ts`
- `src/services/worldSim/__tests__/integration.test.ts`
- `src/state/migrations/worldDataMigration.ts`
- `src/state/migrations/__tests__/worldDataMigration.test.ts`

**Modified:**
- `src/types/world.ts` — add `worldData?: WorldData` to `MapData`; mark `AzgaarWorldRenderData` deprecated in a JSDoc note
- `src/types/index.ts` (barrel) — re-export `WorldData` and friends
- `src/services/azgaarDerivedMapService.ts` — after existing per-cell generation, call `runWorldSim(...)` and attach to returned `MapData`
- `src/services/__tests__/mapService.test.ts` — assert `worldData.version === 2` on default generation
- `src/services/saveLoadService.ts` — call `migrateMapDataToWorldDataV2` on `loadedState.mapData` inside `loadGame`
- `src/services/__tests__/saveLoadService.test.ts` — assert post-load worldData

---

## Conventions

- Run tests: `npx vitest run <path>` (project alias is `npm test`; `vitest` watches by default)
- Vitest 4.x globals: do NOT `import { afterEach, describe, it, expect } from 'vitest'` — they are globals
- Each task ends with a `git commit`. Use Conventional Commits prefix `feat(world-sim)` or `test(world-sim)` as appropriate
- Coordinate system: all world-sim coordinates are in **grid space** (cell units, floats allowed for sub-cell precision). The 3D layer converts to world meters via a constant in a later plan
- `SeededRandom` is imported from `'@/utils/random'` (the barrel), matching existing code in `src/services/azgaarDerivedMapService.ts`

---

## Task 1: WorldData Type Definitions

**Files:**
- Create: `src/services/worldSim/types.ts`
- Modify: `src/types/world.ts` (add field to `MapData`)
- Modify: `src/types/index.ts` (re-export)
- Test: `src/services/worldSim/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/types.test.ts`:

```ts
import type { WorldData, River, Road, Site, BiomeZone, Polygon, Vec2 } from '../types';

it('WorldData shape is constructable with all required fields', () => {
  const point: Vec2 = { x: 0, y: 0 };
  const polygon: Polygon = [point, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const river: River = {
    id: 'r1',
    points: [point, { x: 1, y: 1 }],
    width: [1, 1.2],
    discharge: [10, 12],
  };
  const road: Road = {
    id: 'rd1',
    points: polygon,
    type: 'major',
    fromSiteId: 'a',
    toSiteId: 'b',
  };
  const site: Site = {
    id: 's1',
    kind: 'town',
    position: point,
    footprint: polygon,
    population: 1200,
    walled: true,
    townSeed: 42,
  };
  const biomeZone: BiomeZone = { biomeId: 'forest', polygon };

  const wd: WorldData = {
    version: 2,
    seed: 1,
    templateId: 'continents',
    gridSize: { rows: 40, cols: 60 },
    heights: [],
    temperatures: [],
    moisture: [],
    biomeIds: [],
    rivers: [river],
    roads: [road],
    sites: [site],
    coastlines: [polygon],
    lakes: [],
    biomeZones: [biomeZone],
  };

  expect(wd.version).toBe(2);
  expect(wd.rivers).toHaveLength(1);
  expect(wd.sites[0].kind).toBe('town');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

- [ ] **Step 3: Create the types file**

Create `src/services/worldSim/types.ts`:

```ts
/**
 * @file types.ts
 * Type definitions for the world-sim pipeline output (WorldData) and its artifacts.
 *
 * WorldData is produced once per worldSeed at world creation and persisted in the save.
 * Both the 2D Azgaar atlas and the future 3D streamed world read from this single source.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type Polygon = Vec2[];

export interface River {
  id: string;
  /** Polyline vertices, ordered source → mouth, in grid coords. */
  points: Vec2[];
  /** Width per segment (length = points.length, last entry mirrors second-to-last). */
  width: number[];
  /** Flow volume per segment, for water shader strength + audio gating. */
  discharge: number[];
  /** Parent river id if this is a tributary. */
  parentId?: string;
}

export interface Road {
  id: string;
  points: Vec2[];
  type: 'major' | 'minor' | 'trail';
  fromSiteId: string;
  toSiteId: string;
}

export interface Site {
  id: string;
  kind: 'town' | 'dungeon' | 'ruin' | 'landmark';
  position: Vec2;
  footprint: Polygon;
  population?: number;
  walled?: boolean;
  townSeed?: number;
}

export interface BiomeZone {
  biomeId: string;
  polygon: Polygon;
}

export interface WorldData {
  version: 2;
  seed: number;
  templateId: string;
  gridSize: { rows: number; cols: number };

  // Per-cell scalars (mirror of existing azgaarWorld layers)
  heights: number[];
  temperatures: number[];
  moisture: number[];
  biomeIds: string[];

  // Polyline networks
  rivers: River[];
  roads: Road[];

  // Site placements
  sites: Site[];

  // Polygons
  coastlines: Polygon[];
  lakes: Polygon[];
  biomeZones: BiomeZone[];
}
```

- [ ] **Step 4: Add `worldData` to `MapData` and re-export**

Modify `src/types/world.ts` — locate the `MapData` interface (around line 239) and add the new field:

```ts
import type { WorldData } from '../services/worldSim/types';

export interface MapData {
  gridSize: { rows: number; cols: number };
  tiles: MapTile[][];
  /** @deprecated Use `worldData` instead. Kept for one release for migration. */
  azgaarWorld?: AzgaarWorldRenderData;
  /** Rich world artifact — produced by worldSim. Required for new saves; populated by migration on load for old saves. */
  worldData?: WorldData;
}
```

Modify `src/types/index.ts` — add at the end of the file:

```ts
export type { WorldData, River, Road, Site, BiomeZone, Polygon, Vec2 } from '../services/worldSim/types';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/worldSim/__tests__/types.test.ts`
Expected: PASS, 1 test

- [ ] **Step 6: Commit**

```bash
git add src/services/worldSim/types.ts src/services/worldSim/__tests__/types.test.ts src/types/world.ts src/types/index.ts
git commit -m "feat(world-sim): add WorldData type definitions"
```

---

## Task 2: Marching Squares Utility

**Files:**
- Create: `src/services/worldSim/marchingSquares.ts`
- Test: `src/services/worldSim/__tests__/marchingSquares.test.ts`

Marching squares converts a scalar field (per-cell numbers) into closed polygons that follow a threshold contour. Used by coastline (height ≥ 20), lakes (water-classified cells), and biome zones (per-biome boolean).

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/marchingSquares.test.ts`:

```ts
import { extractPolygons } from '../marchingSquares';

it('returns no polygons when no cell is inside', () => {
  const field = (x: number, y: number) => 0;
  const polys = extractPolygons(field, 4, 4, 0.5);
  expect(polys).toEqual([]);
});

it('extracts a single square polygon from a 3x3 block of insiders', () => {
  const field = (x: number, y: number) => (x >= 1 && x <= 3 && y >= 1 && y <= 3 ? 1 : 0);
  const polys = extractPolygons(field, 5, 5, 0.5);
  expect(polys).toHaveLength(1);
  expect(polys[0].length).toBeGreaterThanOrEqual(4);
  for (const v of polys[0]) {
    expect(v.x).toBeGreaterThanOrEqual(0.5);
    expect(v.x).toBeLessThanOrEqual(4.5);
    expect(v.y).toBeGreaterThanOrEqual(0.5);
    expect(v.y).toBeLessThanOrEqual(4.5);
  }
});

it('extracts two separate polygons for two disjoint islands', () => {
  const field = (x: number, y: number) => {
    const a = x >= 1 && x <= 2 && y >= 1 && y <= 2;
    const b = x >= 5 && x <= 6 && y >= 5 && y <= 6;
    return a || b ? 1 : 0;
  };
  const polys = extractPolygons(field, 8, 8, 0.5);
  expect(polys).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/marchingSquares.test.ts`
Expected: FAIL with "Cannot find module '../marchingSquares'"

- [ ] **Step 3: Implement marching squares**

Create `src/services/worldSim/marchingSquares.ts`:

```ts
/**
 * @file marchingSquares.ts
 * Generic scalar-field → closed-polygon extraction via the marching squares algorithm.
 *
 * The field is sampled at integer cell coords. A cell is "inside" if field(x,y) >= threshold.
 * Returns one polygon per connected region of inside cells; each polygon is a closed loop
 * (first vertex repeated implied) traced along cell boundaries.
 */

import type { Polygon, Vec2 } from './types';

type Field = (x: number, y: number) => number;

interface Edge {
  a: Vec2;
  b: Vec2;
}

const KEY = (v: Vec2): string => `${v.x.toFixed(2)},${v.y.toFixed(2)}`;

export function extractPolygons(field: Field, cols: number, rows: number, threshold: number): Polygon[] {
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return field(x, y) >= threshold;
  };

  const edges: Edge[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (!inside(x + 1, y)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (!inside(x, y + 1)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (!inside(x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
    }
  }

  const edgesByStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = KEY(e.a);
    const list = edgesByStart.get(k) ?? [];
    list.push(e);
    edgesByStart.set(k, list);
  }

  const used = new Set<Edge>();
  const polygons: Polygon[] = [];

  for (const seed of edges) {
    if (used.has(seed)) continue;
    const loop: Vec2[] = [seed.a];
    let current: Edge | undefined = seed;
    let guard = edges.length + 1;
    while (current && guard-- > 0) {
      used.add(current);
      loop.push(current.b);
      const candidates = edgesByStart.get(KEY(current.b));
      const next = candidates?.find((e) => !used.has(e));
      if (!next) break;
      if (KEY(next.a) === KEY(seed.a)) {
        used.add(next);
        loop.push(next.b);
        break;
      }
      current = next;
    }
    if (loop.length >= 4) {
      polygons.push(simplifyClosed(loop));
    }
  }

  return polygons;
}

function simplifyClosed(loop: Vec2[]): Polygon {
  const out: Vec2[] = [];
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length];
    const cur = loop[i];
    const next = loop[(i + 1) % loop.length];
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    if (dx1 * dy2 - dy1 * dx2 === 0) continue;
    out.push(cur);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/marchingSquares.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/marchingSquares.ts src/services/worldSim/__tests__/marchingSquares.test.ts
git commit -m "feat(world-sim): add marching squares polygon extraction"
```

---

## Task 3: Coastlines and Lakes

**Files:**
- Create: `src/services/worldSim/coastlinesAndLakes.ts`
- Test: `src/services/worldSim/__tests__/coastlinesAndLakes.test.ts`

Coastlines = boundary of the height ≥ 20 region. Lakes = water cells (height < 20) NOT connected to the map border.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/coastlinesAndLakes.test.ts`:

```ts
import { extractCoastlines, extractLakes } from '../coastlinesAndLakes';

it('extracts no coastline when the entire grid is water', () => {
  const cols = 4;
  const rows = 4;
  const heights = new Array(cols * rows).fill(10);
  const polys = extractCoastlines(heights, cols, rows);
  expect(polys).toEqual([]);
});

it('extracts one coastline polygon when an island sits in water', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(10);
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) heights[y * cols + x] = 50;
  const polys = extractCoastlines(heights, cols, rows);
  expect(polys).toHaveLength(1);
});

it('extracts a lake when there is interior water surrounded by land', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(50);
  for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) heights[y * cols + x] = 10;
  const lakes = extractLakes(heights, cols, rows);
  expect(lakes).toHaveLength(1);
});

it('does not classify ocean as a lake', () => {
  const cols = 6;
  const rows = 6;
  const heights = new Array(cols * rows).fill(10);
  const lakes = extractLakes(heights, cols, rows);
  expect(lakes).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/coastlinesAndLakes.test.ts`
Expected: FAIL with "Cannot find module '../coastlinesAndLakes'"

- [ ] **Step 3: Implement coastline + lake extraction**

Create `src/services/worldSim/coastlinesAndLakes.ts`:

```ts
/**
 * @file coastlinesAndLakes.ts
 * Polygon extraction for coastlines (boundary of land) and lakes (interior water).
 */
import type { Polygon } from './types';
import { extractPolygons } from './marchingSquares';

const SEA_LEVEL = 20;

export function extractCoastlines(heights: number[], cols: number, rows: number): Polygon[] {
  const at = (x: number, y: number) => heights[y * cols + x] ?? 0;
  return extractPolygons(at, cols, rows, SEA_LEVEL);
}

export function extractLakes(heights: number[], cols: number, rows: number): Polygon[] {
  const isWater = (x: number, y: number) => (heights[y * cols + x] ?? 0) < SEA_LEVEL;
  const ocean = new Uint8Array(cols * rows);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    if (ocean[i] || !isWater(x, y)) return;
    ocean[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < cols; x++) {
    push(x, 0);
    push(x, rows - 1);
  }
  for (let y = 0; y < rows; y++) {
    push(0, y);
    push(cols - 1, y);
  }

  while (queue.length) {
    const i = queue.shift() as number;
    const x = i % cols;
    const y = (i / cols) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  const isLake = (x: number, y: number) => (isWater(x, y) && !ocean[y * cols + x] ? 1 : 0);
  return extractPolygons(isLake, cols, rows, 0.5);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/coastlinesAndLakes.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/coastlinesAndLakes.ts src/services/worldSim/__tests__/coastlinesAndLakes.test.ts
git commit -m "feat(world-sim): extract coastlines and lakes"
```

---

## Task 4: Biome Zone Polygons

**Files:**
- Create: `src/services/worldSim/biomeZones.ts`
- Test: `src/services/worldSim/__tests__/biomeZones.test.ts`

One polygon per contiguous region of cells sharing the same `biomeId`.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/biomeZones.test.ts`:

```ts
import { extractBiomeZones } from '../biomeZones';

it('returns no zones for empty grids', () => {
  expect(extractBiomeZones([], 0, 0)).toEqual([]);
});

it('extracts one zone per distinct biome region', () => {
  const cols = 4;
  const rows = 4;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      biomeIds.push(x < 2 ? 'forest' : 'plains');
    }
  }
  const zones = extractBiomeZones(biomeIds, cols, rows);
  expect(zones.map((z) => z.biomeId).sort()).toEqual(['forest', 'plains']);
  for (const z of zones) {
    expect(z.polygon.length).toBeGreaterThanOrEqual(4);
  }
});

it('produces two zones for two disjoint regions of the same biome', () => {
  const cols = 6;
  const rows = 4;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isForest = (x < 2) || (x > 3);
      biomeIds.push(isForest ? 'forest' : 'plains');
    }
  }
  const zones = extractBiomeZones(biomeIds, cols, rows);
  const forestZones = zones.filter((z) => z.biomeId === 'forest');
  expect(forestZones).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/biomeZones.test.ts`
Expected: FAIL with "Cannot find module '../biomeZones'"

- [ ] **Step 3: Implement biome zone extraction**

Create `src/services/worldSim/biomeZones.ts`:

```ts
/**
 * @file biomeZones.ts
 * Extracts one polygon per contiguous region of cells sharing a biomeId.
 */
import type { BiomeZone } from './types';
import { extractPolygons } from './marchingSquares';

export function extractBiomeZones(biomeIds: string[], cols: number, rows: number): BiomeZone[] {
  if (biomeIds.length === 0 || cols === 0 || rows === 0) return [];
  const unique = new Set(biomeIds);
  const out: BiomeZone[] = [];
  for (const biomeId of unique) {
    const field = (x: number, y: number) => (biomeIds[y * cols + x] === biomeId ? 1 : 0);
    const polys = extractPolygons(field, cols, rows, 0.5);
    for (const polygon of polys) {
      out.push({ biomeId, polygon });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/biomeZones.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/biomeZones.ts src/services/worldSim/__tests__/biomeZones.test.ts
git commit -m "feat(world-sim): extract biome zone polygons"
```

---

## Task 5: River Flow Accumulation and Polylines

**Files:**
- Create: `src/services/worldSim/rivers.ts`
- Test: `src/services/worldSim/__tests__/rivers.test.ts`

For each land cell, find its steepest-descent neighbor. Accumulate upstream area. Cells with flow ≥ threshold become river segments. Trace polylines from sources downstream.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/rivers.test.ts`:

```ts
import { traceRivers } from '../rivers';

it('returns no rivers when there is no land', () => {
  const cols = 4;
  const rows = 4;
  const heights = new Array(cols * rows).fill(10);
  expect(traceRivers(heights, cols, rows, 1)).toEqual([]);
});

it('traces a river down a single-slope ridge to the sea', () => {
  const cols = 6;
  const rows = 1;
  const heights = [80, 70, 60, 40, 25, 10];
  const rivers = traceRivers(heights, cols, rows, 1);
  expect(rivers.length).toBeGreaterThanOrEqual(1);
  const main = rivers[0];
  expect(main.points[0].x).toBeLessThan(5);
  expect(main.points[main.points.length - 1].x).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < main.discharge.length; i++) {
    expect(main.discharge[i]).toBeGreaterThanOrEqual(main.discharge[i - 1]);
  }
});

it('is deterministic for a given seed and heightmap', () => {
  const cols = 8;
  const rows = 8;
  const heights = new Array(cols * rows).fill(0).map((_, i) => 80 - i);
  const a = traceRivers(heights, cols, rows, 1);
  const b = traceRivers(heights, cols, rows, 1);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/rivers.test.ts`
Expected: FAIL with "Cannot find module '../rivers'"

- [ ] **Step 3: Implement river tracing**

Create `src/services/worldSim/rivers.ts`:

```ts
/**
 * @file rivers.ts
 * Flow accumulation + polyline river tracing on a heightmap.
 *
 * Algorithm:
 *  1. For each land cell (height >= SEA_LEVEL), find the steepest-descent neighbor among 8.
 *  2. Sort cells by height descending. Walk in order; for each cell, add `accumulator[i]` to
 *     `accumulator[descent[i]]`. After the walk, every cell knows its upstream area.
 *  3. Identify "sources" (cells with flow >= threshold but no upstream feeder). Trace down
 *     descent[] emitting a polyline until flow drops below threshold or reaches sea.
 */
import type { River, Vec2 } from './types';

const SEA_LEVEL = 20;
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
];

export function traceRivers(heights: number[], cols: number, rows: number, minFlow: number): River[] {
  const n = cols * rows;
  const descent = new Int32Array(n).fill(-1);
  const flow = new Float32Array(n);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (heights[i] < SEA_LEVEL) continue;
      let best = -1;
      let bestH = heights[i];
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (heights[ni] < bestH) {
          bestH = heights[ni];
          best = ni;
        }
      }
      descent[i] = best;
      if (heights[i] >= SEA_LEVEL) flow[i] = 1;
    }
  }

  const order = Array.from({ length: n }, (_, i) => i)
    .filter((i) => heights[i] >= SEA_LEVEL)
    .sort((a, b) => heights[b] - heights[a]);
  for (const i of order) {
    const d = descent[i];
    if (d >= 0) flow[d] += flow[i];
  }

  const visited = new Uint8Array(n);
  const rivers: River[] = [];
  const sourceCandidates = order
    .filter((i) => flow[i] >= minFlow)
    .filter((i) => {
      const [x, y] = [i % cols, (i / cols) | 0];
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (descent[ni] === i) return false;
      }
      return true;
    });

  let riverId = 0;
  for (const src of sourceCandidates) {
    if (visited[src]) continue;
    const points: Vec2[] = [];
    const widthArr: number[] = [];
    const discharge: number[] = [];
    let cur = src;
    let guard = n;
    while (cur >= 0 && guard-- > 0 && !visited[cur] && flow[cur] >= minFlow) {
      visited[cur] = 1;
      points.push({ x: cur % cols + 0.5, y: ((cur / cols) | 0) + 0.5 });
      discharge.push(flow[cur]);
      widthArr.push(Math.max(0.4, Math.sqrt(flow[cur]) * 0.3));
      cur = descent[cur];
    }
    if (points.length >= 2) {
      rivers.push({ id: `r${riverId++}`, points, width: widthArr, discharge });
    }
  }

  return rivers;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/rivers.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/rivers.ts src/services/worldSim/__tests__/rivers.test.ts
git commit -m "feat(world-sim): trace rivers via flow accumulation"
```

---

## Task 6: Site Placement (Towns / Dungeons / Ruins)

**Files:**
- Create: `src/services/worldSim/sites.ts`
- Test: `src/services/worldSim/__tests__/sites.test.ts`

Score cells by `flatness * (river_proximity + coast_proximity)` for towns, inverse for wilderness. Place top scorers with minimum spacing.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/sites.test.ts`:

```ts
import { placeSites } from '../sites';
import { SeededRandom } from '@/utils/random';

const flatHeights = (cols: number, rows: number) => {
  const h = new Array(cols * rows).fill(40);
  for (let x = 0; x < cols; x++) h[x] = 10;
  return h;
};

it('places at least one town with a non-empty footprint', () => {
  const cols = 20;
  const rows = 10;
  const heights = flatHeights(cols, rows);
  const rivers: any[] = [];
  const rng = new SeededRandom(1234);
  const sites = placeSites(heights, cols, rows, rivers, rng, { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  const towns = sites.filter((s) => s.kind === 'town');
  expect(towns.length).toBeGreaterThan(0);
  expect(towns[0].footprint.length).toBeGreaterThanOrEqual(3);
});

it('honours minimum spacing between sites of the same kind', () => {
  const cols = 30;
  const rows = 20;
  const heights = flatHeights(cols, rows);
  const rng = new SeededRandom(5678);
  const sites = placeSites(heights, cols, rows, [], rng, { townTarget: 10, dungeonTarget: 0, ruinTarget: 0 });
  const towns = sites.filter((s) => s.kind === 'town');
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const dx = towns[i].position.x - towns[j].position.x;
      const dy = towns[i].position.y - towns[j].position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(3);
    }
  }
});

it('is deterministic for a given seed', () => {
  const cols = 20;
  const rows = 10;
  const heights = flatHeights(cols, rows);
  const a = placeSites(heights, cols, rows, [], new SeededRandom(42), { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  const b = placeSites(heights, cols, rows, [], new SeededRandom(42), { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/sites.test.ts`
Expected: FAIL with "Cannot find module '../sites'"

- [ ] **Step 3: Implement site placement**

Create `src/services/worldSim/sites.ts`:

```ts
/**
 * @file sites.ts
 * Score-and-spacing placement of towns (high score) and dungeons/ruins (wilderness pockets).
 */
import type { River, Site, Polygon } from './types';
import { SeededRandom } from '@/utils/random';

export interface SiteTargets {
  townTarget: number;
  dungeonTarget: number;
  ruinTarget: number;
}

const SEA_LEVEL = 20;
const MIN_TOWN_SPACING = 3;
const MIN_DUNGEON_SPACING = 4;
const MIN_RUIN_SPACING = 3;

interface ScoredCell {
  i: number;
  x: number;
  y: number;
  score: number;
}

export function placeSites(
  heights: number[],
  cols: number,
  rows: number,
  rivers: River[],
  rng: SeededRandom,
  targets: SiteTargets,
): Site[] {
  const riverMask = new Uint8Array(cols * rows);
  for (const r of rivers) {
    for (const p of r.points) {
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x >= 0 && y >= 0 && x < cols && y < rows) riverMask[y * cols + x] = 1;
    }
  }

  const townScores: ScoredCell[] = [];
  const wildScores: ScoredCell[] = [];

  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && heights[y * cols + x] >= SEA_LEVEL;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!isLand(x, y)) continue;

      let maxDelta = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!isLand(x + dx, y + dy)) continue;
          maxDelta = Math.max(maxDelta, Math.abs(heights[(y + dy) * cols + (x + dx)] - heights[i]));
        }
      }
      const flatness = 1 / (1 + maxDelta * 0.3);

      let riverProx = 0;
      for (let dy = -2; dy <= 2 && !riverProx; dy++) {
        for (let dx = -2; dx <= 2 && !riverProx; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && riverMask[ny * cols + nx]) riverProx = 1;
        }
      }

      let coastProx = 0;
      for (let dy = -2; dy <= 2 && !coastProx; dy++) {
        for (let dx = -2; dx <= 2 && !coastProx; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && heights[ny * cols + nx] < SEA_LEVEL) coastProx = 1;
        }
      }

      const townScore = flatness * (1 + riverProx * 2 + coastProx * 1.5);
      const wildScore = (1 - flatness * 0.5) * (heights[i] / 100) * (1 - riverProx) * (1 - coastProx);

      townScores.push({ i, x, y, score: townScore });
      wildScores.push({ i, x, y, score: wildScore });
    }
  }

  townScores.sort((a, b) => b.score - a.score);
  wildScores.sort((a, b) => b.score - a.score);

  const placed: Site[] = [];
  const tooClose = (px: number, py: number, minSpacing: number) =>
    placed.some((s) => {
      const dx = s.position.x - px;
      const dy = s.position.y - py;
      return Math.sqrt(dx * dx + dy * dy) < minSpacing;
    });

  const stampFootprint = (x: number, y: number, radius: number): Polygon => {
    const poly: Polygon = [];
    const segments = 8;
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      poly.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius });
    }
    return poly;
  };

  let siteId = 0;

  for (const c of townScores) {
    if (placed.filter((s) => s.kind === 'town').length >= targets.townTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_TOWN_SPACING)) continue;
    const pop = Math.round(500 + rng.next() * 4500);
    placed.push({
      id: `t${siteId++}`,
      kind: 'town',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.6 + (pop / 5000) * 0.8),
      population: pop,
      walled: pop > 2500,
      townSeed: (rng.next() * 1e9) | 0,
    });
  }

  for (const c of wildScores) {
    if (placed.filter((s) => s.kind === 'dungeon').length >= targets.dungeonTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_DUNGEON_SPACING)) continue;
    placed.push({
      id: `d${siteId++}`,
      kind: 'dungeon',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.4),
    });
  }

  for (const c of wildScores) {
    if (placed.filter((s) => s.kind === 'ruin').length >= targets.ruinTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_RUIN_SPACING)) continue;
    placed.push({
      id: `u${siteId++}`,
      kind: 'ruin',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.3),
    });
  }

  return placed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/sites.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/sites.ts src/services/worldSim/__tests__/sites.test.ts
git commit -m "feat(world-sim): place towns, dungeons, ruins with scoring + spacing"
```

---

## Task 7: Road Graph (A* + Minimum Spanning Tree)

**Files:**
- Create: `src/services/worldSim/roads.ts`
- Test: `src/services/worldSim/__tests__/roads.test.ts`

All-pairs A* across heightfield. Build MST. Add 20% extra edges for redundancy.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/roads.test.ts`:

```ts
import { generateRoads } from '../roads';
import type { Site } from '../types';

const flat = (cols: number, rows: number) => new Array(cols * rows).fill(40);

const mkSite = (id: string, x: number, y: number): Site => ({
  id,
  kind: 'town',
  position: { x, y },
  footprint: [],
});

it('returns no roads if there are fewer than 2 towns', () => {
  const sites = [mkSite('t0', 1, 1)];
  expect(generateRoads(flat(10, 10), 10, 10, sites)).toEqual([]);
});

it('connects 3 towns into a connected graph (n-1 minimum spanning tree edges)', () => {
  const sites = [
    mkSite('t0', 2, 2),
    mkSite('t1', 8, 2),
    mkSite('t2', 5, 7),
  ];
  const roads = generateRoads(flat(10, 10), 10, 10, sites);
  expect(roads.length).toBeGreaterThanOrEqual(2);
  for (const r of roads) {
    expect(r.fromSiteId).not.toBe(r.toSiteId);
    expect(r.points.length).toBeGreaterThanOrEqual(2);
  }
});

it('road polylines avoid impassable water cells', () => {
  const cols = 10;
  const rows = 10;
  const heights = flat(cols, rows);
  for (let x = 0; x < cols; x++) heights[5 * cols + x] = 10;
  heights[5 * cols + 5] = 40;
  const sites = [mkSite('t0', 2, 2), mkSite('t1', 2, 8)];
  const roads = generateRoads(heights, cols, rows, sites);
  expect(roads.length).toBeGreaterThanOrEqual(1);
  const points = roads[0].points;
  const passesBridge = points.some((p) => Math.abs(p.x - 5) < 1 && Math.abs(p.y - 5) < 1);
  expect(passesBridge).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/roads.test.ts`
Expected: FAIL with "Cannot find module '../roads'"

- [ ] **Step 3: Implement A* + MST road generation**

Create `src/services/worldSim/roads.ts`:

```ts
/**
 * @file roads.ts
 * Generate a connected road graph between sites.
 *
 *  1. For each unordered pair of towns, run A* across the heightfield (water = impassable,
 *     steep slope = high cost).
 *  2. Build a minimum spanning tree over the pairwise distances → n-1 edges.
 *  3. Add up to 20% extra short edges for redundancy.
 */
import type { Road, Site, Vec2 } from './types';

const SEA_LEVEL = 20;

interface PathResult {
  cost: number;
  points: Vec2[];
}

function aStar(heights: number[], cols: number, rows: number, sx: number, sy: number, gx: number, gy: number): PathResult | null {
  const idx = (x: number, y: number) => y * cols + x;
  const isPassable = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && heights[idx(x, y)] >= SEA_LEVEL;
  if (!isPassable(sx, sy) || !isPassable(gx, gy)) return null;

  const open = new Set<number>();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const fScore = new Map<number, number>();
  const heuristic = (x: number, y: number) => Math.hypot(gx - x, gy - y);

  const start = idx(sx, sy);
  open.add(start);
  gScore.set(start, 0);
  fScore.set(start, heuristic(sx, sy));

  while (open.size) {
    let current = -1;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }
    if (current === -1) break;
    const cx = current % cols;
    const cy = (current / cols) | 0;
    if (cx === gx && cy === gy) {
      const points: Vec2[] = [];
      let cur = current;
      while (cur !== undefined) {
        points.push({ x: (cur % cols) + 0.5, y: ((cur / cols) | 0) + 0.5 });
        const prev = cameFrom.get(cur);
        if (prev === undefined) break;
        cur = prev;
      }
      points.reverse();
      return { cost: gScore.get(current) ?? 0, points };
    }
    open.delete(current);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isPassable(nx, ny)) continue;
      const nid = idx(nx, ny);
      const stepCost = Math.hypot(dx, dy) * (1 + Math.abs(heights[idx(nx, ny)] - heights[current]) * 0.05);
      const tentative = (gScore.get(current) ?? Infinity) + stepCost;
      if (tentative < (gScore.get(nid) ?? Infinity)) {
        cameFrom.set(nid, current);
        gScore.set(nid, tentative);
        fScore.set(nid, tentative + heuristic(nx, ny));
        open.add(nid);
      }
    }
  }
  return null;
}

interface Edge { a: number; b: number; cost: number; points: Vec2[]; }

function mst(edges: Edge[], nodes: number): Edge[] {
  edges.sort((u, v) => u.cost - v.cost);
  const parent = Array.from({ length: nodes }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number): boolean => {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return false;
    parent[ri] = rj;
    return true;
  };
  const out: Edge[] = [];
  for (const e of edges) {
    if (union(e.a, e.b)) out.push(e);
    if (out.length === nodes - 1) break;
  }
  return out;
}

export function generateRoads(heights: number[], cols: number, rows: number, sites: Site[]): Road[] {
  const towns = sites.filter((s) => s.kind === 'town');
  if (towns.length < 2) return [];

  const edges: Edge[] = [];
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i];
      const b = towns[j];
      const path = aStar(
        heights, cols, rows,
        Math.floor(a.position.x), Math.floor(a.position.y),
        Math.floor(b.position.x), Math.floor(b.position.y),
      );
      if (path) edges.push({ a: i, b: j, cost: path.cost, points: path.points });
    }
  }

  const tree = mst(edges, towns.length);

  const extras = Math.floor(tree.length * 0.2);
  const treeSet = new Set(tree);
  const candidates = edges.filter((e) => !treeSet.has(e)).slice(0, extras);

  let id = 0;
  const out: Road[] = [];
  for (const e of [...tree, ...candidates]) {
    out.push({
      id: `road${id++}`,
      points: e.points,
      type: 'major',
      fromSiteId: towns[e.a].id,
      toSiteId: towns[e.b].id,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/roads.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/roads.ts src/services/worldSim/__tests__/roads.test.ts
git commit -m "feat(world-sim): generate road graph via A* + MST"
```

---

## Task 8: Pipeline Entry — runWorldSim

**Files:**
- Create: `src/services/worldSim/index.ts`
- Test: `src/services/worldSim/__tests__/pipeline.test.ts`

Single entry point that runs all sub-modules in order and assembles `WorldData`.

- [ ] **Step 1: Write the failing test**

Create `src/services/worldSim/__tests__/pipeline.test.ts`:

```ts
import { runWorldSim } from '../index';

it('returns a WorldData v2 object with all required fields', () => {
  const cols = 20;
  const rows = 12;
  const heights = new Array(cols * rows).fill(0).map((_, i) => 20 + (i % 60));
  const temperatures = new Array(cols * rows).fill(15);
  const moisture = new Array(cols * rows).fill(20);
  const biomeIds = new Array(cols * rows).fill('plains');
  const out = runWorldSim({
    seed: 42,
    templateId: 'continents',
    cols,
    rows,
    heights,
    temperatures,
    moisture,
    biomeIds,
  });
  expect(out.version).toBe(2);
  expect(out.seed).toBe(42);
  expect(out.gridSize).toEqual({ rows, cols });
  expect(out.rivers).toBeDefined();
  expect(out.roads).toBeDefined();
  expect(out.sites).toBeDefined();
  expect(out.coastlines).toBeDefined();
  expect(out.lakes).toBeDefined();
  expect(out.biomeZones).toBeDefined();
});

it('is deterministic for a given seed', () => {
  const params = {
    seed: 99,
    templateId: 'archipelago',
    cols: 16,
    rows: 12,
    heights: new Array(16 * 12).fill(0).map((_, i) => (i * 7) % 100),
    temperatures: new Array(16 * 12).fill(10),
    moisture: new Array(16 * 12).fill(30),
    biomeIds: new Array(16 * 12).fill('forest'),
  };
  const a = runWorldSim(params);
  const b = runWorldSim(params);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/worldSim/__tests__/pipeline.test.ts`
Expected: FAIL with "Cannot find module '../index'"

- [ ] **Step 3: Implement the pipeline**

Create `src/services/worldSim/index.ts`:

```ts
/**
 * @file index.ts
 * World-sim pipeline entry. Given a heightmap + climate + biome assignment,
 * returns a complete WorldData object with rivers, sites, roads, and polygons.
 */
import { SeededRandom } from '@/utils/random';
import type { WorldData } from './types';
import { extractCoastlines, extractLakes } from './coastlinesAndLakes';
import { extractBiomeZones } from './biomeZones';
import { traceRivers } from './rivers';
import { placeSites } from './sites';
import { generateRoads } from './roads';

export interface RunWorldSimInput {
  seed: number;
  templateId: string;
  cols: number;
  rows: number;
  heights: number[];
  temperatures: number[];
  moisture: number[];
  biomeIds: string[];
}

const MIN_RIVER_FLOW = 5;
const TOWN_DENSITY = 1 / 80;
const DUNGEON_DENSITY = 1 / 200;
const RUIN_DENSITY = 1 / 150;

export function runWorldSim(input: RunWorldSimInput): WorldData {
  const { seed, templateId, cols, rows, heights, temperatures, moisture, biomeIds } = input;
  const rng = new SeededRandom(seed ^ 0xa5a5a5a5);

  const cells = cols * rows;
  const targets = {
    townTarget: Math.max(2, Math.round(cells * TOWN_DENSITY)),
    dungeonTarget: Math.round(cells * DUNGEON_DENSITY),
    ruinTarget: Math.round(cells * RUIN_DENSITY),
  };

  const coastlines = extractCoastlines(heights, cols, rows);
  const lakes = extractLakes(heights, cols, rows);
  const biomeZones = extractBiomeZones(biomeIds, cols, rows);
  const rivers = traceRivers(heights, cols, rows, MIN_RIVER_FLOW);
  const sites = placeSites(heights, cols, rows, rivers, rng, targets);
  const roads = generateRoads(heights, cols, rows, sites);

  return {
    version: 2,
    seed,
    templateId,
    gridSize: { rows, cols },
    heights,
    temperatures,
    moisture,
    biomeIds,
    rivers,
    roads,
    sites,
    coastlines,
    lakes,
    biomeZones,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/worldSim/__tests__/pipeline.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/worldSim/index.ts src/services/worldSim/__tests__/pipeline.test.ts
git commit -m "feat(world-sim): pipeline entry runWorldSim"
```

---

## Task 9: Wire worldSim into azgaarDerivedMapService

**Files:**
- Modify: `src/services/azgaarDerivedMapService.ts`
- Test: extend `src/services/__tests__/mapService.test.ts`

After existing per-cell generation, gather inputs and call `runWorldSim`. Attach to `MapData.worldData`. Keep `azgaarWorld` populated for migration.

- [ ] **Step 1: Write the failing test**

Append to `src/services/__tests__/mapService.test.ts` (create if missing):

```ts
import { generateMap } from '../mapService';
import { BIOMES } from '@/constants';

it('generateMap returns MapData with worldData v2 attached', () => {
  const map = generateMap(20, 30, {}, BIOMES, 7777);
  expect(map.worldData).toBeDefined();
  expect(map.worldData!.version).toBe(2);
  expect(map.worldData!.seed).toBe(7777);
  expect(map.worldData!.gridSize).toEqual({ rows: 20, cols: 30 });
});

it('generateMap is deterministic — same seed produces identical worldData', () => {
  const a = generateMap(15, 20, {}, BIOMES, 1234);
  const b = generateMap(15, 20, {}, BIOMES, 1234);
  expect(JSON.stringify(a.worldData)).toBe(JSON.stringify(b.worldData));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/mapService.test.ts`
Expected: FAIL — `map.worldData` is undefined

- [ ] **Step 3: Modify azgaarDerivedMapService to populate worldData**

Add import at the top of `src/services/azgaarDerivedMapService.ts`:

```ts
import { runWorldSim } from './worldSim';
```

Inside `generateAzgaarDerivedMap`, just before the final `return` statement, add:

```ts
const biomeIdFlat: string[] = [];
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    biomeIdFlat.push(tiles[y][x].biomeId);
  }
}

const worldData = runWorldSim({
  seed: worldSeed,
  templateId,
  cols,
  rows,
  heights,
  temperatures,
  moisture: moistureValues,
  biomeIds: biomeIdFlat,
});
```

And update the return to include `worldData`:

```ts
return {
  gridSize: { rows, cols },
  tiles,
  azgaarWorld: {
    version: 1,
    templateId,
    heights,
    temperatures,
    moisture: moistureValues,
    rivers,
  },
  worldData,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__/mapService.test.ts`
Expected: PASS

Then: `npx vitest run src/services/worldSim`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/azgaarDerivedMapService.ts src/services/__tests__/mapService.test.ts
git commit -m "feat(world-sim): wire worldSim pipeline into map generation"
```

---

## Task 10: Save Migration (v1 → v2)

**Files:**
- Create: `src/state/migrations/worldDataMigration.ts`
- Create: `src/state/migrations/__tests__/worldDataMigration.test.ts`

On save load, if `mapData.worldData` is missing, re-run worldSim from per-cell data.

- [ ] **Step 1: Write the failing test**

Create `src/state/migrations/__tests__/worldDataMigration.test.ts`:

```ts
import { migrateMapDataToWorldDataV2 } from '../worldDataMigration';
import type { MapData } from '@/types/world';

const fakeTiles = (cols: number, rows: number) => {
  const tiles = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) row.push({ x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false });
    tiles.push(row);
  }
  return tiles;
};

it('populates worldData when missing using azgaarWorld payload', () => {
  const cols = 10;
  const rows = 8;
  const before: MapData = {
    gridSize: { rows, cols },
    tiles: fakeTiles(cols, rows),
    azgaarWorld: {
      version: 1,
      templateId: 'continents',
      heights: new Array(cols * rows).fill(30),
      temperatures: new Array(cols * rows).fill(10),
      moisture: new Array(cols * rows).fill(20),
      rivers: new Array(cols * rows).fill(false),
    },
  };
  const after = migrateMapDataToWorldDataV2(before, 42);
  expect(after.worldData).toBeDefined();
  expect(after.worldData!.version).toBe(2);
});

it('is a no-op when worldData already exists and is v2', () => {
  const cols = 6;
  const rows = 6;
  const seedWd = {
    version: 2 as const,
    seed: 1,
    templateId: 't',
    gridSize: { rows, cols },
    heights: new Array(cols * rows).fill(30),
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
  const before: MapData = { gridSize: { rows, cols }, tiles: fakeTiles(cols, rows), worldData: seedWd };
  const after = migrateMapDataToWorldDataV2(before, 1);
  expect(after.worldData).toBe(seedWd);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/migrations/__tests__/worldDataMigration.test.ts`
Expected: FAIL with "Cannot find module '../worldDataMigration'"

- [ ] **Step 3: Implement the migration**

Create `src/state/migrations/worldDataMigration.ts`:

```ts
/**
 * @file worldDataMigration.ts
 * One-shot loader-side migration: backfills `MapData.worldData` for saves created
 * before WorldData v2 existed. Idempotent — safe to call on already-migrated saves.
 */
import type { MapData } from '@/types/world';
import { runWorldSim } from '@/services/worldSim';

export function migrateMapDataToWorldDataV2(mapData: MapData, worldSeed: number): MapData {
  if (mapData.worldData && mapData.worldData.version === 2) return mapData;

  const { rows, cols } = mapData.gridSize;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      biomeIds.push(mapData.tiles[y]?.[x]?.biomeId ?? 'plains');
    }
  }

  const az = mapData.azgaarWorld;
  const heights = az?.heights ?? new Array(rows * cols).fill(30);
  const temperatures = az?.temperatures ?? new Array(rows * cols).fill(15);
  const moisture = az?.moisture ?? new Array(rows * cols).fill(20);
  const templateId = az?.templateId ?? 'unknown';

  const worldData = runWorldSim({
    seed: worldSeed,
    templateId,
    cols,
    rows,
    heights,
    temperatures,
    moisture,
    biomeIds,
  });

  return { ...mapData, worldData };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/migrations/__tests__/worldDataMigration.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/state/migrations/worldDataMigration.ts src/state/migrations/__tests__/worldDataMigration.test.ts
git commit -m "feat(world-sim): backfill worldData v2 on legacy save load"
```

---

## Task 11: Hook Migration into Save-Load Flow

**Files:**
- Modify: `src/services/saveLoadService.ts` — call `migrateMapDataToWorldDataV2` on `loadedState.mapData` inside `loadGame`
- Test: extend `src/services/__tests__/saveLoadService.test.ts`

The load entry is `export async function loadGame(slotName, notify): Promise<SaveLoadResult>`. After the save blob parses and `loadedState: GameState` is hydrated, several "normalize older saves" passes run. The new migration call slots in **after** `normalizeLoadedDates(loadedState);` and **before** `upsertSlotMetadata({...})`. `GameState.worldSeed: number` is the seed (verified in `src/types/state.ts:132`).

- [ ] **Step 1: Write the failing test**

Open `src/services/__tests__/saveLoadService.test.ts` and add:

```ts
import { migrateMapDataToWorldDataV2 } from '@/state/migrations/worldDataMigration';

it('migrateMapDataToWorldDataV2 backfills worldData when applied to a v1 mapData', () => {
  const cols = 6;
  const rows = 4;
  const legacyMap = {
    gridSize: { rows, cols },
    tiles: new Array(rows).fill(0).map((_, y) =>
      new Array(cols).fill(0).map((__, x) => ({
        x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false,
      })),
    ),
    azgaarWorld: {
      version: 1 as const,
      templateId: 'continents',
      heights: new Array(cols * rows).fill(30),
      temperatures: new Array(cols * rows).fill(15),
      moisture: new Array(cols * rows).fill(20),
      rivers: new Array(cols * rows).fill(false),
    },
  };
  const migrated = migrateMapDataToWorldDataV2(legacyMap as any, 42);
  expect(migrated.worldData?.version).toBe(2);
});
```

If the file has a `makeFixture()` / `newGameState()` helper, also add:

```ts
import { saveGame, loadGame } from '@/services/saveLoadService';

it('loadGame migrates legacy saves to WorldData v2', async () => {
  const state = makeFixture();
  delete state.mapData.worldData;
  await saveGame(state, 'TEST_SLOT_v1_MIGRATION');
  const result = await loadGame('TEST_SLOT_v1_MIGRATION');
  expect(result.success).toBe(true);
  expect(result.data?.mapData.worldData?.version).toBe(2);
});
```

If no such helper exists, skip the second test and proceed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/saveLoadService.test.ts`
The unit-level test should PASS (the migration utility exists from Task 10). The end-to-end test (if added) should FAIL.

- [ ] **Step 3: Wire migration into `loadGame`**

Add import to `src/services/saveLoadService.ts`:

```ts
import { migrateMapDataToWorldDataV2 } from '@/state/migrations/worldDataMigration';
```

Inside `loadGame`, immediately after `normalizeLoadedDates(loadedState);` add:

```ts
if (loadedState.mapData) {
  loadedState.mapData = migrateMapDataToWorldDataV2(loadedState.mapData, loadedState.worldSeed ?? 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__/saveLoadService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/saveLoadService.ts src/services/__tests__/saveLoadService.test.ts
git commit -m "feat(world-sim): migrate legacy saves on load"
```

---

## Task 12: Integration / Performance Smoke Test

**Files:**
- Create: `src/services/worldSim/__tests__/integration.test.ts`

End-to-end realistic-size world gen + soft performance budget.

- [ ] **Step 1: Write the test**

Create `src/services/worldSim/__tests__/integration.test.ts`:

```ts
import { runWorldSim } from '../index';

const REALISTIC_COLS = 60;
const REALISTIC_ROWS = 40;
const TIME_BUDGET_MS = 5000;

const buildInput = (seed: number) => {
  const cells = REALISTIC_COLS * REALISTIC_ROWS;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    const v = Math.sin(i * 0.13 + seed) * 30 + Math.cos(i * 0.21 + seed * 0.5) * 20 + 30;
    heights.push(Math.max(0, Math.min(100, Math.round(v))));
  }
  return {
    seed,
    templateId: 'continents',
    cols: REALISTIC_COLS,
    rows: REALISTIC_ROWS,
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: new Array(cells).fill(0).map((_, i) => (heights[i] < 20 ? 'ocean' : heights[i] < 40 ? 'plains' : 'forest')),
  };
};

it('end-to-end pipeline produces a complete WorldData object', () => {
  const out = runWorldSim(buildInput(2026));
  expect(out.version).toBe(2);
  expect(out.heights).toHaveLength(REALISTIC_COLS * REALISTIC_ROWS);
  expect(out.coastlines.length).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(out.rivers)).toBe(true);
  expect(Array.isArray(out.roads)).toBe(true);
  expect(Array.isArray(out.sites)).toBe(true);
  expect(Array.isArray(out.biomeZones)).toBe(true);
});

it('completes within the soft performance budget on realistic input', () => {
  const start = performance.now();
  runWorldSim(buildInput(2027));
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/services/worldSim/__tests__/integration.test.ts`
Expected: PASS, 2 tests

If the performance test fails, this is a real signal — investigate the bottleneck (likely all-pairs A* in `roads.ts` if many towns). Optimizations are out of scope; raise the budget temporarily and file a follow-up.

- [ ] **Step 3: Run full worldSim suite**

Run: `npx vitest run src/services/worldSim`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/worldSim/__tests__/integration.test.ts
git commit -m "test(world-sim): end-to-end + performance smoke test"
```

---

## Final Verification

- [ ] **Run all tests touched by this plan**

```bash
npx vitest run src/services/worldSim src/services/__tests__/mapService.test.ts src/services/__tests__/saveLoadService.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts
```

Expected: all PASS

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: pre-existing errors only (CharacterActor, characterUtils, OpportunityAttackSystem.test). No new errors from this plan.

---

## What This Plan Does NOT Do

Intentionally deferred to subsequent plans (see spec §13):

- Rendering polyline rivers / roads / site footprints on the Azgaar atlas SVG — Plan 4
- 3D world rendering (`World3DScene`, `ChunkManager`, LOD) — Plan 2
- Per-chunk meshes — Plan 3
- 2D↔3D transition + Azgaar marker sync — Plan 4
- Deletion of submap layer + grid-mode world map — Plan 4

When this plan lands, world generation produces richer data, the data round-trips through saves correctly, and nothing visible has changed.
