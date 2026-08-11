/**
 * @file smoothBipedGeometry.ts — slice 3 of the entity skeleton pivot: the
 * one-piece smooth biped. Each bone chain (torso column, each arm, each leg)
 * lofts as ONE continuous tube whose vertices blend between the two adjacent
 * bones across a smoothstep zone at every interior joint — elbows and knees
 * crease instead of shearing apart. Terminal pieces (head, deltoids) stay
 * rigid spheres, merged into the same geometry; hands are flattened mitt
 * tubes (palm continues the arm chain, thumb is its own capped tube), and
 * feet are heel-to-toe wedge tubes rigid to the foot bones (round 5).
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

/** The chains of the smooth biped, in build order.
 * round 2 (humanoid-anatomy): each arm chain lofts THROUGH the wrist into the
 * palm segment — the mitt is a continuation of the arm, not a glued-on ball —
 * and each thumb is its own short capped tube rigid to the hand bone. */
export const SMOOTH_CHAINS: readonly ChainDef[] = [
  { segIds: ['torso.pelvis', 'torso.chest', 'neck'] },
  { segIds: ['armL.upper', 'armL.fore', 'handL.palm'] },
  { segIds: ['handL.thumb'] },
  { segIds: ['armR.upper', 'armR.fore', 'handR.palm'] },
  { segIds: ['handR.thumb'] },
  { segIds: ['legL.thigh', 'legL.shin'] },
  { segIds: ['legR.thigh', 'legR.shin'] },
  // round 5 (humanoid-anatomy): heel-to-toe wedge feet — each foot is its own
  // short capped tube rigid to the foot bone (like the thumbs), replacing the
  // terminal nub-ball spheres
  { segIds: ['footL'] },
  { segIds: ['footR'] },
];

const RADIAL = 12;
/** Blend zone width as a fraction of the shorter adjacent bone length.
 * round 1 (humanoid-anatomy): 0.48 → 0.34 — the half-bone blend rounded the
 * knee/elbow into a rubber-hose curve; a tighter zone keeps a visible hard
 * break at the joint while still creasing instead of shearing. */
const ZONE_FACTOR = 0.34;
/** round 3 (humanoid-anatomy): the chest→neck joint blends across nearly the
 * full shorter adjacent length — the 1.0 r chest top slides into the 0.52 r
 * neck root as a trapezius slope instead of a stepped shelf. All other
 * joints keep the tight ZONE_FACTOR crease. */
const NECK_ZONE_FACTOR = 0.9;
const zoneFactorFor = (downstreamSegId: string): number =>
  downstreamSegId === 'neck' ? NECK_ZONE_FACTOR : ZONE_FACTOR;
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
  /** Binormal (front-back) scale — hand pieces squash to a mitt. */
  flat: number;
  /** 0 round … 1 squared-off ring (rounded-rectangle cross-section) — hand
   * pieces read as blocks, not sausages (round 6, humanoid-anatomy). */
  sq: number;
  /** Vertex-color RGB multiplier ([1,1,1] = skin). round 13
   * (humanoid-anatomy): below-belt pieces shift toward desaturated leather
   * browns (trousers/boots) and the belt joint carries a near-black band —
   * the material break that kills the naked one-tone read. A pure greyscale
   * darken FAILED here first: 0.66× landed exactly on the toon ramp's own
   * shadow band, so the trousers read as shading. The HUE shift is what
   * survives the quantized ramp. */
  tint: readonly [number, number, number];
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** round 6 (humanoid-anatomy): the palm flattens to 0.42 of its radius — a
 * slab roughly half the wrist's depth (round 2's 0.62 still read as a ball at
 * sheet distance); the thumb wedge stays chunkier at 0.66.
 * round 13 (humanoid-anatomy): torso rings go ELLIPTICAL — chest 1.18 deep,
 * hip mass 1.12 — so the side view stops being paper-thin through the chest
 * (the flat factor scales the binormal, which is the front-back axis on the
 * vertical torso chain). */
