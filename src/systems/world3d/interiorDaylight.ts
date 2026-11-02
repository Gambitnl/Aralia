/**
 * @file interiorDaylight.ts
 * @description How much sky light reaches each point inside a building, from
 * the building's real window openings. Pure: no three.js, unit-tested.
 *
 * Why (Remy, 2026-11-02): "windows should allow light through". Before this,
 * the sky (hemisphere) light lit every interior surface as if the building
 * had no walls, so a room was as bright at the back as at its window.
 *
 * The physics:
 * - A window is an opening that shows the sky to the room. The share of the
 *   sky light that a surface point receives through one opening is the view
 *   factor from the point to the opening polygon. Lambert's polygon formula
 *   gives it exactly: F = (1 / 2pi) * sum over the edges of
 *   acos(a_i . a_i+1) * (n . unit(a_i x a_i+1)), with a_i the unit vectors from
 *   the point to the polygon corners and n the surface normal. The part of the
 *   polygon behind the surface plane is clipped first, because the surface
 *   cannot see it.
 * - Clear glass passes about 85% of the light (GLASS_TRANSMITTANCE). The same
 *   0.85 is the glazing factor of the BRE split-flux daylight formula.
 * - An interior wall between the point and the window blocks that window
 *   (one occlusion ray to the window center, axis-aligned wall boxes).
 * - Light also bounces inside the building. The BRE split-flux formula gives
 *   the average internally reflected component (IRC) from the window area,
 *   the surface area and the surface reflectances:
 *   IRC = 0.85 W / (A (1 - R)) * (C Rfw + 5 Rcw) / 100, with C = 39 for an
 *   unobstructed sky. It is one value per building.
 * - A point outside the building (the outer face of a perimeter wall) sees
 *   the whole sky as before: its factor is 1, so the street view is unchanged.
 *
 * The renderer multiplies the indirect (sky) light of the interior surfaces by
 * this factor (an ambient-occlusion term). The sun is a separate, direct light:
 * it reaches the room through the same openings by the sun's shadow map.
 *
 * Frame: the site-local RENDER frame of SiteBuilding (sitePartLocalOffset):
 * x and z in meters with z already flipped by doorZSign, y up from the
 * building's surface.
 */
import { isSitePartRenderable, sitePartLocalOffset } from '../worldforge/bridge/sitePartTransform';

/** Clear-glass transmittance; also the BRE split-flux glazing factor. */
export const GLASS_TRANSMITTANCE = 0.85;
/** BRE split-flux coefficient for an unobstructed sky (no outside obstruction angle). */
const BRE_C_UNOBSTRUCTED = 39;
/** How far a test point steps off a surface along its normal, meters. */
const SURFACE_STEP_M = 0.05;
/** Occluders closer than this to the window center are the window's own jambs. */
const WINDOW_REVEAL_M = 0.6;
/** Parts at least this tall block light (walls); lower ones are furniture or sills. */
const OCCLUDER_MIN_H_M = 1.5;
/** Bridge contract strings for facade dressing (interiorParts MATERIAL_PART_TAG
 * and FACADE_PART_TAG), as World3DScene compares them. */
const DRESSING_TAGS = new Set(['building-material', 'facade']);

type V3 = { x: number; y: number; z: number };

export interface DaylightPart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  baseY?: number;
  lightRole?: 'window' | 'hearth';
  walkSurface?: string;
  furnishing?: unknown;
  door?: unknown;
  beam?: unknown;
  renderRole?: 'tactical-only';
  tag?: string;
}

/** One window opening: a rectangle in the wall plane, with its outward normal. */
export interface DaylightOpening {
  corners: [V3, V3, V3, V3];
  center: V3;
  outward: V3;
  areaM2: number;
}

interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/** Everything the per-point factor needs for one building, built once. */
export interface InteriorDaylight {
  openings: DaylightOpening[];
  /** Floor slabs (render frame) that define "inside" by their x-z footprint. */
  floors: Box[];
  /** Wall boxes that can block a window from a point. */
  occluders: Box[];
  /** The building's internally reflected component (0..1). */
  irc: number;
}

function boxOf(p: DaylightPart, doorZSign: number): Box {
  const o = sitePartLocalOffset(p, doorZSign);
  return {
    x0: o.x - p.w / 2, x1: o.x + p.w / 2,
    y0: o.y - p.h / 2, y1: o.y + p.h / 2,
    z0: o.z - p.d / 2, z1: o.z + p.d / 2,
  };
}

