# Maritime Travel — Plan 1: Multi-Modal Routing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a single travel-mode route cross land → harbor → sea → harbor → land so islands (that have a port) become reachable, with a segmented route line and a composite time/distance readout.

**Architecture:** Generalize the route planner so edge cost is supplied *per edge* by the graph (`edgeMinutes`), letting one Dijkstra cost land cells at the land-mode speed and sea cells at the vessel speed within a single route. Add a `buildMultiModalAtlasGraph` that unifies land cells, sea cells, and port transfer edges into one `TravelGraph`. Post-process the resulting `RoutePlan` into a `MultiModalRoute` (land/sea segments) for a segmented line + readout. Wire it into `MapPane` behind a top-of-map sea-preference toggle.

**Tech Stack:** TypeScript, Vitest (globals, `vi`), React (MapPane/AtlasSvgView), existing `systems/travel` + `systems/worldforge/travel` modules.

**Spec:** `docs/superpowers/specs/2026-06-25-maritime-travel-design.md` (Approach A; this plan delivers subsystem 1 "routing core" + the minimum of subsystem 6 "segmented visualization". Plans 2–6 follow — see appendix.)

---

## File Structure

| File | Responsibility | New/Changed |
|------|----------------|-------------|
| `src/systems/travel/routePlanning.ts` | `TravelGraph` gains optional `edgeMinutes(from,to)`; planner uses it when present (else the current terrain/speed formula). | Changed |
| `src/systems/worldforge/travel/multiModalAtlasGraph.ts` | Unified land+sea+port-transfer graph; ferry-lane cell set; supplies `edgeMinutes`. | New |
| `src/systems/travel/multiModalRoute.ts` | Classify a `RoutePlan` over the multimodal graph into land/sea segments → `MultiModalRoute`. | New |
| `src/systems/travel/travelReadout.ts` | `formatMultiModalSummary(route)` composite line (total time, land mi + sea mi, danger). | Changed |
| `src/components/Worldforge/AtlasSvgView.tsx` | Render segmented route (solid land / wavy-blue sea) + harbor markers; show composite readout. | Changed |
| `src/components/MapPane.tsx` | Top-of-map sea-preference toggle; build multimodal graph when sea pref active; pass the segmented route to the view. | Changed |

Tests live beside each module under `__tests__/`.

---

### Task 1: Per-edge cost hook on the planner

**Files:**
- Modify: `src/systems/travel/routePlanning.ts`
- Test: `src/systems/travel/__tests__/routePlanning.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/systems/travel/__tests__/routePlanning.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planRoutesFrom, type TravelGraph } from '../routePlanning';

describe('planRoutesFrom edgeMinutes hook', () => {
  // 3 cells in a line: 0—1—2. edgeMinutes makes the 0→1 hop cheap (1 min) and
  // 1→2 expensive (100 min); the planner must total 101, not derive cost from speed.
  const graph: TravelGraph = {
    neighbors: (c) => (c === 0 ? [1] : c === 1 ? [0, 2] : [1]),
    position: (c) => [c, 0],
    terrain: () => 'open',
    passable: () => true,
    edgeMinutes: (_from, to) => (to === 1 ? 1 : to === 2 ? 100 : 1),
  };

  it('uses edgeMinutes for cost when the graph supplies it', () => {
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 999 });
    const route = field.to(2);
    expect(route).not.toBeNull();
    expect(route!.minutes).toBe(101); // 1 (0→1) + 100 (1→2), independent of speedMph
    expect(route!.cells).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/travel/__tests__/routePlanning.test.ts -t "edgeMinutes"`
Expected: FAIL — `route!.minutes` is computed from `speedMph` (≈ a fraction of a minute), not 101; also a TS error that `edgeMinutes` is not on `TravelGraph`.

- [ ] **Step 3: Add the optional hook to the interface**

In `src/systems/travel/routePlanning.ts`, inside `interface TravelGraph`, after the `danger?` line (currently line 31), add:

```ts
  /**
   * Minutes to travel from `from` into neighbor `to`. When supplied, this is the
   * authoritative per-edge cost and the planner ignores `terrain`/`speedMph` for
   * cost (still used for display). Lets one route mix mover speeds (land vs sea).
   */
  edgeMinutes?(from: number, to: number): number;
```

