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

export const CHAIN_PARTS: PartDef[] = [tailThin, tailThick, tentacles, antennae];
