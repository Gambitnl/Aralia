/**
 * @file fieldParts.ts — organic modular components that merge into the
 * seamless metaball body (snouts, tails, bellies, beards…).
 *
 * Every coordinate is entity-local METERS. Radii scale with the frame's
 * head radius (headRadiusM) and bulk so the same part fits a gnome and a
 * goliath. Animated parts (tails, tentacles) read PartPhase.
 */
import type { BallSink, Frame, PartAnchors, PartDef, PartPhase, Vec3Like } from '../types';
import { headRadiusM, heightM } from '../types';

type Params = Record<string, number | string>;

function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Interpolated ball chain from a to b with tapering radius (blobfolk `chain`).
 * Sample count adapts to span ÷ radius so tails on huge frames stay connected. */
function chain(
  sink: BallSink,
  a: Vec3Like,
  b: Vec3Like,
  minN: number,
  r0: number,
  r1: number,
): void {
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const rMin = Math.max(Math.min(r0, r1), 1e-4);
  const n = Math.max(minN, Math.min(10, Math.ceil(dist / (rMin * 1.15)) + 1));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    sink.ball(
      a.x + (b.x - a.x) * u,
      a.y + (b.y - a.y) * u,
      a.z + (b.z - a.z) * u,
      r0 + (r1 - r0) * u,
    );
  }
}

const snout: PartDef = {
  id: 'snout',
  anchor: 'jaw',
  kind: 'field',
  buildField(sink, frame, params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const len = hr * 1.6 * num(params, 'lengthScale', 1);
    const head = anchors.head;
    // droop > 0 curls the snout downward along its length — a trunk
    const droop = num(params, 'droop', 0);
    const start = { x: head.x, y: head.y - hr * 0.15, z: head.z + hr * 0.5 };
    if (droop > 0) {
      const mid = { x: head.x, y: head.y - hr * 0.3 - len * droop * 0.25, z: head.z + hr * 0.5 + len * 0.55 };
      const end = { x: head.x, y: head.y - hr * 0.3 - len * droop, z: head.z + hr * 0.5 + len * 0.8 };
      chain(sink, start, mid, 3, hr * 0.52, hr * 0.34);
      chain(sink, mid, end, 3, hr * 0.34, hr * 0.22);
      return;
    }
    chain(
      sink,
      start,
      { x: head.x, y: head.y - hr * 0.3, z: head.z + hr * 0.5 + len },
      3,
      hr * 0.55,
      hr * 0.32,
    );
  },
};

const muzzleShort: PartDef = {
  id: 'muzzleShort',
  anchor: 'jaw',
  kind: 'field',
  buildField(sink, frame, _params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const head = anchors.head;
    chain(
      sink,
      { x: head.x, y: head.y - hr * 0.2, z: head.z + hr * 0.45 },
      { x: head.x, y: head.y - hr * 0.28, z: head.z + hr * 1.1 },
      2,
      hr * 0.5,
      hr * 0.38,
    );
  },
};

const tuskJaw: PartDef = {
  id: 'tuskJaw',
  anchor: 'jaw',
  kind: 'field',
  buildField(sink, frame, _params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const head = anchors.head;
    // heavy underbite jaw
    sink.ball(head.x, head.y - hr * 0.45, head.z + hr * 0.5, hr * 0.48);
    // tusks poke up from the jaw corners
    for (const sgn of [-1, 1]) {
      sink.ball(head.x + sgn * hr * 0.42, head.y - hr * 0.2, head.z + hr * 0.72, hr * 0.15);
    }
  },
};

const brow: PartDef = {
  id: 'brow',
  anchor: 'head',
  kind: 'field',
  buildField(sink, frame, _params, _phase, anchors) {
    const hr = headRadiusM(frame);
    sink.ball(anchors.browL.x, anchors.browL.y, anchors.browL.z, hr * 0.26);
    sink.ball(anchors.browR.x, anchors.browR.y, anchors.browR.z, hr * 0.26);
  },
};

const belly: PartDef = {
  id: 'belly',
  anchor: 'hips',
  kind: 'field',
  buildField(sink, frame, params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const hips = anchors.hips;
    sink.ball(
      hips.x,
      hips.y + hr * 0.35,
      hips.z + hr * 0.3,
      hr * 1.05 * frame.bulk * num(params, 'size', 1),
    );
  },
};