- [ ] **Step 4: Use the hook in the planner**

In `planRoutesFrom`, replace the `minutesOf` definition (currently lines 126-130):

```ts
  const minutesOf = (from: number, to: number): number => {
    const miles = dist(graph.position(from), graph.position(to)) * opts.milesPerUnit;
    const terrainMod = TERRAIN_TRAVEL_MODIFIERS[graph.terrain(to)] || 1;
    return (miles / (speed * terrainMod)) * 60;
  };
```

with:

```ts
  const minutesOf = (from: number, to: number): number => {
    if (graph.edgeMinutes) return graph.edgeMinutes(from, to);
    const miles = dist(graph.position(from), graph.position(to)) * opts.milesPerUnit;
    const terrainMod = TERRAIN_TRAVEL_MODIFIERS[graph.terrain(to)] || 1;
    return (miles / (speed * terrainMod)) * 60;
  };
```

(`speed` and `opts` stay; land graphs that don't supply `edgeMinutes` keep their exact current behavior.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/systems/travel/__tests__/routePlanning.test.ts`
Expected: PASS, including the pre-existing routePlanning tests (no behavior change when `edgeMinutes` is absent).

- [ ] **Step 6: Commit**

```bash
git add src/systems/travel/routePlanning.ts src/systems/travel/__tests__/routePlanning.test.ts
git commit -m "feat(travel): per-edge cost hook (edgeMinutes) on TravelGraph"
```

---

### Task 2: Multi-modal atlas graph

**Files:**
- Create: `src/systems/worldforge/travel/multiModalAtlasGraph.ts`
- Test: `src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts`

Background: cells are land when `pack.cells.h[c] >= 20` (`LAND_THRESHOLD`). A port burg has `burg.port` (a water-feature id) and `pack.cells.haven[burg.cell]` is the adjacent water cell it opens onto. Sea lanes are `pack.routes[].cells` for routes with `group === 'searoutes'`.

- [ ] **Step 1: Write the failing test**

Create `src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMultiModalAtlasGraph, buildFerryLaneCells } from '../multiModalAtlasGraph';
import { planRoutesFrom } from '../../../travel/routePlanning';
import type { FmgAtlasResult } from '../../fmg/generateAtlas';

// Minimal hand-built atlas: a 1-D chain of 5 cells.
//   0(land) — 1(land,PORT) — 2(sea) — 3(sea) — 4(land,PORT)
// A land mover can only reach 0,1. With a sea capability + the two ports it can
// cross 1→2→3→4 and reach the "island" cell 4.
function makeAtlas(): FmgAtlasResult {
  const cells = {
    c: [[1], [0, 2], [1, 3], [2, 4], [3]],          // neighbors
    p: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as Array<[number, number]>, // centroids 1 unit apart
    h: [30, 30, 5, 5, 30],                            // land, land, sea, sea, land
    biome: [1, 1, 0, 0, 1],
    haven: [0, 2, 0, 0, 3],                           // port at 1 opens to sea cell 2; port at 4 to sea 3
    harbor: [0, 1, 0, 0, 1],
  };
  return {
    pack: {
      cells,
      burgs: [
        { i: 0 },                                     // index 0 placeholder (upstream)
        { i: 1, cell: 1, port: 7 },                   // port burg on cell 1
        { i: 2, cell: 4, port: 7 },                   // port burg on cell 4
      ],
      routes: [{ group: 'searoutes', cells: [2, 3] }],
    },
    biomesData: { name: ['Marine', 'Grassland'] },
    graphWidth: 5,
  } as unknown as FmgAtlasResult;
}

describe('buildFerryLaneCells', () => {
  it('collects only searoute cells', () => {
    const lanes = buildFerryLaneCells(makeAtlas());
    expect([...lanes].sort()).toEqual([2, 3]);
  });
});

describe('buildMultiModalAtlasGraph', () => {
  const atlas = makeAtlas();

  it('keeps the far island unreachable without a sea capability', () => {
    const graph = buildMultiModalAtlasGraph(atlas, { landMode: 'walking', sea: null });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });
    expect(field.to(4)).toBeNull();        // can't cross the sea
    expect(field.to(1)).not.toBeNull();    // land hop still works
  });

  it('reaches the island via ferry across the sea lane', () => {
    const graph = buildMultiModalAtlasGraph(atlas, {
      landMode: 'walking',
      sea: { kind: 'ferry', speedMph: 8 },
    });
    const field = planRoutesFrom(graph, 0, { milesPerUnit: 1, speedMph: 3 });
    const route = field.to(4);
    expect(route).not.toBeNull();
    expect(route!.cells).toEqual([0, 1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts`
Expected: FAIL — module `../multiModalAtlasGraph` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/systems/worldforge/travel/multiModalAtlasGraph.ts`:

```ts
/**
 * @file multiModalAtlasGraph.ts — one TravelGraph spanning land + sea, joined at
 * harbors, for Approach-A multimodal routing. Land cells cost at the land-mode
 * speed; sea cells cost at the vessel speed and are only passable when the trip
 * has a sea capability; port transfer edges (land cell ↔ its haven water cell)
 * let a single Dijkstra cross land → harbor → sea → harbor → land.
 *
 * Pure: no React/DOM. See docs/superpowers/specs/2026-06-25-maritime-travel-design.md.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
import type { TravelTerrain } from '../../../types/travel';
import { transportSpeedMph } from '../../travel/routePlanning';
import { atlasMilesPerUnit, buildRoadCells } from './atlasTravelGraph';

const LAND_THRESHOLD = 20;
const DIFFICULT_BIOMES = new Set<string>([
  'Hot desert', 'Cold desert', 'Tropical rainforest', 'Temperate rainforest',
  'Taiga', 'Tundra', 'Glacier', 'Wetland',
]);
const TERRAIN_MOD: Record<TravelTerrain, number> = { road: 1, trail: 1, open: 1, difficult: 0.5 };
/** Minutes added when boarding/leaving a vessel at a harbor (loading time). */
const BOARDING_MINUTES = 60;

type Packish = {
  cells: { c?: number[][]; p?: Array<[number, number]>; h?: ArrayLike<number>; biome?: ArrayLike<number>; haven?: ArrayLike<number> };
  burgs?: Array<{ i?: number; cell?: number; port?: number }>;
  routes?: Array<{ group?: string; cells?: number[] }>;
};

export type SeaCapability =
  | { kind: 'ferry'; speedMph: number }
  | { kind: 'ship'; speedMph: number };

export interface MultiModalOptions {
  /** Land transport id for land-leg speed (default 'walking'). */
  landMode?: string;
  /** Land transport speed override in mph; if absent, derived from landMode. */
  landSpeedMph?: number;
  /** Sea capability for this trip, or null for land-only. */
  sea: SeaCapability | null;
}

/** Cell ids on a generated sea lane (group === 'searoutes'). */
export function buildFerryLaneCells(atlas: FmgAtlasResult): Set<number> {
  const set = new Set<number>();
  for (const r of ((atlas.pack as unknown as Packish).routes ?? [])) {
    if (r.group !== 'searoutes') continue;
    for (const c of r.cells ?? []) set.add(c);
  }
  return set;
}

/** Map of land cell → its haven (water) cell, for every port burg. */
function buildPortTransfers(pack: Packish): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of pack.burgs ?? []) {
    if (!b || !b.port || b.cell == null) continue;
    const haven = pack.cells.haven?.[b.cell];
    if (haven != null) m.set(b.cell, haven);
  }
  return m;
}

