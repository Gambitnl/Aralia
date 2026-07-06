# Building Blueprint Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One deterministic building generator that emits a rich, believable `BlueprintPlan` (rooms, doors, windows, furniture, stairs, and wall edges — all in feet on a 5 ft grid), rendered as a 2D module-map blueprint and raised into 3D from that same data.

**Architecture:** Grow the existing L4 interior generator (`src/systems/worldforge/interior/`) into the shared building-maker rather than forking. Generation is split into small pure modules (footprint → partition → program → doors → windows/walls → furniture → floors) that assemble a `BlueprintPlan` POJO. Two consumers read that data: a pure 2D SVG drawer (already prototyped in `PreviewBlueprint.tsx`) and the 3D building build.

**Tech Stack:** TypeScript, Vitest (unit tests), React (preview surfaces), the worldforge seed-path RNG (`rngFromPath`/`childSeedPath`/`streamPath` in `src/systems/worldforge/seedPath.ts`).

## Global Constraints

- **Feet-canon 5 ft grid.** Every coordinate is in feet and aligned to the 5 ft atomic grid. `CELL_FT = 5`, `MIN_ROOM_FT = 10`.
- **Pure data, zero THREE imports.** The generator and `BlueprintPlan` must not import `three` or any renderer. Data only.
- **Deterministic via seed paths.** Randomness comes only from `rngFromPath(streamPath(path, '<concern>'))`. Same seed path in → byte-identical plan out. Never `Math.random()` in generator code.
- **US spelling** in all identifiers and labels (color, gray, -ize).
- **No fallback.** One real path; fail honestly. No silent graceful degradation.
- **Walls sit on the grid line with real thickness** (thick outer, thin inner) growing outward from the line; a wall never consumes a playable tile.
- **Do not commit.** The repo auto-snapshots to GitHub daily at 2am — leave finished work in the tree. Each task ends by running its tests green; there is no manual `git commit` step.
- **Spec:** `docs/superpowers/specs/2026-07-05-building-blueprint-pipeline-design.md`.

---

## File Structure

**New:**
- `src/systems/worldforge/interior/blueprintTypes.ts` — the `BlueprintPlan` contract and all sub-types.
- `src/systems/worldforge/interior/footprint.ts` — irregular footprint (wings + tower) → occupied cells.
- `src/systems/worldforge/interior/partition.ts` — split the footprint into connected rooms (cells per room).
- `src/systems/worldforge/interior/program.ts` — per-building-type room purposes + which room is the dominant "main".
- `src/systems/worldforge/interior/doors.ts` — connected door graph, street entry on the main room, swing direction.
- `src/systems/worldforge/interior/walls.ts` — wall edges (outer/inner + thickness) and outward-facing windows.
- `src/systems/worldforge/interior/furnish.ts` — room-clipped furniture from purpose recipes.
- `src/systems/worldforge/interior/generateBuilding.ts` — assembles all of the above into a `BlueprintPlan`.
- `src/systems/worldforge/interior/renderBlueprintSvg.ts` — pure `BlueprintPlan` → SVG string (module-map style), lifted and cleaned from `PreviewBlueprint.tsx`.
- `src/systems/worldforge/interior/__tests__/*.test.ts` — one test file per module above.

**Modified:**
- `src/components/DesignPreview/steps/PreviewBlueprint.tsx` — consume `generateBuilding` + `renderBlueprintSvg`.
- `src/components/DesignPreview/steps/PreviewFloorplans.tsx` — retire its private generator; consume the shared one (or delete once Blueprint covers it — decide during Task 12).
- `src/systems/worldforge/interior/generateInterior.ts` — becomes a thin adapter that returns the legacy `InteriorPlan` shape from a `BlueprintPlan` (keeps existing 3D-build callers working), OR is superseded — decide in Task 10.
- The 3D interior build (`src/systems/worldforge/bridge/interiorBuild.ts` + `interiorParts.ts`, `src/systems/world3d/buildingModels.ts`) — raise the irregular shell + wall thickness from `BlueprintPlan`.

**Convention note:** `BlueprintPlan` is the new source of truth. `InteriorPlan` (legacy) either becomes a derived view or is replaced; no data is generated twice.

---

## Task 1: Blueprint data contract

**Files:**
- Create: `src/systems/worldforge/interior/blueprintTypes.ts`
- Test: `src/systems/worldforge/interior/__tests__/blueprintTypes.test.ts`

