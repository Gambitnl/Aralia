/**
 * @file chainParts.ts — animated tapered segment chains (body v2).
 *
 * Tails, tentacles, and antennae keep moving every frame, so they render
 * through the same segment renderer as the body: buildChain returns the
 * chain's segments for the current phase. Ids are stable and radii are
 * frame-constant — only the endpoints move (wag, wave, twitch).
 */
import type { BodySegment, Frame, PartAnchors, PartDef, PartPhase, Vec3Like } from '../types';
import { headRadiusM, heightM } from '../types';

type Params = Record<string, number | string>;

function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Split a→b into `n` tapered segments with stable ids. */
function taperedChain(
  idPrefix: string,
  a: Vec3Like,
  mid: Vec3Like | null,
  b: Vec3Like,
  n: number,
  r0: number,
  r1: number,
): BodySegment[] {
  const points: Vec3Like[] = [a];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    if (mid) {
      // quadratic bezier through the mid control point
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * (1 - u) * u;
      const w2 = u * u;
      points.push({
        x: w0 * a.x + w1 * mid.x + w2 * b.x,
        y: w0 * a.y + w1 * mid.y + w2 * b.y,
        z: w0 * a.z + w1 * mid.z + w2 * b.z,
      });
    } else {
      points.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });
    }
  }
  points.push(b);
  const out: BodySegment[] = [];
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 1) / n;
    out.push({
      id: `${idPrefix}.${i}`,
      ax: points[i].x,
      ay: points[i].y,
      az: points[i].z,
      bx: points[i + 1].x,
      by: points[i + 1].y,
      bz: points[i + 1].z,
      r0: r0 + (r1 - r0) * u0,
      r1: r0 + (r1 - r0) * u1,
    });
  }
  return out;
}

function tail(thick: boolean): NonNullable<PartDef['buildChain']> {
  return (frame, params, phase, anchors) => {
    const hr = headRadiusM(frame);
    const root = anchors.tailRoot;
    const len = heightM(frame) * (thick ? 0.38 : 0.45) * num(params, 'lengthScale', 1);
    const wag = Math.sin(phase.t * 6) * len * 0.18;
    const droop = num(params, 'droop', 0.45);
    // arc > 0 lifts the mid-tail before it falls — a dragon's tail sweeps up
    // and clear of the rear legs instead of hugging them
    const arc = num(params, 'arc', 0);
    const end: Vec3Like = { x: root.x + wag, y: root.y - len * droop, z: root.z - len };
    const mid: Vec3Like | null =
      arc > 0 ? { x: root.x + wag * 0.5, y: root.y + len * arc * 0.45, z: root.z - len * 0.5 } : null;
    return taperedChain(thick ? 'tailThick' : 'tailThin', root, mid, end, 3, hr * (thick ? 0.5 : 0.3), hr * (thick ? 0.16 : 0.1));
  };
}

const tailThin: PartDef = { id: 'tailThin', anchor: 'tailRoot', kind: 'chain', buildChain: tail(false) };
const tailThick: PartDef = { id: 'tailThick', anchor: 'tailRoot', kind: 'chain', buildChain: tail(true) };

const tentacles: PartDef = {
  id: 'tentacles',
  anchor: 'hips',
  kind: 'chain',
  buildChain(frame, params, phase, anchors) {
    const hr = headRadiusM(frame);
    const hips = anchors.hips;
    const count = Math.max(3, Math.round(num(params, 'count', 5)));
    const len = heightM(frame) * 0.4;
    const out: BodySegment[] = [];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const wave = Math.sin(phase.t * 4 + k * 1.7) * hr * 0.35;
      const root: Vec3Like = { x: hips.x + Math.cos(a) * hr * 0.5, y: hips.y, z: hips.z + Math.sin(a) * hr * 0.5 };
      const end: Vec3Like = {
        x: hips.x + Math.cos(a) * (hr * 0.9 + wave),
        y: hips.y - len,
        z: hips.z + Math.sin(a) * (hr * 0.9 + wave),
      };
      out.push(...taperedChain(`tentacle${k}`, root, null, end, 2, hr * 0.22, hr * 0.08));
    }
    return out;
  },
};

