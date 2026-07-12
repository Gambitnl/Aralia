# Road Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing generated road network mechanically real (tiered travel speeds, graded biome speeds, tier-graded danger) and visually tiered (2D stroke language with forest fade, 3D tier ribbons with patchy faint paths), and make faint forest paths genuinely hard to follow (Survival DC ladder feeding the existing get-lost drift).

**Spec:** `docs/superpowers/specs/2026-07-11-road-systems-design.md` — read it first.

**Architecture:** One new pure tunables module + one new pure classification module (`routeTerrain.ts`) become the single source of truth for tier/biome speed, danger, navigation DC, and visibility. Both travel graph builders consume it (killing their duplicated tables). The FMG routes generator splits its output into `highways`/`roads`/`trails`/`paths`/`searoutes` groups. 2D renderers share one stroke-style module with per-segment visibility fade. 3D carries `kind` through `regionPolylinesToGround` into the existing tier-tinted ribbon pipeline.

**Tech Stack:** TypeScript, Vitest, React (2D SVG atlas), three.js/R3F ground pipeline (3D). No new dependencies.

## Global Constraints

- **NO manual git commits and NO branches/worktrees.** This repo auto-commits a daily snapshot; all work lands directly in `master`'s working tree. Where the standard task template says "Commit", instead: run the task's tests + `npx tsc --noEmit` and move on.
- **Agora lock before editing:** before modifying any file, `export AGORA_AGENT_ID=claude-roads` and lock the files via the Agora daemon (`node tools/agora/client.mjs lock <paths...> --reason "roads task N"`, or curl POST /locks). Release when the task ends. A 409 conflict = hard stop on that file; coordinate, don't override.
- **US-English plain-language comments** (GOV.UK style, US spelling), matching each file's existing comment density.
- Tests: run per-file via `npx vitest run <path>`. Type check: `npx tsc --noEmit` (repo has NO `typecheck` script; the tsconfig excludes nothing relevant).
- **SeededRandom convention:** `nextInt(min, max)` is MAX-EXCLUSIVE (d20 = `nextInt(1, 21)`).
- Do not touch files currently locked by other Agora agents (check `curl -s http://localhost:4319/locks`).
- ~346 empty test files + dev_hub.html build failure are known background noise — not yours to fix, not caused by you.

---

### Task 1: Tunables + terrain classification core (`roadTunables.ts`, `routeTerrain.ts`)

**Files:**
- Create: `src/systems/worldforge/travel/roadTunables.ts`
- Create: `src/systems/worldforge/travel/routeTerrain.ts`
- Test: `src/systems/worldforge/travel/__tests__/routeTerrain.test.ts`

**Interfaces:**
- Consumes: nothing (pure leaf modules).
- Produces (later tasks rely on these exact names):
  - `RouteTier = 'highway' | 'road' | 'trail' | 'path'`
  - `RouteVisibility = 'visible' | 'faint' | 'overgrown'`
  - `landSpeedFactor(biomeName: string, tier: RouteTier | null): number`
  - `landDanger(biomeName: string, tier: RouteTier | null): number`
  - `routeVisibility(biomeName: string, tier: RouteTier): RouteVisibility`
  - `navDC(biomeName: string, tier: RouteTier | null): number`
  - `navCause(biomeName: string, tier: RouteTier | null): 'road' | 'wilds' | 'faint-path'`
  - All tunable tables re-exported from `roadTunables.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/travel/__tests__/routeTerrain.test.ts
import { describe, it, expect } from 'vitest';
import {
  landSpeedFactor, landDanger, routeVisibility, navDC, navCause,
} from '../routeTerrain';
import {
  BIOME_SPEED_FACTOR, ROAD_TIER_SPEED, ROAD_TIER_DANGER_MULT,
} from '../roadTunables';

describe('landSpeedFactor', () => {
  it('grades off-road speed by biome (forest slower than plains)', () => {
    expect(landSpeedFactor('Grassland', null)).toBe(1.0);
    expect(landSpeedFactor('Temperate deciduous forest', null)).toBe(0.75);
    expect(landSpeedFactor('Wetland', null)).toBe(0.45);
    expect(landSpeedFactor('', null)).toBe(1.0); // unknown biome = open ground
  });
  it('highway and road ignore the biome penalty entirely', () => {
    expect(landSpeedFactor('Temperate rainforest', 'highway')).toBe(ROAD_TIER_SPEED.highway);
    expect(landSpeedFactor('Wetland', 'road')).toBe(ROAD_TIER_SPEED.road);
  });
  it('trail softens half the biome penalty, path softens a quarter', () => {
    // trail through deciduous forest: 1.1 * lerp(0.75, 1, 0.5) = 1.1 * 0.875
    expect(landSpeedFactor('Temperate deciduous forest', 'trail')).toBeCloseTo(1.1 * 0.875, 10);
    // path through deciduous forest: 1.0 * lerp(0.75, 1, 0.25) = 0.8125
    expect(landSpeedFactor('Temperate deciduous forest', 'path')).toBeCloseTo(0.8125, 10);
  });
  it('a road is never slower than walking the same biome off-road', () => {
    for (const biome of Object.keys(BIOME_SPEED_FACTOR)) {
      for (const tier of ['highway', 'road', 'trail', 'path'] as const) {
        expect(landSpeedFactor(biome, tier)).toBeGreaterThanOrEqual(landSpeedFactor(biome, null));
      }
    }
  });
});

describe('landDanger', () => {
  it('keeps the existing biome baseline off-road', () => {
    expect(landDanger('Grassland', null)).toBe(0.2);
    expect(landDanger('Glacier', null)).toBe(0.6);
    expect(landDanger('', null)).toBe(0.25); // default
  });
  it('scales danger down by tier (busier road = safer)', () => {
    expect(landDanger('Grassland', 'highway')).toBeCloseTo(0.2 * ROAD_TIER_DANGER_MULT.highway, 10);
    expect(landDanger('Grassland', 'path')).toBeCloseTo(0.2 * ROAD_TIER_DANGER_MULT.path, 10);
  });
});

describe('routeVisibility / navDC / navCause', () => {
  it('paths fade in forest and vanish in deep forest', () => {
    expect(routeVisibility('Grassland', 'path')).toBe('visible');
    expect(routeVisibility('Temperate deciduous forest', 'path')).toBe('faint');
    expect(routeVisibility('Taiga', 'path')).toBe('overgrown');
  });
  it('trails fade only in deep forest; roads and highways never fade', () => {
    expect(routeVisibility('Temperate deciduous forest', 'trail')).toBe('visible');
    expect(routeVisibility('Tropical rainforest', 'trail')).toBe('faint');
    expect(routeVisibility('Tropical rainforest', 'road')).toBe('visible');
    expect(routeVisibility('Taiga', 'highway')).toBe('visible');
  });
  it('navigation DC ladder: maintained roads 0; paths climb with forest density', () => {
    expect(navDC('Grassland', 'highway')).toBe(0);
    expect(navDC('Taiga', 'road')).toBe(0);
    expect(navDC('Grassland', 'trail')).toBe(0);
    expect(navDC('Temperate rainforest', 'trail')).toBe(5);
    expect(navDC('Grassland', 'path')).toBe(5);
    expect(navDC('Temperate deciduous forest', 'path')).toBe(8);
    expect(navDC('Taiga', 'path')).toBe(12);
    // Off-road keeps today's values: open 5, difficult 15.
    expect(navDC('Grassland', null)).toBe(5);
    expect(navDC('Wetland', null)).toBe(15);
  });
  it('names the cause for player-facing messaging', () => {
    expect(navCause('Grassland', 'road')).toBe('road');
    expect(navCause('Temperate deciduous forest', 'path')).toBe('faint-path');
    expect(navCause('Wetland', null)).toBe('wilds');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/routeTerrain.test.ts`
Expected: FAIL — cannot resolve `../routeTerrain` / `../roadTunables`.

- [ ] **Step 3: Write `roadTunables.ts`**

