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
import { EXTERIOR, type InteriorRoom, type InteriorPlan } from '../interior/types';
import type { SeedPath } from '../seedPath';

/** One renderable box, site-local meters (y sits on the ground). */
export interface SitePart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  /** Base elevation in meters (default 0 = on the floor). Lets a part float
   * above the ground — e.g. an occupant's head atop their body. */
  baseY?: number;
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
  workshop: '#b09a72', // same as house for now, or maybe slightly different
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

/**
 * Render-ready body for one occupant, in METERS + hex — the projection of the
 * parametric BodyPlan (BODY-1, body/generateBody) the figure renderer needs.
 * Kept structural (no BodyPlan import) so this module stays decoupled from the
 * roster/body data types; the bridge maps BodyPlan → OccupantBody at the call
 * site.
 */
export interface OccupantBody {
  /** Total standing height (heel to crown), meters. */
  heightM: number;
  /** Shoulder width → body box width, meters. */
  shoulderWidthM: number;
  /** Torso depth (front-to-back) → body box depth, meters. */
  depthM: number;
  /** Head height (chin to crown) → head box, meters. */
  headSizeM: number;
  skinToneHex: string;
  clothingHex: string;
}

/** Minimal occupant view (structural — avoids coupling to roster types). */
export interface OccupantFigure {
  id: number;
  ageBand: 'child' | 'adult' | 'elder';
  /** Standing at their work plot (front-of-house) vs at home (back half). */
  atWork?: boolean;
  /** Parametric body (BODY-1): per-person proportions + palette. Required —
   * every roster occupant has an identity, so there is one real path and no
   * fallback to uniform crates. */
  body: OccupantBody;
}

/**
 * Wall envelope (in METERS — the footprint the renderer must fit roofs/floors
 * to; the plot footprint is up to 5 ft larger per axis, and sizing roofs to it
 * caused the floating-sombrero look, shots 1–2 of Remy's 2026-06-12 review)
 * AND interior parts, from a SINGLE interior generation. The 3D bake needs both
 * per plot; generating the (deterministic) interior once and reusing it here
 * avoids regenerating it — significant for large capitals (~650 plots).
 */
export function buildInterior(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
  shellHeightM: number,
  occupants: OccupantFigure[] = [],
): { envelope: { wallWidthM: number; wallDepthM: number }; parts: SitePart[] } {
  const plan = generateInterior(plot, seedPath);
  return {
    envelope: { wallWidthM: plan.widthFt * FT, wallDepthM: plan.depthFt * FT },
    parts: buildInteriorParts(plot, seedPath, shellHeightM, occupants, plan),
  };
}