function tail(thick: boolean): PartDef['buildField'] {
  return (sink, frame, params, phase, anchors) => {
    const hr = headRadiusM(frame);
    const root = anchors.tailRoot;
    const len = heightM(frame) * (thick ? 0.38 : 0.45) * num(params, 'lengthScale', 1);
    const wag = Math.sin(phase.t * 6) * len * 0.18;
    const droop = num(params, 'droop', 0.45);
    // arc > 0 lifts the mid-tail before it falls — a dragon's tail sweeps up
    // and clear of the rear legs instead of hugging them
    const arc = num(params, 'arc', 0);
    const end = { x: root.x + wag, y: root.y - len * droop, z: root.z - len };
    if (arc > 0) {
      const mid = {
        x: root.x + wag * 0.5,
        y: root.y + len * arc * 0.45,
        z: root.z - len * 0.5,
      };
      chain(sink, root, mid, thick ? 3 : 3, hr * (thick ? 0.5 : 0.3), hr * (thick ? 0.34 : 0.2));
      chain(sink, mid, end, thick ? 3 : 3, hr * (thick ? 0.34 : 0.2), hr * (thick ? 0.18 : 0.11));
      return;
    }
    chain(
      sink,
      root,
      end,
      thick ? 4 : 5,
      hr * (thick ? 0.5 : 0.3),
      hr * (thick ? 0.2 : 0.12),
    );
  };
}

const tailThin: PartDef = { id: 'tailThin', anchor: 'tailRoot', kind: 'field', buildField: tail(false) };
const tailThick: PartDef = { id: 'tailThick', anchor: 'tailRoot', kind: 'field', buildField: tail(true) };

const beardField: PartDef = {
  id: 'beardField',
  anchor: 'jaw',
  kind: 'field',
  buildField(sink, frame, params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const jaw = anchors.jaw;
    const len = hr * 1.1 * num(params, 'lengthScale', 1);
    chain(
      sink,
      { x: jaw.x, y: jaw.y - hr * 0.1, z: jaw.z + hr * 0.35 },
      { x: jaw.x, y: jaw.y - len, z: jaw.z + hr * 0.15 },
      3,
      hr * 0.42,
      hr * 0.22,
    );
  },
};

const tentacles: PartDef = {
  id: 'tentacles',
  anchor: 'hips',
  kind: 'field',
  buildField(sink, frame, params, phase, anchors) {
    const hr = headRadiusM(frame);
    const hips = anchors.hips;
    const count = Math.max(3, Math.round(num(params, 'count', 5)));
    const len = heightM(frame) * 0.4;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const wave = Math.sin(phase.t * 4 + k * 1.7) * hr * 0.35;
      chain(
        sink,
        { x: hips.x + Math.cos(a) * hr * 0.5, y: hips.y, z: hips.z + Math.sin(a) * hr * 0.5 },
        {
          x: hips.x + Math.cos(a) * (hr * 0.9 + wave),
          y: hips.y - len,
          z: hips.z + Math.sin(a) * (hr * 0.9 + wave),
        },
        4,
        hr * 0.22,
        hr * 0.09,
      );
    }
  },
};

const antennae: PartDef = {
  id: 'antennae',
  anchor: 'crown',
  kind: 'field',
  buildField(sink, frame, _params, phase, anchors) {
    const hr = headRadiusM(frame);
    const crown = anchors.crown;
    const twitch = Math.sin(phase.t * 7) * hr * 0.15;
    for (const sgn of [-1, 1]) {
      chain(
        sink,
        { x: crown.x + sgn * hr * 0.3, y: crown.y, z: crown.z },
        { x: crown.x + sgn * (hr * 0.55 + twitch * sgn), y: crown.y + hr * 1.1, z: crown.z + hr * 0.4 },
        3,
        hr * 0.12,
        hr * 0.07,
      );
    }
  },
};

const crest: PartDef = {
  id: 'crest',
  anchor: 'crown',
  kind: 'field',
  buildField(sink, frame, _params, _phase, anchors) {
    const hr = headRadiusM(frame);
    const crown = anchors.crown;
    for (let i = 0; i < 4; i++) {
      const u = i / 3;
      sink.ball(
        crown.x,
        crown.y + hr * (0.35 - u * 0.5),
        crown.z - u * hr * 1.2,
        hr * (0.3 - u * 0.12),
      );
    }
  },
};

export const FIELD_PARTS: PartDef[] = [
  snout,
  muzzleShort,
  tuskJaw,
  brow,
  belly,
  tailThin,
  tailThick,
  beardField,
  tentacles,
  antennae,
  crest,
];

// Re-exported for gait drivers, which build torso/limb chains the same way.
export { chain };
export type { PartPhase };