const antennae: PartDef = {
  id: 'antennae',
  anchor: 'crown',
  kind: 'chain',
  buildChain(frame, _params, phase, anchors) {
    const hr = headRadiusM(frame);
    const crown = anchors.crown;
    const twitch = Math.sin(phase.t * 7) * hr * 0.15;
    const out: BodySegment[] = [];
    for (const sgn of [-1, 1]) {
      const side = sgn < 0 ? 'L' : 'R';
      const root: Vec3Like = { x: crown.x + sgn * hr * 0.3, y: crown.y, z: crown.z };
      const end: Vec3Like = {
        x: crown.x + sgn * (hr * 0.55 + twitch * sgn),
        y: crown.y + hr * 1.1,
        z: crown.z + hr * 0.4,
      };
      out.push(...taperedChain(`antenna${side}`, root, null, end, 2, hr * 0.1, hr * 0.05));
    }
    return out;
  },
};

/** round 2 (creature-anatomy): a low continuous dorsal blade strip along the
 * spine — the serpent's fin ridge. A CHAIN part, not a rigid mesh: the blades
 * ride the live chest→back→hips anchor curve every frame, so they follow a
 * rearing serpentine front and the slither wave instead of detaching like a
 * fixed strip would. Params: scale (blade size), count (5–14 blades). */
const finRidge: PartDef = {
  id: 'finRidge',
  anchor: 'back',
  kind: 'chain',
  buildChain(frame, params, _phase, anchors) {
    const chest = anchors.chest;
    const back = anchors.back;
    const hips = anchors.hips;
    const count = Math.max(5, Math.min(14, Math.round(num(params, 'count', 9))));
    // ≈ the plan body radius (bodyRadM ≈ heightM × 0.4 on low serpentine
    // frames) so blades clear the hull without a schema hook
    const base = heightM(frame) * 0.4 * num(params, 'scale', 1);
    const out: BodySegment[] = [];
    // a reared serpentine front descends steeply below the chest→back chord —
    // bow the front half of the curve down toward the real spine
    const sag = Math.max(0, chest.y - back.y) * 0.3;
    for (let k = 0; k < count; k++) {
      // the ridge runs the GROUNDED back half onto the lower rise (u 0.3–1);
      // the raised neck stays clean — the Valheim reference carries its fins
      // along the back, and blades on a near-vertical spine point backward
      const u = 0.3 + 0.7 * (k / (count - 1));
      // quadratic bezier through the three spine anchors
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * (1 - u) * u;
      const w2 = u * u;
      const px = w0 * chest.x + w1 * back.x + w2 * hips.x;
      const py = w0 * chest.y + w1 * back.y + w2 * hips.y - Math.sin(Math.min(1, u * 2) * Math.PI) * sag;
      const pz = w0 * chest.z + w1 * back.z + w2 * hips.z;
      // tangent (bezier derivative) for the backward rake
      let tx = 2 * (1 - u) * (back.x - chest.x) + 2 * u * (hips.x - back.x);
      let ty = 2 * (1 - u) * (back.y - chest.y) + 2 * u * (hips.y - back.y);
      let tz = 2 * (1 - u) * (back.z - chest.z) + 2 * u * (hips.z - back.z);
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      // blade direction: up perpendicularized against the tangent, so blades
      // stand off a reared (near-vertical) front instead of lying along it
      let dx = -ty * tx;
      let dy = 1 - ty * ty;
      let dz = -ty * tz;
      const dl = Math.hypot(dx, dy, dz);
      if (dl < 0.2) {
        // near-vertical tangent: rake the blade backward off the neck
        dx = 0; dy = 0.45; dz = -0.9;
      } else {
        dx /= dl; dy /= dl; dz /= dl;
      }
      // swept-back rake like a sail fin; a LOW continuous blade strip, not a
      // needle comb: wide overlapping roots sunk 0.55 base below the curve so
      // an imperfect anchor fit still reads rooted, short graded heights.
      const h = base * (0.9 + Math.sin(u * Math.PI) * 0.35);
      const rootSink = base * 0.55;
      out.push({
        id: `fin.${k}`,
        ax: px - dx * rootSink, ay: py - dy * rootSink, az: pz - dz * rootSink,
        bx: px + (dx - tx * 0.45) * h,
        by: py + (dy - ty * 0.45) * h,
        bz: pz + (dz - tz * 0.45) * h,
        r0: Math.max(0.014, base * 0.3),
        r1: Math.max(0.006, base * 0.05),
      });
    }
    return out;
  },
};

export const CHAIN_PARTS: PartDef[] = [tailThin, tailThick, tentacles, antennae, finRidge];
