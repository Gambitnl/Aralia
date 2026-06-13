/**
 * @file interiorParts.ts — L4 interior → renderable wall/furnishing parts.
 *
 * Turns an InteriorPlan (plot-local FEET, street wall at y=0) into a list of
 * site-local boxes in METERS that the 3D scene renders inside a building's
 * group, replacing the solid shell box: perimeter walls with a real gap at
 * the entry door (decision #11 — seamless, the camera can walk in), interior
 * walls along room boundaries minus doorway gaps, and low furnishing blocks.
 *
 * Frame: x = centered frontage meters (matching the renderer group's +x
 * along the footprint's 0→1 edge). z = centered DEPTH meters with +z
 * pointing INWARD (away from the street). The renderer flips z by the
 * site's doorZSign so the street wall lands on the correct face of the
 * rotated group — same convention the exterior door mesh already uses.
 */

import { generateInterior, type InteriorPlotInput } from '../interior/generateInterior';
import { EXTERIOR } from '../interior/types';
import type { SeedPath } from '../seedPath';

/** One renderable box, site-local meters (y sits on the ground). */
export interface SitePart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
}

const FT = 0.3048;
/** Wall thickness, meters. */
const WALL_T = 0.3;
/** Doorway clear width, feet (one 5 ft cell). */
const DOOR_FT = 5;
/** Single worn-plank floor color shared by every generated interior. */
const FLOOR_COLOR = '#9a8a72';
/** Thin slab height that gives interiors a visible floor without blocking walls. */
const FLOOR_H = 0.12;
/** Interior wall color (lime-washed plaster). */
export const INTERIOR_WALL_COLOR = '#cfc7b8';
/** Exterior (perimeter) wall tint by plot role — keeps the market/house
 * identity the solid shells used to carry. */
export const PERIMETER_WALL_COLORS: Record<string, string> = {
  market: '#c8923f',
  house: '#b09a72',
};

const FURNITURE: Record<string, { w: number; d: number; h: number; colorHex: string }> = {
  table: { w: 1.6, d: 0.9, h: 0.8, colorHex: '#c8a24a' },
  hearth: { w: 1.4, d: 0.7, h: 1.4, colorHex: '#b5552e' },
  counter: { w: 2.2, d: 0.7, h: 1.0, colorHex: '#c8a24a' },
  shelf: { w: 1.8, d: 0.4, h: 1.8, colorHex: '#9a8458' },
  barrel: { w: 0.7, d: 0.7, h: 1.0, colorHex: '#8a6a42' },
  bed: { w: 1.0, d: 2.0, h: 0.6, colorHex: '#7da0c4' },
  chest: { w: 1.0, d: 0.6, h: 0.6, colorHex: '#a07c4a' },
  crate: { w: 0.8, d: 0.8, h: 0.8, colorHex: '#8a6a42' },
  workbench: { w: 2.0, d: 0.8, h: 0.9, colorHex: '#b08968' },
};

/** A 1-D wall run [lo, hi] on a fixed line, in feet. */
interface Run {
  lo: number;
  hi: number;
}

/** Merge overlapping or touching wall spans on a fixed wall line. */
function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  const sorted = [...runs].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  for (const run of sorted) {
    const last = out[out.length - 1];
    if (!last || run.lo > last.hi) {
      out.push({ ...run });
      continue;
    }
    last.hi = Math.max(last.hi, run.hi);
  }
  return out;
}

/** Remove [gapLo, gapHi] from every run (splitting where needed). */
function cutRuns(runs: Run[], gapLo: number, gapHi: number): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (gapHi <= r.lo || gapLo >= r.hi) {
      out.push(r);
      continue;
    }
    if (gapLo > r.lo) out.push({ lo: r.lo, hi: gapLo });
    if (gapHi < r.hi) out.push({ lo: gapHi, hi: r.hi });
  }
  return out;
}