const flatOf = (segId: string): number =>
  segId.endsWith('.palm') ? 0.42
  : segId.endsWith('.thumb') ? 0.66
  : segId === 'torso.chest' ? 1.18
  : segId === 'torso.pelvis' ? 1.12
  : 1;

/** round 13 (humanoid-anatomy): RGB tint per segment — hips and legs read as
 * leather-brown trousers, feet as darker boots, everything else keeps skin.
 * Multiplicative over the race skin hex, so outfits stay race-consistent. */
const SKIN_TINT: readonly [number, number, number] = [1, 1, 1];
const TROUSER_TINT: readonly [number, number, number] = [0.52, 0.4, 0.34];
const BOOT_TINT: readonly [number, number, number] = [0.36, 0.28, 0.24];
const tintOf = (segId: string): readonly [number, number, number] =>
  segId === 'torso.pelvis' || segId.startsWith('leg') ? TROUSER_TINT : segId.startsWith('foot') ? BOOT_TINT : SKIN_TINT;

/** The near-black leather belt band at the pelvis→chest joint ring. */
const BELT_TINT: readonly [number, number, number] = [0.2, 0.16, 0.14];

/** round 6 (humanoid-anatomy): hand pieces square their rings so the palm has
 * flat faces and hard-ish corners — the knuckle plane needs an edge to live
 * on, and a squared slab cannot be mistaken for a ball. */
const sqOf = (segId: string): number => (segId.startsWith('hand') ? 1 : 0);

/** How far a full-sq ring is pulled from the circle toward the square.
 * round 8 (humanoid-anatomy): 0.7 → 0.85 — the flat palm faces washed out
 * to a mitten on slim (human/dwarf) frames; only hand rings carry sq > 0,
 * so the harder pull sharpens hands without touching any other chain. */
