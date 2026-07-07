import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { EXTERIOR, type BuildingType } from '../blueprintTypes';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { buildWalls, mergeWallRuns } from '../walls';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  return { fp, rg, rooms, ...buildWalls(p, rg, doors, rooms), doors };
};

const CELL_FT = 5;
const TYPES: BuildingType[] = ['cottage', 'shop', 'tavern', 'workshop', 'manor'];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Interior (roomA-side) cell of a wall edge, derived from its geometry alone. */
const interiorCell = (w: { x: number; y: number; axis: 'x' | 'y'; nx: number; ny: number }) => {
  if (w.axis === 'y') {
    // Vertical wall on the x = w.x grid line; w.y is a cell-center.
    return { cx: w.nx > 0 ? w.x / CELL_FT - 1 : w.x / CELL_FT, cy: Math.floor(w.y / CELL_FT) };
  }
  return { cx: Math.floor(w.x / CELL_FT), cy: w.ny > 0 ? w.y / CELL_FT - 1 : w.y / CELL_FT };
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

  it('roomA/roomB and (nx,ny) match an independent rg recomputation (A1)', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { rg, walls } = build(type, seed);
        const rows = rg.length;
        const cols = rg[0].length;
        const at = (cx: number, cy: number): number =>
          cy >= 0 && cy < rows && cx >= 0 && cx < cols ? rg[cy][cx] : -1;
        expect(walls.length).toBeGreaterThan(0);
        for (const w of walls) {
          // Exactly one axis-appropriate unit normal.
          if (w.axis === 'y') {
            expect(Math.abs(w.nx)).toBe(1);
            expect(w.ny).toBe(0);
          } else {
            expect(Math.abs(w.ny)).toBe(1);
            expect(w.nx).toBe(0);
          }
          const a = interiorCell(w);
          // Interior cell holds roomA (never exterior).
          expect(at(a.cx, a.cy)).toBe(w.roomA);
          expect(w.roomA).toBeGreaterThanOrEqual(0);
          // The cell across the edge holds roomB; EXTERIOR means the (nx,ny)
          // step immediately leaves the footprint.
          const across = at(a.cx + w.nx, a.cy + w.ny);
          if (w.kind === 'outer') {
            expect(w.roomB).toBe(EXTERIOR);
            expect(across).toBe(-1);
          } else {
            expect(w.roomB).toBe(across);
            expect(w.roomB).toBeGreaterThanOrEqual(0);
            expect(w.roomB).not.toBe(w.roomA);
          }
        }
      }
    }
  });

  it('wallRuns exactly tile the wall edges per (axis, kind) group (A4)', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { walls, wallRuns } = build(type, seed);
        expect(wallRuns).toEqual(mergeWallRuns(walls)); // deterministic, RNG-free
        const countEdges = (axis: string, kind: string): number =>
          walls.filter((w) => w.axis === axis && w.kind === kind).length;
        const sumRunCells = (axis: string, kind: string): number =>
          wallRuns
            .filter((r) => r.axis === axis && r.kind === kind)
            .reduce((s, r) => s + (r.axis === 'y' ? r.y2 - r.y1 : r.x2 - r.x1) / CELL_FT, 0);
        for (const axis of ['x', 'y'] as const) {
          for (const kind of ['outer', 'inner'] as const) {
            expect(sumRunCells(axis, kind)).toBe(countEdges(axis, kind));
          }
        }
        // Every edge is covered by exactly one run on its line with its normal.
        for (const w of walls) {
          const covering = wallRuns.filter((r) =>
            r.axis === w.axis && r.kind === w.kind && r.nx === w.nx && r.ny === w.ny &&
            (w.axis === 'y'
              ? r.x1 === w.x && r.y1 < w.y && w.y < r.y2
              : r.y1 === w.y && r.x1 < w.x && w.x < r.x2));
          expect(covering.length).toBe(1);
        }
      }
    }
  });

  // ---- A12: purpose-aware windows. Eligibility is recomputed here from rg +
  // doors alone (independent oracle — no walls.ts internals).

  type Slot = { x: number; y: number; axis: 'x' | 'y'; roomA: number; fixed: number; dir: number };

  /** Every outer edge slot of the footprint, tagged with room + facade. */
  const outerSlotsOf = (rg: number[][], doors: any[]): Slot[] => {
    const rows = rg.length, cols = rg[0].length;
    const at = (cx: number, cy: number): number =>
      cy >= 0 && cy < rows && cx >= 0 && cx < cols ? rg[cy][cx] : -1;
    const openAir = (cx: number, cy: number, dx: number, dy: number): boolean => {
      let x = cx, y = cy;
      while (x >= 0 && x < cols && y >= 0 && y < rows) {
        if (rg[y][x] >= 0) return false;
        x += dx; y += dy;
      }
      return true;
    };
    const doorAt = (axis: string, x: number, y: number): boolean =>
      doors.some((d) => d.axis === axis && d.x === x && d.y === y);
    const nearDoor = (x: number, y: number): boolean =>
      doors.some((d) => Math.hypot(d.x - x, d.y - y) <= CELL_FT);
    // First pass: EVERY outer edge (minus door-occupied edges), tagged. Run
    // extents (Fix C) are computed from THIS full set — matching walls.ts, which
    // derives run extents from all outer wall edges, NOT the door-clearance /
    // open-air filtered candidate set. Near-door edges still form wall, so they
    // lengthen the run a window may sit within.
    interface RawEdge extends Slot { blocked: boolean }
    const raw: RawEdge[] = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (rg[cy][cx] < 0) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (at(cx + dx, cy + dy) >= 0) continue;
          const axis: 'x' | 'y' = dx !== 0 ? 'y' : 'x';
          const x = dx !== 0 ? (dx > 0 ? cx + 1 : cx) * CELL_FT : cx * CELL_FT + CELL_FT / 2;
          const y = dy !== 0 ? (dy > 0 ? cy + 1 : cy) * CELL_FT : cy * CELL_FT + CELL_FT / 2;
          if (doorAt(axis, x, y)) continue; // door removes the wall edge entirely
          raw.push({
            x, y, axis, roomA: rg[cy][cx],
            fixed: axis === 'y' ? x : y,
            dir: axis === 'y' ? dx : dy,
            // Not a window candidate when near a door or facing enclosed air —
            // but it IS still wall, so it counts toward the run extent.
            blocked: nearDoor(x, y) || !openAir(cx + dx, cy + dy, dx, dy),
          });
        }
      }
    }
    // Corner clearance (Fix C): a slot's window void + margin must fit inside the
    // continuous run (axis:fixed:dir, split on 5 ft contiguity) computed from ALL
    // outer edges. Mirrors walls.ts.
    const WINDOW_FT = 3;
    const MARGIN_FT = 1.5;
    const need = WINDOW_FT / 2 + MARGIN_FT;
    const along = (s: Slot): number => (s.axis === 'y' ? s.y : s.x);
    const byRun = new Map<string, RawEdge[]>();
    for (const s of raw) {
      const key = `${s.axis}:${s.fixed}:${s.dir}`;
      const list = byRun.get(key) ?? [];
      list.push(s);
      byRun.set(key, list);
    }
    const fits = new Set<RawEdge>();
    for (const list of byRun.values()) {
      list.sort((a, b) => along(a) - along(b));
      let start = 0;
      for (let i = 1; i <= list.length; i++) {
        if (i === list.length || along(list[i]) - along(list[i - 1]) !== CELL_FT) {
          const lo = along(list[start]) - CELL_FT / 2;
          const hi = along(list[i - 1]) + CELL_FT / 2;
          for (let j = start; j < i; j++) {
            const a = along(list[j]);
            if (a - need >= lo - 1e-6 && a + need <= hi + 1e-6) fits.add(list[j]);
          }
          start = i;
        }
      }
    }
    // A window candidate = an unblocked edge that also fits corner clearance.
    return raw.filter((s) => !s.blocked && fits.has(s));
  };

  /** Map a window back to its interior room from rg geometry alone. */
  const windowRoom = (rg: number[][], w: { x: number; y: number; axis: string }): number => {
    const at = (cx: number, cy: number): number =>
      cy >= 0 && cy < rg.length && cx >= 0 && cx < rg[0].length ? rg[cy][cx] : -1;
    if (w.axis === 'y') {
      const cy = Math.floor(w.y / CELL_FT);
      const left = at(w.x / CELL_FT - 1, cy);
      return left >= 0 ? left : at(w.x / CELL_FT, cy);
    }
    const cx = Math.floor(w.x / CELL_FT);
    const up = at(cx, w.y / CELL_FT - 1);
    return up >= 0 ? up : at(cx, w.y / CELL_FT);
  };

  const SWEEP_SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
  const GUARANTEED = new Set(['bedroom', 'guest-room', 'private-room', 'solar', 'kitchen']);

  it('A12: every eligible-edged habitable/main room has >= 1 window', () => {
    for (const type of TYPES) {
      for (const seed of SWEEP_SEEDS) {
        const { rg, rooms, doors, windows } = build(type, seed);
        const eligible = outerSlotsOf(rg, doors);
        const winRooms = windows.map((w) => windowRoom(rg, w));
        for (const room of rooms) {
          const mustGlaze = room.isMain || GUARANTEED.has(room.purpose);
          if (!mustGlaze) continue;
          const hasEligible = eligible.some((s) => s.roomA === room.id);
          if (!hasEligible) continue; // honest omission
          expect(
            winRooms.filter((id) => id === room.id).length,
            `${type} seed ${seed} room ${room.id} (${room.purpose}) windowless`,
          ).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('A12: cellar-purpose rooms never get a window (any floor incl. ground)', () => {
    let cellarsSeen = 0;
    for (const type of TYPES) {
      for (const seed of SWEEP_SEEDS) {
        const { rg, rooms, windows } = build(type, seed);
        const cellars = new Set(rooms.filter((r) => r.purpose === 'cellar').map((r) => r.id));
        cellarsSeen += cellars.size;
        for (const w of windows) {
          expect(cellars.has(windowRoom(rg, w)), `${type} seed ${seed} cellar window`).toBe(false);
        }
      }
    }
    expect(cellarsSeen).toBeGreaterThan(0); // the assertion is not vacuous
  });

  it('A12: eligible shopfronts carry glazing, on the entry facade when possible', () => {
    let shopfrontsSeen = 0;
    for (const type of TYPES) {
      for (const seed of SWEEP_SEEDS) {
        const { rg, rooms, doors, windows } = build(type, seed);
        const entry = doors.find((d: any) => d.isEntry);
        const eligible = outerSlotsOf(rg, doors);
        const winKeys = new Set(windows.map((w) => `${w.axis}:${w.x}:${w.y}`));
        const onFacade = (s: Slot): boolean =>
          entry !== undefined && s.axis === entry.axis &&
          s.fixed === (entry.axis === 'y' ? entry.x : entry.y) &&
          s.dir === -(entry.axis === 'y' ? entry.openDir.nx : entry.openDir.ny);
        for (const room of rooms.filter((r: any) => r.purpose === 'shopfront')) {
          const mine = eligible.filter((s) => s.roomA === room.id);
          if (mine.length === 0) continue; // honest omission
          shopfrontsSeen++;
          const facade = mine.filter(onFacade);
          const pool = facade.length > 0 ? facade : mine;
          expect(
            pool.some((s) => winKeys.has(`${s.axis}:${s.x}:${s.y}`)),
            `${type} seed ${seed} shopfront ${room.id} unglazed`,
          ).toBe(true);
        }
      }
    }
    expect(shopfrontsSeen).toBeGreaterThan(0);
  });

  it('A12: window set is deterministic per seed and omitting rooms keeps legacy behavior', () => {
    const p = rootSeedPath(7);
    const fp = genFootprint(p, 'manor');
    const rg = partition(p, fp, { keepMainWhole: true });
    const rooms = assignPurposes(p, 'manor', rg);
    const { doors } = wireDoors(p, rg, rooms);
    expect(buildWalls(p, rg, doors, rooms).windows)
      .toEqual(buildWalls(p, rg, doors, rooms).windows);
    // Legacy path (no rooms) is unchanged and self-consistent.
    expect(buildWalls(p, rg, doors).windows).toEqual(buildWalls(p, rg, doors).windows);
  });

  // ── Fix C: window corner clearance (2026-07-06). A window slot is only kept
  // when the full window width (3 ft) plus a >= 1 ft margin fits inside the
  // continuous wall stretch between corners/doors it belongs to. Windows that
  // would clip the perpendicular wall at a run end are honestly dropped.
  describe('window corner clearance (Fix C)', () => {
    const WINDOW_FT = 3;
    // Margin = the perpendicular outer wall thickness (1.5 ft), so the 3 ft void
    // fully clears the wall at a run end. Satisfies the spec's >= 1 ft floor and
    // actually resolves the clip (a 1 ft margin still leaves 0.5 ft overlap).
    const MARGIN_FT = 1.5;

    /** Maximal outer-wall run extents [lo, hi] on each (axis, fixed, dir)
     *  line, reconstructed from rg alone (independent oracle). */
    const outerRunExtents = (rg: number[][], doors: any[]) => {
      const rows = rg.length, cols = rg[0].length;
      const at = (cx: number, cy: number): number =>
        cy >= 0 && cy < rows && cx >= 0 && cx < cols ? rg[cy][cx] : -1;
      const doorAt = (axis: string, x: number, y: number): boolean =>
        doors.some((d) => d.axis === axis && d.x === x && d.y === y);
      // Collect outer edges keyed by run line, as along-positions.
      const lines = new Map<string, number[]>();
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (rg[cy][cx] < 0) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (at(cx + dx, cy + dy) >= 0) continue;
            const axis: 'x' | 'y' = dx !== 0 ? 'y' : 'x';
            const x = dx !== 0 ? (dx > 0 ? cx + 1 : cx) * CELL_FT : cx * CELL_FT + CELL_FT / 2;
            const y = dy !== 0 ? (dy > 0 ? cy + 1 : cy) * CELL_FT : cy * CELL_FT + CELL_FT / 2;
            if (doorAt(axis, x, y)) continue; // door breaks the run
            const fixed = axis === 'y' ? x : y;
            const dir = axis === 'y' ? dx : dy;
            const along = axis === 'y' ? y : x;
            const key = `${axis}:${fixed}:${dir}`;
            const list = lines.get(key) ?? [];
            list.push(along);
            lines.set(key, list);
          }
        }
      }
      // Merge contiguous (5 ft-spaced) along-positions into [lo, hi] extents.
      const extentsByKey = new Map<string, Array<{ lo: number; hi: number }>>();
      for (const [key, alongs] of lines) {
        alongs.sort((a, b) => a - b);
        const spans: Array<{ lo: number; hi: number }> = [];
        let start = 0;
        for (let i = 1; i <= alongs.length; i++) {
          if (i === alongs.length || alongs[i] - alongs[i - 1] !== CELL_FT) {
            spans.push({ lo: alongs[start] - CELL_FT / 2, hi: alongs[i - 1] + CELL_FT / 2 });
            start = i;
          }
        }
        extentsByKey.set(key, spans);
      }
      return extentsByKey;
    };

    it('every placed window has >= 1 ft clearance to its run ends (30 seeds)', () => {
      for (const type of TYPES) {
        for (const seed of SWEEP_SEEDS) {
          const { rg, doors, windows, walls } = build(type, seed);
          const outerSet = new Set(
            walls.filter((w) => w.kind === 'outer').map((w) => `${w.axis}:${w.x}:${w.y}`),
          );
          const extents = outerRunExtents(rg, doors);
          for (const w of windows) {
            expect(outerSet.has(`${w.axis}:${w.x}:${w.y}`)).toBe(true);
            const along = w.axis === 'y' ? w.y : w.x;
            const fixed = w.axis === 'y' ? w.x : w.y;
            // The window belongs to exactly one run extent on its line (either
            // outward dir); it must sit with full width + margin inside it.
            const candidates = [
              ...(extents.get(`${w.axis}:${fixed}:1`) ?? []),
              ...(extents.get(`${w.axis}:${fixed}:-1`) ?? []),
            ].filter((e) => along > e.lo && along < e.hi);
            expect(candidates.length).toBeGreaterThan(0);
            const fits = candidates.some(
              (e) =>
                along - WINDOW_FT / 2 - MARGIN_FT >= e.lo - 1e-6 &&
                along + WINDOW_FT / 2 + MARGIN_FT <= e.hi + 1e-6,
            );
            expect(
              fits,
              `${type} seed ${seed} window @${along} on ${w.axis}:${fixed} clips a run end`,
            ).toBe(true);
          }
        }
      }
    });

    it('window set stays deterministic per seed (Fix C)', () => {
      for (const type of TYPES) {
        for (const seed of [1, 4, 7, 12]) {
          const a = build(type, seed).windows;
          const b = build(type, seed).windows;
          expect(a).toEqual(b);
        }
      }
    });
  });

  it('run endpoints are grid-aligned feet and runs never cross a door (A4)', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { wallRuns, doors } = build(type, seed);
        for (const r of wallRuns) {
          for (const v of [r.x1, r.y1, r.x2, r.y2]) expect(v % CELL_FT).toBe(0);
          expect(r.axis === 'y' ? r.y2 - r.y1 : r.x2 - r.x1).toBeGreaterThan(0);
        }
        for (const d of doors) {
          const crossing = wallRuns.filter((r) =>
            r.axis === d.axis &&
            (d.axis === 'y'
              ? r.x1 === d.x && r.y1 < d.y && d.y < r.y2
              : r.y1 === d.y && r.x1 < d.x && d.x < r.x2));
          expect(crossing).toEqual([]);
        }
      }
    }
  });
});