```ts
/**
 * @file roadTunables.ts — every gameplay-feel constant for the road system.
 *
 * ALL numbers here are TUNABLE starting values (spec 2026-07-11-road-systems).
 * One module on purpose: Remy tunes travel feel here without hunting through
 * the graph builders, renderers, and navigation code that consume these.
 */
import type { RouteTier, RouteVisibility } from './routeTerrain';

/** Off-road speed factor per FMG biome name (multiplies mph; 1 = full speed).
 * Graded from the FMG biome movement `cost[]` ordering: plains fastest, forest
 * slower, swamp/glacier slowest. Unlisted biomes (Marine) never carry land travel. */
export const BIOME_SPEED_FACTOR: Record<string, number> = {
  Grassland: 1.0,
  Savanna: 0.9,
  'Tropical seasonal forest': 0.75,
  'Temperate deciduous forest': 0.75,
  'Tropical rainforest': 0.5,
  'Temperate rainforest': 0.55,
  Taiga: 0.6,
  'Hot desert': 0.7,
  'Cold desert': 0.65,
  Tundra: 0.6,
  Wetland: 0.45,
  Glacier: 0.3,
};
export const DEFAULT_BIOME_SPEED_FACTOR = 1.0;

/** Wilderness danger baseline per biome (0..1) — moved verbatim from the twin
 * tables in atlasTravelGraph.ts / multiModalAtlasGraph.ts so it lives once. */
export const BIOME_DANGER: Record<string, number> = {
  'Hot desert': 0.5, 'Cold desert': 0.45, 'Tropical rainforest': 0.55, 'Temperate rainforest': 0.4,
  Taiga: 0.4, Tundra: 0.45, Glacier: 0.6, Wetland: 0.5,
  Savanna: 0.3, Grassland: 0.2, 'Tropical seasonal forest': 0.35, 'Temperate deciduous forest': 0.3,
};
export const DEFAULT_LAND_DANGER = 0.25;

/** On-route speed factor per tier (replaces the biome factor; see softening). */
export const ROAD_TIER_SPEED: Record<RouteTier, number> = {
  highway: 1.5, road: 1.25, trail: 1.1, path: 1.0,
};
/** Fraction of the biome penalty a tier REMOVES (1 = cleared road ignores biome). */
export const ROAD_TIER_BIOME_SOFTENING: Record<RouteTier, number> = {
  highway: 1.0, road: 1.0, trail: 0.5, path: 0.25,
};
/** Danger multiplier per tier (patrols and traffic make busy roads safer). */
export const ROAD_TIER_DANGER_MULT: Record<RouteTier, number> = {
  highway: 0.4, road: 0.5, trail: 0.7, path: 0.9,
};

/** Forest classes for visibility fade. Deep forest also counts as forest. */
export const FOREST_BIOMES = new Set(['Tropical seasonal forest', 'Temperate deciduous forest']);
export const DEEP_FOREST_BIOMES = new Set(['Tropical rainforest', 'Temperate rainforest', 'Taiga']);

/** Navigation DC ladder for on-route travel, by tier and visibility. */
export const ROUTE_NAV_DC: Record<RouteTier, Record<RouteVisibility, number>> = {
  highway: { visible: 0, faint: 0, overgrown: 0 },
  road: { visible: 0, faint: 0, overgrown: 0 },
  trail: { visible: 0, faint: 5, overgrown: 5 },
  path: { visible: 5, faint: 8, overgrown: 12 },
};
/** Off-road navigation DCs (unchanged from TERRAIN_NAVIGATION_DCS semantics). */
export const OFFROAD_NAV_DC_OPEN = 5;
export const OFFROAD_NAV_DC_DIFFICULT = 15;

/** A burg this populous (FMG population units), or any port/capital, is a "town":
 * town↔town links become roads; village links stay trails. */
export const ROAD_BURG_MIN_POPULATION = 5;

/** Forest-spur path generation: share of villages that get a hunters'/woodcutters'
 * path (deterministic hash pick), and how deep into the forest it runs (cells). */
export const PATH_SPUR_PERCENT = 40;
export const PATH_SPUR_MAX_DEPTH = 3;

/** 3D rural ribbon tiers (feet + tint), mirroring town STREET_TIERS' shape. */
export const ROAD_3D_TIERS: Record<RouteTier, { widthFt: number; colorHex: string }> = {
  highway: { widthFt: 44, colorHex: '#c9b79a' }, // pale flagstone (matches town avenue)
  road: { widthFt: 40, colorHex: '#a08b62' },    // packed earth (today's default)
  trail: { widthFt: 20, colorHex: '#b5a077' },   // lighter worn track
  path: { widthFt: 8, colorHex: '#9aa07a' },     // faint green-brown wear line
};
/** Patch cycle for 3D faint paths: keep N points, skip M, repeat (broken wear-line). */
export const PATH_3D_KEEP_POINTS = 6;
export const PATH_3D_SKIP_POINTS = 3;
```

- [ ] **Step 4: Write `routeTerrain.ts`**

```ts
/**
 * @file routeTerrain.ts — ONE classification core for land travel over routes.
 *
 * Single source of truth for: off-road biome speed, on-route tier speed,
 * danger, navigation DCs, and route visibility (fading forest paths). Both
 * travel graph builders (atlasTravelGraph, multiModalAtlasGraph) and the 2D/3D
 * renderers consume THIS module, so mechanics and looks cannot drift apart.
 * Pure: no React/DOM, no atlas types — callers pass biome names + tiers.
 */
import {
  BIOME_SPEED_FACTOR, DEFAULT_BIOME_SPEED_FACTOR,
  BIOME_DANGER, DEFAULT_LAND_DANGER,
  ROAD_TIER_SPEED, ROAD_TIER_BIOME_SOFTENING, ROAD_TIER_DANGER_MULT,
  FOREST_BIOMES, DEEP_FOREST_BIOMES,
  ROUTE_NAV_DC, OFFROAD_NAV_DC_OPEN, OFFROAD_NAV_DC_DIFFICULT,
} from './roadTunables';

/** Land route tiers, best to faintest. Sea routes are not terrain. */
export type RouteTier = 'highway' | 'road' | 'trail' | 'path';
/** How readable a route segment is on the ground (and on the map). */
export type RouteVisibility = 'visible' | 'faint' | 'overgrown';

const TIER_RANK: Record<RouteTier, number> = { highway: 3, road: 2, trail: 1, path: 0 };
/** The better (faster, safer) of two tiers — cells where routes overlap keep the best. */
export function bestTier(a: RouteTier | undefined, b: RouteTier): RouteTier {
  return a && TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/** Off-road biomes that were "difficult" before grading — kept for nav DCs. */
const DIFFICULT_BIOMES = new Set<string>([
  'Hot desert', 'Cold desert', 'Tropical rainforest', 'Temperate rainforest',
  'Taiga', 'Tundra', 'Glacier', 'Wetland',
]);

function biomeFactor(biomeName: string): number {
  return BIOME_SPEED_FACTOR[biomeName] ?? DEFAULT_BIOME_SPEED_FACTOR;
}

/** Speed factor for a land cell: tier boost with biome-penalty softening on a
 * route, or the graded biome factor off-road. Multiplies the party's mph. */
export function landSpeedFactor(biomeName: string, tier: RouteTier | null): number {
  const biome = biomeFactor(biomeName);
  if (!tier) return biome;
  const soften = ROAD_TIER_BIOME_SOFTENING[tier];
  const softened = biome + (1 - biome) * soften; // lerp(biome, 1, soften)
  return ROAD_TIER_SPEED[tier] * softened;
}

/** Danger for a land cell: biome baseline, scaled down on routes by tier. */
export function landDanger(biomeName: string, tier: RouteTier | null): number {
  const base = BIOME_DANGER[biomeName] ?? DEFAULT_LAND_DANGER;
  return tier ? base * ROAD_TIER_DANGER_MULT[tier] : base;
}

/** How visible a route segment is in this biome. Maintained tiers never fade. */
export function routeVisibility(biomeName: string, tier: RouteTier): RouteVisibility {
  if (tier === 'highway' || tier === 'road') return 'visible';
  if (tier === 'trail') return DEEP_FOREST_BIOMES.has(biomeName) ? 'faint' : 'visible';
  // path
  if (DEEP_FOREST_BIOMES.has(biomeName)) return 'overgrown';
  if (FOREST_BIOMES.has(biomeName)) return 'faint';
  return 'visible';
}

/** Getting-lost DC for a land cell (DMG p.111 ladder, extended for faint paths). */
export function navDC(biomeName: string, tier: RouteTier | null): number {
  if (tier) return ROUTE_NAV_DC[tier][routeVisibility(biomeName, tier)];
  return DIFFICULT_BIOMES.has(biomeName) ? OFFROAD_NAV_DC_DIFFICULT : OFFROAD_NAV_DC_OPEN;
}

/** Why a cell can lose the party — drives the arrival message wording. */
export function navCause(biomeName: string, tier: RouteTier | null): 'road' | 'wilds' | 'faint-path' {
  if (!tier) return 'wilds';
  return routeVisibility(biomeName, tier) === 'visible' ? 'road' : 'faint-path';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/routeTerrain.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: no NEW errors (pre-existing noise allowed; compare against a pre-change run if unsure).

---

### Task 2: Tier map from generated routes — fixes the dead road wiring

**Files:**
- Modify: `src/systems/worldforge/travel/routeTerrain.ts` (append)
- Test: `src/systems/worldforge/travel/__tests__/routeTerrain.test.ts` (append)

**Interfaces:**
- Consumes: `RouteTier`, `bestTier` (Task 1).
- Produces: `buildRouteCellTiers(pack: { routes?: Array<{ group?: string; cells?: number[]; points?: number[][] }> }): Map<number, RouteTier>` — cellId → best land tier. **This is the bug fix:** it reads `cells` AND falls back to `points[i][2]`, the defensive read `buildFerryLaneCells` already uses; generated routes only carry `points`, which is why the current `buildRoadCells` returns an empty set and roads are mechanically inert.

- [ ] **Step 1: Write the failing test (append to routeTerrain.test.ts)**

```ts
import { buildRouteCellTiers } from '../routeTerrain';

