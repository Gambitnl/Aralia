/**
 * @file mergeReferenceHand.ts — the humanoid hand merge (hands campaign
 * close, part-quality GOAL, Remy's GO 2026-08-21). The licensed reference
 * mesh (referenceHandMesh.ts, CC-BY 4.0 — see REFERENCE_HAND_CREDIT)
 * replaces the lofted palm/thenar/thumb/finger chains in the smooth biped.
 *
 * The DIGIT WRAP: the mesh ships straight open fingers in the palm-local
 * canonical frame (+Y fingers, +X thumb, +Z palm face, wrist origin,
 * 1 unit = handR). Each digit vertex carries up to two link weights
 * (baked); at merge time each link gets a rigid+stretch transform from its
 * straight bind chain onto the race's bipedHandDigits rest chain — the
 * relaxed-fist layout the driver poses. Blending POSITIONS by the same
 * weights that become skinWeights keeps the surface continuous at the
 * knuckles and keeps skinned animation consistent with the rest shape.
 */
import { Quaternion, Vector3 } from 'three';
import type { Frame } from '../types';
import type { BipedBoneName, BipedRestPose } from './skeletonBuilder';
import { bipedHandDigits } from './skeletonBuilder';
import {
  REF_HAND_BIND_FINGERS,
  REF_HAND_BIND_THUMB,
  REF_HAND_IDX,
  REF_HAND_LINK_A,
  REF_HAND_LINK_B,
  REF_HAND_LINKS,
  REF_HAND_POS,
  REF_HAND_WB,
  type RefHandChain,
} from './referenceHandMesh';

const UP = new Vector3(0, 1, 0);

/** Per-vertex ink weights by link — the loft's tuned hand ink budget
 * (smoothBipedGeometry inkOf): fingers thin, thumb mid, palm 0.45. */
const LINK_INK: readonly number[] = (() => {
  const ink = new Array(12).fill(0.45);
  ink[REF_HAND_LINKS.thumbA] = 0.5;
  ink[REF_HAND_LINKS.thumbB] = 0.5;
  for (const k of [4, 5, 6, 7, 8, 9, 10, 11]) ink[k] = 0.3;
  return ink;
})();

interface LinkTransform {
  /** bind root, real units */
  a: Vector3;
  /** target root */
  ta: Vector3;
  q: Quaternion;
  /** stretch along the bind direction */
  dir: Vector3;
  s: number;
}

function linkTransform(bindA: Vector3, bindB: Vector3, targetA: Vector3, targetB: Vector3): LinkTransform {
  const dir = bindB.clone().sub(bindA).normalize();
  const tDir = targetB.clone().sub(targetA).normalize();
  return {
    a: bindA,
    ta: targetA,
    q: new Quaternion().setFromUnitVectors(dir, tDir),
    dir,
    s: targetB.distanceTo(targetA) / bindB.distanceTo(bindA),
  };
}

const applyLink = (t: LinkTransform, p: Vector3, out: Vector3): Vector3 => {
  out.copy(p).sub(t.a);
  const along = out.dot(t.dir);
  out.addScaledVector(t.dir, along * (t.s - 1));
  return out.applyQuaternion(t.q).add(t.ta);
};

