/**
 * @file smoothBipedGeometry.ts — slice 3 of the entity skeleton pivot: the
 * one-piece smooth biped. Each bone chain (torso column, each arm, each leg)
 * lofts as ONE continuous tube whose vertices blend between the two adjacent
 * bones across a smoothstep zone at every interior joint — elbows and knees
 * crease instead of shearing apart. Terminal pieces (head, hands, feet) stay
 * rigid spheres, merged into the same geometry.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-23-skeleton-smooth-bodies.md
 *
 * What changed: new file. Why: rigid weights (slice 1) reproduce the segment
 * look; the smooth look needs different geometry AND weights, kept behind
 * skinnedBody's `weights: 'smooth'` option until the eyeball gate passes.
 * Winding guard: each closed tube's signed volume is measured after build and
 * the index order flipped if negative — the Emberwing inside-out lesson as
 * code, not vigilance.
 */
import { BufferAttribute, BufferGeometry, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import type { BipedBoneName, BipedRestPose } from './skeletonBuilder';

export interface ChainDef {
  /** Rest segment ids in root→tip order; segment k is owned by its own bone. */
  segIds: string[];
}

/** The five chains of the smooth biped, in build order. */
export const SMOOTH_CHAINS: readonly ChainDef[] = [
  { segIds: ['torso.pelvis', 'torso.chest', 'neck'] },
  { segIds: ['armL.upper', 'armL.fore'] },
  { segIds: ['armR.upper', 'armR.fore'] },
  { segIds: ['legL.thigh', 'legL.shin'] },
  { segIds: ['legR.thigh', 'legR.shin'] },
];

const RADIAL = 12;
/** Blend zone width as a fraction of the shorter adjacent bone length. */
const ZONE_FACTOR = 0.48;
/** Rings across each blend zone (odd — one ring sits on the joint). */
const ZONE_RINGS = 5;

interface Station {
  pos: Vector3;
  tangent: Vector3;
  radius: number;
  bone0: number;
  bone1: number;
  w0: number;
  w1: number;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Build the ring stations for one chain: segment ends, mid-bone rings, and
 * smoothstep-weighted rings across each interior joint. */
function chainStations(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  def: ChainDef,
): Station[] {
  const segs = def.segIds.map((id) => {
    const seg = restPose.segments.find((s) => s.id === id);
    if (!seg) throw new Error(`smooth biped: rest segment "${id}" missing`);
    return seg;
  });
  const stations: Station[] = [];
  const push = (
    seg: (typeof segs)[number],
    t: number,
    bone0: number,
    bone1: number,
    w0: number,
    w1: number,
  ) => {
    const a = new Vector3(...seg.a);
    const b = new Vector3(...seg.b);
    const pos = a.clone().lerp(b, t);
    const tangent = b.clone().sub(a).normalize();
    stations.push({ pos, tangent, radius: seg.r0 + (seg.r1 - seg.r0) * t, bone0, bone1, w0, w1 });
  };

  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const bone = boneIndex.get(seg.bone)!;
    const len = new Vector3(...seg.b).distanceTo(new Vector3(...seg.a));
    const prevLen = k > 0 ? new Vector3(...segs[k - 1].b).distanceTo(new Vector3(...segs[k - 1].a)) : 0;
    // fraction of THIS segment consumed by the zones at its ends
    const zoneIn = k > 0 ? (ZONE_FACTOR * Math.min(prevLen, len)) / 2 / len : 0;
    const nextLen = k < segs.length - 1 ? new Vector3(...segs[k + 1].b).distanceTo(new Vector3(...segs[k + 1].a)) : 0;
    const zoneOut = k < segs.length - 1 ? (ZONE_FACTOR * Math.min(len, nextLen)) / 2 / len : 0;

    if (k === 0) push(seg, 0, bone, 0, 1, 0); // chain root ring, rigid
    // mid-bone ring, rigid (between the zones)
    push(seg, (zoneIn + (1 - zoneOut)) / 2, bone, 0, 1, 0);

    if (k < segs.length - 1) {
      // blend zone across the joint into segment k+1
      const nextSeg = segs[k + 1];
      const nextBone = boneIndex.get(nextSeg.bone)!;
      const half = Math.floor(ZONE_RINGS / 2);
      for (let ring = 0; ring < ZONE_RINGS; ring++) {
        const t = smoothstep(ring / (ZONE_RINGS - 1));
        if (ring < half) {
          push(seg, 1 - zoneOut * (1 - ring / half), bone, nextBone, 1 - t, t);
        } else if (ring === half) {
          push(seg, 1, bone, nextBone, 1 - t, t); // on the joint
        } else {
          const u = (ring - half) / half;
          push(nextSeg, ((ZONE_FACTOR * Math.min(len, nextLen)) / 2 / nextLen) * u, bone, nextBone, 1 - t, t);
        }
      }
    } else {
      push(seg, 1, bone, 0, 1, 0); // chain tip ring, rigid
    }
  }
  return stations;
}

/** Signed volume of an indexed triangle soup (×6). Negative = inside-out. */
function signedVolume(positions: number[], index: number[], from: number, to: number): number {
  let vol = 0;
  for (let e = from; e < to; e += 3) {
    const a = index[e] * 3;
    const b = index[e + 1] * 3;
    const c = index[e + 2] * 3;
    vol +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) +
      positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return vol;
}

export function buildSmoothBipedGeometry(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
): BufferGeometry {
  const positions: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const index: number[] = [];

  const normal = new Vector3();
  const binormal = new Vector3();
  const prevTangent = new Vector3();
  const offset = new Vector3();

  for (const def of SMOOTH_CHAINS) {
    const stations = chainStations(restPose, boneIndex, def);
    const ringStart: number[] = [];

    // parallel-transport frame down the chain (bind paths are near-straight;
    // the frame stays stable through the small elbow/knee bind bends)
    normal.set(1, 0, 0);
    if (Math.abs(stations[0].tangent.dot(normal)) > 0.9) normal.set(0, 0, 1);
    binormal.crossVectors(stations[0].tangent, normal).normalize();
    normal.crossVectors(binormal, stations[0].tangent).normalize();
    prevTangent.copy(stations[0].tangent);

    for (const st of stations) {
      if (st.tangent.dot(prevTangent) < 0.9999) {
        // rotate the frame with the tangent (Rodrigues via cross products)
        const axis = new Vector3().crossVectors(prevTangent, st.tangent);
        const s = axis.length();
        if (s > 1e-6) {
          axis.divideScalar(s);
          const angle = Math.asin(Math.min(1, s));
          normal.applyAxisAngle(axis, angle);
          binormal.applyAxisAngle(axis, angle);
        }
        prevTangent.copy(st.tangent);
      }
      ringStart.push(positions.length / 3);
      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        offset.copy(normal).multiplyScalar(Math.cos(a) * st.radius)
          .addScaledVector(binormal, Math.sin(a) * st.radius);
        positions.push(st.pos.x + offset.x, st.pos.y + offset.y, st.pos.z + offset.z);
        skinIndex.push(st.bone0, st.bone1, 0, 0);
        skinWeight.push(st.w0, st.w1, 0, 0);
      }
    }

    const chainIndexStart = index.length;
    for (let i = 0; i < stations.length - 1; i++) {
      const a0 = ringStart[i];
      const b0 = ringStart[i + 1];
      for (let j = 0; j < RADIAL; j++) {
        const j1 = (j + 1) % RADIAL;
        index.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
      }
    }
    // end caps (fan to a center vertex, rigid to the end ring's primary bone)
    for (const [ringIdx, stationIdx] of [
      [0, 0],
      [ringStart.length - 1, stations.length - 1],
    ] as const) {
      const st = stations[stationIdx];
      const center = positions.length / 3;
      positions.push(st.pos.x, st.pos.y, st.pos.z);
      skinIndex.push(st.bone0, st.bone1, 0, 0);
      skinWeight.push(st.w0, st.w1, 0, 0);
      const base = ringStart[ringIdx];
      for (let j = 0; j < RADIAL; j++) {
        const j1 = (j + 1) % RADIAL;
        if (stationIdx === 0) index.push(center, base + j1, base + j);
        else index.push(center, base + j, base + j1);
      }
    }
    // the Emberwing lesson as code: measure, and flip if inside-out
    if (signedVolume(positions, index, chainIndexStart, index.length) < 0) {
      for (let e = chainIndexStart; e < index.length; e += 3) {
        const tmp = index[e + 1];
        index[e + 1] = index[e + 2];
        index[e + 2] = tmp;
      }
    }
  }

  // terminal rigid pieces — same spheres slice 1 builds
  for (const ball of restPose.balls) {
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    const pos = sphere.attributes.position;
    const base = positions.length / 3;
    const bone = boneIndex.get(ball.bone)!;
    for (let v = 0; v < pos.count; v++) {
      positions.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      skinIndex.push(bone, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
    }
    const sIndex = sphere.index!;
    for (let e = 0; e < sIndex.count; e++) index.push(base + sIndex.getX(e));
    sphere.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(skinIndex), 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(skinWeight), 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