describe('buildRouteCellTiers', () => {
  it('reads generated routes that carry only points (the inert-roads bug)', () => {
    const pack = {
      routes: [
        { group: 'roads', points: [[0, 0, 10], [1, 0, 11], [2, 0, 12]] },
        { group: 'trails', points: [[0, 1, 12], [1, 1, 13]] },
      ],
    };
    const tiers = buildRouteCellTiers(pack);
    expect(tiers.get(10)).toBe('road');
    expect(tiers.get(13)).toBe('trail');
    // Overlap keeps the better tier: cell 12 is on both a road and a trail.
    expect(tiers.get(12)).toBe('road');
  });
  it('maps every land group and ignores searoutes', () => {
    const pack = {
      routes: [
        { group: 'highways', points: [[0, 0, 1]] },
        { group: 'paths', points: [[0, 0, 2]] },
        { group: 'searoutes', points: [[0, 0, 3]] },
        { group: 'roads', cells: [4] }, // legacy `cells` shape still honored
      ],
    };
    const tiers = buildRouteCellTiers(pack);
    expect(tiers.get(1)).toBe('highway');
    expect(tiers.get(2)).toBe('path');
    expect(tiers.has(3)).toBe(false);
    expect(tiers.get(4)).toBe('road');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/routeTerrain.test.ts`
Expected: FAIL — `buildRouteCellTiers` is not exported.

- [ ] **Step 3: Implement (append to routeTerrain.ts)**

```ts
/** Route group vocab (FMG plural) → land tier. Searoutes are not land terrain. */
const GROUP_TO_TIER: Record<string, RouteTier> = {
  highways: 'highway', roads: 'road', trails: 'trail', paths: 'path',
};

/**
 * Cell → best land route tier across all generated routes. Defensive read:
 * FMG-generated routes expose their path as `points` ([x, y, cellId] triples);
 * some tests and legacy producers carry `cells`. Reading only `cells` is the
 * bug that left the whole road network mechanically inert — read both.
 */
export function buildRouteCellTiers(
  pack: { routes?: Array<{ group?: string; cells?: number[]; points?: number[][] }> },
): Map<number, RouteTier> {
  const tiers = new Map<number, RouteTier>();
  for (const route of pack.routes ?? []) {
    const tier = GROUP_TO_TIER[route.group ?? ''];
    if (!tier) continue;
    const add = (cell: number): void => {
      if (Number.isFinite(cell)) tiers.set(cell, bestTier(tiers.get(cell), tier));
    };
    for (const cell of route.cells ?? []) add(cell);
    for (const point of route.points ?? []) add(point[2]);
  }
  return tiers;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/routeTerrain.test.ts`
Expected: PASS.

---

### Task 3: Wire the land travel graph (`atlasTravelGraph.ts` + `routePlanning.ts`)

**Files:**
- Modify: `src/systems/worldforge/travel/atlasTravelGraph.ts`
- Modify: `src/systems/travel/routePlanning.ts` (TravelGraph interface + minutesOf)
- Test: `src/systems/worldforge/travel/__tests__/atlasTravelGraph.test.ts` (extend; read it first — it has existing expectations that will shift)

**Interfaces:**
- Consumes: `buildRouteCellTiers`, `landSpeedFactor`, `landDanger`, `navDC`, `navCause`, `RouteTier` (Tasks 1–2).
- Produces:
  - `TravelGraph.speedFactor?: (cell: number) => number` (optional member on the interface in `routePlanning.ts`; when present the planner uses it INSTEAD of `TERRAIN_TRAVEL_MODIFIERS[terrain(to)]`).
  - `buildNavInfoFn(atlas: FmgAtlasResult): (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' }` (exported from `atlasTravelGraph.ts`; Task 6 wires it into MapPane).
  - `buildRoadCells` STAYS exported (backward compat) but is reimplemented on top of `buildRouteCellTiers` (all land-tier cells).

**Key edits (complete):**

- [ ] **Step 1: Read the existing test file to learn its atlas fixture shape**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/atlasTravelGraph.test.ts` (baseline green), then Read it. It builds small fake atlas objects — reuse its fixture pattern for the new cases.

- [ ] **Step 2: Write failing tests (extend atlasTravelGraph.test.ts)**

Add cases (adapt fixture construction to the file's existing pattern — the shape is `{ pack: { cells: { c, p, h, biome }, routes }, biomesData: { name }, graphWidth }`):

```ts
describe('graded road mechanics (2026-07-11 road systems)', () => {
  // Fixture: 3 land cells in a row; cell 1 carries a 'roads'-group route that
  // only has points (the generated shape). Biome: all Temperate deciduous forest.
  // Adapt to this file's existing fixture helper.
  it('detects road cells from points-only generated routes', () => {
    const atlas = makeAtlas(/* routes: [{ group: 'roads', points: [[x,y,1]] }] */);
    const graph = buildAtlasTravelGraph(atlas);
    expect(graph.terrain(1)).toBe('road');           // was 'open' before the fix
    expect(graph.speedFactor!(1)).toBeCloseTo(1.25); // road tier speed
  });
  it('grades off-road speed by biome instead of the old binary difficult set', () => {
    const graph = buildAtlasTravelGraph(makeAtlas(/* no routes, forest biome */));
    expect(graph.speedFactor!(0)).toBeCloseTo(0.75); // deciduous forest off-road
  });
  it('halves-and-more danger by tier on routes', () => {
    const graph = buildAtlasTravelGraph(makeAtlas(/* road on cell 1, Grassland */));
    expect(graph.danger!(1)).toBeCloseTo(0.2 * 0.5); // road tier danger mult
  });
});
```

Run: `npx vitest run src/systems/worldforge/travel/__tests__/atlasTravelGraph.test.ts`
Expected: new cases FAIL (`speedFactor` undefined, terrain 'open').

- [ ] **Step 3: Add `speedFactor` to the TravelGraph interface + planner**

In `src/systems/travel/routePlanning.ts`: find the `TravelGraph` interface (near the top; it declares `neighbors/position/terrain/passable/danger?/edgeMinutes?`) and add:

```ts
  /** Optional graded speed factor per cell (road tiers + biome grading). When
   * present the planner uses it instead of the coarse TERRAIN_TRAVEL_MODIFIERS. */
  speedFactor?: (cell: number) => number;
```

Then in `planRoutesFrom`, replace the `minutesOf` body's terrain line:

```ts
  const minutesOf = (from: number, to: number): number => {
    if (graph.edgeMinutes) return graph.edgeMinutes(from, to);
    const miles = dist(graph.position(from), graph.position(to)) * opts.milesPerUnit;
    const factor = graph.speedFactor
      ? graph.speedFactor(to)
      : (TERRAIN_TRAVEL_MODIFIERS[graph.terrain(to)] || 1);
    return (miles / (speed * Math.max(0.05, factor))) * 60;
  };
```

- [ ] **Step 4: Rewire `atlasTravelGraph.ts` onto the shared core**

Replace the file's local tables and classifier with the shared module (keep `nearestLandCell`, `atlasMilesPerUnit`, `transportMobility` untouched):

```ts
import {
  buildRouteCellTiers, landSpeedFactor, landDanger, navDC, navCause,
  type RouteTier,
} from './routeTerrain';
```

1. DELETE the local `DIFFICULT_BIOMES`, `BIOME_DANGER`, `DEFAULT_DANGER` constants (they move to roadTunables — Task 1 already holds the same values; keep `DIFFICULT_BIOMES` ONLY if `buildAtlasTerrainFn` still needs it — see 4c).
2. Replace `buildRoadCells`:

```ts
/** All cell ids that lie on a LAND route (any tier). Kept for callers that only
 * need membership; graded consumers use buildRouteCellTiers directly. */
export function buildRoadCells(atlas: FmgAtlasResult): Set<number> {
  return new Set(buildRouteCellTiers(atlas.pack as unknown as Packish).keys());
}
```

   and widen `Packish.routes` to `Array<{ group?: string; cells?: number[]; points?: number[][] }>`.
3. `buildAtlasTerrainFn` (provisioning + navDrift legacy consumer) becomes tier-aware but keeps returning `TravelTerrain`:

```ts
export function buildAtlasTerrainFn(
  atlas: FmgAtlasResult,
  opts: AtlasTravelGraphOptions = {},
): (cell: number) => TravelTerrain {
  const cells = (atlas.pack as unknown as Packish).cells;
  const tiers = buildRouteCellTiers(atlas.pack as unknown as Packish);
  const mobility = opts.mobility ?? 'land';
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  return (c: number): TravelTerrain => {
    if (mobility !== 'land') return 'open';
    const tier = tiers.get(c);
    if (tier === 'highway' || tier === 'road') return 'road';
    if (tier === 'trail') return 'trail';
    // Paths are not "roads" for provisioning burn; off-road classification below.
    return navDC(biomeName(c), null) >= 15 ? 'difficult' : 'open';
  };
}
```

   (`AtlasTravelGraphOptions.roadCells` is now unused by this fn — keep the option field for compatibility but stop reading it here if that breaks a caller; grep `roadCells` first: `rg -n "roadCells" src`.)
4. In `buildAtlasTravelGraph`, replace terrain/danger and add speedFactor:

```ts
  const tiers = buildRouteCellTiers(atlas.pack as unknown as Packish);
  const tierOf = (c: number): RouteTier | null => (mobility === 'land' ? tiers.get(c) ?? null : null);
  return {
    neighbors: (c) => cells.c?.[c] ?? [],
    position: (c) => { const p = cells.p?.[c]; return p ? [p[0], p[1]] : [0, 0]; },
    terrain: (c): TravelTerrain => {
      if (mobility !== 'land') return 'open';
      const tier = tierOf(c);
      if (tier === 'highway' || tier === 'road') return 'road';
      if (tier === 'trail') return 'trail';
      return navDC(biomeName(c), null) >= 15 ? 'difficult' : 'open';
    },
    passable,
    speedFactor: (c) => (mobility === 'land' ? landSpeedFactor(biomeName(c), tierOf(c)) : 1),
    danger: (c) => (mobility === 'land' ? landDanger(biomeName(c), tierOf(c))
                                        : (landDanger(biomeName(c), null))),
  };
```

   (Water/air keep today's behavior: `speedFactor` 1 and biome-baseline danger — matches the old `danger` which only halved on land roads.)
5. Add `buildNavInfoFn` (consumed by Task 6):

```ts
/** Per-cell getting-lost info for navDrift: DC + player-facing cause. */
export function buildNavInfoFn(
  atlas: FmgAtlasResult,
): (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' } {
  const cells = (atlas.pack as unknown as Packish).cells;
  const tiers = buildRouteCellTiers(atlas.pack as unknown as Packish);
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  return (c) => {
    const tier = tiers.get(c) ?? null;
    return { dc: navDC(biomeName(c), tier), cause: navCause(biomeName(c), tier) };
  };
}
```

- [ ] **Step 5: Run the file's tests; fix shifted expectations**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/atlasTravelGraph.test.ts`
Expected: new cases PASS. Pre-existing cases may fail where they pinned the OLD binary behavior (e.g. forest = 'open' with no route, danger without tier scaling). Update those expectations to the graded values — each change must be explainable by "roads now work / biomes now graded", nothing else. Also run: `npx vitest run src/systems/travel` (routePlanning consumers) and fix analogous pins.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit` — no new errors.

---

### Task 4: Wire the multimodal graph (`multiModalAtlasGraph.ts`)

**Files:**
- Modify: `src/systems/worldforge/travel/multiModalAtlasGraph.ts`
- Test: `src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts` (extend, same drill as Task 3)

**Interfaces:**
- Consumes: `buildRouteCellTiers`, `landSpeedFactor`, `landDanger` (Tasks 1–2).
- Produces: behavior only — land legs of multimodal routes get identical grading to Task 3 (the two graphs must agree cell-for-cell).

- [ ] **Step 1: Write failing test** — mirror Task 3's new cases against `buildMultiModalAtlasGraph` (land cell on a points-only road route → `edgeMinutes` reflects 1.25 factor; forest off-road land leg reflects 0.75). Use the file's existing fixtures. Run to see FAIL.

- [ ] **Step 2: Implement**

1. DELETE the local `DIFFICULT_BIOMES` and `BIOME_DANGER` / `DEFAULT_LAND_DANGER` tables; import from `./roadTunables` (`BIOME_DANGER`, `DEFAULT_LAND_DANGER`) where still referenced, and use `landDanger`/`landSpeedFactor` from `./routeTerrain` for land cells.
2. Replace `const roadCells = buildRoadCells(atlas);` with `const tiers = buildRouteCellTiers(pack);` (the `Packish` here already has `routes`; widen its route type with `group?/cells?/points?` if needed).
3. `terrain` (land branch):

```ts
  const terrain = (cell: number): TravelTerrain => {
    if (!isLand(cell)) return 'open';
    const tier = tiers.get(cell);
    if (tier === 'highway' || tier === 'road') return 'road';
    if (tier === 'trail') return 'trail';
    return navDC(biomeName(cell), null) >= 15 ? 'difficult' : 'open';
  };
```

   (same off-road inference Task 3 uses — `navDC` already encodes the 8 difficult biomes off-road; import `navDC` from `./routeTerrain`, no extra export needed).
4. `danger` (land branch): `const base = landDanger(biomeName(cell), tiers.get(cell) ?? null); return base;` (sea branches unchanged).
5. `edgeMinutes` land branch:

```ts
      const speed = isLand(to) ? landSpeedMph : (opts.sea?.speedMph ?? landSpeedMph);
      const modifier = isLand(to)
        ? landSpeedFactor(biomeName(to), tiers.get(to) ?? null)
        : 1;
      const miles = distance(position(from), position(to)) * milesPerUnit;
      return (miles / Math.max(0.1, speed * modifier)) * 60;
```

6. `buildFerryLaneCells` is already defensive — leave it.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts` and `npx vitest run src/systems/worldforge/travel`
Expected: PASS after updating any pinned-to-old-binary expectations (same rule as Task 3: every shifted number must trace to grading/tier activation).

- [ ] **Step 4: Type check** — `npx tsc --noEmit`, no new errors.

---

### Task 5: Tiered generation — highways / road-vs-trail split (`routes-generator.ts` + artifact chain)

**Files:**
- Modify: `src/systems/worldforge/fmg/routes-generator.ts`
- Modify: `src/systems/worldforge/artifacts.ts` (AtlasRoute.kind, RegionRoad.kind)
- Modify: `src/systems/worldforge/adapter/atlasArtifact.ts` (mapRouteGroup)
- Modify: `src/systems/worldforge/region/generateRegion.ts` (kind/width mapping — mechanical part only; 3D look lands in Task 9)
- Test: extend the existing FMG world test that asserts routes (find it: `rg -n "routes" src/systems/worldforge/fmg/__tests__ --glob "*.test.ts" -l`; the known one is `fmgWorld.test.ts` which reads `r.cells ?? r.points.map(p => p[2])`)

**Interfaces:**
- Consumes: `ROAD_BURG_MIN_POPULATION` from `roadTunables` (Task 1).
- Produces:
  - `Route.group: 'highways' | 'roads' | 'trails' | 'paths' | 'searoutes'` (paths group arrives here; its generator arrives Task 7 — the union includes it now so types settle once).
  - `AtlasRoute.kind: 'highway' | 'road' | 'trail' | 'path' | 'searoute'`.
  - `RegionRoad.kind: 'highway' | 'road' | 'trail' | 'path'`.

- [ ] **Step 1: Write the failing test**

In the FMG world test file (whichever asserts generated routes today), add:

```ts
it('tiers land routes: capitals ride highways, town links are roads, village links trails', () => {
  // Use the file's existing generated-world fixture (same seed as its other cases).
  const routes = world.pack.routes!;
  const groups = new Set(routes.map((r) => r.group));
  expect(groups.has('highways')).toBe(true);
  expect(groups.has('trails')).toBe(true);
  expect(groups.has('roads') || groups.has('trails')).toBe(true); // road split may be world-dependent
  // No route keeps the retired bare vocabulary mismatch: every group is known.
  for (const r of routes) {
    expect(['highways', 'roads', 'trails', 'paths', 'searoutes']).toContain(r.group);
  }
  // Every capital burg sits on at least one highway cell.
  const highwayCells = new Set(
    routes.filter((r) => r.group === 'highways').flatMap((r) => r.points.map((p) => p[2])),
  );
  for (const b of world.pack.burgs!.filter((b) => b?.i && !b.removed && b.capital)) {
    expect(highwayCells.has(b.cell)).toBe(true);
  }
});
it('is deterministic: same seed regenerates identical route groups + cells', () => {
  // Regenerate with the fixture's seed and compare group+cellIds signatures.
  const sig = (rs: Route[]) => rs.map((r) => `${r.group}:${r.points.map((p) => p[2]).join(',')}`).join('|');
  expect(sig(regenerate().pack.routes!)).toBe(sig(world.pack.routes!));
});
```

(Adapt fixture/regenerate names to the file's helpers. If generation there is expensive, reuse its existing single world const — determinism can compare two RoutesModule.generate() runs over structuredClone'd packs instead.)

Run to see FAIL (`highways` group doesn't exist yet).

- [ ] **Step 2: Implement the generator split**

In `routes-generator.ts`:

1. Widen the union: `group: "highways" | "roads" | "trails" | "paths" | "searoutes"`.
2. `generateMainRoads` is unchanged logic — but its output routes become group `highways` (see step 4).
3. `generateTrails` splits per Urquhart edge by burg importance. Replace the method with:

```ts
  private isTownBurg(burg: Burg): boolean {
    // Towns anchor roads; villages anchor trails. Capitals/ports always qualify.
    return Boolean(burg.capital) || Boolean(burg.port) ||
      ((burg.population as number | undefined) ?? 0) >= ROAD_BURG_MIN_POPULATION;
  }

  private generateTrails(connections: Map<string, boolean>) {
    const { burgsByFeature } = this.sortBurgsByFeature(this.ctx.pack.burgs!);
    const townRoads: Route[] = [];
    const villageTrails: Route[] = [];

    for (const [key, featureBurgs] of Object.entries(burgsByFeature)) {
      const points = featureBurgs.map((burg) => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        const from = featureBurgs[fromId];
        const to = featureBurgs[toId];
        const isRoad = this.isTownBurg(from) && this.isTownBurg(to);
        const segments = this.findPathSegments({
          isWater: false, connections, start: from.cell, exit: to.cell,
        });
        for (const segment of segments) {
          this.addConnections(segment, connections);
          (isRoad ? townRoads : villageTrails).push({ feature: Number(key), cells: segment } as Route);
        }
      });
    }

    return { townRoads, villageTrails };
  }
```

   Import at top: `import { ROAD_BURG_MIN_POPULATION } from '../travel/roadTunables';` (check the relative path from `fmg/`: `../travel/roadTunables`).
4. `createRoutesData` emits the tiered groups (paths slot in Task 7):

```ts
  private createRoutesData(routes: Route[], connections: Map<string, boolean>) {
    const mainRoads = this.generateMainRoads(connections);
    const { townRoads, villageTrails } = this.generateTrails(connections);
    const seaRoutes = this.generateSeaRoutes(connections);
    const pointsArray = this.preparePointsArray();

    const emit = (list: Route[], group: Route['group']) => {
      for (const { feature, cells, merged } of this.mergeRoutes(list)) {
        if (merged) continue;
        const points = this.getPoints(group, cells!, pointsArray);
        routes.push({ i: routes.length, group, feature, points });
      }
    };
    emit(mainRoads, 'highways');
    emit(townRoads, 'roads');
    emit(villageTrails, 'trails');
    emit(seaRoutes, 'searoutes');

    return routes;
  }
```

   (Merging stays per-group so tiers never blend.)
5. Update the group-keyed helpers:
   - `hasRoad`: `return route.group === 'roads' || route.group === 'highways';`
   - `getConnectivityRate` map: `{ highways: 0.25, roads: 0.2, trails: 0.1, paths: 0.05, searoutes: 0.2, default: 0.1 }`.
6. Grep for other `group ===` / `'roads'`-literal consumers of pack.routes and fix intent-preserving (`rg -n "'roads'|\"roads\"|'trails'|\"trails\"" src --glob "!**/__tests__/**"` — expected hits: atlasDraw.ts, atlasSvg.ts/AtlasLayers.tsx (Task 8 restyles them, but add `highways`→road-style and `paths`→trail-style fallbacks NOW so the map never drops routes between tasks), generateRegion.ts (step 3 below), atlasArtifact.ts (step 3), multiModalAtlasGraph `searoutes` (untouched), burg/markers generators if any (map `roads|highways` where the old intent was "on a main road")).

- [ ] **Step 3: Artifact chain**

- `artifacts.ts`: `AtlasRoute.kind: 'highway' | 'road' | 'trail' | 'path' | 'searoute';` and `RegionRoad.kind: 'highway' | 'road' | 'trail' | 'path';`
- `adapter/atlasArtifact.ts`:

```ts
function mapRouteGroup(group: RouteGroup): AtlasRoute['kind'] {
  if (group === 'highways') return 'highway';
  if (group === 'roads') return 'road';
  if (group === 'trails') return 'trail';
  if (group === 'paths') return 'path';
  return 'searoute';
}
```

  (If `RouteGroup` is a named type import, widen it at its source — it must already reference the Route union.)
- `generateRegion.ts` (the `route.group === 'searoutes'` skip stays; the kind/width lines become):

```ts
    // Width by kind: highway 44ft paved trunk, road 40ft trade route,
    // trail 20ft cart track, path 8ft foot-worn line.
    const kind =
      route.group === 'highways' ? 'highway' as const :
      route.group === 'roads' ? 'road' as const :
      route.group === 'paths' ? 'path' as const : 'trail' as const;
    const widthFt = kind === 'highway' ? 44 : kind === 'road' ? 40 : kind === 'trail' ? 20 : 8;
```

- [ ] **Step 4: Run tests**

Run the FMG world test file + `npx vitest run src/systems/worldforge` — new cases PASS; fix any group-literal pins in other worldforge tests the same intent-preserving way. `npx tsc --noEmit` — the compiler is the safety net that finds every remaining `'road' | 'trail' | 'searoute'` consumer; chase every new error to done.

---

### Task 6: Getting lost on faint paths (`navDrift` + `checkNavigation` + MapPane + App wording)

**Files:**
- Modify: `src/systems/travel/TravelNavigation.ts` (dcOverride param)
- Modify: `src/systems/travel/navDrift.ts` (nav-info fn, cause)
- Modify: `src/components/MapPane.tsx` (two call sites swap in `buildNavInfoFn`)
- Modify: `src/App.tsx` (drift announcement wording by cause — find it: `rg -n "driftDirection" src/App.tsx`)
- Test: `rg -l "deriveNavDrift" src --glob "*.test.ts"` (extend the existing navDrift test file; if none exists create `src/systems/travel/__tests__/navDrift.test.ts`)

**Interfaces:**
- Consumes: `buildNavInfoFn` (Task 3).
- Produces:
  - `checkNavigation(survivalCheckResult, terrain, pace, hasMapOrCompass, intendedDirection, rng, dcOverride?: number)` — when `dcOverride` is a number it replaces the terrain-table DC (0 still auto-succeeds).
  - `deriveNavDrift(navInfoOf: (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' }, routeCells, routePoints, survivalModifier, rng): NavDrift | undefined` — governing DC = max over route cells; `NavDrift` gains `cause: 'wilds' | 'faint-path'`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to the navDrift test file
import { describe, it, expect } from 'vitest';
import { deriveNavDrift } from '../navDrift';
import { SeededRandom } from '@/utils/random';

const pts: Array<[number, number]> = [[0, 0], [10, 0]];
const info = (dc: number, cause: 'road' | 'wilds' | 'faint-path') => () => ({ dc, cause });

describe('deriveNavDrift DC ladder (faint forest paths)', () => {
  it('never rolls on maintained routes (dc 0 auto-success)', () => {
    // Any rng: dc 0 must short-circuit before consuming randomness.
    expect(deriveNavDrift(info(0, 'road'), [1, 2], pts, -5, new SeededRandom(1))).toBeUndefined();
  });
  it('governs by the WORST cell: one overgrown path cell forces DC 12', () => {
    const navInfo = (cell: number) =>
      cell === 2 ? { dc: 12 as const, cause: 'faint-path' as const } : { dc: 0 as const, cause: 'road' as const };
    // Find a seed that rolls low enough to fail DC 12 with +0 Survival:
    // seed 3 → first nextInt(1,21) is deterministic; scan a few seeds in the test.
    let sawLost = false;
    for (let seed = 1; seed <= 40 && !sawLost; seed++) {
      const drift = deriveNavDrift(navInfo, [1, 2, 3], pts, 0, new SeededRandom(seed));
      if (drift) {
        sawLost = true;
        expect(drift.cause).toBe('faint-path');
        expect(drift.extraSeconds).toBeGreaterThanOrEqual(3600);
        expect(drift.extraSeconds).toBeLessThanOrEqual(6 * 3600);
      }
    }
    expect(sawLost).toBe(true); // DC 12 with +0 must fail for SOME seed in 40
  });
  it('a high Survival modifier keeps the party found on the same seeds', () => {
    const navInfo = info(8, 'faint-path');
    for (let seed = 1; seed <= 40; seed++) {
      // +19 makes 1+19 = 20 ≥ 8: can never fail.
      expect(deriveNavDrift(navInfo, [1, 2], pts, 19, new SeededRandom(seed))).toBeUndefined();
    }
  });
});
```

Run: FAIL (deriveNavDrift still takes a terrain fn; no `cause`).

- [ ] **Step 2: Implement**

`TravelNavigation.ts` — add the optional param and use it for the DC:

```ts
export function checkNavigation(
  survivalCheckResult: number,
  terrain: TravelTerrain,
  pace: TravelPace,
  hasMapOrCompass: boolean,
  intendedDirection: TravelDirection,
  rng: SeededRandom = new SeededRandom(Math.random()),
  dcOverride?: number,
): NavigationResult {
  // 1. Determine DC — the graded road system passes an explicit per-trip DC
  // (faint forest paths etc.); the terrain table remains the legacy default.
  const dc = dcOverride ?? TERRAIN_NAVIGATION_DCS[terrain];
```

(rest of the function body unchanged — the `dc === 0` auto-success path now also covers override 0.)

`navDrift.ts` — new signature + cause:

```ts
export interface NavDrift {
  lost: boolean;
  driftDirection: string;
  extraSeconds: number;
  /** What lost the party: trackless wilds, or a path that faded under the trees. */
  cause: 'wilds' | 'faint-path';
}

export function deriveNavDrift(
  navInfoOf: (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' },
  routeCells: number[],
  routePoints: Array<[number, number]>,
  survivalModifier: number,
  rng: SeededRandom,
): NavDrift | undefined {
  if (routeCells.length < 2 || routePoints.length < 2) return undefined;
  // Governing DC = the WORST cell the route crosses; its cause names the story.
  let dc = 0;
  let cause: 'road' | 'wilds' | 'faint-path' = 'road';
  for (const c of routeCells) {
    const info = navInfoOf(c);
    if (info.dc > dc) { dc = info.dc; cause = info.cause; }
  }
  if (dc <= 0) return undefined; // maintained the whole way — exempt, no roll
  const start = routePoints[0];
  const end = routePoints[routePoints.length - 1];
  const direction = bearingToDirection(end[0] - start[0], end[1] - start[1]);
  const survivalCheckResult = rng.nextInt(1, 21) + survivalModifier;
  const result = checkNavigation(survivalCheckResult, 'open', 'normal', false, direction, rng, dc);
  if (result.success || !result.driftDirection) return undefined;
  return {
    lost: true,
    driftDirection: result.driftDirection,
    extraSeconds: result.timePenaltyHours * 3600,
    cause: cause === 'road' ? 'wilds' : cause, // dc>0 with cause 'road' can't happen; guard anyway
  };
}
```

(Update the doc comment above it: the road exemption now reads "any all-maintained route (highway/road, or visible trail) yields DC 0".)

`MapPane.tsx` — both call sites (search `deriveNavDrift(`): replace the first argument `buildAtlasTerrainFn(worldforgeAtlas)` with `buildNavInfoFn(worldforgeAtlas)` and add `buildNavInfoFn` to the existing import from `atlasTravelGraph`. Check whether `buildAtlasTerrainFn` has remaining MapPane uses (provisioning ring) — keep its import if so.

`App.tsx` — find the navDrift announcement (`rg -n "driftDirection|navDrift" src/App.tsx`) and word by cause (keep the existing message structure; exact insertion depends on what's there — the rule: `cause === 'faint-path'` prefixes "The path fades among the trees — you lose the trail", else keep the current lost-in-the-wilds wording; both keep drift direction + hours lost).

- [ ] **Step 3: Run tests**

`npx vitest run src/systems/travel` — navDrift + TravelNavigation suites PASS (update any test pinning the old 4-arg deriveNavDrift signature). `npx tsc --noEmit` — chase every caller the compiler flags (there should be exactly the two MapPane call sites).

---

### Task 7: Forest-spur path generation (`generatePaths`)

**Files:**
- Modify: `src/systems/worldforge/fmg/routes-generator.ts`
- Test: same FMG world test file as Task 5 (append)

**Interfaces:**
- Consumes: `PATH_SPUR_PERCENT`, `PATH_SPUR_MAX_DEPTH` (Task 1); `FOREST_BIOMES`/`DEEP_FOREST_BIOMES` names via biome ids 5–9.
- Produces: `pack.routes` entries with `group: 'paths'` — faint foot-tracks from villages into nearby forest.

- [ ] **Step 1: Write the failing test (append to the FMG world test)**

```ts
it('generates village forest-spur paths that start at a burg and end in forest', () => {
  const FOREST_IDS = new Set([5, 6, 7, 8, 9]);
  const paths = world.pack.routes!.filter((r) => r.group === 'paths');
  // World-dependent count, but a default world with villages near forest gets SOME.
  expect(paths.length).toBeGreaterThan(0);
  const burgCells = new Set(world.pack.burgs!.filter((b) => b?.i && !b.removed).map((b) => b.cell));
  const biome = world.pack.cells.biome!;
  for (const p of paths) {
    const cells = p.points.map((pt) => pt[2]);
    expect(burgCells.has(cells[0]) || burgCells.has(cells[cells.length - 1])).toBe(true);
    expect(cells.some((c) => FOREST_IDS.has(biome[c]))).toBe(true);
  }
});
```

Run: FAIL (no `paths` group yet). NOTE: if the fixture world genuinely has no villages adjacent to forest, relax to a dedicated small crafted pack — but try the real world first; FMG defaults are forest-rich.

- [ ] **Step 2: Implement `generatePaths`**

Add to `RoutesModule` (uses only existing ctx fields; deterministic via integer hash, no RNG):

```ts
  /** Knuth-hash a burg id to a stable 0..99 bucket (deterministic spur pick). */
  private spurBucket(burgId: number): number {
    return Math.abs(Math.imul(burgId, 2654435761)) % 100;
  }

  /**
   * Village forest spurs: a share of villages get a short hunters'/woodcutters'
   * path from the village into the nearest forest, so faint paths lead INTO the
   * woods (and can fade there) instead of only linking settlements. Deterministic:
   * spur selection hashes the burg id; the target is the first forest cell found
   * by BFS, walked PATH_SPUR_MAX_DEPTH cells deeper along forest neighbors.
   */
  private generatePaths(connections: Map<string, boolean>) {
    const cells = this.ctx.pack.cells as any;
    const FOREST_IDS = new Set([5, 6, 7, 8, 9]);
    const isForest = (c: number): boolean => FOREST_IDS.has(cells.biome?.[c] ?? 0);
    const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= 20;
    const paths: Route[] = [];

    for (const burg of this.ctx.pack.burgs!) {
      if (!burg.i || burg.removed || this.isTownBurg(burg)) continue; // villages only
      if (this.spurBucket(burg.i as number) >= PATH_SPUR_PERCENT) continue;

      // BFS from the village for the nearest forest cell (bounded search).
      const seen = new Set<number>([burg.cell as number]);
      const queue: number[] = [burg.cell as number];
      let entry = -1;
      let visited = 0;
      while (queue.length && visited < 400 && entry < 0) {
        const cur = queue.shift()!;
        visited++;
        for (const nb of cells.c?.[cur] ?? []) {
          if (seen.has(nb) || !isLand(nb)) continue;
          seen.add(nb);
          if (isForest(nb)) { entry = nb; break; }
          queue.push(nb);
        }
      }
      if (entry < 0) continue; // no forest near this village

      // Walk deeper: follow forest neighbors up to PATH_SPUR_MAX_DEPTH cells,
      // picking the lowest-id neighbor for determinism.
      let target = entry;
      for (let d = 0; d < PATH_SPUR_MAX_DEPTH; d++) {
        const deeper = (cells.c?.[target] ?? [])
          .filter((nb: number) => isForest(nb) && !seen.has(nb))
          .sort((a: number, b: number) => a - b)[0];
        if (deeper == null) break;
        seen.add(deeper);
        target = deeper;
      }

      const segments = this.findPathSegments({
        isWater: false, connections, start: burg.cell as number, exit: target,
      });
      for (const segment of segments) {
        this.addConnections(segment, connections);
        paths.push({ feature: burg.feature as number, cells: segment } as Route);
      }
    }

    return paths;
  }
```

Imports: add `PATH_SPUR_PERCENT, PATH_SPUR_MAX_DEPTH` to the Task-5 `roadTunables` import. In `createRoutesData`, after the trails emit: `const paths = this.generatePaths(connections);` then `emit(paths, 'paths');` (order: after trails, before searoutes — spurs must not steal trail corridors).

- [ ] **Step 3: Run tests**

FMG world test file PASS (including Task 5's determinism case, which now covers paths too). `npx vitest run src/systems/worldforge`. `npx tsc --noEmit`.

---

### Task 8: 2D visual language — shared stroke styles + forest fade (canvas + SVG)

**Files:**
- Create: `src/components/Worldforge/routeMapStyle.ts`
- Modify: `src/components/Worldforge/atlasSvg.ts` (buildRoutes + AtlasSvgRoute)
- Modify: `src/components/Worldforge/AtlasLayers.tsx` (routes render)
- Modify: `src/components/Worldforge/atlasDraw.ts` (canvas routes block)
- Test: `src/components/Worldforge/__tests__/routeMapStyle.test.ts` (create; check the dir's existing test location convention first: `rg -l "buildRoutes" src --glob "*.test.ts"`)

**Interfaces:**
- Consumes: `routeVisibility` (Task 1) — via biome name per point cellId.
- Produces:
  - `ROUTE_STROKES: Record<'highway'|'road'|'trail'|'path'|'searoute', { stroke: string; width: number; dash?: string; casing?: { stroke: string; width: number } }>`
  - `VISIBILITY_OPACITY: Record<RouteVisibility, number>` = `{ visible: 1, faint: 0.35, overgrown: 0.2 }` with paths using base 0.55 when visible (see code).
  - `segmentRouteByVisibility(points: number[][], visibilityOf: (cellId: number) => RouteVisibility): Array<{ points: number[][]; visibility: RouteVisibility }>`
  - `AtlasSvgRoute` gains `kind: string; opacity: number` (keeps `group` so nothing else breaks).

- [ ] **Step 1: Write the failing test**

```ts
// src/components/Worldforge/__tests__/routeMapStyle.test.ts
import { describe, it, expect } from 'vitest';
import { segmentRouteByVisibility, routeOpacity, ROUTE_STROKES } from '../routeMapStyle';

describe('segmentRouteByVisibility', () => {
  it('splits a polyline where visibility changes, sharing the boundary point', () => {
    // cells: 1,2 visible; 3,4 faint; 5 visible
    const points = [[0, 0, 1], [1, 0, 2], [2, 0, 3], [3, 0, 4], [4, 0, 5]];
    const vis = (c: number) => (c === 3 || c === 4 ? 'faint' as const : 'visible' as const);
    const segs = segmentRouteByVisibility(points, vis);
    expect(segs.map((s) => s.visibility)).toEqual(['visible', 'faint', 'visible']);
    // Segments overlap at boundaries so strokes stay continuous.
    expect(segs[0].points.at(-1)).toEqual([2, 0, 3]);
    expect(segs[1].points[0]).toEqual([2, 0, 3]);
    expect(segs[1].points.at(-1)).toEqual([4, 0, 5]);
  });
  it('returns one segment for uniform visibility', () => {
    const points = [[0, 0, 1], [1, 0, 2]];
    expect(segmentRouteByVisibility(points, () => 'visible')).toHaveLength(1);
  });
});

describe('style tables', () => {
  it('every kind has a stroke; only highways carry a casing', () => {
    expect(ROUTE_STROKES.highway.casing).toBeDefined();
    for (const kind of ['road', 'trail', 'path', 'searoute'] as const) {
      expect(ROUTE_STROKES[kind].casing).toBeUndefined();
      expect(ROUTE_STROKES[kind].stroke).toMatch(/^#/);
    }
  });
  it('opacity fades faint and overgrown path segments', () => {
    expect(routeOpacity('path', 'visible')).toBeCloseTo(0.55);
    expect(routeOpacity('path', 'faint')).toBeCloseTo(0.35);
    expect(routeOpacity('path', 'overgrown')).toBeCloseTo(0.2);
    expect(routeOpacity('road', 'visible')).toBe(1);
  });
});
```

Run: FAIL (module missing).

- [ ] **Step 2: Implement `routeMapStyle.ts`**

```ts
/**
 * @file routeMapStyle.ts — ONE stroke language for routes on the 2D atlas.
 *
 * Both renderers (canvas atlasDraw + SVG AtlasLayers via buildRoutes) read this
 * table, so the map cannot show two different road languages. Visibility fade
 * comes from routeTerrain.routeVisibility — the same classification the travel
 * mechanics use, so "looks faint" and "is hard to follow" always agree.
 */
import type { RouteVisibility } from '../../systems/worldforge/travel/routeTerrain';

export interface RouteStroke {
  stroke: string;
  width: number;
  dash?: [number, number];
  casing?: { stroke: string; width: number };
}

/** Stroke per route kind (atlas vocabulary: singular kinds). */
export const ROUTE_STROKES: Record<'highway' | 'road' | 'trail' | 'path' | 'searoute', RouteStroke> = {
  highway: { stroke: '#b8894a', width: 1.6, casing: { stroke: '#4a3520', width: 2.4 } },
  road: { stroke: '#8b5a2b', width: 1.2 },
  trail: { stroke: '#708090', width: 0.8, dash: [3, 3] },
  path: { stroke: '#6b7280', width: 0.6, dash: [1, 2.5] },
  searoute: { stroke: '#87cefa', width: 1.0, dash: [4, 4] },
};

/** Base opacity per kind (paths are subtle even in the open). */
const KIND_BASE_OPACITY: Record<string, number> = { path: 0.55 };
const VISIBILITY_OPACITY: Record<RouteVisibility, number> = { visible: 1, faint: 0.35, overgrown: 0.2 };

/** Final stroke opacity for a route segment of `kind` at `visibility`. */
export function routeOpacity(kind: string, visibility: RouteVisibility): number {
  if (visibility !== 'visible') return VISIBILITY_OPACITY[visibility];
  return KIND_BASE_OPACITY[kind] ?? 1;
}

/** FMG plural group → atlas singular kind (render-side mirror of the adapter). */
export function groupToKind(group: string): keyof typeof ROUTE_STROKES {
  if (group === 'highways') return 'highway';
  if (group === 'roads') return 'road';
  if (group === 'trails') return 'trail';
  if (group === 'paths') return 'path';
  return 'searoute';
}

/**
 * Split a route polyline into runs of constant visibility, sharing boundary
 * points so adjacent strokes stay continuous. Points are FMG [x, y, cellId].
 */
export function segmentRouteByVisibility(
  points: number[][],
  visibilityOf: (cellId: number) => RouteVisibility,
): Array<{ points: number[][]; visibility: RouteVisibility }> {
  if (points.length < 2) return [];
  const out: Array<{ points: number[][]; visibility: RouteVisibility }> = [];
  let run: number[][] = [points[0]];
  let vis = visibilityOf(points[0][2]);
  for (let i = 1; i < points.length; i++) {
    const v = visibilityOf(points[i][2]);
    run.push(points[i]);
    if (v !== vis && i < points.length) {
      out.push({ points: run, visibility: vis });
      run = [points[i]];
      vis = v;
    }
  }
  if (run.length >= 2) out.push({ points: run, visibility: vis });
  else if (out.length && run.length === 1) out[out.length - 1].points.push(run[0]);
  return out;
}
```

WAIT — the segmentation above has a subtle off-by-one: the boundary point gets pushed into the old run AND starts the new run, which is exactly the sharing the test asserts (`segs[0].points.at(-1)` equals `segs[1].points[0]`). Verify against the test's expected arrays; adjust until the test passes EXACTLY as written (the test is the contract; the sketch is a starting point).

- [ ] **Step 3: Wire the SVG side**

`atlasSvg.ts`:
- `export interface AtlasSvgRoute { d: string; group: string; kind: string; opacity: number }`
- `buildRoutes` splits per segment; it needs biome names:

```ts
export function buildRoutes(atlas: FmgAtlasResult): AtlasSvgRoute[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pack: any = atlas.pack as any;
  const routes: any[] = pack.routes ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names: string[] | undefined = (atlas.biomesData as any)?.name;
  const biomeOf = (cellId: number): string => names?.[pack.cells?.biome?.[cellId] ?? -1] ?? '';
  const out: AtlasSvgRoute[] = [];
  for (const r of routes) {
    const pts: number[][] = r.points ?? [];
    if (pts.length < 2) continue;
    const kind = groupToKind(r.group ?? 'roads');
    if (kind === 'searoute' || kind === 'highway' || kind === 'road') {
      // Maintained (or sea) routes never fade — one segment, full polyline.
      const d = 'M' + pts.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join('L');
      out.push({ d, group: r.group ?? 'roads', kind, opacity: routeOpacity(kind, 'visible') });
      continue;
    }
    const tier = kind; // 'trail' | 'path'
    for (const seg of segmentRouteByVisibility(pts, (c) => routeVisibility(biomeOf(c), tier))) {
      const d = 'M' + seg.points.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join('L');
      out.push({ d, group: r.group ?? 'roads', kind, opacity: routeOpacity(kind, seg.visibility) });
    }
  }
  return out;
}
```

  Imports: `groupToKind, routeOpacity, segmentRouteByVisibility` from `../../components/Worldforge/routeMapStyle` — NO: `atlasSvg.ts` is already in `src/components/Worldforge/`, so `./routeMapStyle`; plus `routeVisibility` from `../../systems/worldforge/travel/routeTerrain`.

`AtlasLayers.tsx` routes block becomes:

```tsx
      {visible.routes ? (model.routes ?? []).map((rt, i) => {
        const s = ROUTE_STROKES[(rt.kind ?? 'road') as keyof typeof ROUTE_STROKES] ?? ROUTE_STROKES.road;
        return (
          <g key={`rt${i}`} opacity={rt.opacity ?? 1}>
            {s.casing ? (
              <path d={rt.d} fill="none" stroke={s.casing.stroke} strokeWidth={s.casing.width}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ) : null}
            <path d={rt.d} fill="none" stroke={s.stroke} strokeWidth={s.width}
              strokeDasharray={s.dash ? s.dash.join(' ') : undefined}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        );
      }) : null}
```

  Import `ROUTE_STROKES` from `./routeMapStyle`.

- [ ] **Step 4: Wire the canvas side (`atlasDraw.ts` 5.2 block)**

Replace the routes block with the shared table + segmentation (same fade rules; canvas uses `ctx.globalAlpha`):

```ts
    // 5.2 Routes — tier stroke language + forest fade, shared with the SVG
    // renderer via routeMapStyle (one language, two backends).
    if (pack.routes) {
      const biomeOf = (cellId: number): string =>
        biomesData?.name?.[(pack.cells as any)?.biome?.[cellId] ?? -1] ?? '';
      const drawPolyline = (pts: number[][], style: RouteStroke, opacity: number) => {
        const trace = () => {
          ctx.beginPath();
          ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
          for (let k = 1; k < pts.length; k++) ctx.lineTo(tx(pts[k][0]), ty(pts[k][1]));
        };
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (style.casing) {
          trace();
          ctx.strokeStyle = style.casing.stroke;
          ctx.lineWidth = style.casing.width * view.scale;
          ctx.setLineDash([]);
          ctx.stroke();
        }
        trace();
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width * view.scale;
        ctx.setLineDash(style.dash ? style.dash.map((d) => d * view.scale) : []);
        ctx.stroke();
        ctx.restore();
      };
      for (const route of pack.routes) {
        const pts = route.points;
        if (!pts || pts.length < 2) continue;
        const kind = groupToKind(route.group ?? 'roads');
        const style = ROUTE_STROKES[kind];
        if (kind === 'trail' || kind === 'path') {
          for (const seg of segmentRouteByVisibility(pts, (c) => routeVisibility(biomeOf(c), kind))) {
            drawPolyline(seg.points, style, routeOpacity(kind, seg.visibility));
          }
        } else {
          drawPolyline(pts, style, routeOpacity(kind, 'visible'));
        }
      }
    }
```

Check what `biomesData` is called inside `atlasDraw.ts` scope (`rg -n "biomesData" src/components/Worldforge/atlasDraw.ts`) — thread it from the atlas argument the way the file already accesses pack; adapt the two lookups to the file's local names. Import the four routeMapStyle symbols + `routeVisibility` + `RouteStroke` type.

- [ ] **Step 5: Run tests + type check**

`npx vitest run src/components/Worldforge/__tests__/routeMapStyle.test.ts` PASS. `rg -l "buildRoutes" src --glob "*.test.ts"` → run those files; update pinned expectations (AtlasSvgRoute gained fields; old group-only assertions still hold because `group` stayed). `npx tsc --noEmit`.

---

### Task 9: 3D — tier ribbons + patchy faint paths (`groundChunkLoader.ts`)

**Files:**
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` (`regionPolylinesToGround` + the two call sites at the `world` assembly)
- Test: find this file's test home first: `rg -l "regionPolylinesToGround|groundChunkLoader" src --glob "*.test.ts"`. If none tests this fn (likely — it's private), EXPORT it for testing (`export` keyword; the file already exports many helpers) and create `src/systems/worldforge/bridge/__tests__/regionRoadRibbons.test.ts`.

**Interfaces:**
- Consumes: `ROAD_3D_TIERS`, `PATH_3D_KEEP_POINTS`, `PATH_3D_SKIP_POINTS` (Task 1); `RegionRoad.kind` incl. `highway`/`path` (Task 5).
- Produces: `regionPolylinesToGround(lines: Array<{ centerline: Array<[number, number]>; widthFt: number; kind?: 'highway' | 'road' | 'trail' | 'path' }>, local: LocalArtifact): GroundPolyline[]` — kind-aware colorHex + patchy path splitting. Rivers keep calling it WITHOUT kind (unchanged behavior).

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/bridge/__tests__/regionRoadRibbons.test.ts
import { describe, it, expect } from 'vitest';
import { regionPolylinesToGround } from '../groundChunkLoader';
import { ROAD_3D_TIERS, PATH_3D_KEEP_POINTS, PATH_3D_SKIP_POINTS } from '../../travel/roadTunables';

const local = { bounds: { x: 0, y: 0, width: 3000, height: 3000 } } as any;
const line = (n: number, kind?: 'highway' | 'road' | 'trail' | 'path') => ({
  centerline: Array.from({ length: n }, (_, i) => [i * 100, 500] as [number, number]),
  widthFt: kind ? ROAD_3D_TIERS[kind].widthFt : 30,
  ...(kind ? { kind } : {}),
});

describe('regionPolylinesToGround (tier ribbons)', () => {
  it('carries the tier tint through as colorHex', () => {
    const [road] = regionPolylinesToGround([line(5, 'road')], local);
    expect(road.colorHex).toBe(ROAD_3D_TIERS.road.colorHex);
    const [hwy] = regionPolylinesToGround([line(5, 'highway')], local);
    expect(hwy.colorHex).toBe(ROAD_3D_TIERS.highway.colorHex);
  });
  it('leaves kind-less polylines (rivers) untinted and whole', () => {
    const out = regionPolylinesToGround([line(30)], local);
    expect(out).toHaveLength(1);
    expect(out[0].colorHex).toBeUndefined();
  });
  it('breaks paths into a deterministic keep/skip patch cycle', () => {
    const n = 30;
    const out = regionPolylinesToGround([line(n, 'path')], local);
    expect(out.length).toBeGreaterThan(1); // broken wear-line, not one ribbon
    // Every emitted patch is a renderable polyline and total points < input
    // (the skip windows are dropped).
    const totalPts = out.reduce((s, p) => s + p.points.length, 0);
    expect(totalPts).toBeLessThan(n);
    for (const p of out) expect(p.points.length).toBeGreaterThanOrEqual(2);
    // Deterministic: same input → same patches.
    const again = regionPolylinesToGround([line(n, 'path')], local);
    expect(JSON.stringify(again)).toBe(JSON.stringify(out));
  });
  it('roads and trails stay one continuous ribbon', () => {
    expect(regionPolylinesToGround([line(30, 'road')], local)).toHaveLength(1);
    expect(regionPolylinesToGround([line(30, 'trail')], local)).toHaveLength(1);
  });
});
```

Run: FAIL (`regionPolylinesToGround` not exported; no colorHex/patching).

- [ ] **Step 2: Implement**

Replace the function (and export it):

```ts
/** Region polylines (feet, world space) → ground meters, kept if any point
 * lands inside the artifact window (fine clipping happens per chunk). Route
 * polylines carry `kind`, which sets the tier tint (ROAD_3D_TIERS) and breaks
 * faint paths into a keep/skip patch cycle so they read as broken wear-lines.
 * Rivers pass no `kind` and behave exactly as before. */
export function regionPolylinesToGround(
  lines: Array<{ centerline: Array<[number, number]>; widthFt: number; kind?: RegionRoad['kind'] }>,
  local: LocalArtifact,
): GroundPolyline[] {
  const { bounds } = local;
  const out: GroundPolyline[] = [];
  const push = (pts: Array<{ x: number; z: number }>, widthFt: number, colorHex?: string): void => {
    const extentX = bounds.width * FEET_TO_METERS;
    const extentZ = bounds.height * FEET_TO_METERS;
    const touches = pts.some(
      (p) => p.x >= -50 && p.x <= extentX + 50 && p.z >= -50 && p.z <= extentZ + 50,
    );
    if (touches && pts.length >= 2) {
      out.push({
        points: pts,
        widthM: Math.max(1, widthFt * FEET_TO_METERS),
        ...(colorHex ? { colorHex } : {}),
      });
    }
  };
  for (const line of lines) {
    const pts = line.centerline.map(([fx, fy]) => ({
      x: (fx - bounds.x) * FEET_TO_METERS,
      z: (fy - bounds.y) * FEET_TO_METERS,
    }));
    const colorHex = line.kind ? ROAD_3D_TIERS[line.kind].colorHex : undefined;
    if (line.kind === 'path') {
      // Faint path: deterministic keep/skip cycle → broken wear-line patches.
      const cycle = PATH_3D_KEEP_POINTS + PATH_3D_SKIP_POINTS;
      for (let start = 0; start < pts.length; start += cycle) {
        push(pts.slice(start, start + PATH_3D_KEEP_POINTS), line.widthFt, colorHex);
      }
    } else {
      push(pts, line.widthFt, colorHex);
    }
  }
  return out;
}
```

Imports: `import { ROAD_3D_TIERS, PATH_3D_KEEP_POINTS, PATH_3D_SKIP_POINTS } from '../travel/roadTunables';` and `RegionRoad` type from `../artifacts` (check what the file already imports from artifacts and extend that import). Verify `GroundPolyline` already has optional `colorHex` (`rg -n "colorHex" src/systems/worldforge/bridge/groundChunkLoader.ts` — town streets already push it; if the type lacks it, add `colorHex?: string`).

Call sites: the `world` assembly (`rivers: region ? regionPolylinesToGround(region.rivers, local) : []` and `roads: [...regionPolylinesToGround(region.roads, local), ...]`) — `region.roads` items now naturally carry `kind` (RegionRoad), rivers don't; NO call-site change needed beyond types compiling.

- [ ] **Step 3: Run tests + type check**

`npx vitest run src/systems/worldforge/bridge/__tests__/regionRoadRibbons.test.ts` PASS. `npx tsc --noEmit`. Also run the broader `npx vitest run src/systems/worldforge/bridge` if tests exist there.

---

### Task 10: Faint-path warning in the travel readout

**Files:**
- Modify: `src/systems/travel/travelReadout.ts` (formatRouteSummary option)
- Modify: `src/components/MapPane.tsx` + `src/components/Worldforge/AtlasSvgView.tsx` (call sites — find them: `rg -n "formatRouteSummary" src`)
- Test: `rg -l "formatRouteSummary" src --glob "*.test.ts"` (extend, or create `src/systems/travel/__tests__/travelReadout.test.ts`)

**Interfaces:**
- Consumes: `buildNavInfoFn` (Task 3).
- Produces: `formatRouteSummary(route, transportLabel = 'on foot', opts?: { faintPath?: boolean }): string` — appends `· follows a faint forest path` when set; and `routeHasFaintPath(navInfoOf, cells): boolean` exported from `navDrift.ts`.

- [ ] **Step 1: Failing test**

```ts
import { formatRouteSummary } from '../travelReadout';
import { routeHasFaintPath } from '../navDrift';

it('warns when a route follows a faint forest path', () => {
  const route = { cells: [1], points: [[0, 0]], miles: 5, minutes: 100, danger: 0.2 } as any;
  expect(formatRouteSummary(route, 'on foot', { faintPath: true }))
    .toContain('follows a faint forest path');
  expect(formatRouteSummary(route)).not.toContain('faint');
});
it('routeHasFaintPath detects any faint-path cell', () => {
  const info = (c: number) => (c === 2
    ? { dc: 8, cause: 'faint-path' as const }
    : { dc: 0, cause: 'road' as const });
  expect(routeHasFaintPath(info, [1, 2, 3])).toBe(true);
  expect(routeHasFaintPath(info, [1, 3])).toBe(false);
});
```

- [ ] **Step 2: Implement**

`travelReadout.ts`:

```ts
export function formatRouteSummary(
  route: RoutePlan,
  transportLabel = 'on foot',
  opts?: { faintPath?: boolean },
): string {
  const rating = dangerRating(route.danger);
  const base = `≈ ${formatTravelTime(route.minutes)} · ~${formatDistance(route.miles)} · Danger: ${rating.level} · ${transportLabel}`;
  return opts?.faintPath ? `${base} · follows a faint forest path` : base;
}
```

`navDrift.ts` (append):

```ts
/** True when any cell of the route is a faint/overgrown path — the readout
 * warns the player BEFORE they commit to a trip that can lose the trail. */
export function routeHasFaintPath(
  navInfoOf: (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' },
  routeCells: number[],
): boolean {
  return routeCells.some((c) => navInfoOf(c).cause === 'faint-path');
}
```

Call sites: wherever MapPane/AtlasSvgView call `formatRouteSummary(route, label)` for a LAND route with atlas in scope, pass `{ faintPath: routeHasFaintPath(buildNavInfoFn(worldforgeAtlas), route.cells) }` (memoize the navInfo fn once per atlas next to the existing travel memos: `const navInfoOf = useMemo(() => worldforgeAtlas ? buildNavInfoFn(worldforgeAtlas) : null, [worldforgeAtlas])`). Where the summary is built in `AtlasSvgView` without the atlas, thread the boolean in as a prop from MapPane — follow whichever direction the existing `formatRouteSummary` data already flows (read the call site; the summary string may already be built in MapPane and passed down).

- [ ] **Step 3: Run tests + type check** — the extended test file PASSes; `npx tsc --noEmit` clean; `npx vitest run src/systems/travel`.

---

### Task 11: Verification sweep + visual proof

**Files:** none new (fixes only). Outputs: screenshots for Remy.

- [ ] **Step 1: Full targeted test run**

```
npx vitest run src/systems/worldforge src/systems/travel src/components/Worldforge
npx tsc --noEmit
```

Every failure must be traceable to an intended behavior change (graded speeds, tier vocabulary) — fix tests intent-preserving; fix code where the test caught a real bug.

- [ ] **Step 2: 2D visual eyeball (MANDATORY — goldens alone insufficient)**

Start the dev server via the Browser pane (launch.json config), open the game's world map (Routes layer defaults ON), zoom a region with capitals + forest. Verify by eye: highways read as cased trunk lines, roads solid brown, trails dashed gray, paths dotted and dissolving where they enter forest. Screenshot → send to Remy.

- [ ] **Step 3: 3D visual eyeball**

Use the shoot.mjs rig (`.agent/3d-visual-quality/` conventions; `window.__bm3dCam` hook is for battlemap — for the ground world use the established world3d capture recipe) OR in-browser: enter 3D near a burg with a road, verify rural ribbons show tier tints and any path shows as broken patches. Screenshot → send to Remy.

- [ ] **Step 4: Travel-time sanity check in-game**

In travel mode, hover a destination along a highway vs the same distance off-road; the readout must show the highway trip meaningfully faster (≈1.5× speed on-road vs graded biome off-road). Hover a route crossing a faint path → summary shows the warning line.

- [ ] **Step 5: Docs + tracker**

- Update the spec's `## Open` with anything discovered.
- Add the planmap topic (`public/planmap/topics.json` — Agora-lock it first; it is frequently locked by others): campaign `travel`, id `road-systems`, status `active`, link to the spec, features per slice.