export function appendReferenceHands(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  out: {
    positions: number[];
    skinIndex: number[];
    skinWeight: number[];
    colors: number[];
    inks: number[];
    index: number[];
  },
  frame?: Frame,
): void {
  const nVerts = REF_HAND_POS.length / 3;
  // dwarven breadth: bulky frames widen the hand laterally and in depth
  // without growing finger length (the non-uniform race scale of the
  // promotion list). Slim frames are untouched.
  const breadth = 1 + 0.3 * (frame ? Math.min(0.6, Math.max(0, frame.bulk - 1)) : 0);

  for (const side of ['L', 'R'] as const) {
    const palm = restPose.segments.find((s) => s.id === `hand${side}.palm`);
    if (!palm) continue;
    const anchor = new Vector3(...palm.a);
    const palmDir = new Vector3(...palm.b).sub(anchor);
    const palmLen = palmDir.length();
    palmDir.normalize();
    const handR = palm.r1;
    const palmQuat = new Quaternion().setFromUnitVectors(UP, palmDir);
    const mirror = side === 'L' ? -1 : 1;

    // targets in the sgn=+1 canonical space (the baked space); the left hand
    // mirrors at the very end — bipedHandDigits(-1) is exactly that mirror.
    const digits = bipedHandDigits(1, handR, palmLen, 0);
    const scaleChain = (c: RefHandChain): [Vector3, Vector3, Vector3] => [
      new Vector3(...c.root).multiplyScalar(handR),
      new Vector3(...c.j1).multiplyScalar(handR),
      new Vector3(...c.tip).multiplyScalar(handR),
    ];
    const transforms = new Array<LinkTransform | null>(12).fill(null);
    for (let k = 0; k < 4; k++) {
      const [bRoot, bJ1, bTip] = scaleChain(REF_HAND_BIND_FINGERS[k]);
      const f = digits.fingers[k];
      transforms[REF_HAND_LINKS.f0a + k * 2] = linkTransform(bRoot, bJ1, f.root, f.j1);
      transforms[REF_HAND_LINKS.f0b + k * 2] = linkTransform(bJ1, bTip, f.j1, f.tip);
    }
    {
      const [bRoot, bJ1, bTip] = scaleChain(REF_HAND_BIND_THUMB);
      transforms[REF_HAND_LINKS.thumbA] = linkTransform(bRoot, bJ1, digits.thumb.a, digits.thumb.j1);
      transforms[REF_HAND_LINKS.thumbB] = linkTransform(bJ1, bTip, digits.thumb.j1, digits.thumb.tip);
    }

    const boneOf: readonly number[] = (() => {
      const names: BipedBoneName[] = [
        `hand${side}`,
        `foreArm${side}`,
        `thumb${side}a`,
        `thumb${side}b`,
        `finger${side}0a`, `finger${side}0b`,
        `finger${side}1a`, `finger${side}1b`,
        `finger${side}2a`, `finger${side}2b`,
        `finger${side}3a`, `finger${side}3b`,
      ] as BipedBoneName[];
      return names.map((n) => boneIndex.get(n)!);
    })();

    const base = out.positions.length / 3;
    const p = new Vector3();
    const pa = new Vector3();
    const pb = new Vector3();
    for (let i = 0; i < nVerts; i++) {
      p.set(REF_HAND_POS[i * 3], REF_HAND_POS[i * 3 + 1], REF_HAND_POS[i * 3 + 2]).multiplyScalar(handR);
      const la = REF_HAND_LINK_A[i];
      const lb = REF_HAND_LINK_B[i];
      const w = REF_HAND_WB[i];
      const tA = transforms[la];
      const tB = transforms[lb];
      if (tA) applyLink(tA, p, pa);
      else pa.copy(p);
      if (lb === la) pb.copy(pa);
      else if (tB) applyLink(tB, p, pb);
      else pb.copy(p);
      pa.lerp(pb, w);
      // breadth then mirror, then palm frame into the world
      pa.x *= breadth * mirror;
      pa.z *= breadth;
      pa.applyQuaternion(palmQuat).add(anchor);
      out.positions.push(pa.x, pa.y, pa.z);
      out.skinIndex.push(boneOf[la], boneOf[lb], 0, 0);
      out.skinWeight.push(1 - w, w, 0, 0);
      out.colors.push(1, 1, 1);
      out.inks.push(LINK_INK[la] * (1 - w) + LINK_INK[lb] * w);
    }
    // the mirrored hand flips its winding
    if (mirror < 0) {
      for (let e = 0; e < REF_HAND_IDX.length; e += 3) {
        out.index.push(base + REF_HAND_IDX[e], base + REF_HAND_IDX[e + 2], base + REF_HAND_IDX[e + 1]);
      }
    } else {
      for (const vi of REF_HAND_IDX) out.index.push(base + vi);
    }
  }
}