const SQ_STRENGTH = 0.85;

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
    flat = flatOf(seg.id),
    radius?: number,
    sq = sqOf(seg.id),
    tint = tintOf(seg.id),
  ) => {
    const a = new Vector3(...seg.a);
    const b = new Vector3(...seg.b);
    const pos = a.clone().lerp(b, t);
    const tangent = b.clone().sub(a).normalize();
    stations.push({ pos, tangent, radius: radius ?? seg.r0 + (seg.r1 - seg.r0) * t, bone0, bone1, w0, w1, flat, sq, tint });
  };

  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const bone = boneIndex.get(seg.bone)!;
    const len = new Vector3(...seg.b).distanceTo(new Vector3(...seg.a));
    const prevLen = k > 0 ? new Vector3(...segs[k - 1].b).distanceTo(new Vector3(...segs[k - 1].a)) : 0;
    // fraction of THIS segment consumed by the zones at its ends
    // round 3 (humanoid-anatomy): the factor is per-joint (keyed by the
    // downstream segment) so the chest→neck zone can widen into a trapezius
    const zoneIn = k > 0 ? (zoneFactorFor(seg.id) * Math.min(prevLen, len)) / 2 / len : 0;
    const nextLen = k < segs.length - 1 ? new Vector3(...segs[k + 1].b).distanceTo(new Vector3(...segs[k + 1].a)) : 0;
    const zoneOut = k < segs.length - 1 ? (zoneFactorFor(segs[k + 1].id) * Math.min(len, nextLen)) / 2 / len : 0;

    if (k === 0) {
      // round 13 (humanoid-anatomy): GLUTE TUCK — the torso chain no longer
      // ends in the flat "skirt-hem" disc the round-12 verdict named. Two
      // extrapolated rings below the pelvis root (0.88 r0 then 0.52 r0)
      // round the hip mass down into the crotch, so the thighs read as
      // rooted INTO it instead of hanging from a hem.
      if (seg.id === 'torso.pelvis') {
        push(seg, -(seg.r0 * 0.58) / len, bone, 0, 1, 0, flatOf(seg.id), seg.r0 * 0.52);
        push(seg, -(seg.r0 * 0.3) / len, bone, 0, 1, 0, flatOf(seg.id), seg.r0 * 0.88);
      }
      push(seg, 0, bone, 0, 1, 0); // chain root ring, rigid
    }
    // mid-bone ring, rigid (between the zones)
    push(seg, (zoneIn + (1 - zoneOut)) / 2, bone, 0, 1, 0);

    if (k < segs.length - 1) {
      // blend zone across the joint into segment k+1
      const nextSeg = segs[k + 1];
      const nextBone = boneIndex.get(nextSeg.bone)!;
      const half = Math.floor(ZONE_RINGS / 2);
      // round 2 (humanoid-anatomy): blend the flatten factor across the zone
      // so the wrist eases from round forearm into the flattened palm
      const flatA = flatOf(seg.id);
      const flatB = flatOf(nextSeg.id);
      // round 6 (humanoid-anatomy): the ring squareness blends across the
      // zone too — the wrist eases from a round forearm into the squared palm
      const sqA = sqOf(seg.id);
      const sqB = sqOf(nextSeg.id);
      // round 3 (humanoid-anatomy): blend RADIUS across the zone when the two
      // segments disagree at the joint. Before, each ring took its own
      // segment's lerped radius, so the chest top (1.0 r) meeting the neck
      // root (0.52 r) rendered as a hard shelf between adjacent rings;
      // blending sweeps it into a continuous trapezius slope. Joints whose
      // radii already match at the joint (elbow, wrist, knee) keep their
      // exact per-segment radii — zero change there.
      const tExit = (zoneFactorFor(nextSeg.id) * Math.min(len, nextLen)) / 2 / nextLen;
      const rEntry = seg.r0 + (seg.r1 - seg.r0) * (1 - zoneOut);
      const rExit = nextSeg.r0 + (nextSeg.r1 - nextSeg.r0) * tExit;
      const blendRadius = Math.abs(seg.r1 - nextSeg.r0) > 1e-9;
      // round 13 (humanoid-anatomy): tint blends across the zone, and the
      // pelvis→chest joint ring darkens to BELT_TINT — the dark belt band
      // riding exactly on the silhouette's waist pinch.
      const tintA = tintOf(seg.id);
      const tintB = tintOf(nextSeg.id);
      const isBelt = seg.id === 'torso.pelvis' && nextSeg.id === 'torso.chest';
      const lerpTint = (t2: number): readonly [number, number, number] => [
        tintA[0] + (tintB[0] - tintA[0]) * t2,
        tintA[1] + (tintB[1] - tintA[1]) * t2,
        tintA[2] + (tintB[2] - tintA[2]) * t2,
      ];
      for (let ring = 0; ring < ZONE_RINGS; ring++) {
        const t = smoothstep(ring / (ZONE_RINGS - 1));
        const flat = flatA + (flatB - flatA) * t;
        const sq = sqA + (sqB - sqA) * t;
        const radius = blendRadius ? rEntry + (rExit - rEntry) * t : undefined;
        const tint = isBelt && ring === half ? BELT_TINT : lerpTint(t);
        if (ring < half) {
          push(seg, 1 - zoneOut * (1 - ring / half), bone, nextBone, 1 - t, t, flat, radius, sq, tint);
        } else if (ring === half) {
          push(seg, 1, bone, nextBone, 1 - t, t, flat, radius, sq, tint); // on the joint
        } else {
          const u = (ring - half) / half;
          push(nextSeg, tExit * u, bone, nextBone, 1 - t, t, flat, radius, sq, tint);
        }
      }
    } else {
      push(seg, 1, bone, 0, 1, 0); // chain tip ring, rigid
    }
  }
  // round 6 (humanoid-anatomy): knuckle plane — a palm-ended chain gets one
  // extra bevel ring just past the blunt tip at 62% radius, so the palm ends
  // in a hard beveled ridge (one edge line reads as four knuckles at low
  // poly) instead of a rounded cap.
  // round 8 (humanoid-anatomy): the round-6 bevel only read on the orc —
  // slimmer frames' palms are small enough that a single 62%-radius step
  // washed out into a rounded mitten at sheet distance. The tip now FLARES
  // first (a 110% crest ring right past the palm end — the knuckle row
  // casts its own facet break on every frame size), then drops hard to 52%
  // over a longer bevel run.
  const last = segs[segs.length - 1];
  if (last.id.endsWith('.palm')) {
    const lastBone = boneIndex.get(last.bone)!;
    const len = new Vector3(...last.b).distanceTo(new Vector3(...last.a));
    push(last, 1 + (last.r1 * 0.12) / len, lastBone, 0, 1, 0, flatOf(last.id), last.r1 * 1.1);
    push(last, 1 + (last.r1 * 0.44) / len, lastBone, 0, 1, 0, flatOf(last.id), last.r1 * 0.52);
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
  // round 13 (humanoid-anatomy): per-vertex value tints (trousers, boots,
  // belt band) — greyscale multipliers over the material's skin tone. The
  // fill material enables vertexColors; the ink shell ignores them.
  const colors: number[] = [];

  const normal = new Vector3();
  const binormal = new Vector3();
  const prevTangent = new Vector3();
  const offset = new Vector3();

  // round 4 (humanoid-anatomy): thick-necked rest poses carry a trapezius
  // wedge segment (chest top → skull equator) that swallows the hard outline
  // step where the neck meets the head ball — loft it as its own capped cone
  // so the smooth body keeps parity with the segment renderer. Frames without
  // it (slender necks) build the unchanged chain table.
  const chains: readonly ChainDef[] = restPose.segments.some((s) => s.id === 'torso.traps')
    ? [...SMOOTH_CHAINS, { segIds: ['torso.traps'] }]
    : SMOOTH_CHAINS;

  for (const def of chains) {
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
        const c = Math.cos(a);
        const s = Math.sin(a);
        // round 6 (humanoid-anatomy): squared rings — blend the unit circle
        // toward the unit square (divide by the Chebyshev norm) by sq, so
        // hand pieces loft as blocks with flat faces
        const k = st.sq > 0 ? 1 + st.sq * SQ_STRENGTH * (1 / Math.max(Math.abs(c), Math.abs(s)) - 1) : 1;
        offset.copy(normal).multiplyScalar(c * k * st.radius)
          .addScaledVector(binormal, s * k * st.radius * st.flat);
        positions.push(st.pos.x + offset.x, st.pos.y + offset.y, st.pos.z + offset.z);
        skinIndex.push(st.bone0, st.bone1, 0, 0);
        skinWeight.push(st.w0, st.w1, 0, 0);
        colors.push(st.tint[0], st.tint[1], st.tint[2]);
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
      colors.push(st.tint[0], st.tint[1], st.tint[2]);
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

  // terminal rigid pieces — same spheres slice 1 builds.
  // round 7 (humanoid-anatomy): the head ball is SKIPPED — the sculpted
  // humanoid head (headForms.buildHumanoidHead) mounts on the head bone in
  // assembleEntity; baking the old sphere here would leave an egg poking
  // through the new skull planes. The rest-pose ball itself stays (it binds
  // the head bone and drives it through the pose sink).
  for (const ball of restPose.balls) {
    if (ball.id === 'head') continue;
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    const pos = sphere.attributes.position;
    const base = positions.length / 3;
    const bone = boneIndex.get(ball.bone)!;
    for (let v = 0; v < pos.count; v++) {
      positions.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      skinIndex.push(bone, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
      colors.push(1, 1, 1); // deltoid mass stays skin-toned
    }
    const sIndex = sphere.index!;
    for (let e = 0; e < sIndex.count; e++) index.push(base + sIndex.getX(e));
    sphere.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(skinIndex), 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(skinWeight), 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
