# SP1 Voronoi Submap Engine — Iteration #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The deterministic, headless core of the Voronoi submap engine: given a parent cell polygon + its inherited set-piece anchors + a seed-path, produce the **site set** for the submap — seeded points scattered *inside the parent polygon* plus the inherited features force-placed at their **relative positions** (the "Bomnogorvan" contract foundation). Voronoi-cell polygon construction, clipping-to-parent-shape, and rendering are **iteration #2**.

**Architecture:** A pure module `submapEngine.ts` (no React/DOM) under `src/systems/worldforge/submap/`. It mirrors how `atlasSvg.ts`/`generateRegion.ts` are pure: a stub or real `SubmapParentContext` in, a `SubmapSites` data structure out, unit-tested with tiny hand-built polygons. Determinism comes from the existing `seedPath` RNG (`rngFromPath`), exactly like `generateRegion`/`generateTownPlan`.

**Tech Stack:** TypeScript, Vitest, the existing `src/systems/worldforge/seedPath.ts` (`childSeedPath`/`rngFromPath`/`streamPath`). No new deps. (`delaunator` is available for iteration #2's Voronoi step.)

**Scope (iteration #1):** site generation + feature force-placement + determinism only. Per the SP0 lesson, keep it a small testable slice. Do NOT build Voronoi cell polygons, clipping, biome sub-variation, rivers/roads projection, or rendering — those are iteration #2+.

**Binding constraints (from SPEC §11 2026-06-22 + memory):** Azgaar L0 → WF L1+ (the engine *consumes* a parent context, never generates a competing world); inherited features keep identity + relative position; no Watabou; no fallback layers; deterministic per seed-path. Read `docs/projects/worldforge/subprojects/sp1-voronoi-submap-engine/NORTH_STAR.md` and SPEC §11 item 2 first.

---

## File Structure

- `src/systems/worldforge/submap/submapEngine.ts` — **new.** Types + `pointInPolygon`, `polygonBounds`, `generateSubmapSites`. One responsibility: turn a parent context into the submap's deterministic site set.
- `src/systems/worldforge/submap/__tests__/submapEngine.test.ts` — **new.** Unit tests (point-in-polygon, scatter-inside, forced feature sites, Bomnogorvan relative position, determinism).

Coordinate convention: the parent `polygon` and feature `x/y` are in one shared coordinate space (the parent cell's own graph coords). The engine works directly in that space (no normalization needed for iteration #1 — relative position is preserved because features and scattered points share the polygon's frame).

---

## Task 1: Geometry helpers (`pointInPolygon`, `polygonBounds`)

**Files:**
- Create: `src/systems/worldforge/submap/submapEngine.ts`
- Test: `src/systems/worldforge/submap/__tests__/submapEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { pointInPolygon, polygonBounds } from '../submapEngine';

const square: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe('geometry helpers', () => {
  it('pointInPolygon: inside true, outside false', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });
  it('polygonBounds returns the axis-aligned bbox', () => {
    expect(polygonBounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/submap/__tests__/submapEngine.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/systems/worldforge/submap/submapEngine.ts
export type Pt = [number, number];

/** Ray-casting point-in-polygon (polygon = ordered [x,y] vertices). */
export function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = (yi > p[1]) !== (yj > p[1])
      && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function polygonBounds(polygon: Pt[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/submap/__tests__/submapEngine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit** (skip if the project auto-commits — leave in tree)

```bash
git add src/systems/worldforge/submap/submapEngine.ts src/systems/worldforge/submap/__tests__/submapEngine.test.ts
git commit -m "feat(worldforge/sp1): point-in-polygon + bounds helpers for submap engine"
```

---

## Task 2: `SubmapParentContext` + `generateSubmapSites`

**Files:**
- Modify: `src/systems/worldforge/submap/submapEngine.ts`
- Test: `src/systems/worldforge/submap/__tests__/submapEngine.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { generateSubmapSites } from '../submapEngine';
import { rootSeedPath } from '../../seedPath';

const triangle: Array<[number, number]> = [[0, 100], [100, 100], [50, 0]]; // apex at (50,0)

describe('generateSubmapSites', () => {
  it('scatters the requested count of points, all inside the polygon', () => {
    const r = generateSubmapSites(
      { polygon: triangle, seedPath: rootSeedPath(42), features: [] },
      { count: 40 },
    );
    expect(r.sites.length).toBeGreaterThanOrEqual(40); // forced features + scatter
    for (const s of r.sites) expect(pointInPolygon(s, triangle)).toBe(true);
  });

  it('Bomnogorvan contract: an inherited burg is force-sited at its relative position', () => {
    const r = generateSubmapSites(
      {
        polygon: triangle,
        seedPath: rootSeedPath(42),
        features: [{ kind: 'burg', x: 50, y: 8, id: 137, name: 'Bomnogorvan' }], // near apex
      },
      { count: 40 },
    );
    const fs = r.featureSites[0];
    expect(fs.feature.name).toBe('Bomnogorvan');     // identity preserved
    expect(r.sites[fs.siteIndex]).toEqual([50, 8]);  // exact relative position kept
    // and it is the nearest site to its own location (owns a cell there)
    let nearest = -1; let best = Infinity;
    r.sites.forEach((s, i) => { const d = (s[0] - 50) ** 2 + (s[1] - 8) ** 2; if (d < best) { best = d; nearest = i; } });
    expect(nearest).toBe(fs.siteIndex);
  });

  it('is deterministic: same seed-path → identical sites', () => {
    const ctx = { polygon: triangle, seedPath: rootSeedPath(7), features: [] };
    const a = generateSubmapSites(ctx, { count: 30 });
    const b = generateSubmapSites(ctx, { count: 30 });
    expect(a.sites).toEqual(b.sites);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/submap/__tests__/submapEngine.test.ts`
Expected: FAIL — `generateSubmapSites` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `submapEngine.ts`)

```ts
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

export interface SubmapFeature {
  kind: 'burg' | 'roadJunction' | 'riverBend';
  x: number;
  y: number;
  id?: number;
  name?: string;
}

export interface SubmapParentContext {
  /** Parent cell polygon (ordered [x,y] vertices, the submap boundary). */
  polygon: Pt[];
  /** Hierarchical seed path for deterministic generation (e.g. wf:42/cell:137). */
  seedPath: SeedPath;
  /** Inherited biome (carried to the submap; sub-variation is iteration #2). */
  biome?: string;
  /** Inherited set pieces, in the parent polygon's coord space (force-sited). */
  features?: SubmapFeature[];
}

export interface GenerateSubmapSitesOptions {
  /** Target scattered-point count (forced feature sites are added on top). */
  count?: number;
  /** Rejection-sampling attempt cap multiplier (default 20). */
  maxAttemptsPerPoint?: number;
}

export interface SubmapSites {
  sites: Pt[];
  /** Map from a context feature to the site index that carries it. */
  featureSites: Array<{ feature: SubmapFeature; siteIndex: number }>;
}

/**
 * Deterministic submap site set: inherited features are force-sited FIRST (so
 * each owns the Voronoi cell at its exact relative position — the Bomnogorvan
 * contract), then seeded jittered points are rejection-sampled inside the parent
 * polygon. Identity travels on the feature objects unchanged.
 */
export function generateSubmapSites(
  ctx: SubmapParentContext,
  opts: GenerateSubmapSitesOptions = {},
): SubmapSites {
  const count = opts.count ?? 60;
  const maxAttempts = (opts.maxAttemptsPerPoint ?? 20) * count;
  const sites: Pt[] = [];
  const featureSites: SubmapSites['featureSites'] = [];

  // 1. Forced feature sites (exact relative positions, identity preserved).
  for (const f of ctx.features ?? []) {
    featureSites.push({ feature: f, siteIndex: sites.length });
    sites.push([f.x, f.y]);
  }

  // 2. Seeded scatter inside the polygon (rejection sampling within bbox).
  const rng = rngFromPath(streamPath(ctx.seedPath, 'submap-sites'));
  const b = polygonBounds(ctx.polygon);
  let attempts = 0;
  while (sites.length < count + featureSites.length && attempts < maxAttempts) {
    attempts++;
    const x = b.minX + rng.next() * (b.maxX - b.minX);
    const y = b.minY + rng.next() * (b.maxY - b.minY);
    if (pointInPolygon([x, y], ctx.polygon)) sites.push([+x.toFixed(3), +y.toFixed(3)]);
  }

  return { sites, featureSites };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/submap/__tests__/submapEngine.test.ts`
Expected: PASS (5 tests).

Note for the executor: `rngFromPath` returns a `SeededRandom`; confirm its method is `.next()` returning 0..1 (used the same way in `generateTownPlan.ts`/`generateRegion.ts`). If the method differs, mirror those files.

- [ ] **Step 5: Commit** (skip if auto-commit — leave in tree)

```bash
git add src/systems/worldforge/submap/submapEngine.ts src/systems/worldforge/submap/__tests__/submapEngine.test.ts
git commit -m "feat(worldforge/sp1): deterministic submap site set with forced inherited-feature placement (Bomnogorvan contract)"
```

---

## Self-Review

**Spec coverage (iteration #1):** clip-to-parent-shape *site domain* ✓ (points sampled inside the polygon); inherited features at relative position with identity ✓ (forced sites, feature objects carry id/name); deterministic per seed-path ✓. Explicitly deferred to iteration #2 (tracked in SP1 `TRACKER.md` when created): Voronoi cell-polygon construction (`delaunator`), clipping cells to the parent boundary, per-sub-cell biome sub-variation, river/road polyline projection, and the recursion wrapper (output sub-cell → new `SubmapParentContext`).

**Placeholder scan:** none — every code step has complete code; the only note is the `rngFromPath().next()` API confirmation (a verification instruction, not a placeholder).

**Type consistency:** `Pt` used throughout; `SubmapParentContext.features` are `SubmapFeature[]`; `generateSubmapSites` returns `SubmapSites` whose `featureSites[].feature` is the same `SubmapFeature`. `SeedPath`/`rngFromPath`/`streamPath` imported from `../seedPath` (matches `generateRegion.ts`).

**Risk note for the executor:** rejection sampling can under-fill very thin polygons within `maxAttempts`; the test asserts `>=` count tolerantly. Iteration #2's Voronoi step will consume `SubmapSites.sites` directly (`Delaunator.from(sites)`).