/** Linear luminance of a hex color: the surface's diffuse reflectance. */
export function reflectanceOfHex(hex: string): number {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (!Number.isFinite(v)) return 0.5;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}

/** True when the point lies over a floor slab of this building (x-z footprint). */
export function insideFootprint(p: V3, floors: readonly Box[]): boolean {
  for (const f of floors) {
    if (p.x > f.x0 && p.x < f.x1 && p.z > f.z0 && p.z < f.z1) return true;
  }
  return false;
}

/**
 * Collect the openings, floor footprint, occluders and the IRC for one
 * building from its parts. Returns null when the building has no floor slab
 * (no interior to light) or no window.
 */
export function buildInteriorDaylight(parts: readonly DaylightPart[], doorZSign: number): InteriorDaylight | null {
  const visible = parts.filter(isSitePartRenderable);
  const floors = visible.filter((p) => p.walkSurface === 'floor').map((p) => boxOf(p, doorZSign));
  if (floors.length === 0) return null;
  const occluders: Box[] = [];
  const openings: DaylightOpening[] = [];
  // BRE split-flux areas and reflectances (area-weighted).
  let areaAll = 0, reflAll = 0;
  let areaLow = 0, reflLow = 0;
  let areaHigh = 0, reflHigh = 0;
  for (const p of visible) {
    if (p.furnishing || p.door || p.beam) continue;
    // Facade dressing (courses, trim, shutters) sits outside the rooms.
    if (p.tag !== undefined && DRESSING_TAGS.has(p.tag)) continue;
    const b = boxOf(p, doorZSign);
    if (p.lightRole === 'window') {
      // The pane fills the opening. Its thin axis is the wall normal.
      const alongX = p.w >= p.d;
      const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 };
      const n = alongX ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      // Outward = the side with no floor under it.
      const probe = { x: c.x + n.x * 0.5, y: c.y, z: c.z + n.z * 0.5 };
      const outward = insideFootprint(probe, floors) ? { x: -n.x, y: 0, z: -n.z } : n;
      const corners: [V3, V3, V3, V3] = alongX
        ? [{ x: b.x0, y: b.y0, z: c.z }, { x: b.x1, y: b.y0, z: c.z }, { x: b.x1, y: b.y1, z: c.z }, { x: b.x0, y: b.y1, z: c.z }]
        : [{ x: c.x, y: b.y0, z: b.z0 }, { x: c.x, y: b.y0, z: b.z1 }, { x: c.x, y: b.y1, z: b.z1 }, { x: c.x, y: b.y1, z: b.z0 }];
      openings.push({ corners, center: c, outward, areaM2: (alongX ? p.w : p.d) * p.h });
      continue;
    }
    if (p.h >= OCCLUDER_MIN_H_M) occluders.push(b);
    // Interior surface area of this box, split for the split-flux formula:
    // floors count low, ceilings high, walls half and half.
    const r = reflectanceOfHex(p.colorHex);
    if (p.walkSurface === 'floor') {
      const a = p.w * p.d;
      areaAll += a; reflAll += a * r; areaLow += a; reflLow += a * r;
    } else if (p.h < 0.6 && p.w * p.d > 1) {
      // A thin horizontal slab that is not a floor: a ceiling.
      const a = p.w * p.d;
      areaAll += a; reflAll += a * r; areaHigh += a; reflHigh += a * r;
    } else if (p.h >= OCCLUDER_MIN_H_M) {
      // One room-facing side of a wall: its long face.
      const a = Math.max(p.w, p.d) * p.h;
      areaAll += a; reflAll += a * r;
      areaLow += a / 2; reflLow += (a / 2) * r;
      areaHigh += a / 2; reflHigh += (a / 2) * r;
    }
  }
  if (openings.length === 0) return null;
  const windowArea = openings.reduce((s, o) => s + o.areaM2, 0);
  const R = areaAll > 0 ? reflAll / areaAll : 0.5;
  const Rfw = areaLow > 0 ? reflLow / areaLow : R;
  const Rcw = areaHigh > 0 ? reflHigh / areaHigh : R;
  const A = areaAll + windowArea;
  const irc = A > 0
    ? Math.min(1, (GLASS_TRANSMITTANCE * windowArea / (A * (1 - Math.min(R, 0.95)))) * (BRE_C_UNOBSTRUCTED * Rfw + 5 * Rcw) / 100)
    : 0;
  return { openings, floors, occluders, irc };
}