export function buildInteriorParts(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
  shellHeightM: number,
  occupants: OccupantFigure[] = [],
  // Optional precomputed interior — lets a caller that also needs the wall
  // envelope (the 3D bake) generate the interior ONCE and reuse it here rather
  // than regenerating. Defaults to generating from (plot, seedPath).
  precomputedPlan?: InteriorPlan,
): SitePart[] {
  const plan = precomputedPlan ?? generateInterior(plot, seedPath);
  const W = plan.widthFt;
  const D = plan.depthFt;
  const toX = (fx: number): number => (fx - W / 2) * FT;
  const toZ = (fy: number): number => (fy - D / 2) * FT;
  const parts: SitePart[] = [];
  const wallH = Math.min(shellHeightM, 3);
  // Vertical spacing between floors (the shell is divided evenly by storey).
  const storeyHeightM = shellHeightM / Math.max(1, plan.storeys);

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
  // Placeable rooms across every floor, each tagged with its elevation. Resident
  // (non-working) occupants fill the ground rooms first, then upstairs bedrooms,
  // so a multi-storey home is inhabited top to bottom. Keyed `<level>:<roomId>`
  // because each floor numbers its rooms from 0 (ids are not globally unique).
  interface Placeable { room: InteriorRoom; baseY: number; key: string }
  const groundResidents: Placeable[] = plan.rooms
    .filter((room) => room.id !== entryRoom?.id)
    .map((room) => ({ room, baseY: 0, key: `0:${room.id}` }));
  const upperResidents: Placeable[] = plan.upperFloors.flatMap((floor) =>
    floor.rooms.map((room) => ({ room, baseY: floor.level * storeyHeightM, key: `${floor.level}:${room.id}` })),
  );
  const residentPool: Placeable[] = [...groundResidents, ...upperResidents];
  const entryPlaceable: Placeable = { room: entryRoom, baseY: 0, key: `0:${entryRoom?.id ?? 0}` };

  const placeFor: Placeable[] = occupants.map((occupant, index) => {
    if (occupant.atWork && entryRoom) return entryPlaceable;
    const choices = residentPool.length > 0 ? residentPool : [entryPlaceable];
    return choices[index % choices.length] ?? entryPlaceable;
  });
  const perKey = new Map<string, number>();
  for (const p of placeFor) perKey.set(p.key, (perKey.get(p.key) ?? 0) + 1);
  const placedPerKey = new Map<string, number>();
  occupants.forEach((o, k) => {
    const placeable = placeFor[k] ?? entryPlaceable;
    const room = placeable.room;
    const totalInRoom = perKey.get(placeable.key) ?? 1;
    const slotInRoom = placedPerKey.get(placeable.key) ?? 0;
    placedPerKey.set(placeable.key, slotInRoom + 1);
    const centerX = room.x + room.w / 2;
    const centerY = room.y + room.d / 2;
    const ringRadiusM = totalInRoom > 1 ? 0.6 : 0;
    const angle = (Math.PI * 2 * slotInRoom) / totalInRoom + room.id * 0.37;
    const offsetXFt = (Math.cos(angle) * ringRadiusM) / FT;
    const offsetYFt = (Math.sin(angle) * ringRadiusM) / FT;
    const px = toX(centerX + offsetXFt);
    const pz = toZ(centerY + offsetYFt);
    // A villager reads as a person, not a crate: a clothed body box under a
    // skin-toned head. Dimensions and palette come from the occupant's
    // parametric BodyPlan (BODY-1) — height, build, skin and clothing all vary
    // per person, so a crowd reads as a population rather than clones. The floor's
    // elevation (placeable.baseY) lifts upstairs occupants onto their storey.
    const body = o.body;
    const headH = body.headSizeM;
    const bodyH = Math.max(0.1, body.heightM - headH);
    parts.push({
      x: px,
      z: pz,
      w: body.shoulderWidthM,
      d: body.depthM,
      h: bodyH,
      colorHex: body.clothingHex,
      // Omit baseY on the ground floor so the part shape is unchanged there.
      ...(placeable.baseY > 0 ? { baseY: placeable.baseY } : {}),
    });
    parts.push({
      x: px,
      z: pz,
      w: body.headSizeM * 0.85,
      d: body.headSizeM * 0.8,
      h: headH,
      baseY: placeable.baseY + bodyH,
      colorHex: body.skinToneHex,
    });
  });

  // ── Upper storeys (L4 multi-storey). The exterior shell already encloses every
  // storey, so each upper floor adds only its own floor slab, INTERNAL room-divider
  // walls (with doorway gaps), and furniture — lifted to the floor's elevation via
  // baseY, which the renderer already honors. A stair flight box fills each shaft
  // gap. Single-storey buildings have no upperFloors, so this block is skipped and
  // their part list is byte-identical to before. ──
  if (plan.upperFloors.length > 0) {
    const upperWallH = Math.min(storeyHeightM, 3);
    for (const floor of plan.upperFloors) {
      const baseY = floor.level * storeyHeightM;
      parts.push({ x: 0, z: 0, w: W * FT, d: D * FT, h: FLOOR_H, colorHex: FLOOR_COLOR, baseY });

      const fLines = new Map<string, Run[]>();
      const addF = (key: string, lo: number, hi: number): void => {
        const runs = fLines.get(key) ?? [];
        runs.push({ lo, hi });
        fLines.set(key, runs);
      };
      for (const r of floor.rooms) {
        // Skip envelope-edge lines (h:0/h:D/v:0/v:W) — the shell wall covers them.
        if (r.y > 0) addF(`h:${r.y}`, r.x, r.x + r.w);
        if (r.y + r.d < D) addF(`h:${r.y + r.d}`, r.x, r.x + r.w);
        if (r.x > 0) addF(`v:${r.x}`, r.y, r.y + r.d);
        if (r.x + r.w < W) addF(`v:${r.x + r.w}`, r.y, r.y + r.d);
      }
      for (const [key, runs] of fLines) fLines.set(key, mergeRuns(runs));
      for (const door of floor.doorways) {
        const half = DOOR_FT / 2;
        if (door.axis === 'x') {
          const key = `h:${door.y}`;
          if (fLines.has(key)) fLines.set(key, cutRuns(fLines.get(key)!, door.x - half, door.x + half));
        } else {
          const key = `v:${door.x}`;
          if (fLines.has(key)) fLines.set(key, cutRuns(fLines.get(key)!, door.y - half, door.y + half));
        }
      }
      for (const [key, runs] of fLines) {
        const horizontal = key.startsWith('h:');
        const lineAt = Number(key.slice(2));
        for (const r of runs) {
          if (r.hi - r.lo < 1) continue;
          const len = (r.hi - r.lo) * FT;
          if (horizontal) {
            parts.push({ x: toX((r.lo + r.hi) / 2), z: toZ(lineAt), w: len, d: WALL_T, h: upperWallH, colorHex: INTERIOR_WALL_COLOR, baseY });
          } else {
            parts.push({ x: toX(lineAt), z: toZ((r.lo + r.hi) / 2), w: WALL_T, d: len, h: upperWallH, colorHex: INTERIOR_WALL_COLOR, baseY });
          }
        }
      }
      for (const f of floor.furnishings) {
        const spec = FURNITURE[f.kind];
        if (!spec) continue;
        const rotated = f.rotation === 90 || f.rotation === 270;
        parts.push({
          x: toX(f.x), z: toZ(f.y),
          w: rotated ? spec.d : spec.w, d: rotated ? spec.w : spec.d,
          h: spec.h, colorHex: spec.colorHex, baseY,
        });
      }
    }
    // Stair flight: one wood box per gap, rising a full storey at the shaft.
    for (const s of plan.stairs) {
      parts.push({
        x: toX(s.x), z: toZ(s.y), w: DOOR_FT * FT, d: DOOR_FT * FT,
        h: storeyHeightM, colorHex: '#7a5a36', baseY: s.fromFloor * storeyHeightM,
      });
    }
  }

  return parts;
}
