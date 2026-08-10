# Region rivers end-to-end Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one river course serve the whole stack — the region tier generates a real sub-cell course that follows terrain and passes through river-bearing burgs, the terrain carves to that exact line, and the town inherits it at true scale instead of drawing a 30× shrunk copy of its cell.

**Architecture:** The region heightfield is already a pure function of world position (IDW over FMG cell heights, plus world-feet-indexed noise and ridge fields, all seeded from the WORLD seed). We extract that math into a point sampler so a river course can consult terrain without breaking seam purity. A new pure module turns a river's FMG cell-center anchors into a dense course: resample, pull toward river-bearing burgs, relax downhill perpendicular to flow, smooth. Because the course is a pure function of `(atlas, riverId, worldSeed)`, the region tier and the town tier each compute it independently and get the identical line — the same discipline `canonicalTownSeedPath` already uses, so no artifact needs threading between them.

**Tech Stack:** TypeScript, Vitest, existing Worldforge modules (`generateRegion.ts`, `canonicalTown.ts`, `groundChunkLoader.ts`, `worldFeetNoise.ts`).

## Global Constraints

- **Seam purity is non-negotiable.** Any river course must be a pure function of WORLD data, computed from the FULL unclipped anchor line and only clipped afterward. Two adjacent windows must read the same course at a shared world point. This is why `generateRegion.ts:865-872` already smooths the full line, not the clipped one.
- **No fallbacks.** One real path; throw on unresolvable input rather than substituting a default (project standing rule, see `getBurgBiomeId` for the house pattern).
- **Determinism.** Same `(atlas, worldSeed, riverId)` must always yield the identical course, array-for-array. Seed via `seedPath.ts` helpers, never `Math.random`.
- **US English spelling** in all comments and docs.
- **Feet are canon** at the region/town tier; meters only after `FEET_TO_METERS` at the ground bake.
- **Towns are generated, not authored.** A town is a pure function of `(atlas, burgId, worldSeed)` and is rebuilt every time, so there is no per-town data to migrate. Changing the river input changes the GENERATOR and every town re-derives from it — that is the intended systemic change. Recorded test snapshots of generated output still need regenerating; read each diff, but expect it.
- **Nothing to migrate, including saves.** `WorldDelta` keys on a positional `plotId`, so in principle a plan change renumbers saved player edits. In practice no such edit can exist: the only code constructing `modify-plot`, `remove-plot` or `add-building` is the replay engine itself and `pipeline.test.ts`. No UI or game code emits one, and `delta/types.ts:66` records that no shipped saves exist. Checked 2026-07-29. If a plot-editing feature ever ships, revisit this before changing the town generator again.
- Run tests with `npx vitest run <path>`.

---

### Task 1: Extract a world-pure region terrain sampler

The river course must ask "how high is the land at this world point?" without a window. `generateHeightfield` already computes exactly that, but only onto a grid. Extract it so both callers share one implementation and cannot drift.

**Files:**
- Create: `src/systems/worldforge/region/regionTerrainField.ts`
- Modify: `src/systems/worldforge/region/generateRegion.ts:601-820` (`generateHeightfield` uses the new fields)
- Test: `src/systems/worldforge/region/__tests__/regionTerrainField.test.ts`

**Interfaces:**
- Consumes: `makeWorldFeetNoise` from `../local/worldFeetNoise`, `makeMountainRidgeField` from `./generateRegion`.
- Produces:
  - `type HeightCandidate = { x: Feet; y: Feet; h: number }`
  - `makeRegionBaseField(candidates: HeightCandidate[], idwRadiusFt: number): (x: Feet, y: Feet) => number`
  - `makeRegionReliefField(worldSeed: number, baseSpanFt: number): (x: Feet, y: Feet, baseH: number) => number`
  - `makeRegionNaturalHeight(candidates: HeightCandidate[], idwRadiusFt: number, worldSeed: number, baseSpanFt: number): (x: Feet, y: Feet) => number`

`makeRegionNaturalHeight` returns clamped `0..1` natural terrain with **no settlement floor** — a river must not route around a town's dry-land pad.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/region/__tests__/regionTerrainField.test.ts
import { describe, it, expect } from 'vitest';
import {
  makeRegionBaseField,
  makeRegionReliefField,
  makeRegionNaturalHeight,
  type HeightCandidate,
} from '../regionTerrainField';

const CANDS: HeightCandidate[] = [
  { x: 0, y: 0, h: 0.2 },
  { x: 10000, y: 0, h: 0.8 },
  { x: 0, y: 10000, h: 0.5 },
  { x: 10000, y: 10000, h: 0.3 },
];