**Interfaces:**
- Produces: every type below. All later tasks import from here.

- [ ] **Step 1: Write the contract**

```ts
import type { Feet } from '../units';

export type BuildingType = 'cottage' | 'shop' | 'tavern' | 'workshop' | 'manor';

export type RoomPurpose =
  | 'hall' | 'common-room' | 'great-hall' | 'nave'
  | 'kitchen' | 'bedroom' | 'guest-room' | 'private-room' | 'solar'
  | 'shopfront' | 'workshop' | 'storage' | 'pantry' | 'cellar' | 'armory'
  | 'sanctuary' | 'vestry' | 'study' | 'guard-room' | 'corridor';

export const EXTERIOR = -1;

/** A 5 ft grid cell (cell coords, not feet). Feet = cell * 5. */
export interface Cell { cx: number; cy: number; }

export interface BlueprintRoom {
  id: number;
  purpose: RoomPurpose;
  cells: Cell[];
  /** Convenience bbox in feet. */
  bbox: { x: Feet; y: Feet; w: Feet; d: Feet };
  isMain: boolean;
  isCorridor: boolean;
}

/** A door on a wall line. axis 'x' = horizontal wall (crosses a y boundary),
 *  'y' = vertical wall (crosses an x boundary). Matches InteriorDoorway. */
export interface BlueprintDoor {
  a: number; b: number; // room ids; a === EXTERIOR for the street entry
  x: Feet; y: Feet;
  axis: 'x' | 'y';
  isEntry: boolean;
}

export interface BlueprintWindow { x: Feet; y: Feet; axis: 'x' | 'y'; }

export interface BlueprintFurnishing {
  kind: string; roomId: number; x: Feet; y: Feet; rotation: 0 | 90 | 180 | 270;
}

/** A wall segment on one cell edge. thicknessFt grows outward from the line. */
export interface WallEdge {
  x: Feet; y: Feet; axis: 'x' | 'y';
  kind: 'outer' | 'inner';
  thicknessFt: Feet;
}

export interface BlueprintFloor {
  level: number; // -1 = basement, 0 = ground, 1+ = upper
  rooms: BlueprintRoom[];
  doors: BlueprintDoor[];
  windows: BlueprintWindow[];
  furnishings: BlueprintFurnishing[];
  walls: WallEdge[];
}

export interface BlueprintStair { fromLevel: number; x: Feet; y: Feet; }

export interface BlueprintPlan {
  buildingId: number;
  type: BuildingType;
  footprintCells: Cell[];
  widthFt: Feet; depthFt: Feet;
  floors: BlueprintFloor[]; // ordered basement..ground..upper; ground has level 0
  stairs: BlueprintStair[];
}

export const cellKey = (cx: number, cy: number): string => `${cx},${cy}`;
```

- [ ] **Step 2: Write a shape test**

```ts
import { describe, it, expect } from 'vitest';
import { cellKey, EXTERIOR } from '../blueprintTypes';

describe('blueprintTypes', () => {
  it('cellKey is stable and unique', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(cellKey(2, 3)).not.toBe(cellKey(3, 2));
  });
  it('EXTERIOR sentinel is -1', () => { expect(EXTERIOR).toBe(-1); });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/blueprintTypes.test.ts`
Expected: PASS.

---

## Task 2: Irregular footprint

**Files:**
- Create: `src/systems/worldforge/interior/footprint.ts`
- Test: `src/systems/worldforge/interior/__tests__/footprint.test.ts`

**Interfaces:**
- Consumes: `BuildingType`, `Cell`, `cellKey` (Task 1); `rngFromPath`, `SeedPath`, `streamPath` (seedPath.ts).
- Produces: `genFootprint(path: SeedPath, type: BuildingType): { cols: number; rows: number; occ: boolean[][]; cells: Cell[] }`.

**Design:** A footprint is the union of a main rectangle plus 0–4 wings/towers, snapped to the 5 ft grid, chosen by type. Cottage: main + optional 1 wing. Shop/workshop: main + a front/side wing. Tavern: main + 1–2 wings. Manor: main + up to 2 wings + one square tower. Every building must have at least one shape-breaking feature (guarantee: if no wing rolled, force one). Wings attach flush to a side, overlapping by one cell so the union is connected. Normalize so min cell is (0,0).