/** Clothing palette — picked by occupant id so villagers vary stably. */
const CLOTHING = ['#6e4a3a', '#4a5e6e', '#5e6e4a', '#7a6a4a', '#6a4a6e'];

/** Minimal occupant view (structural — avoids coupling to roster types). */
export interface OccupantFigure {
  id: number;
  ageBand: 'child' | 'adult' | 'elder';
  /** Standing at their work plot (front-of-house) vs at home (back half). */
  atWork?: boolean;
}

/**
 * Wall envelope of a plot's interior in METERS — the footprint the renderer
 * must fit roofs/floors to (the plot footprint is up to 5 ft larger per
 * axis; sizing roofs to it caused the floating-sombrero look, shots 1–2 of
 * Remy's 2026-06-12 review).
 */
export function interiorEnvelopeM(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
): { wallWidthM: number; wallDepthM: number } {
  const plan = generateInterior(plot, seedPath);
  return { wallWidthM: plan.widthFt * FT, wallDepthM: plan.depthFt * FT };
}

export function buildInteriorParts(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
  shellHeightM: number,
  occupants: OccupantFigure[] = [],
): SitePart[] {
  const plan = generateInterior(plot, seedPath);
  const W = plan.widthFt;
  const D = plan.depthFt;
  const toX = (fx: number): number => (fx - W / 2) * FT;
  const toZ = (fy: number): number => (fy - D / 2) * FT;
  const parts: SitePart[] = [];
  const wallH = Math.min(shellHeightM, 3);

  // Emit the full-envelope floor before walls, furniture, or people. The
  // renderer places part bottoms on local ground, so this thin plank slab
  // covers raw terrain without changing the frozen wall-envelope contract.
  parts.push({
    x: 0,
    z: 0,
    w: W * FT,
    d: D * FT,
    h: FLOOR_H,
    colorHex: FLOOR_COLOR,
  });

  // Wall lines: key "h:<y>" (horizontal, along x) or "v:<x>" (vertical).
  // Perimeter lines start as full runs; internal room edges accumulate runs
  // (duplicates from adjacent rooms overlap harmlessly — gap cutting below
  // applies to every run on the line, so doors stay open through both).
  const lines = new Map<string, Run[]>();
  const addRun = (key: string, lo: number, hi: number): void => {
    const runs = lines.get(key) ?? [];
    runs.push({ lo, hi });
    lines.set(key, runs);
  };

  addRun('h:0', 0, W);
  addRun(`h:${D}`, 0, W);
  addRun('v:0', 0, D);
  addRun(`v:${W}`, 0, D);
  for (const r of plan.rooms) {
    if (r.y > 0) addRun(`h:${r.y}`, r.x, r.x + r.w);
    if (r.y + r.d < D) addRun(`h:${r.y + r.d}`, r.x, r.x + r.w);
    if (r.x > 0) addRun(`v:${r.x}`, r.y, r.y + r.d);
    if (r.x + r.w < W) addRun(`v:${r.x + r.w}`, r.y, r.y + r.d);
  }

  // Collapse coincident shared-wall spans before cutting doors. This keeps
  // the old "all runs on the line are cut by a door" behavior, but removes
  // duplicate slabs that rendered as twinned walls from inside a room.
  for (const [key, runs] of lines) {
    lines.set(key, mergeRuns(runs));
  }

  // Cut doorway gaps. Entry door (a === EXTERIOR) sits on h:0 — the
  // perimeter street wall — which is what makes the building enterable.
  for (const door of plan.doorways) {
    const half = DOOR_FT / 2;
    if (door.axis === 'x') {
      const key = `h:${door.y}`;
      if (lines.has(key)) lines.set(key, cutRuns(lines.get(key)!, door.x - half, door.x + half));
    } else {
      const key = `v:${door.x}`;
      if (lines.has(key)) lines.set(key, cutRuns(lines.get(key)!, door.y - half, door.y + half));
    }
  }
  // The exterior entry is also used below to choose the front-of-house room
  // for workers, so this import remains part of the live placement contract.

  // Runs → boxes. Perimeter walls rise to the shell height and carry the
  // plot-role tint; interior walls stop at wallH in lime plaster.
  const perimeterColor = PERIMETER_WALL_COLORS[plot.role] ?? PERIMETER_WALL_COLORS.house;
  for (const [key, runs] of lines) {
    const horizontal = key.startsWith('h:');
    const lineAt = Number(key.slice(2));
    const isPerimeter =
      (horizontal && (lineAt === 0 || lineAt === D)) ||
      (!horizontal && (lineAt === 0 || lineAt === W));
    const h = isPerimeter ? shellHeightM : wallH;
    const colorHex = isPerimeter ? perimeterColor : INTERIOR_WALL_COLOR;
    for (const r of runs) {
      if (r.hi - r.lo < 1) continue; // skip slivers under 1 ft
      const len = (r.hi - r.lo) * FT;
      if (horizontal) {
        parts.push({ x: toX((r.lo + r.hi) / 2), z: toZ(lineAt), w: len, d: WALL_T, h, colorHex });
      } else {
        parts.push({ x: toX(lineAt), z: toZ((r.lo + r.hi) / 2), w: WALL_T, d: len, h, colorHex });
      }
    }
  }

  for (const f of plan.furnishings) {
    const spec = FURNITURE[f.kind];
    if (!spec) continue;
    const rotated = f.rotation === 90 || f.rotation === 270;
    parts.push({
      x: toX(f.x),
      z: toZ(f.y),
      w: rotated ? spec.d : spec.w,
      d: rotated ? spec.w : spec.d,
      h: spec.h,
      colorHex: spec.colorHex,
    });
  }

  // Occupants (ROSTER-1): standing-figure boxes. Workers use the room that
  // owns the exterior doorway, while residents cycle through the remaining
  // rooms. This keeps people in real walkable room centers instead of on a
  // fixed depth line that can cross internal walls.
  const entryDoor = plan.doorways.find((door) => door.a === EXTERIOR);
  const fallbackRoom = plan.rooms[0];
  const entryRoom = plan.rooms.find((room) => room.id === entryDoor?.b) ?? fallbackRoom;
  const residentRooms = plan.rooms.filter((room) => room.id !== entryRoom?.id);
  const roomForOccupants = occupants.map((occupant, index) => {
    if (occupant.atWork && entryRoom) return entryRoom;
    const choices = residentRooms.length > 0 ? residentRooms : plan.rooms;
    return choices[index % choices.length] ?? fallbackRoom;
  });
  const occupantsPerRoom = new Map<number, number>();
  for (const room of roomForOccupants) {
    occupantsPerRoom.set(room.id, (occupantsPerRoom.get(room.id) ?? 0) + 1);
  }
  const placedPerRoom = new Map<number, number>();
  occupants.forEach((o, k) => {
    const room = roomForOccupants[k] ?? fallbackRoom;
    const totalInRoom = occupantsPerRoom.get(room.id) ?? 1;
    const slotInRoom = placedPerRoom.get(room.id) ?? 0;
    placedPerRoom.set(room.id, slotInRoom + 1);
    const centerX = room.x + room.w / 2;
    const centerY = room.y + room.d / 2;
    const ringRadiusM = totalInRoom > 1 ? 0.6 : 0;
    const angle = (Math.PI * 2 * slotInRoom) / totalInRoom + room.id * 0.37;
    const offsetXFt = (Math.cos(angle) * ringRadiusM) / FT;
    const offsetYFt = (Math.sin(angle) * ringRadiusM) / FT;
    const h = o.ageBand === 'child' ? 1.05 : o.ageBand === 'elder' ? 1.6 : 1.7;
    parts.push({
      x: toX(centerX + offsetXFt),
      z: toZ(centerY + offsetYFt),
      w: 0.45,
      d: 0.3,
      h,
      colorHex: CLOTHING[o.id % CLOTHING.length],
    });
  });

  return parts;
}