// ── View factor ───────────────────────────────────────────────────────────

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);

/**
 * View factor (0..1) from a differential surface at `p` with unit normal `n`
 * to a planar polygon. The polygon is clipped to the half-space in front of
 * the surface first (Sutherland-Hodgman against the tangent plane).
 */
export function polygonViewFactor(p: V3, n: V3, polygon: readonly V3[]): number {
  // Clip against dot(n, v - p) >= eps.
  const eps = 1e-6;
  const clipped: V3[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = dot(n, sub(a, p)) - eps, db = dot(n, sub(b, p)) - eps;
    if (da >= 0) clipped.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  if (clipped.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < clipped.length; i++) {
    const a = sub(clipped[i], p), b = sub(clipped[(i + 1) % clipped.length], p);
    const la = len(a), lb = len(b);
    if (la < 1e-9 || lb < 1e-9) continue;
    const c = cross(a, b);
    const lc = len(c);
    if (lc < 1e-12) continue;
    const cosT = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));
    sum += Math.acos(cosT) * dot(n, c) / lc;
  }
  // The winding sets the sign; the clipped polygon lies wholly in front.
  return Math.min(1, Math.abs(sum) / (2 * Math.PI));
}

/** Slab test: does the segment p0 -> p1 pass through the box between t0 and t1? */
function segmentHitsBox(p0: V3, d: V3, t0: number, t1: number, b: Box): boolean {
  let lo = t0, hi = t1;
  const axes: Array<[number, number, number, number]> = [
    [p0.x, d.x, b.x0, b.x1], [p0.y, d.y, b.y0, b.y1], [p0.z, d.z, b.z0, b.z1],
  ];
  for (const [o, dd, mn, mx] of axes) {
    if (Math.abs(dd) < 1e-12) {
      if (o <= mn || o >= mx) return false;
      continue;
    }
    let ta = (mn - o) / dd, tb = (mx - o) / dd;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    lo = Math.max(lo, ta);
    hi = Math.min(hi, tb);
    if (lo >= hi) return false;
  }
  return true;
}

/**
 * The sky-light factor (0..1) for one surface point of this building: 1
 * outside, else the glass-transmitted view factor of every unblocked window
 * plus the building's internally reflected component.
 */
export function interiorSkyFactor(day: InteriorDaylight, p: V3, n: V3): number {
  const probe = { x: p.x + n.x * SURFACE_STEP_M, y: p.y + n.y * SURFACE_STEP_M, z: p.z + n.z * SURFACE_STEP_M };
  if (!insideFootprint(probe, day.floors)) return 1;
  let direct = 0;
  for (const o of day.openings) {
    // A point sees a window only from the room side of the window plane.
    if (dot(o.outward, sub(probe, o.center)) >= 0) continue;
    const f = polygonViewFactor(probe, n, o.corners);
    if (f <= 0) continue;
    const d = sub(o.center, probe);
    const dist = len(d);
    const tEnd = Math.max(0, 1 - WINDOW_REVEAL_M / Math.max(dist, 1e-6));
    let blocked = false;
    for (const b of day.occluders) {
      if (segmentHitsBox(probe, d, 1e-4, tEnd, b)) { blocked = true; break; }
    }
    if (!blocked) direct += f;
  }
  return Math.min(1, GLASS_TRANSMITTANCE * direct + day.irc);
}

/**
 * Bake the factor for every vertex of a geometry already placed in the
 * building's render frame. Returns one value per vertex.
 */
export function bakeInteriorSkyFactors(
  day: InteriorDaylight,
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
): Float32Array {
  const count = Math.floor(positions.length / 3);
  const out = new Float32Array(count);
  const p = { x: 0, y: 0, z: 0 }, n = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    p.x = positions[i * 3]; p.y = positions[i * 3 + 1]; p.z = positions[i * 3 + 2];
    n.x = normals[i * 3]; n.y = normals[i * 3 + 1]; n.z = normals[i * 3 + 2];
    out[i] = interiorSkyFactor(day, p, n);
  }
  return out;
}

/** Box segments so the per-vertex factor varies across a large face. */
export const DAYLIGHT_GRID_M = 0.75;
export function daylightSegments(sizeM: number): number {
  return Math.max(1, Math.min(16, Math.ceil(sizeM / DAYLIGHT_GRID_M)));
}