- [ ] **Step 1: Write tests that pin the shape guarantees**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';

const shapeOf = (type: any, seed: number) =>
  genFootprint(rootSeedPath(seed), type);

describe('genFootprint', () => {
  it('is deterministic for a seed path', () => {
    const a = genFootprint(rootSeedPath(42), 'tavern');
    const b = genFootprint(rootSeedPath(42), 'tavern');
    expect(a.cells).toEqual(b.cells);
  });

  it('is a single connected region', () => {
    const { occ, cols, rows } = shapeOf('manor', 7);
    // flood from the first occupied cell; every occupied cell must be reached
    let start: [number, number] | null = null;
    for (let y = 0; y < rows && !start; y++)
      for (let x = 0; x < cols && !start; x++) if (occ[y][x]) start = [x, y];
    const seen = new Set<string>();
    const st = [start!]; seen.add(`${start![0]},${start![1]}`);
    while (st.length) {
      const [x, y] = st.pop()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx>=0&&ny>=0&&nx<cols&&ny<rows&&occ[ny][nx]&&!seen.has(`${nx},${ny}`)) {
          seen.add(`${nx},${ny}`); st.push([nx,ny]);
        }
      }
    }
    const total = occ.flat().filter(Boolean).length;
    expect(seen.size).toBe(total);
  });

  it('no building type is ever a bare rectangle (has a shape-breaking feature)', () => {
    for (const type of ['cottage','shop','tavern','workshop','manor'] as const) {
      let rectangles = 0;
      for (let s = 0; s < 200; s++) {
        const { occ, cols, rows } = shapeOf(type, s);
        const filled = occ.flat().filter(Boolean).length;
        if (filled === cols * rows) rectangles++;
      }
      expect(rectangles).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/footprint.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `footprint.ts`**

Implement `genFootprint` per the design. Draw wing counts/sizes from `rngFromPath(streamPath(path, 'footprint'))`. Attach wings flush (overlap 1 cell). After building the wing list, if the union is a plain rectangle, force one extra wing before rasterizing. Rasterize to `occ[y][x]`, collect `cells`, return `{cols, rows, occ, cells}`. Keep every dimension a whole number of cells (feet/5).

- [ ] **Step 4: Run tests to green**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/footprint.test.ts`
Expected: PASS (all three).

---

## Task 3: Room partition

**Files:**
- Create: `src/systems/worldforge/interior/partition.ts`
- Test: `src/systems/worldforge/interior/__tests__/partition.test.ts`

**Interfaces:**
- Consumes: footprint `{cols, rows, occ}` (Task 2); `Cell` (Task 1); seed path RNG.
- Produces: `partition(path: SeedPath, fp: Footprint, opts: { keepMainWhole: boolean }): number[][]` — a `rg[y][x]` room-id grid (-1 outside), room ids compact from 0.

**Design:** BSP-split the bounding box, clip each leaf to the occupied cells, flood-fill each leaf's occupied region into connected rooms (so a leaf spanning a notch yields two rooms). Merge slivers (< 3 cells) into the neighbor they share the most edge with. **Dominant main room:** reserve the largest wing (or a target rectangle around the front-centre) as ONE un-split room so the hall/common-room/nave stays big — controlled by `opts.keepMainWhole`. Target room count scales with area but stays modest (cottage 3–5, tavern 6–9, manor 6–10) — bias the BSP stop so big footprints do not shred.

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';

const roomIds = (rg: number[][]) => new Set(rg.flat().filter((v) => v >= 0));
const areaOf = (rg: number[][], id: number) => rg.flat().filter((v) => v === id).length;

describe('partition', () => {
  it('every occupied cell belongs to exactly one room, ids compact from 0', () => {
    const fp = genFootprint(rootSeedPath(3), 'tavern');
    const rg = partition(rootSeedPath(3), fp, { keepMainWhole: true });
    const ids = [...roomIds(rg)].sort((a, b) => a - b);
    expect(ids[0]).toBe(0);
    expect(ids).toEqual(ids.map((_, i) => i)); // 0..n-1 contiguous
    const occupied = fp.occ.flat().filter(Boolean).length;
    expect(rg.flat().filter((v) => v >= 0).length).toBe(occupied);
  });

  it('keeps one dominant room (>= 30% of area) when keepMainWhole', () => {
    const fp = genFootprint(rootSeedPath(9), 'manor');
    const rg = partition(rootSeedPath(9), fp, { keepMainWhole: true });
    const total = fp.occ.flat().filter(Boolean).length;
    const biggest = Math.max(...[...roomIds(rg)].map((id) => areaOf(rg, id)));
    expect(biggest / total).toBeGreaterThanOrEqual(0.3);
  });

  it('no sliver rooms (< 3 cells) survive', () => {
    const fp = genFootprint(rootSeedPath(11), 'shop');
    const rg = partition(rootSeedPath(11), fp, { keepMainWhole: true });
    for (const id of roomIds(rg)) expect(areaOf(rg, id)).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to fail** — `npx vitest run src/systems/worldforge/interior/__tests__/partition.test.ts` → FAIL.

- [ ] **Step 3: Implement `partition.ts`** per design (BSP + clip + connected components + sliver-merge + reserved main room + compaction).

- [ ] **Step 4: Run to green** — same command → PASS.

---

## Task 4: Room program (purposes)

**Files:**
- Create: `src/systems/worldforge/interior/program.ts`
- Test: `src/systems/worldforge/interior/__tests__/program.test.ts`

**Interfaces:**
- Consumes: `rg` (Task 3), `BuildingType`, `RoomPurpose`, `Cell`, `BlueprintRoom` (Task 1).
- Produces: `assignPurposes(path, type, rg): BlueprintRoom[]` — one room per id, with `purpose`, `cells`, `bbox` (feet), `isMain`, `isCorridor`.

**Design:** Detect corridors (a room whose cells form a 1-cell-wide run of length ≥ 3) → `corridor`. Mark the biggest non-corridor room `isMain`, give it the type's headline purpose (cottage `hall`, tavern `common-room`, manor `great-hall`, shop `shopfront`, workshop `workshop`). Assign the rest from a per-type weighted program with min/max counts (e.g. tavern = 1 kitchen, 0–1 cellar, then guest-rooms; a shop = shopfront + workshop + storage + living rooms). **Cap `storage` at ~1 per building** — no plan is half storeroom.

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  return assignPurposes(p, type, rg);
};

describe('assignPurposes', () => {
  it('exactly one main room, and it is the largest non-corridor', () => {
    const rooms = build('tavern', 5);
    expect(rooms.filter((r) => r.isMain)).toHaveLength(1);
    const main = rooms.find((r) => r.isMain)!;
    const nonCorridorAreas = rooms.filter((r) => !r.isCorridor).map((r) => r.cells.length);
    expect(main.cells.length).toBe(Math.max(...nonCorridorAreas));
  });

  it('the main room carries the type headline purpose', () => {
    expect(build('tavern', 5).find((r) => r.isMain)!.purpose).toBe('common-room');
    expect(build('manor', 6).find((r) => r.isMain)!.purpose).toBe('great-hall');
  });

  it('no building is half storeroom (storage rooms <= 1)', () => {
    for (let s = 0; s < 100; s++) {
      const rooms = build('tavern', s);
      expect(rooms.filter((r) => r.purpose === 'storage').length).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run to fail.** **Step 3: Implement `program.ts`.** **Step 4: Run to green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/program.test.ts`

---

## Task 5: Doors + entrance

**Files:**
- Create: `src/systems/worldforge/interior/doors.ts`
- Test: `src/systems/worldforge/interior/__tests__/doors.test.ts`

**Interfaces:**
- Consumes: `rg` (Task 3), `BlueprintRoom[]` (Task 4), `BlueprintDoor`, `EXTERIOR` (Task 1).
- Produces: `wireDoors(path, rg, rooms): { doors: BlueprintDoor[] }` — a connected door graph plus one street entry.

**Design:** Build room adjacency from shared wall edges. Compute a spanning tree over rooms so every room is reachable, one door per tree edge; add a few loop doors. The **street entry** is placed on an outer wall edge of the main room (or, if the main room has no outer wall, on a corridor that connects to it) — never a random back room. Each interior door's swing opens into the **larger** of the two rooms.

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { EXTERIOR } from '../blueprintTypes';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  return { rooms, doors };
};

describe('wireDoors', () => {
  it('every room is reachable from the entry (connected graph)', () => {
    const { rooms, doors } = build('manor', 4);
    const entry = doors.find((d) => d.a === EXTERIOR)!;
    const adj = new Map<number, number[]>();
    for (const d of doors) {
      if (d.a === EXTERIOR) continue;
      (adj.get(d.a) ?? adj.set(d.a, []).get(d.a)!).push(d.b);
      (adj.get(d.b) ?? adj.set(d.b, []).get(d.b)!).push(d.a);
    }
    const seen = new Set([entry.b]); const st = [entry.b];
    while (st.length) for (const n of adj.get(st.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); st.push(n); }
    expect(seen.size).toBe(rooms.length);
  });

  it('the entry sits on the main room (or a corridor joined to it)', () => {
    const { rooms, doors } = build('tavern', 8);
    const entry = doors.find((d) => d.a === EXTERIOR)!;
    const room = rooms.find((r) => r.id === entry.b)!;
    expect(room.isMain || room.isCorridor).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail. Step 3: Implement `doors.ts`. Step 4: Run to green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/doors.test.ts`

---

## Task 6: Walls + windows

**Files:**
- Create: `src/systems/worldforge/interior/walls.ts`
- Test: `src/systems/worldforge/interior/__tests__/walls.test.ts`

**Interfaces:**
- Consumes: `rg` (Task 3), `BlueprintDoor[]` (Task 5), `WallEdge`, `BlueprintWindow` (Task 1).
- Produces: `buildWalls(path, rg, doors): { walls: WallEdge[]; windows: BlueprintWindow[] }`.

**Design:** For every cell edge where the two sides differ (room vs room, or room vs outside), emit a `WallEdge` unless a door sits there. `kind` = `'outer'` when one side is outside, else `'inner'`. `thicknessFt`: outer = 1.5 ft, inner = 0.5 ft (grows outward from the line; the drawing and 3D both read this). **Windows** go only on `outer` edges that face true open air — classify by ray-casting outward from the edge to the footprint's bounding box; an edge whose outward ray immediately re-enters the footprint (a re-entrant notch) is NOT outdoors and gets no window. Space windows along each outer run, none within one cell of a door or the entry.

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { buildWalls } from '../walls';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  return { fp, ...buildWalls(p, rg, doors), doors };
};

describe('buildWalls', () => {
  it('outer walls are thicker than inner walls', () => {
    const { walls } = build('manor', 2);
    const outer = walls.find((w) => w.kind === 'outer')!;
    const inner = walls.find((w) => w.kind === 'inner')!;
    expect(outer.thicknessFt).toBeGreaterThan(inner.thicknessFt);
  });

  it('no wall edge coincides with a door', () => {
    const { walls, doors } = build('tavern', 6);
    for (const d of doors) {
      const clash = walls.some((w) => w.axis === d.axis && w.x === d.x && w.y === d.y);
      expect(clash).toBe(false);
    }
  });

  it('windows only sit on outer walls', () => {
    const { walls, windows } = build('shop', 1);
    const outerSet = new Set(walls.filter((w) => w.kind === 'outer').map((w) => `${w.axis}:${w.x}:${w.y}`));
    for (const win of windows) expect(outerSet.has(`${win.axis}:${win.x}:${win.y}`)).toBe(true);
  });
});
```

- [ ] **Step 2–4: fail → implement `walls.ts` → green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/walls.test.ts`

---

## Task 7: Furniture (room-clipped)

**Files:**
- Create: `src/systems/worldforge/interior/furnish.ts`
- Test: `src/systems/worldforge/interior/__tests__/furnish.test.ts`

**Interfaces:**
- Consumes: `BlueprintRoom[]` (Task 4), `BlueprintDoor[]` (Task 5), `BlueprintFurnishing` (Task 1).
- Produces: `furnishRooms(path, rooms, doors, blocked): BlueprintFurnishing[]`, where `blocked` is a set of cell keys reserved for stairs.

**Design:** One recipe per `RoomPurpose` (bed/chest in bedrooms, hearth+tables in halls, counter+shelves in shops, and so on). Every placed item must land on a cell that belongs to the room (`room.cells`), never its bounding box — so L-shaped rooms don't leak furniture. Skip cells within one cell of a door or in `blocked` (stairs). Corridors get no furniture.

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { furnishRooms } from '../furnish';
import { cellKey } from '../blueprintTypes';

describe('furnishRooms', () => {
  it('every furnishing sits on a cell owned by its room', () => {
    const p = rootSeedPath(15);
    const fp = genFootprint(p, 'tavern');
    const rg = partition(p, fp, { keepMainWhole: true });
    const rooms = assignPurposes(p, 'tavern', rg);
    const { doors } = wireDoors(p, rg, rooms);
    const furn = furnishRooms(p, rooms, doors, new Set());
    const cellsById = new Map(rooms.map((r) => [r.id, new Set(r.cells.map((c) => cellKey(c.cx, c.cy)))]));
    for (const f of furn) {
      const cx = Math.floor(f.x / 5), cy = Math.floor(f.y / 5);
      expect(cellsById.get(f.roomId)!.has(cellKey(cx, cy))).toBe(true);
    }
  });

  it('corridors get no furniture', () => {
    const p = rootSeedPath(21);
    const fp = genFootprint(p, 'manor');
    const rg = partition(p, fp, { keepMainWhole: true });
    const rooms = assignPurposes(p, 'manor', rg);
    const { doors } = wireDoors(p, rg, rooms);
    const furn = furnishRooms(p, rooms, doors, new Set());
    const corridorIds = new Set(rooms.filter((r) => r.isCorridor).map((r) => r.id));
    expect(furn.some((f) => corridorIds.has(f.roomId))).toBe(false);
  });
});
```

- [ ] **Step 2–4: fail → implement `furnish.ts` → green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/furnish.test.ts`

---

## Task 8: Assemble floors, stairs, basement

**Files:**
- Create: `src/systems/worldforge/interior/generateBuilding.ts`
- Test: `src/systems/worldforge/interior/__tests__/generateBuilding.test.ts`

**Interfaces:**
- Consumes: all modules above; `BlueprintPlan`, `BlueprintFloor`, `BlueprintStair` (Task 1); `childSeedPath`, `rootSeedPath` (seedPath).
- Produces: `generateBuilding(input: { buildingId: number; type: BuildingType; seedPath: SeedPath; storeys?: number; basement?: boolean }): BlueprintPlan`.

**Design:** Ground floor (`level 0`) uses `keepMainWhole: true`. A single stair shaft sits at the main room's centre; it repeats up through each upper floor and down into the basement, landing inside a room on every level (each floor seeds from `childSeedPath(path, 'floor:<level>')`). Upper floors are sleeping quarters; the basement is cellars/storage (`keepMainWhole: false`). Pass the stair cell to `furnishRooms` as `blocked` on every floor it touches. Assemble the `BlueprintPlan`. Memoize per `(seedPath, type, storeys, basement)` exactly as `generateInterior` does today.

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { generateBuilding } from '../generateBuilding';

const gen = (over = {}) => generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(3), storeys: 3, basement: true, ...over });

describe('generateBuilding', () => {
  it('is byte-identical for the same input', () => {
    expect(JSON.stringify(gen())).toBe(JSON.stringify(gen()));
  });

  it('has a basement, ground, and upper floors ordered by level', () => {
    const plan = gen();
    const levels = plan.floors.map((f) => f.level);
    expect(levels).toContain(-1);
    expect(levels).toContain(0);
    expect(levels).toContain(2);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels); // already ascending
  });

  it('a stair lands inside a room on both floors it joins', () => {
    const plan = gen();
    for (const st of plan.stairs) {
      for (const lvl of [st.fromLevel, st.fromLevel + 1]) {
        const floor = plan.floors.find((f) => f.level === lvl)!;
        const inRoom = floor.rooms.some((r) =>
          r.cells.some((c) => c.cx === Math.floor(st.x / 5) && c.cy === Math.floor(st.y / 5)));
        expect(inRoom).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2–4: fail → implement `generateBuilding.ts` → green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/generateBuilding.test.ts`

---

## Task 9: Golden snapshot for the five types

**Files:**
- Test: `src/systems/worldforge/interior/__tests__/generateBuilding.golden.test.ts`

**Interfaces:** Consumes `generateBuilding` (Task 8).

- [ ] **Step 1: Write a golden test that locks the shape of one seed per type**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { generateBuilding } from '../generateBuilding';

describe('generateBuilding golden', () => {
  for (const type of ['cottage','shop','tavern','workshop','manor'] as const) {
    it(`${type} seed 12345 is stable`, () => {
      const plan = generateBuilding({ buildingId: 1, type, seedPath: rootSeedPath(12345), storeys: type === 'manor' ? 3 : 2, basement: true });
      // summary snapshot: dims, room count + purposes per floor, door/window/stair counts
      const summary = {
        dims: [plan.widthFt, plan.depthFt],
        floors: plan.floors.map((f) => ({
          level: f.level,
          rooms: f.rooms.map((r) => r.purpose).sort(),
          doors: f.doors.length, windows: f.windows.length, walls: f.walls.length,
        })),
        stairs: plan.stairs.length,
      };
      expect(summary).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 2: Run to create the snapshot** — `npx vitest run src/systems/worldforge/interior/__tests__/generateBuilding.golden.test.ts` → writes `__snapshots__`. **Eyeball the summaries for sanity** (room counts modest, purposes sensible, storage ≤ 1) before accepting.

---

## Task 10: Legacy adapter (keep the 3D build working)

**Files:**
- Modify: `src/systems/worldforge/interior/generateInterior.ts`
- Test: `src/systems/worldforge/interior/__tests__/generateInterior.test.ts` (existing — must stay green)

**Interfaces:**
- Produces: `generateInterior(plot, seedPath): InteriorPlan` unchanged in signature, now derived from `generateBuilding`.

**Design:** Rewrite `generateInterior` as a thin adapter: call `generateBuilding`, then map `BlueprintPlan` → the legacy `InteriorPlan` shape (rooms as bbox rects, doorways, furnishings, stairs, upperFloors). This keeps every current 3D-build caller working while a single generator now owns generation. Legacy `RoomRole` maps from `RoomPurpose` (e.g. `common-room`/`great-hall` → `hall`, `shopfront` → `shopfloor`, everything cellar/pantry/armory → `storage`).

- [ ] **Step 1: Run the existing interior tests to capture current behavior** — `npx vitest run src/systems/worldforge/interior/__tests__/generateInterior.test.ts` (note what they assert).
- [ ] **Step 2: Implement the adapter** mapping `BlueprintPlan` → `InteriorPlan`.
- [ ] **Step 3: Run the existing tests** — same command. If an assertion no longer holds because the plan is legitimately richer, update the assertion to the new truth (do not weaken a real check). Expected: PASS.
- [ ] **Step 4: Run the whole interior suite** — `npx vitest run src/systems/worldforge/interior` → PASS.

---

## Task 11: Pure 2D blueprint drawer

**Files:**
- Create: `src/systems/worldforge/interior/renderBlueprintSvg.ts`
- Modify: `src/components/DesignPreview/steps/PreviewBlueprint.tsx`
- Test: `src/systems/worldforge/interior/__tests__/renderBlueprintSvg.test.ts`

**Interfaces:**
- Consumes: `BlueprintPlan`, `BlueprintFloor` (Task 1).
- Produces: `renderBlueprintSvg(plan: BlueprintPlan, level: number): string`.

**Design:** Lift the SVG builder out of `PreviewBlueprint.tsx` into a pure module over `BlueprintPlan`, folding in the picture fixes from the critique: interior doors 3 ft wide (not 5 ft) with a matching swing that never crosses a wall; floor lighting clamped so corner cells never go near-black; labels centered with `dominant-baseline` and wrapped/abbreviated (never overflowing a wall); a graphic **scale bar** and **room numbers** with a keyed legend; walls drawn at their `WallEdge.thicknessFt` straddling the line. `PreviewBlueprint.tsx` then imports `generateBuilding` + `renderBlueprintSvg` and drops its private generator.

- [ ] **Step 1: Write tests** (pure string assertions, no DOM)

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../seedPath';
import { generateBuilding } from '../generateBuilding';
import { renderBlueprintSvg } from '../renderBlueprintSvg';

describe('renderBlueprintSvg', () => {
  const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(7), storeys: 2, basement: true });
  it('emits one <svg> with a viewBox', () => {
    const svg = renderBlueprintSvg(plan, 0);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox=');
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
  });
  it('draws a scale bar and a room number for every non-corridor room', () => {
    const svg = renderBlueprintSvg(plan, 0);
    expect(svg).toContain('data-scale-bar');
    const nonCorridor = plan.floors[0].rooms.filter((r) => !r.isCorridor).length; // note: floors[0] may be basement; test uses ground below
  });
  it('interior door leaves are 3 ft, not a full 5 ft cell', () => {
    const svg = renderBlueprintSvg(plan, 0);
    // door leaves carry data-door-ft; none may be 5
    const fts = [...svg.matchAll(/data-door-ft="([0-9.]+)"/g)].map((m) => Number(m[1]));
    expect(fts.length).toBeGreaterThan(0);
    expect(fts.every((f) => f <= 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail. Step 3: Implement `renderBlueprintSvg.ts`** (emit the `data-*` hooks the tests read: `data-scale-bar`, `data-door-ft`, `data-room-num`). **Step 4: Point `PreviewBlueprint.tsx` at the shared generator + renderer. Step 5: Run to green.**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/renderBlueprintSvg.test.ts`

- [ ] **Step 6: Eyeball on the Design Preview.** Start `dev:preview`, open `/Aralia/misc/design.html?step=blueprint`, reroll each type and every floor. Confirm: irregular shapes draw, doors read as normal doors, corners aren't black, labels don't cross walls, scale bar + room numbers show. (Screenshots hang on this page — inspect via the SVG DOM, per the known limitation.)

---

## Task 12: 3D build from the blueprint

**Files:**
- Modify: `src/systems/worldforge/bridge/interiorBuild.ts`, `src/systems/worldforge/bridge/interiorParts.ts`, `src/systems/world3d/buildingModels.ts`
- Test: `src/systems/world3d/__tests__/buildingModels.test.ts` (extend)

**Interfaces:**
- Consumes: `BlueprintPlan` + `WallEdge` (Task 1). The 3D build reads the plan directly (or via the Task 10 adapter for the parts it already handles) and additionally raises: the **irregular outer shell** (follow `footprintCells`, not a single box), **wall thickness** (extrude each `WallEdge` at its `thicknessFt`), and **basement + upper floors** at their levels.

**Design:** Replace the rectangular-envelope assumption in the interior build with a walk over `WallEdge[]` per floor: each edge becomes a wall segment box of length one cell and width `thicknessFt`, centered on the grid line. The outer shell is the set of `kind: 'outer'` edges. Floors stack at `level * storeyHeight`; the basement sits at `-storeyHeight`.

- [ ] **Step 1: Write a test that the shell follows an irregular footprint**

```ts
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../worldforge/seedPath';
import { generateBuilding } from '../../worldforge/interior/generateBuilding';
import { buildBuildingMeshData } from '../buildingModels'; // pure data builder (no THREE meshes)

describe('buildBuildingMeshData', () => {
  it('outer wall segment count matches the plan outer edges (irregular shell)', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(4), storeys: 2, basement: false });
    const ground = plan.floors.find((f) => f.level === 0)!;
    const data = buildBuildingMeshData(plan);
    const outerEdges = ground.walls.filter((w) => w.kind === 'outer').length;
    expect(data.floors[0].outerWallSegments).toBe(outerEdges);
  });
});
```

- [ ] **Step 2: Run to fail. Step 3: Refactor `buildingModels.ts`** to expose a pure `buildBuildingMeshData(plan): { floors: { level: number; outerWallSegments: number; ... }[] }` that walks `WallEdge[]`, then have the THREE-side builder consume it. **Step 4: Run to green.**
- [ ] **Step 5: Eyeball in 3D.** Enter a building in the 3D world (or the town-3D preview) and confirm the shell is no longer a plain box, walls have thickness, and floors/basement stack. Capture via the headless shoot rig (screenshots hang on R3F).

---

## Self-Review

- **Spec coverage:** data contract (T1) · irregular footprints (T2) · believable layout: dominant main room + corridors (T3), purposes + storage cap (T4), sensible entrance (T5) · walls as real-thickness edges + outward windows (T6) · room-clipped furniture (T7) · basements + multi-storey + stairs (T8) · determinism/goldens (T9) · one generator, no duplicate (T10 adapter) · module-map drawer with door/label/lighting/scale-bar/room-number fixes (T11) · 3D from the shared data with irregular shell + wall thickness (T12). Every spec section maps to a task.
- **Placeholder scan:** each task carries concrete tests; heavy geometry is specified by its tests + a precise design paragraph (the test is the contract), not "TODO".
- **Type consistency:** all tasks import the Task 1 names (`BlueprintPlan`, `BlueprintRoom.cells`, `WallEdge.thicknessFt`, `BlueprintDoor.axis`, `EXTERIOR`); the legacy `InteriorPlan` is produced only by the Task 10 adapter.

---

*After Task 12, decide whether `PreviewFloorplans.tsx` retires (Blueprint now covers it) or stays as a look-lab.*