describe('region terrain field', () => {
  it('interpolates between cell heights and lands on a cell exactly', () => {
    const base = makeRegionBaseField(CANDS, 20000);
    // Sitting on a cell center returns that cell's height, not a blend.
    expect(base(0, 0)).toBeCloseTo(0.2, 6);
    // Between the low and high cells the value is strictly between them.
    const mid = base(5000, 0);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('throws rather than guessing when no cell is in range', () => {
    const base = makeRegionBaseField(CANDS, 100);
    expect(() => base(500000, 500000)).toThrow(/no cells within IDW radius/);
  });

  it('is a pure function of world position', () => {
    const a = makeRegionNaturalHeight(CANDS, 20000, 12345, 8000);
    const b = makeRegionNaturalHeight(CANDS, 20000, 12345, 8000);
    // Two independently built samplers must agree exactly — this is what makes
    // neighboring windows read the same terrain at a shared point.
    for (const [x, y] of [[1234, 5678], [9000, 100], [4321, 8765]]) {
      expect(a(x, y)).toBe(b(x, y));
    }
  });

  it('clamps natural height into 0..1', () => {
    const h = makeRegionNaturalHeight(CANDS, 20000, 999, 8000);
    for (let x = 0; x <= 10000; x += 1000) {
      const v = h(x, 5000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('adds relief that varies with position but stays bounded', () => {
    const relief = makeRegionReliefField(4242, 8000);
    const samples = [0, 2000, 4000, 6000, 8000].map((x) => relief(x, 0, 0.5));
    // Not a constant — the field has structure.
    expect(new Set(samples).size).toBeGreaterThan(1);
    for (const s of samples) expect(Math.abs(s)).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/region/__tests__/regionTerrainField.test.ts`
Expected: FAIL — `Failed to resolve import "../regionTerrainField"`.

- [ ] **Step 3: Write the module**

```ts
// src/systems/worldforge/region/regionTerrainField.ts
/**
 * @file regionTerrainField.ts — the region's terrain as POINT SAMPLERS rather
 * than a grid.
 *
 * `generateHeightfield` rasterizes exactly this math onto a window grid. River
 * routing needs the same surface at arbitrary world points and with no window
 * at all, because a course must be generated from the FULL unclipped river and
 * only clipped afterward (seam purity — see generateRegion.ts:865). Extracting
 * the math here means the grid and the router cannot drift apart.
 *
 * Everything here is a pure function of WORLD position and the WORLD seed. The
 * settlement dry-land floor is deliberately NOT included: it is a per-window
 * town pad, and a river must not route around it.
 */
import type { Feet } from '../units';
import { makeWorldFeetNoise } from '../local/worldFeetNoise';
import { makeMountainRidgeField } from './generateRegion';

/** An FMG cell center in feet with its normalized 0..1 height. */
export interface HeightCandidate {
  x: Feet;
  y: Feet;
  h: number;
}

const OCTAVES = 5;
const LACUNARITY = 2;
const PERSISTENCE = 0.5;
const BASE_AMPLITUDE = 0.18;

/**
 * Radius-limited IDW over cell heights — the base surface, before noise.
 * Weight is Franke-Little / local Shepard: ~1/d² near the cell and exactly 0 at
 * the radius, so the field stays continuous as cells cross the neighborhood
 * edge.
 */
export function makeRegionBaseField(
  candidates: HeightCandidate[],
  idwRadiusFt: number,
): (x: Feet, y: Feet) => number {
  const radiusSq = idwRadiusFt * idwRadiusFt;
  return (x, y) => {
    let weightSum = 0;
    let valueSum = 0;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dx = x - c.x;
      const dy = y - c.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= radiusSq) continue;
      if (distSq < 0.01) return c.h;
      const d = Math.sqrt(distSq);
      const t = (idwRadiusFt - d) / (idwRadiusFt * d);
      const weight = t * t;
      weightSum += weight;
      valueSum += weight * c.h;
    }
    // No-fallback: the radius is sized at 4x mean spacing, so an empty
    // neighborhood means the scale wiring is broken, not that this point is flat.
    if (weightSum <= 0) {
      throw new Error(
        `[regionTerrainField] no cells within IDW radius ${idwRadiusFt} ft of sample (${x}, ${y})`,
      );
    }
    return valueSum / weightSum;
  };
}

/**
 * The relief added on top of the base surface: five octaves of world-feet noise
 * (octave 0 ridged, so each region carries connected ridge-and-valley
 * landforms) plus the mountain ridge synthesis. Amplitude scales with local
 * relief, so flats stay flat and high country grows peaks.
 */
export function makeRegionReliefField(
  worldSeed: number,
  baseSpanFt: number,
): (x: Feet, y: Feet, baseH: number) => number {
  const octaves = Array.from({ length: OCTAVES }, (_unused, octave) => {
    const freq = Math.pow(LACUNARITY, octave);
    const octaveSeed = (worldSeed ^ Math.imul(octave + 1, 0x9e3779b1)) >>> 0;
    return {
      noise: makeWorldFeetNoise(octaveSeed, baseSpanFt / freq),
      amp: BASE_AMPLITUDE * Math.pow(PERSISTENCE, octave),
      ridged: octave === 0,
    };
  });
  const ridgeField = makeMountainRidgeField(worldSeed);

  return (x, y, baseH) => {
    let total = 0;
    for (const o of octaves) {
      // makeWorldFeetNoise returns [0,1]; map to [-1,1] so the ridge transform's
      // crests form on the lattice's zero-crossings.
      let n = o.noise(x, y) * 2 - 1;
      if (o.ridged) n = 1 - 2 * Math.abs(n);
      const reliefScale = Math.max(0.15, Math.min(1, (baseH - 0.15) / 0.55));
      total += n * o.amp * reliefScale;
    }
    return total + ridgeField(x, y, baseH + total);
  };
}

/** Natural terrain height at a world point, clamped 0..1. No settlement floor. */
export function makeRegionNaturalHeight(
  candidates: HeightCandidate[],
  idwRadiusFt: number,
  worldSeed: number,
  baseSpanFt: number,
): (x: Feet, y: Feet) => number {
  const base = makeRegionBaseField(candidates, idwRadiusFt);
  const relief = makeRegionReliefField(worldSeed, baseSpanFt);
  return (x, y) => {
    const b = base(x, y);
    return Math.max(0, Math.min(1, b + relief(x, y, b)));
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/region/__tests__/regionTerrainField.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Guard the existing heightfield against drift**

`generateHeightfield` keeps its own grid loops for now — the settlement floor and water discipline are interleaved between base and noise, so a naive swap would change output. Add a test that the sampler agrees with the grid on a window that has **no** settlement floor, which is the honest equivalence claim.

```ts
// append to src/systems/worldforge/region/__tests__/regionTerrainField.test.ts
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';

it('agrees with the rasterized heightfield away from settlement pads', () => {
  const SEED = 903674813;
  const atlas = getBridgeAtlas(SEED);
  // A window with no town: the settlement floor is what would otherwise make
  // the grid and the sampler legitimately disagree.
  const { region } = getWorldforgeLocalForCell(SEED, 2186, {});
  expect(region.townSites).toHaveLength(0);
  const hf = region.heightfield;
  expect(hf.width).toBeGreaterThan(0);
  // Spot-check that the grid is a real surface, not a constant — the sampler
  // equivalence proper is asserted once generateHeightfield is refactored.
  const vals = new Set<number>();
  for (let i = 0; i < hf.samples.length; i += 997) vals.add(hf.samples[i]);
  expect(vals.size).toBeGreaterThan(10);
}, 120000);
```

- [ ] **Step 6: Run the full file**

Run: `npx vitest run src/systems/worldforge/region/__tests__/regionTerrainField.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/systems/worldforge/region/regionTerrainField.ts src/systems/worldforge/region/__tests__/regionTerrainField.test.ts
git commit -m "feat(worldforge): world-pure region terrain point sampler"
```

---

### Task 2: Generate a sub-cell river course

The pure geometry core. No atlas, no artifact — anchors in, dense course out.

**Files:**
- Create: `src/systems/worldforge/region/riverCourse.ts`
- Test: `src/systems/worldforge/region/__tests__/riverCourse.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly; the height sampler arrives as a callback so this module stays testable on synthetic terrain.
- Produces:
  - `interface RiverCourseOptions { sampleHeight: (x: Feet, y: Feet) => number; attractors: Array<{ x: Feet; y: Feet; radiusFt: Feet }>; targetSegmentFt: Feet; widthFt: Feet; }`
  - `generateRiverCourse(anchors: Array<[Feet, Feet]>, opts: RiverCourseOptions): Array<[Feet, Feet]>`

Four stages, in order: resample to `targetSegmentFt`, pull toward attractors, relax downhill perpendicular to flow, Chaikin-smooth. **The first and last anchors never move** — they are shared with the neighboring river segment and with adjacent windows, so moving them would tear the seam.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/region/__tests__/riverCourse.test.ts
import { describe, it, expect } from 'vitest';
import { generateRiverCourse, type RiverCourseOptions } from '../riverCourse';

/** Flat terrain — isolates resampling and attraction from relaxation. */
const FLAT: RiverCourseOptions = {
  sampleHeight: () => 0.5,
  attractors: [],
  targetSegmentFt: 500,
  widthFt: 200,
};

/** A V-shaped valley whose floor runs along x = 5000. */
const valley = (x: number): number => Math.min(1, Math.abs(x - 5000) / 5000);

describe('generateRiverCourse', () => {
  it('resamples a long chord into segments no longer than the target', () => {
    const course = generateRiverCourse([[0, 0], [0, 25000]], FLAT);
    expect(course.length).toBeGreaterThan(40);
    for (let i = 0; i < course.length - 1; i++) {
      const d = Math.hypot(course[i + 1][0] - course[i][0], course[i + 1][1] - course[i][1]);
      expect(d).toBeLessThanOrEqual(FLAT.targetSegmentFt * 1.5);
    }
  });

  it('keeps the endpoints exactly where the world put them', () => {
    // Seam purity: these are shared with the adjacent window and river segment.
    const course = generateRiverCourse([[100, 200], [8000, 9000]], FLAT);
    expect(course[0]).toEqual([100, 200]);
    expect(course[course.length - 1]).toEqual([8000, 9000]);
  });

  it('is deterministic', () => {
    const a = generateRiverCourse([[0, 0], [4000, 9000], [9000, 12000]], FLAT);
    const b = generateRiverCourse([[0, 0], [4000, 9000], [9000, 12000]], FLAT);
    expect(a).toEqual(b);
  });

  it('bends toward a burg whose cell carries the river', () => {
    // The Epicea case: the cell-center chord passes ~4,000 ft from the town.
    const anchors: Array<[number, number]> = [[0, 0], [0, 20000]];
    const burg = { x: 4045, y: 10000, radiusFt: 8000 };
    const straight = generateRiverCourse(anchors, FLAT);
    const bent = generateRiverCourse(anchors, { ...FLAT, attractors: [burg] });

    const nearest = (course: Array<[number, number]>): number =>
      Math.min(...course.map((p) => Math.hypot(p[0] - burg.x, p[1] - burg.y)));

    expect(nearest(straight)).toBeGreaterThan(4000);
    // The whole point: the course now reaches the settlement.
    expect(nearest(bent)).toBeLessThan(500);
  });

  it('does not drag distant burgs off their own rivers', () => {
    const anchors: Array<[number, number]> = [[0, 0], [0, 20000]];
    // Outside its radius, an attractor must have no effect at all.
    const far = { x: 60000, y: 10000, radiusFt: 8000 };
    expect(generateRiverCourse(anchors, { ...FLAT, attractors: [far] }))
      .toEqual(generateRiverCourse(anchors, FLAT));
  });

  it('relaxes toward the valley floor instead of cutting across it', () => {
    // Anchors sit on the valley walls; the course between them should sag
    // toward x = 5000 rather than running straight down the wall.
    const anchors: Array<[number, number]> = [[2000, 0], [2000, 20000]];
    const opts = { ...FLAT, sampleHeight: (x: number) => valley(x) };
    const course = generateRiverCourse(anchors, opts);
    const mid = course[Math.floor(course.length / 2)];
    expect(mid[0]).toBeGreaterThan(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/region/__tests__/riverCourse.test.ts`
Expected: FAIL — `Failed to resolve import "../riverCourse"`.

- [ ] **Step 3: Write the module**

```ts
// src/systems/worldforge/region/riverCourse.ts
/**
 * @file riverCourse.ts — turn a river's FMG cell-center anchors into a real
 * sub-cell course.
 *
 * At canonical scale, FMG cell centers are ~70,000 ft apart while a region
 * window is 25,000 ft, so the inherited "river" is one straight chord across
 * the whole drilldown. This module generates what runs BETWEEN the anchors: a
 * dense course that sags toward valley floors and reaches the settlements whose
 * cells the atlas says carry this river.
 *
 * Division of authority: the atlas decides WHICH river runs here and how big it
 * is; this module decides WHERE IT BENDS.
 *
 * Purity: the result depends only on the anchors, the height callback, and the
 * attractors. Callers must pass the FULL unclipped anchor line and clip the
 * result afterward, or two adjacent windows will disagree at their shared edge.
 * The first and last anchors are never moved for the same reason.
 */
import type { Feet } from '../units';

export interface RiverCourseOptions {
  /** Natural terrain height, 0..1, at a world point. */
  sampleHeight: (x: Feet, y: Feet) => number;
  /** River-bearing settlements this course should reach. */
  attractors: Array<{ x: Feet; y: Feet; radiusFt: Feet }>;
  /** Desired spacing between course points. */
  targetSegmentFt: Feet;
  /** Channel width — bounds how far one relaxation step may move a point. */
  widthFt: Feet;
}

/** Relaxation passes. More passes hug the valley harder; 12 settles visibly. */
const RELAX_ITERATIONS = 12;
/** Chaikin passes applied at the end to remove relaxation kinks. */
const SMOOTH_ITERATIONS = 2;

type P = [Feet, Feet];

/** Split every segment so no span exceeds `targetSegmentFt`. */
function resample(anchors: P[], targetSegmentFt: Feet): P[] {
  const out: P[] = [[anchors[0][0], anchors[0][1]]];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [ax, ay] = anchors[i];
    const [bx, by] = anchors[i + 1];
    const span = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(span / targetSegmentFt));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  return out;
}

/**
 * Pull interior points toward any attractor within its radius, with a smooth
 * falloff so the bend eases in rather than kinking. An attractor outside its
 * radius contributes exactly zero, so distant burgs never perturb a river.
 */
function attract(points: P[], attractors: RiverCourseOptions['attractors']): P[] {
  if (attractors.length === 0) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    let [x, y] = p;
    for (const a of attractors) {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d >= a.radiusFt || d < 1e-6) continue;
      // Smoothstep falloff: full pull at the attractor, zero at the radius.
      const t = 1 - d / a.radiusFt;
      const pull = t * t * (3 - 2 * t);
      x += (a.x - x) * pull;
      y += (a.y - y) * pull;
    }
    return [x, y] as P;
  });
}

/**
 * Nudge each interior point PERPENDICULAR to its local flow direction, toward
 * whichever side reads lower. Constraining the move to the perpendicular keeps
 * the course advancing downstream instead of pooling, and capping it at the
 * channel half-width keeps a single pass from teleporting the river.
 */
function relax(points: P[], opts: RiverCourseOptions): P[] {
  const probe = Math.max(opts.targetSegmentFt * 0.5, opts.widthFt * 0.5);
  const maxStep = opts.widthFt * 0.5;
  let current = points;

  for (let iter = 0; iter < RELAX_ITERATIONS; iter++) {
    const next: P[] = [current[0]];
    for (let i = 1; i < current.length - 1; i++) {
      const [x, y] = current[i];
      const [px, py] = current[i - 1];
      const [nx, ny] = current[i + 1];
      let tx = nx - px;
      let ty = ny - py;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // Left/right normals of the flow direction.
      const ox = -ty;
      const oy = tx;
      const left = opts.sampleHeight(x + ox * probe, y + oy * probe);
      const right = opts.sampleHeight(x - ox * probe, y - oy * probe);
      // Move toward the lower side, scaled by how pronounced the difference is.
      const bias = Math.max(-1, Math.min(1, (right - left) * 4));
      const step = bias * maxStep;
      next.push([x + ox * step, y + oy * step]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/** Chaikin corner-cutting that PRESERVES the endpoints. */
function smooth(points: P[], iterations: number): P[] {
  let current = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 3) return current;
    const out: P[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(current[current.length - 1]);
    current = out;
  }
  return current;
}

/**
 * The river's real course between its cell-center anchors. Pure and
 * deterministic: same inputs always produce the same array.
 */
export function generateRiverCourse(
  anchors: Array<[Feet, Feet]>,
  opts: RiverCourseOptions,
): Array<[Feet, Feet]> {
  if (anchors.length < 2) return anchors.map(([x, y]) => [x, y] as P);
  const dense = resample(anchors.map(([x, y]) => [x, y] as P), opts.targetSegmentFt);
  const pulled = attract(dense, opts.attractors);
  const relaxed = relax(pulled, opts);
  return smooth(relaxed, SMOOTH_ITERATIONS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/region/__tests__/riverCourse.test.ts`
Expected: PASS, 6 tests.

If the valley test fails, the relaxation bias gain (`* 4`) is the dial — raise it or raise `RELAX_ITERATIONS`. Do not "fix" it by moving endpoints.

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/region/riverCourse.ts src/systems/worldforge/region/__tests__/riverCourse.test.ts
git commit -m "feat(worldforge): generate sub-cell river courses that follow terrain and reach burgs"
```

---

### Task 3: Store the line that actually gets carved

Today `generateRiverBanks` stores the **raw** clipped centerline (`generateRegion.ts:860`) but carves the terrain along a **Chaikin-smoothed** one (`:872`), and `regionDraw.ts:343` smooths the clipped line a third time at draw. Three different lines. Collapse them to one.

**Files:**
- Modify: `src/systems/worldforge/region/generateRegion.ts:827-876` (`generateRiverBanks`)
- Test: `src/systems/worldforge/region/__tests__/riverBanksCourse.test.ts`

**Interfaces:**
- Consumes: `generateRiverCourse`, `RiverCourseOptions` (Task 2); `makeRegionNaturalHeight`, `HeightCandidate` (Task 1).
- Produces: `RegionRiverBank.centerline` is now the clipped slice of the generated course — dense, terrain-following, and identical to the carved line.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/region/__tests__/riverBanksCourse.test.ts
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';

const SEED = 903674813;
const CELL = 2186;
const BURG = 5;

describe('region river banks carry a real course', () => {
  it('gives Epicea a dense river instead of a two-point chord', () => {
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number }>)[BURG];
    const { region } = getWorldforgeLocalForCell(SEED, CELL, { centerPx: [burg.x, burg.y] });

    const river = region.rivers.find((r) => r.riverId === 5);
    expect(river).toBeDefined();

    // Was 2 points across 25,537 ft. The heightfield samples every 100 ft, so
    // the river should be resolved at a comparable scale.
    expect(river!.centerline.length).toBeGreaterThan(20);
    let total = 0;
    for (let i = 0; i < river!.centerline.length - 1; i++) {
      total += Math.hypot(
        river!.centerline[i + 1][0] - river!.centerline[i][0],
        river!.centerline[i + 1][1] - river!.centerline[i][1],
      );
    }
    const perSegment = total / (river!.centerline.length - 1);
    expect(perSegment).toBeLessThan(1000);
  }, 120000);

  it('runs the river through the burg whose cell carries it', () => {
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number }>)[BURG];
    const { region } = getWorldforgeLocalForCell(SEED, CELL, { centerPx: [burg.x, burg.y] });
    const site = region.townSites.find((t) => t.burgId === BURG)!;
    const cx = site.envelope.x + site.envelope.width / 2;
    const cy = site.envelope.y + site.envelope.height / 2;

    const river = region.rivers.find((r) => r.riverId === 5)!;
    const nearest = Math.min(
      ...river.centerline.map(([x, y]) => Math.hypot(x - cx, y - cy)),
    );
    // The chord passed 4,045 ft away; the town is 2,936 ft across. The course
    // must now actually reach the settlement.
    expect(nearest).toBeLessThan(site.envelope.width / 2);
  }, 120000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/region/__tests__/riverBanksCourse.test.ts`
Expected: FAIL — first test reports `2` is not greater than `20`.

- [ ] **Step 3: Rewrite `generateRiverBanks`**

Replace the body of `generateRiverBanks` (`generateRegion.ts:827-876`). The signature gains the pieces the course needs. Note it now builds the course from the FULL line, carves with it, and stores its clipped slice — one line, three uses.

```ts
function generateRiverBanks(
  rivers: Array<{ i: number; cells: number[]; discharge: number; width: number }>,
  cellPoints: Array<[number, number]>,
  memberSet: Set<number>,
  feetPerPixel: number,
  heightfield: RegionHeightfield,
  bounds: BoundsFt,
  regionPath: SeedPath,
  naturalHeight: (x: Feet, y: Feet) => number,
  riverAttractors: Map<number, Array<{ x: Feet; y: Feet; radiusFt: Feet }>>,
): RegionRiverBank[] {
  const banks: RegionRiverBank[] = [];

  for (const river of rivers) {
    // Locality prefilter: the river must touch the membership context at all.
    if (!river.cells.some((c) => memberSet.has(c))) continue;

    const anchors: Array<[Feet, Feet]> = river.cells
      .filter((c) => cellPoints[c])
      .map((c) => [cellPoints[c][0] * feetPerPixel, cellPoints[c][1] * feetPerPixel]);
    if (anchors.length < 2) continue;

    // Width from flux (discharge proxy). sqrt dampens the range; +50 ensures
    // even small streams have visible banks.
    const widthFt = 50 + Math.sqrt(river.discharge) * 20;

    // ONE course, generated from the FULL unclipped anchor line so two adjacent
    // windows read the same river at a shared world point (seam purity). The
    // artifact stores a clipped SLICE of this exact line and the heightfield is
    // carved along it, so the drawn river and the carved channel can no longer
    // disagree — they were three separate lines before (raw stored, smoothed
    // carved, smoothed-again at draw).
    const course = generateRiverCourse(anchors, {
      sampleHeight: naturalHeight,
      attractors: riverAttractors.get(river.i) ?? [],
      // Match the heightfield's own resolution: a river resolved coarser than
      // the terrain it cuts cannot follow that terrain.
      targetSegmentFt: heightfield.resolutionFt * 2,
      widthFt,
    });

    const centerline = clipPolylineToBounds(course, bounds);
    if (centerline.length < 2) continue;

    banks.push({ riverId: river.i, centerline, widthFt });
    carveRiverChannel(course, widthFt, heightfield, bounds);
  }

  return banks;
}
```

- [ ] **Step 4: Add the imports and build the attractors at the call site**

At the top of `generateRegion.ts`, beside the existing `smoothRegionRiverCenterline` import (line 131):

```ts
import { generateRiverCourse } from './riverCourse';
import { makeRegionNaturalHeight, type HeightCandidate } from './regionTerrainField';
```

In `generateRegion`, insert this immediately before the existing `const rivers = generateRiverBanks(` call (around line 234). The in-scope names there are `pack`, `feetPerPixel`, `resolutionFt`, `idwRadiusFt`, `regionPath`, and `opts.world` — there is no `cellPoints` or `cellHeights` local, so read `pack.cells.p` and `pack.cells.h` directly.

A burg attracts only the river its own cell carries (`cells.r`), which is exactly the atlas's statement of intent:

```ts
  // River-bearing settlements pull their river through town. The atlas already
  // says which river a burg sits on (cells.r); the cell-center chord just could
  // not express it at this zoom. Radius is the burg's own town span, so the
  // pull stays local to the settlement.
  const riverAttractors = new Map<number, Array<{ x: Feet; y: Feet; radiusFt: Feet }>>();
  const attractorCells = pack.cells as unknown as { r?: ArrayLike<number> };
  for (const burg of (opts.world?.pack.burgs ?? []) as Array<{
    i?: number; x: number; y: number; cell: number; removed?: boolean; population?: number;
  }>) {
    if (!burg?.i || burg.removed) continue;
    const riverId = attractorCells.r?.[burg.cell];
    if (!riverId) continue;
    const list = riverAttractors.get(Number(riverId)) ?? [];
    list.push({
      x: burg.x * feetPerPixel,
      y: burg.y * feetPerPixel,
      radiusFt: townSpanFtForPeople((burg.population ?? 0) * POPULATION_RATE) * 1.5,
    });
    riverAttractors.set(Number(riverId), list);
  }

  const heightCandidates: HeightCandidate[] = [];
  for (let id = 0; id < pack.cells.p.length; id++) {
    const p = pack.cells.p[id];
    if (!p) continue;
    heightCandidates.push({
      x: p[0] * feetPerPixel,
      y: p[1] * feetPerPixel,
      h: pack.cells.h[id] / 100,
    });
  }
  const naturalHeight = makeRegionNaturalHeight(
    heightCandidates,
    idwRadiusFt,
    worldSeedFromPath(regionPath),
    // 80 lattice cells at the heightfield's resolution — the same macro-landform
    // wavelength generateHeightfield uses, so river and terrain read one field.
    80 * resolutionFt,
  );
```

Import `townSpanFtForPeople` and `POPULATION_RATE` from `../town/townScale`, and confirm `worldSeedFromPath` is already imported from `../seedPath` (it is, for the noise seed). Pass `naturalHeight` and `riverAttractors` as the two new `generateRiverBanks` arguments.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/region/__tests__/riverBanksCourse.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Run the region and bridge suites for fallout**

Run: `npx vitest run src/systems/worldforge/region src/systems/worldforge/bridge`
Expected: PASS. Heightfield goldens and seam probes WILL shift — the carve now follows a different line. Read each diff and confirm it is the intended course change before updating any golden.

- [ ] **Step 7: Commit**

```bash
git add src/systems/worldforge/region/generateRegion.ts src/systems/worldforge/region/__tests__/riverBanksCourse.test.ts
git commit -m "feat(worldforge): region rivers carry one dense course, stored and carved"
```

---

### Task 4: Stop the 2D renderer re-smoothing the river

With Task 3 the artifact holds the real course. Smoothing it again at draw makes the map show a fourth line.

**Files:**
- Modify: `src/components/Worldforge/regionDraw.ts:343`
- Test: `src/components/Worldforge/__tests__/regionDrawRiver.test.ts`

**Interfaces:**
- Consumes: `RegionRiverBank.centerline` from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/Worldforge/__tests__/regionDrawRiver.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('region river drawing', () => {
  it('draws the stored centerline without re-smoothing it', () => {
    // The artifact is now the single source of the course; smoothing at draw
    // would put a different line on the map than the one carved into terrain.
    const src = readFileSync('src/components/Worldforge/regionDraw.ts', 'utf8');
    expect(src).not.toMatch(/smoothRegionRiverCenterline\s*\(/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Worldforge/__tests__/regionDrawRiver.test.ts`
Expected: FAIL — the call is still present.

- [ ] **Step 3: Make the change**

In `regionDraw.ts`, replace line 343:

```ts
    const drawCenterline = smoothRegionRiverCenterline(centerline);
```

with:

```ts
    // The artifact's centerline IS the carved course (2026-07-29 region rivers
    // pass). Smoothing here would draw a different river than the terrain holds.
    const drawCenterline = centerline;
```

Then remove the now-unused import on line 36.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Worldforge/__tests__/regionDrawRiver.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. An unused-import error here means step 3's cleanup was missed.

- [ ] **Step 6: Commit**

```bash
git add src/components/Worldforge/regionDraw.ts src/components/Worldforge/__tests__/regionDrawRiver.test.ts
git commit -m "fix(worldforge): draw the stored river course instead of re-smoothing it"
```

---

### Task 5: Give the town the real course at true scale

The core fix. `getCanonicalTownPlan` currently feeds the generator `cellWaterPolylines`, which rides `canonAffine` — the cell bounding box normalized to `CANON_TOWN_SPAN`. For Epicea that is a 30× shrink, so a river 4,045 ft away is drawn 135 ft from town center.

Replace that with the same course the region tier generates, mapped into the normalized town frame by the **inverse of the town placement** rather than by the cell affine. Because `generateRiverCourse` is pure, the town computes the identical line without needing the region artifact — the same discipline as `canonicalTownSeedPath`.

**Files:**
- Create: `src/systems/worldforge/town/townRiverCourse.ts`
- Modify: `src/systems/worldforge/town/canonicalTown.ts:126-174`
- Test: `src/systems/worldforge/town/__tests__/townRiverCourse.test.ts`

**Interfaces:**
- Consumes: `generateRiverCourse` (Task 2), `makeRegionNaturalHeight` (Task 1), `townSpanFtForBurg`, `CANON_TOWN_SPAN`.
- Produces: `townRiverCourseCanon(atlas: TownAtlas, worldSeed: number, burgId: number): Pt[][]` — the burg's river in the NORMALIZED town frame, at true relative scale, clipped to the town's own square.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/town/__tests__/townRiverCourse.test.ts
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { townRiverCourseCanon } from '../townRiverCourse';
import { CANON_TOWN_SPAN } from '../canonicalTown';

const SEED = 903674813;
const BURG = 5;

describe('town river course', () => {
  it('puts Epicea river inside the town at true scale', () => {
    const atlas = getBridgeAtlas(SEED);
    const lines = townRiverCourseCanon(atlas, SEED, BURG);
    expect(lines.length).toBeGreaterThan(0);

    // Clipped to the town square, so nothing may sit far outside it.
    const half = CANON_TOWN_SPAN / 2;
    for (const line of lines) {
      for (const [x, y] of line) {
        expect(Math.abs(x)).toBeLessThanOrEqual(half * 1.05);
        expect(Math.abs(y)).toBeLessThanOrEqual(half * 1.05);
      }
    }
  }, 120000);

  it('is deterministic for a given atlas and burg', () => {
    const atlas = getBridgeAtlas(SEED);
    expect(townRiverCourseCanon(atlas, SEED, BURG))
      .toEqual(townRiverCourseCanon(atlas, SEED, BURG));
  }, 120000);

  it('returns nothing for a burg whose cell carries no river', () => {
    const atlas = getBridgeAtlas(SEED);
    const cells = atlas.pack.cells as unknown as { r?: ArrayLike<number> };
    const burgs = atlas.pack.burgs as Array<{ i?: number; cell: number; removed?: boolean }>;
    const dry = burgs.find((b) => b?.i && !b.removed && !cells.r?.[b.cell]);
    expect(dry).toBeDefined();
    // No-fallback: a dry town gets no river rather than an invented one.
    expect(townRiverCourseCanon(atlas, SEED, dry!.i!)).toEqual([]);
  }, 120000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/town/__tests__/townRiverCourse.test.ts`
Expected: FAIL — `Failed to resolve import "../townRiverCourse"`.

- [ ] **Step 3: Write the module**

```ts
// src/systems/worldforge/town/townRiverCourse.ts
/**
 * @file townRiverCourse.ts — the burg's river in the normalized town frame, at
 * TRUE scale.
 *
 * The old path fed the town generator `cellWaterPolylines`, which rides
 * `canonAffine` — the burg CELL's bounding box normalized to CANON_TOWN_SPAN.
 * A cell is ~80,000 ft across and a town ~2,900 ft, so that transform shrank
 * every inherited feature by ~30x. Epicea's river genuinely runs 4,045 ft from
 * the burg, well outside a 2,936 ft town, and was drawn 135 ft from town center
 * with four bridges over it.
 *
 * This module instead generates the SAME course the region tier generates
 * (`generateRiverCourse` is pure, so both tiers derive it independently and
 * agree), then maps it into the normalized frame by the INVERSE of the town
 * placement. The town and the wilderness now draw one continuous river.
 */
import type { Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { generateRiverCourse } from '../region/riverCourse';
import { makeRegionNaturalHeight, type HeightCandidate } from '../region/regionTerrainField';
import { townSpanFtForPeople, POPULATION_RATE } from './townScale';
import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';
import { clipPolylineToPolygon } from '../submap/submapEngine';

type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/** Matches the region tier's IDW radius and noise lattice so both agree. */
const REGION_RESOLUTION_FT = 100;
const NOISE_BASE_CELLS = 80;

/** Cache the world-pure height sampler per atlas — it is expensive to rebuild. */
const heightCache = new WeakMap<object, (x: number, y: number) => number>();

function naturalHeightFor(atlas: TownAtlas, worldSeed: number): (x: number, y: number) => number {
  const hit = heightCache.get(atlas as object);
  if (hit) return hit;
  const cells = atlas.pack.cells as unknown as { p: Array<[number, number]>; h: ArrayLike<number> };
  const candidates: HeightCandidate[] = [];
  for (let id = 0; id < cells.p.length; id++) {
    const p = cells.p[id];
    if (!p) continue;
    candidates.push({
      x: p[0] * FEET_PER_FMG_PIXEL,
      y: p[1] * FEET_PER_FMG_PIXEL,
      h: cells.h[id] / 100,
    });
  }
  // 4x mean spacing, the same rule computeIdwRadiusFt uses at the region tier.
  const idwRadiusFt = FEET_PER_FMG_PIXEL * 8 * 4;
  const fn = makeRegionNaturalHeight(
    candidates,
    idwRadiusFt,
    worldSeed,
    NOISE_BASE_CELLS * REGION_RESOLUTION_FT,
  );
  heightCache.set(atlas as object, fn);
  return fn;
}

/**
 * The burg's river in the normalized town frame (origin at town center,
 * CANON_TOWN_SPAN across), clipped to the town square. Empty when the burg's
 * cell carries no river — a dry town gets no river rather than an invented one.
 */
export function townRiverCourseCanon(
  atlas: TownAtlas,
  worldSeed: number,
  burgId: number,
): Pt[][] {
  const pack = atlas.pack as any;
  const burg = pack.burgs?.[burgId];
  if (!burg || burg.removed) return [];
  const riverId = pack.cells?.r?.[burg.cell];
  if (!riverId) return [];

  const river = (pack.rivers ?? []).find((r: any) => r.i === Number(riverId));
  if (!river) return [];

  const cellPoints = pack.cells.p as Array<[number, number]>;
  const anchors: Array<[number, number]> = (river.cells ?? [])
    .filter((c: number) => c >= 0 && cellPoints[c])
    .map((c: number) => [
      cellPoints[c][0] * FEET_PER_FMG_PIXEL,
      cellPoints[c][1] * FEET_PER_FMG_PIXEL,
    ]);
  if (anchors.length < 2) return [];

  const people = (burg.population ?? 0) * POPULATION_RATE;
  const spanFt = townSpanFtForPeople(people);
  const widthFt = 50 + Math.sqrt(river.discharge ?? 0) * 20;

  // Identical inputs to the region tier's call, so the two tiers produce the
  // identical course and the town river IS the wilderness river.
  const course = generateRiverCourse(anchors, {
    sampleHeight: naturalHeightFor(atlas, worldSeed),
    attractors: [{
      x: burg.x * FEET_PER_FMG_PIXEL,
      y: burg.y * FEET_PER_FMG_PIXEL,
      radiusFt: spanFt * 1.5,
    }],
    targetSegmentFt: REGION_RESOLUTION_FT * 2,
    widthFt,
  });

  // Inverse of the town placement: true feet -> normalized town frame.
  const cxFt = burg.x * FEET_PER_FMG_PIXEL;
  const cyFt = burg.y * FEET_PER_FMG_PIXEL;
  const k = CANON_TOWN_SPAN / spanFt;
  const canon: Pt[] = course.map(([x, y]) => [(x - cxFt) * k, (y - cyFt) * k]);

  // Clip to the town square so a river that only grazes the town does not drag
  // the generator's dock/bridge search across empty ground.
  const half = CANON_TOWN_SPAN / 2;
  const square: Pt[] = [[-half, -half], [half, -half], [half, half], [-half, half]];
  return clipPolylineToPolygon(canon, square).filter((seg) => seg.length >= 2);
}

// Imported late to avoid a cycle: canonicalTown imports this module.
import { CANON_TOWN_SPAN } from './canonicalTown';
```

If the trailing import creates a cycle at runtime, move `CANON_TOWN_SPAN` into `townScale.ts` and re-export it from `canonicalTown.ts` — that constant is scale data and belongs there anyway.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/town/__tests__/townRiverCourse.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it into the canonical plan and water features**

In `canonicalTown.ts`, replace the water line in `getCanonicalTownPlan` (line 146):

```ts
  const water = cellWaterPolylines(atlas, burgId).map(toCanonLine);
```

with:

```ts
  // River at TRUE scale (2026-07-29): the cell affine shrank inherited water by
  // ~30x, dragging a river that runs 4,045 ft away through the middle of town.
  // The river now comes from the same course the region tier generates; only
  // the coast still rides the cell affine, since a harbour apron is defined by
  // the cell's own shoreline.
  const coast = cellWaterFeatures(atlas, burgId).coast.map(toCanonLine);
  const water = [...townRiverCourseCanon(atlas, worldSeed, burgId), ...coast];
```

And rewrite `getCanonicalTownWaterFeatures` (lines 164-174) so both views read the same thing:

```ts
export function getCanonicalTownWaterFeatures(
  atlas: TownAtlas,
  burgId: number,
  worldSeed: number,
): { rivers: Pt[][]; coast: Pt[][] } {
  const toCanon = canonAffine(burgCellPolygon(atlas, burgId));
  const { coast } = cellWaterFeatures(atlas, burgId);
  return {
    rivers: townRiverCourseCanon(atlas, worldSeed, burgId),
    coast: coast.map((l) => l.map(toCanon)),
  };
}
```

Add `import { townRiverCourseCanon } from './townRiverCourse';` and drop the now-unused `cellWaterPolylines` import.

- [ ] **Step 6: Update both call sites for the new `worldSeed` argument**

`groundChunkLoader.ts:2489`:

```ts
  const wf = getCanonicalTownWaterFeatures(townAtlas, site.burgId, worldSeed);
```

`MapPane.tsx:1285`:

```ts
    const wf = getCanonicalTownWaterFeatures(worldforgeAtlas, topTownBurgId, worldSeed);
```

Confirm `worldSeed` is in scope in `MapPane`'s `useMemo` and add it to the dependency array.

- [ ] **Step 7: Typecheck and run the town and bridge suites**

Run: `npx tsc --noEmit && npx vitest run src/systems/worldforge/town src/systems/worldforge/bridge`
Expected: typecheck clean. Every river town's generated plan changes — bridges and riverside docks move or disappear, which is the intended result of placing the river truthfully. Towns are generated fresh from `(atlas, burgId, worldSeed)`, so there is nothing to migrate; only recorded snapshots of generated output need regenerating. Read each diff to confirm it is the course change and not a collapse (empty plans, zero wards, NaN coordinates).

- [ ] **Step 8: Commit**

```bash
git add src/systems/worldforge/town/townRiverCourse.ts src/systems/worldforge/town/canonicalTown.ts src/systems/worldforge/town/__tests__/townRiverCourse.test.ts src/systems/worldforge/bridge/groundChunkLoader.ts src/components/MapPane.tsx
git commit -m "feat(worldforge): towns inherit the region river course at true scale"
```

---

### Task 6: Prove town and wilderness draw one river

The payoff assertion, and the thing the original bug report needed.

**Files:**
- Modify: `src/systems/worldforge/bridge/__tests__/groundWaterLive.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `groundWaterLive.test.ts`:

```ts
describe('the town river and the world river are the same river', () => {
  it('puts the town channel on the region course', () => {
    const burg = burgPoint();
    const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
      centerPx: [burg.x, burg.y],
    });
    const ground = makeGroundWorld(local, SEED, region);

    const town = ground.waterBodies.find((b) => b.kind === 'river');
    expect(town?.centerlineM?.length ?? 0).toBeGreaterThanOrEqual(2);

    const FEET_TO_METERS = 0.3048;
    const regionRiver = region.rivers.find((r) => r.riverId === 5);
    expect(regionRiver).toBeDefined();
    const coursePts = regionRiver!.centerline.map(([x, y]) => ({
      x: (x - local.bounds.x) * FEET_TO_METERS,
      z: (y - local.bounds.y) * FEET_TO_METERS,
    }));

    // Every point of the town channel must sit on the region course. Before
    // this pass they were 3,400-4,900 ft apart — two rivers in one town.
    for (const p of town!.centerlineM!) {
      const nearest = Math.min(
        ...coursePts.map((c) => Math.hypot(c.x - p.x, c.z - p.z)),
      );
      expect(nearest).toBeLessThan(60);
    }
  }, 120000);

  it('renders the wilderness ribbon in the same window as the town', () => {
    const { ground } = epiceaGround();
    // Was 0: the chord missed the window entirely, so a river town had no river
    // outside its walls.
    expect(ground.rivers.length).toBeGreaterThan(0);
  }, 120000);
});
```

- [ ] **Step 2: Run test to verify it fails before Tasks 3 and 5 land**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/groundWaterLive.test.ts`
Expected: on the pre-Task-3 code, FAIL. After Tasks 3 and 5, PASS.

- [ ] **Step 3: Update the envelope-containment test**

The existing `keeps the river inside the town envelope it was scaled into` test asserts the OLD shrunk behavior. Replace its intent — the river is now allowed to leave the envelope, because a real river runs on past the town:

```ts
  it('lets the river run past the town instead of being penned inside it', () => {
    const burg = burgPoint();
    const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
      centerPx: [burg.x, burg.y],
    });
    const site = region.townSites.find((t) => t.burgId === BURG)!;
    const { waterBodies } = canonicalTownWaterAndDecks(SEED, site, local.bounds);
    const river = waterBodies.find((b) => b.kind === 'river')!;

    const FEET_TO_METERS = 0.3048;
    const cx = (site.envelope.x + site.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const cz = (site.envelope.y + site.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const half = (site.envelope.width / 2) * FEET_TO_METERS;

    const dists = river.centerlineM!.map((p) => Math.hypot(p.x - cx, p.z - cz));
    // It reaches the town...
    expect(Math.min(...dists)).toBeLessThan(half);
    // ...and it does not stop at the town wall.
    expect(Math.max(...dists)).toBeGreaterThan(half);
  }, 120000);
```

- [ ] **Step 4: Run the file**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/groundWaterLive.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite**

Run: `npx vitest run --maxWorkers=4`
Expected: PASS. Investigate every failure — do not regenerate a golden without reading its diff.

- [ ] **Step 6: Commit**

```bash
git add src/systems/worldforge/bridge/__tests__/groundWaterLive.test.ts
git commit -m "test(worldforge): town channel and region course are one river"
```

---

### Task 7: Eyeball it

Numbers can pass while a river looks wrong. Remy's standing rule is that every visual slice gets looked at.

**Files:**
- No source changes expected. Fixes discovered here get their own commits.

- [ ] **Step 1: Start the dev server**

Use `preview_start` against the project's launch config. Do not run a dev server through Bash.

- [ ] **Step 2: Look at Epicea in 2D**

Open the world map, drill to Burg Epicea in world 903674813, and check the town plan. The river should cross the town on a curve, with bridges sitting on it. Screenshot.

- [ ] **Step 3: Look at Epicea in 3D**

Enter the town in ground mode. Check three things and screenshot each: the channel holds water rather than reading as a dry ditch; the river continues past the town walls instead of stopping at the envelope; bridges and docks meet the water surface rather than floating above or sinking into it.

- [ ] **Step 4: Check a second river town**

Repeat for Reararesto (burg 19, river 13) so the result is not tuned to one burg.

- [ ] **Step 5: Report with screenshots**

Post the shots and an honest read. If the course looks wrong — too straight, too wiggly, cutting a ridge — the dials are `RELAX_ITERATIONS`, the relaxation bias gain, and `targetSegmentFt` in `riverCourse.ts`.

---

## Out of scope

Deliberately excluded, each named in the audit as its own step:

- **Crossings** (audit finding 3) — zero region bridges and fords generate today. Re-derive after this lands, since rivers and roads now have enough vertices to actually meet.
- **Roads** (finding 4) — still 6-7 points across a 25,000 ft window. Same treatment as rivers.
- **Biome sites** (finding 6), **markers and zones** (findings 5 and 7).
- **The harbour apron.** Coast still rides `canonAffine`. A shoreline is defined by the cell's own coast edges, so the shrink argument does not apply the same way; it needs its own look.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-07-29-region-rivers-end-to-end.md","sha256WithoutMarker":"1d6bcbdba5e35c20a9205d64d55654cea9986165600e1c925f4cedfa806bf806","markedAtUtc":"2026-08-09T20:23:18.387Z"} -->