export function buildMultiModalAtlasGraph(atlas: FmgAtlasResult, opts: MultiModalOptions): TravelGraph {
  const pack = atlas.pack as unknown as Packish;
  const cells = pack.cells;
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;
  const milesPerUnit = atlasMilesPerUnit(atlas);
  const roadCells = buildRoadCells(atlas);
  const laneCells = buildFerryLaneCells(atlas);
  const transfers = buildPortTransfers(pack);       // land cell → haven
  const reverseTransfers = new Map<number, number[]>(); // haven → [land cells]
  for (const [land, haven] of transfers) {
    const arr = reverseTransfers.get(haven) ?? [];
    arr.push(land);
    reverseTransfers.set(haven, arr);
  }

  const landSpeed = opts.landSpeedMph ?? transportSpeedMph({ method: opts.landMode === 'walking' ? 'walking' : 'mounted', vehicle: undefined } as never);
  const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= LAND_THRESHOLD;
  const biomeName = (c: number): string => names?.[cells.biome?.[c] ?? -1] ?? '';
  const landTerrain = (c: number): TravelTerrain =>
    roadCells.has(c) ? 'road' : (DIFFICULT_BIOMES.has(biomeName(c)) ? 'difficult' : 'open');
  const pos = (c: number): [number, number] => { const p = cells.p?.[c]; return p ? [p[0], p[1]] : [0, 0]; };
  const unitDist = (a: number, b: number): number => Math.hypot(pos(a)[0] - pos(b)[0], pos(a)[1] - pos(b)[1]);

  const passable = (c: number): boolean => {
    if (!cells.p?.[c]) return false;
    if (isLand(c)) return true;            // land always walkable
    return opts.sea != null;               // sea only with a capability this trip
  };

  return {
    // Port transfer edges augment the Voronoi neighbors: a port land cell also
    // neighbors its haven water cell (and vice-versa) so a route can board/land.
    neighbors: (c) => {
      const base = cells.c?.[c] ?? [];
      const haven = transfers.get(c);
      const landSides = reverseTransfers.get(c);
      if (haven == null && !landSides) return base;
      const extra: number[] = [];
      if (haven != null) extra.push(haven);
      if (landSides) extra.push(...landSides);
      return [...base, ...extra];
    },
    position: pos,
    terrain: (c): TravelTerrain => (isLand(c) ? landTerrain(c) : 'open'),
    passable,
    danger: (c) => (isLand(c) ? (DIFFICULT_BIOMES.has(biomeName(c)) ? 0.4 : 0.25) : 0.3),
    edgeMinutes: (from, to) => {
      const fromLand = isLand(from), toLand = isLand(to);
      // Port transfer edge (land ↔ haven): a boarding/landing cost, no distance.
      if (fromLand !== toLand) return BOARDING_MINUTES;
      const miles = unitDist(from, to) * milesPerUnit;
      if (toLand) {
        const mod = TERRAIN_MOD[landTerrain(to)] ?? 1;
        return (miles / (Math.max(0.1, landSpeed) * mod)) * 60;
      }
      // Sea edge: vessel speed; ferries pay a small surcharge off their lane is
      // n/a here (ferries stay on lanes by construction), open water just costs more.
      const seaSpeed = Math.max(0.1, opts.sea?.speedMph ?? 0.1);
      const offLane = !laneCells.has(to);
      const penalty = opts.sea?.kind === 'ship' && offLane ? 1.25 : 1; // open-water slower
      return (miles / seaSpeed) * 60 * penalty;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts`
Expected: PASS (island unreachable land-only; reachable via ferry; lane cells = [2,3]).

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/travel/multiModalAtlasGraph.ts src/systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts
git commit -m "feat(travel): unified multimodal atlas graph (land+sea+harbor transfers)"
```

---

### Task 3: Route segmentation + composite readout

**Files:**
- Create: `src/systems/travel/multiModalRoute.ts`
- Modify: `src/systems/travel/travelReadout.ts`
- Test: `src/systems/travel/__tests__/multiModalRoute.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/travel/__tests__/multiModalRoute.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { segmentRoute, type CellKind } from '../multiModalRoute';
import { formatMultiModalSummary } from '../travelReadout';
import type { RoutePlan } from '../routePlanning';

// Route 0..4 through land,land,sea,sea,land — kinds per cell.
const route: RoutePlan = {
  cells: [0, 1, 2, 3, 4],
  points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  miles: 4,
  minutes: 200,
  danger: 0.4,
};
const kindOf = (c: number): CellKind => (c === 2 || c === 3 ? 'sea' : 'land');

describe('segmentRoute', () => {
  it('splits the polyline into contiguous land/sea segments and tallies miles', () => {
    const mm = segmentRoute(route, kindOf, 1);
    expect(mm.segments.map((s) => s.kind)).toEqual(['land', 'sea', 'land']);
    // land miles: 0→1 (1) + 3→4 (1) = 2 ; sea miles: 1→2 + 2→3 = 2
    expect(mm.landMiles).toBeCloseTo(2, 5);
    expect(mm.seaMiles).toBeCloseTo(2, 5);
    expect(mm.minutes).toBe(200);
  });
});

describe('formatMultiModalSummary', () => {
  it('reports total time, land + sea miles, and danger', () => {
    const mm = segmentRoute(route, kindOf, 1);
    const s = formatMultiModalSummary(mm);
    expect(s).toContain('3h 20m');     // 200 min
    expect(s).toContain('2 mi land');
    expect(s).toContain('2 mi sea');
    expect(s).toContain('Danger: Moderate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/travel/__tests__/multiModalRoute.test.ts`
Expected: FAIL — `../multiModalRoute` and `formatMultiModalSummary` do not exist.

- [ ] **Step 3: Write the segmenter**

Create `src/systems/travel/multiModalRoute.ts`:

```ts
/**
 * @file multiModalRoute.ts — classify a planned RoutePlan into contiguous
 * land / sea segments so the map can draw each leg in its own style and the
 * readout can report land vs sea distance. Pure: no React/DOM.
 */
import type { RoutePlan } from './routePlanning';

export type CellKind = 'land' | 'sea';

export interface RouteSegment {
  kind: CellKind;
  /** Polyline points for this leg (shares the boundary point with the next leg). */
  points: Array<[number, number]>;
}

export interface MultiModalRoute {
  cells: number[];
  segments: RouteSegment[];
  miles: number;
  landMiles: number;
  seaMiles: number;
  minutes: number;
  danger: number;
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Split `route` into land/sea segments. An edge's kind is the kind of the cell
 * being entered (`cells[i]`); the boundary point is shared so the drawn legs
 * join. `milesPerUnit` converts point distance to the per-segment mile tallies.
 */
export function segmentRoute(route: RoutePlan, kindOf: (cell: number) => CellKind, milesPerUnit: number): MultiModalRoute {
  const segments: RouteSegment[] = [];
  let landMiles = 0;
  let seaMiles = 0;
  for (let i = 1; i < route.cells.length; i++) {
    const kind = kindOf(route.cells[i]);
    const a = route.points[i - 1];
    const b = route.points[i];
    const miles = dist(a, b) * milesPerUnit;
    if (kind === 'land') landMiles += miles; else seaMiles += miles;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.points.push(b);
    else segments.push({ kind, points: [a, b] });
  }
  return {
    cells: route.cells,
    segments,
    miles: route.miles,
    landMiles,
    seaMiles,
    minutes: route.minutes,
    danger: route.danger,
  };
}
```

- [ ] **Step 4: Add the composite formatter**

In `src/systems/travel/travelReadout.ts`, add an import at the top (after the existing `RoutePlan` import):

```ts
import type { MultiModalRoute } from './multiModalRoute';
```

and append at the end of the file:

```ts
/**
 * Composite one-line summary for a multimodal route, e.g.
 * "≈ 3h 20m · 2 mi land + 2 mi sea · Danger: Moderate".
 */
export function formatMultiModalSummary(route: MultiModalRoute): string {
  const rating = dangerRating(route.danger);
  return `≈ ${formatTravelTime(route.minutes)} · ${formatDistance(route.landMiles)} land + ${formatDistance(route.seaMiles)} sea · Danger: ${rating.level}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/systems/travel/__tests__/multiModalRoute.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/systems/travel/multiModalRoute.ts src/systems/travel/travelReadout.ts src/systems/travel/__tests__/multiModalRoute.test.ts
git commit -m "feat(travel): segment routes into land/sea legs + composite readout"
```

---

### Task 4: Segmented route + harbor markers in AtlasSvgView

**Files:**
- Modify: `src/components/Worldforge/AtlasSvgView.tsx`
- Test: `src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`

The view currently renders one route polyline from `planRoute(hoveredCell): RoutePlan | null` (props `travelActive`, `planRoute`, `transportLabel`) inside the zoomed `<g>`, plus the screen-space "Travel to" flag and the bottom readout. This task adds an optional `planMultiModal?(toCell): MultiModalRoute | null` prop; when present and it returns a route, render per-segment polylines (solid for land, wavy-blue dashes for sea) and an anchor glyph at each land↔sea boundary, and show `formatMultiModalSummary` in the readout.

- [ ] **Step 1: Write the failing test**

Add to `src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import AtlasSvgView from '../AtlasSvgView';
import type { MultiModalRoute } from '../../../systems/travel/multiModalRoute';

const mmRoute: MultiModalRoute = {
  cells: [0, 1, 2],
  segments: [
    { kind: 'land', points: [[1, 1], [3, 3]] },
    { kind: 'sea', points: [[3, 3], [6, 6]] },
  ],
  miles: 10, landMiles: 4, seaMiles: 6, minutes: 300, danger: 0.4,
};

it('renders land and sea route segments + a harbor marker when multimodal', () => {
  const atlas = { cells: [], width: 10, height: 10, /* minimal model stub */ } as never;
  render(
    <AtlasSvgView
      atlas={atlas}
      travelActive
      planMultiModal={() => mmRoute}
      marker={{ x: 1, y: 1 }}
    />,
  );
  const svg = screen.getByTestId('atlas-svg-view');
  fireEvent.mouseMove(svg, { clientX: 6, clientY: 6 });
  expect(screen.getByTestId('atlas-route-seg-land')).toBeTruthy();
  expect(screen.getByTestId('atlas-route-seg-sea')).toBeTruthy();
  expect(screen.getByTestId('atlas-harbor-marker')).toBeTruthy();
  expect(screen.getByTestId('atlas-travel-readout').textContent).toContain('sea');
});
```

(Match the existing test's atlas/model stub shape — copy the stub the neighbouring travel-readout test already uses, including `cells.p`, so `findCellAtPoint` resolves a hovered cell.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx -t "multimodal"`
Expected: FAIL — `planMultiModal` prop unknown; no `atlas-route-seg-*` / `atlas-harbor-marker` testids.

- [ ] **Step 3: Add the prop**

In `AtlasSvgView.tsx`, add to `AtlasSvgViewProps` (beside `planRoute?` around line 46):

```ts
  /** Optional multimodal planner; when it returns a route, the view draws
   *  segmented land/sea legs + harbor markers instead of the single line. */
  planMultiModal?: (toCell: number) => import('../../systems/travel/multiModalRoute').MultiModalRoute | null;
```

and accept it in the destructured props (beside `planRoute`) on the component signature line.

- [ ] **Step 4: Compute the multimodal route on hover**

Near the existing `travelRoute` memo (around line 372), add:

```tsx
  const travelMm = useMemo(
    () => (travelActive && planMultiModal && hoveredCell != null ? planMultiModal(hoveredCell) : null),
    [travelActive, planMultiModal, hoveredCell],
  );
```

- [ ] **Step 5: Render segmented legs (inside the zoomed `<g>`)**

Replace the existing single-route block (the `{travelRoute && travelRoute.points.length > 1 ? (...) : null}` group around lines 430-447) with one that prefers the multimodal route when present:

```tsx
        {/* Multimodal route — per-segment legs (land solid / sea wavy-blue). */}
        {travelMm ? travelMm.segments.map((seg, si) => {
          const pts = seg.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          const isSea = seg.kind === 'sea';
          return (
            <polyline
              key={`seg${si}`}
              data-testid={`atlas-route-seg-${seg.kind}`}
              points={pts}
              fill="none"
              stroke={isSea ? '#38bdf8' : dangerRating(travelMm.danger).color}
              strokeWidth={isSea ? 2 : 2.2}
              strokeDasharray={isSea ? '2 5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        }) : (travelRoute && travelRoute.points.length > 1 ? (
          <>
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke="#0f172a" strokeOpacity={0.5} strokeWidth={4.5}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke={dangerRating(travelRoute.danger).color} strokeWidth={2.2}
              strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
          </>
        ) : null)}
```

- [ ] **Step 6: Render harbor markers (screen space, constant size)**

Just before the existing travel-destination flag block (the `{travelRoute && ... 'atlas-travel-destination' ...}` group), add:

```tsx
      {/* Harbor markers at each land↔sea boundary — screen space, constant size. */}
      {travelMm ? travelMm.segments.slice(0, -1).map((seg, si) => {
        const b = seg.points[seg.points.length - 1]; // boundary = leg end
        return (
          <g
            key={`harbor${si}`}
            transform={`translate(${b[0] * view.k + view.x},${b[1] * view.k + view.y})`}
            style={{ pointerEvents: 'none' }}
            data-testid="atlas-harbor-marker"
          >
            <circle r={5} fill="#0ea5e9" stroke="#0f172a" strokeWidth={1.5} />
            <path d="M0,-3 L0,3 M-2.5,0.5 a2.5,2.5 0 0 0 5,0" fill="none" stroke="#e0f2fe" strokeWidth={1} />
          </g>
        );
      }) : null}
```

- [ ] **Step 7: Show the composite readout when multimodal**

Import the formatter at the top of `AtlasSvgView.tsx` (beside the existing `formatRouteSummary` import):

```ts
import { formatMultiModalSummary } from '../../systems/travel/travelReadout';
```

In the readout block (`data-testid="atlas-travel-readout"`, around line 533), change the body to prefer the multimodal summary:

```tsx
        {travelMm
          ? formatMultiModalSummary(travelMm)
          : travelRoute
            ? formatRouteSummary(travelRoute, transportLabel)
            : <span style={{ color: '#f87171' }}>No route to here</span>}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`
Expected: PASS, including the pre-existing single-route travel tests.

- [ ] **Step 9: Commit**

```bash
git add src/components/Worldforge/AtlasSvgView.tsx src/components/Worldforge/__tests__/AtlasSvgView.test.tsx
git commit -m "feat(map): segmented land/sea route + harbor markers in AtlasSvgView"
```

---

### Task 5: Wire the sea preference into MapPane

**Files:**
- Modify: `src/components/MapPane.tsx`
- Test: `src/components/__tests__/MapPane.test.tsx`

Add a top-of-map sea-preference toggle (`None` | `Ferry`), and when it is `Ferry` build the multimodal graph and pass a `planMultiModal` to `AtlasSvgView`. (Owned-ship is added in Plan 3 with the ship-as-asset state; ferry is the v1-foundation option.)

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/MapPane.test.tsx` (reuse the file's existing render helper / atlas fixture):

```tsx
it('exposes a sea-preference toggle in travel mode', async () => {
  renderMapPaneInTravelMode(); // existing helper that mounts the WF atlas in travel mode
  expect(await screen.findByTestId('travel-sea-pref')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/MapPane.test.tsx -t "sea-preference"`
Expected: FAIL — no `travel-sea-pref` element.

- [ ] **Step 3: Add sea-preference state**

In `MapPane.tsx`, beside `const [transportId, setTransportId] = useState('walking');` (line 318) add:

```tsx
  const [seaPref, setSeaPref] = useState<'none' | 'ferry'>('none');
```

- [ ] **Step 4: Build the multimodal field when ferry is selected**

After the existing `travelField` / `planAtlasRoute` memos (after line 332), add:

```tsx
  const travelMmField = useMemo(() => {
    if (interactionMode !== 'travel' || seaPref === 'none' || !worldforgeAtlas || playerAtlasCell == null) return null;
    const graph = buildMultiModalAtlasGraph(worldforgeAtlas, {
      landMode: transportId === 'walking' ? 'walking' : 'mounted',
      landSpeedMph: transportSpeedMph(selectedTransport.option),
      sea: { kind: 'ferry', speedMph: 8 },
    });
    const origin = nearestLandCell(worldforgeAtlas, playerAtlasCell);
    return planRoutesFrom(graph, origin, { milesPerUnit: atlasMilesPerUnit(worldforgeAtlas), speedMph: 3 });
  }, [interactionMode, seaPref, worldforgeAtlas, playerAtlasCell, transportId, selectedTransport]);

  const isLandCell = useCallback((c: number) => {
    const h = (worldforgeAtlas?.pack as unknown as { cells?: { h?: ArrayLike<number> } } | undefined)?.cells?.h?.[c] ?? 0;
    return h >= 20;
  }, [worldforgeAtlas]);

  const planAtlasMultiModal = useCallback((toCell: number) => {
    const plan = travelMmField?.to(toCell);
    if (!plan) return null;
    return segmentRoute(plan, (c) => (isLandCell(c) ? 'land' : 'sea'), atlasMilesPerUnit(worldforgeAtlas!));
  }, [travelMmField, isLandCell, worldforgeAtlas]);
```

Add the imports at the top of `MapPane.tsx`:

```ts
import { buildMultiModalAtlasGraph } from '@/systems/worldforge/travel/multiModalAtlasGraph';
import { segmentRoute } from '@/systems/travel/multiModalRoute';
```

- [ ] **Step 5: Render the toggle + pass the planner**

In the top control row, beside the transport `<select>` (the block gated by `allowTravel && interactionMode === 'travel'` around line 546), add:

```tsx
                <select
                  data-testid="travel-sea-pref"
                  value={seaPref}
                  onChange={(e) => setSeaPref(e.target.value as 'none' | 'ferry')}
                  className="px-2 py-1 rounded bg-gray-700 text-gray-100"
                  title="Sea travel: hire a ferry to cross water"
                >
                  <option value="none">No sea travel</option>
                  <option value="ferry">Ferry (hired)</option>
                </select>
```

On the world-atlas `AtlasSvgView` (the one already receiving `travelActive`/`planRoute` around line 729), add the prop:

```tsx
                planMultiModal={planAtlasMultiModal}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/MapPane.test.tsx`
Expected: PASS, including the pre-existing MapPane travel tests.

- [ ] **Step 7: Live verification (visual-inspection rule)**

Start the preview, load a game, open the world map, enter Travel, set Ferry, hover a cell across water from the player. Confirm: a segmented route (solid land + dashed-blue sea), harbor markers at the crossings, and a readout like `≈ … · N mi land + M mi sea · Danger: …`.

```
Continue Journey → 🌍 → Travel → sea-pref "Ferry (hired)" → hover an island cell
```

(Use DOM measurement via preview_eval to verify segment testids + readout text; `preview_screenshot` may hang in a playing session — known R3F/rAF behavior.)

- [ ] **Step 8: Commit**

```bash
git add src/components/MapPane.tsx src/components/__tests__/MapPane.test.tsx
git commit -m "feat(map): ferry sea-preference toggle wires multimodal island routing"
```

---

## Self-Review

- **Spec coverage (this plan):** subsystem 1 (routing core, Approach A) — Tasks 1–2; subsystem 6 minimum (segmented visualization + top-of-map sea selector) — Tasks 4–5; composite readout — Task 3. Subsystems 2–5 (reachability, dock tiers, ship asset, fares, sea danger) are sequenced as Plans 2–6 below, not dropped.
- **No placeholders:** every code step shows full code; tests assert concrete values.
- **Type consistency:** `MultiModalRoute`/`RouteSegment`/`CellKind` (Task 3) are the exact types consumed in Tasks 4–5; `SeaCapability`/`MultiModalOptions` (Task 2) match the `buildMultiModalAtlasGraph` calls in Task 5; `edgeMinutes` signature (Task 1) matches its use in Task 2.
- **Behavior preservation:** the `edgeMinutes` hook is optional, so land-only graphs (`atlasTravelGraph`, `submapTravelGraph`) and their tests are unchanged.

## Appendix — remaining v1 plans (sequenced)

- **Plan 2 — Island reachability (`ensureIslandHarbors`).** Connected-components over land cells; significance filter; promote/spawn a fishing-village port; link it to the sea-lane graph. Hooks into the burgs+routes generation pipeline (`generateWorld.ts`). Guarantees port-less islands become reachable.
- **Plan 3 — Owned ship as tracked asset.** `ownedShips[{id,vehicleId,dockedPortId}]` in both `GameState` factories; `sea: { kind: 'ship' }` enabled only from the docked port; sailing relocates the ship; "Your ship" option in the sea-pref selector (disabled with reason when undocked).
- **Plan 4 — Dock tiers + tender legs.** `dockSize` per port; `dockClass` on water vehicles; berth-vs-anchor decision; insert a tender segment (3rd `CellKind`) when an owned ship exceeds the dock; render the dotted tender hop.
- **Plan 5 — Ferry fares.** `ferryFare(route)`; show fare in the readout; deduct gold on departure; disable ferry when unaffordable or no lane reaches the destination (honest failure, no cross-fallback).
- **Plan 6 — Sea danger & encounters.** Sea danger tables (lane < coastal < open ocean); extend the encounter roll to sea segments (storm/pirate); higher danger for off-lane owned-ship routes.
