/**
 * @file bodyColliders.ts — the collision shapes worn cloth hangs over.
 *
 * Character cloth+armor campaign, slice 1a (2026-11-04, question sheet
 * 71CWggvG). Remy picked GPU particle cloth, but every cloth method on that
 * sheet needs the same input: shapes that follow the bones, so a cape, robe
 * or skirt rests ON the body and never cuts through it. This file is that
 * input, and only that. It runs no simulation.
 *
 * SHAPE. One collider per flesh piece of the skinned biped's rest pose
 * (skeletonBuilder.bipedRestPose): torso, neck, arm and leg links, palms,
 * feet, the head and deltoid balls, plus one segment per clavicle. Digits,
 * the thenar wedge and the trapezius wedge are left out on purpose: they are
 * small, and every collider costs one test per cloth point.
 *
 * Each collider is a segment with a ROUNDED-BOX section, not a round one:
 * half-width hx (lateral) and half-depth hz (front to back), joined by a
 * fourth-power norm. A round section fitted to the chest WIDTH would stand
 * off the chest DEPTH, and a cape would float a hand-width off the back.
 * This is the entity-forge method (src/anim/cloth.ts BodyCapsules),
 * reimplemented here. Each of hx and hz follows a PROFILE of PROFILE_KNOTS
 * values spaced evenly from end A to end B: one straight taper cannot follow
 * a body that is widest in the middle (pectorals, calves), and overshoots at
 * the ends. Four knots were tried first; one wide spot then widened a third
 * of the chest, and cloth stood off the waist. Eight knots hold it.
 *
 * MEASURED, NOT GUESSED. The rest-pose radii are the driver's bones, not the
 * drawn skin: the smooth loft bulges past them at the pectorals, forearms,
 * calves and feet (measured 2026-11-04: up to 36 mm outside on a half-orc).
 * So each profile is fitted to the bind-pose skin vertices its collider
 * owns, then the cloth margin is added on top. The fit rules below each
 * record the measurement that forced them.
 *
 * POSE. Live endpoints and section axes come from the same matrix skinning
 * uses (bone.matrixWorld × boneInverse), so a collider cannot drift from the
 * skin it stands for. The packed layout is CLOTH_COLLIDER_STRIDE = 32 floats
 * (8 vec4s) per collider, so a GPU solver can upload it as-is:
 *   [ax ay az 0] [bx by bz 0] [Xx Xy Xz 0] [Zx Zy Zz 0] [hx0 .. hx7] [hz0 .. hz7]
 * X and Z are the unit lateral and depth axes; the axis A→B is perpendicular
 * to both. Knot k sits at u = k / 7 along A→B.
 *
 * Margins are cloth thickness, in units of stature. The torso margin is wider
 * than the limb margin: belts, hems and pouches sit on the torso
 * (entity-forge fm-076), and a wide limb margin would close the gap between
 * the legs (fm-013).
 */
import { Matrix4, Vector3, type Bone, type BufferGeometry } from 'three';
import type { Frame } from '../../types';
import { BIPED_BONE_PARENT, bipedSkullRadiusM, type BipedBoneName, type BipedRestPose } from '../skeletonBuilder';

/** Floats per packed collider (see the file header for the layout). */
export const CLOTH_COLLIDER_STRIDE = 32;
/** Section profile knots per axis, evenly spaced from A (u = 0) to B (u = 1). */
export const PROFILE_KNOTS = 8;

/** Flesh pieces that cloth collides with. Ids are the driver's own emission
 * ids (BipedDriver.buildBody), the same ids the rest pose carries. */
const SEGMENT_IDS: ReadonlySet<string> = new Set([
  'torso.pelvis',
  'torso.chest',
  'neck',
  'armL.upper',
  'armL.fore',
  'handL.palm',
  'armR.upper',
  'armR.fore',
  'handR.palm',
  'legL.thigh',
  'legL.shin',
  'footL',
  'legR.thigh',
  'legR.shin',
  'footR',
]);
const BALL_IDS: ReadonlySet<string> = new Set(['head', 'deltoidL', 'deltoidR']);
const TORSO_IDS: ReadonlySet<string> = new Set(['torso.pelvis', 'torso.chest', 'neck', 'head', 'clavicleL', 'clavicleR']);

type V3 = readonly [number, number, number];
type Profile = number[];

export interface ClothCollider {
  /** The rest-pose emission id this collider stands for ('clavicleL/R' for
   * the two synthetic shoulder-top segments). */
  readonly id: string;
  readonly bone: BipedBoneName;
  readonly boneIndex: number;
  /** Rest (bind) endpoints, entity-local meters. A = B for a ball. */
  readonly a: V3;
  readonly b: V3;
  /** Rest unit section axes: X lateral, Z depth, both perpendicular to A→B. */
  readonly x: V3;
  readonly z: V3;
  /** Half-width and half-depth profiles, A to B, fitted + margin, meters. */
  readonly hx: readonly number[];
  readonly hz: readonly number[];
}

export interface ClothColliderMargins {
  /** Added to torso, neck, clavicle and head sections, meters. */
  torso: number;
  /** Added to every limb, hand and foot section, meters. */
  limb: number;
}

/** Default cloth thickness for a figure of stature `heightM`. */
export function defaultClothMargins(heightM: number): ClothColliderMargins {
  return { torso: 0.012 * heightM, limb: 0.006 * heightM };
}

interface Draft {
  id: string;
  bone: BipedBoneName;
  boneIndex: number;
  a: Vector3;
  b: Vector3;
  y: Vector3;
  len: number;
  x: Vector3;
  z: Vector3;
  hx: Profile;
  hz: Profile;
  /** Rest (driver) radius at A and B — used only to ASSIGN skin to pieces. */
  rr0: number;
  rr1: number;
}

const WORLD_X = new Vector3(1, 0, 0);
const WORLD_Y = new Vector3(0, 1, 0);
const WORLD_Z = new Vector3(0, 0, 1);

/** Section frame for a segment axis: X = world X made perpendicular to the
 * axis (world Z when the axis runs along X), Z completes a right-handed set. */
function sectionFrame(axis: Vector3, outX: Vector3, outZ: Vector3): void {
  const ref = Math.abs(axis.dot(WORLD_X)) > 0.9 ? WORLD_Z : WORLD_X;
  outX.copy(ref).addScaledVector(axis, -ref.dot(axis)).normalize();
  outZ.crossVectors(outX, axis).normalize();
}

/** Profile value at u in [0, 1] (piecewise linear between the knots). */
function profileAt(p: Readonly<Profile>, u: number): number {
  const t = u * (PROFILE_KNOTS - 1);
  const k = Math.min(PROFILE_KNOTS - 2, Math.floor(t));
  const f = t - k;
  return p[k] + (p[k + 1] - p[k]) * f;
}

/** The same, reading the knots straight out of a packed buffer. */
function packedProfileAt(caps: Float32Array, o: number, u: number): number {
  const t = u * (PROFILE_KNOTS - 1);
  const k = Math.min(PROFILE_KNOTS - 2, Math.floor(t));
  const f = t - k;
  return caps[o + k] + (caps[o + k + 1] - caps[o + k]) * f;
}

/** Local coordinates of a point against a draft: s = meters along A→B
 * (unclamped), u = s / len clamped to [0, 1], the lateral and depth offsets
 * (X and Z are perpendicular to the axis, so they need no axis point), and
 * the distance past an end cap. A ball (len 0) keeps its axial offset in
 * `along` — the first version dropped it, so balls ignored height. */
function local(d: Draft, px: number, py: number, pz: number): { s: number; u: number; ox: number; oz: number; along: number } {
  const rx = px - d.a.x, ry = py - d.a.y, rz = pz - d.a.z;
  const s = rx * d.y.x + ry * d.y.y + rz * d.y.z;
  const sc = s < 0 ? 0 : s > d.len ? d.len : s;
  return {
    s,
    u: d.len > 1e-9 ? sc / d.len : 0,
    ox: rx * d.x.x + ry * d.x.y + rz * d.x.z,
    oz: rx * d.z.x + ry * d.z.y + rz * d.z.z,
    along: s - sc,
  };
}

/** Fourth-power section norm: < 1 inside, 1 on the surface. */
function sectionNorm(d: Draft, l: ReturnType<typeof local>): number {
  const hx = profileAt(d.hx, l.u);
  const hz = profileAt(d.hz, l.u);
  const hy = Math.min(hx, hz);
  const tx = l.ox / hx, tz = l.oz / hz, ty = l.along / hy;
  return tx * tx * tx * tx + tz * tz * tz * tz + ty * ty * ty * ty;
}

/**
 * The collider set for one biped: rest pose + the bind-pose skin it must
 * cover. `skin` is the SkinnedMesh geometry the figure actually draws (the
 * smooth loft on game surfaces), with skinIndex/skinWeight in the skeleton's
 * bone order. Throws if the rest pose lacks a piece this file expects — a
 * renamed emission id must fail loudly, never silently drop a collider.
 */
export function bipedClothColliders(
  frame: Frame,
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  skin: BufferGeometry,
  margins: ClothColliderMargins,
): ClothCollider[] {
  const indexOf = (bone: BipedBoneName): number => {
    const i = boneIndex.get(bone);
    if (i === undefined) throw new Error(`bodyColliders: bone "${bone}" is not in the skeleton`);
    return i;
  };
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  const push = (id: string, bone: BipedBoneName, a: Vector3, b: Vector3, seed: number, rr0: number, rr1: number): Draft => {
    const y = b.clone().sub(a);
    const len = y.length();
    if (len > 1e-9) y.divideScalar(len);
    else y.copy(WORLD_Y);
    const x = new Vector3(), z = new Vector3();
    sectionFrame(y, x, z);
    const d: Draft = { id, bone, boneIndex: indexOf(bone), a, b, y, len, x, z, hx: new Array(PROFILE_KNOTS).fill(seed), hz: new Array(PROFILE_KNOTS).fill(seed), rr0, rr1 };
    drafts.push(d);
    return d;
  };
  for (const s of restPose.segments) {
    if (!SEGMENT_IDS.has(s.id)) continue;
    seen.add(s.id);
    // seeds start small: the fit below GROWS each section to the skin it
    // owns, so a seed larger than the skin would leave cloth floating
    push(s.id, s.bone, new Vector3(...s.a), new Vector3(...s.b), Math.min(s.r0, s.r1) * 0.3, s.r0, s.r1);
  }
  // The CLAVICLES carry the shoulder-top flesh from the neck base out to the
  // shoulder, but the rest pose has no flesh piece for them (the deltoid
  // ball skins to them and sits at the far end). A deltoid sphere alone had
  // to grow to 24 cm to reach the neck base. Each clavicle gets its own
  // segment, chest top → shoulder joint, on the clavicle bone.
  const chestSeg = restPose.segments.find((g) => g.id === 'torso.chest');
  for (const [name, arm] of [['clavicleL', 'armL.upper'], ['clavicleR', 'armR.upper']] as const) {
    const up = restPose.segments.find((g) => g.id === arm);
    if (!chestSeg || !up) throw new Error(`bodyColliders: no torso.chest or ${arm} piece for the ${name} collider`);
    const r = up.r0 * 0.8;
    push(name, name, new Vector3(...chestSeg.b), new Vector3(...up.a), r * 0.3, r, r);
  }
  const headDrafts = new Set<Draft>();
  for (const k of restPose.balls) {
    if (!BALL_IDS.has(k.id)) continue;
    seen.add(k.id);
    const c = new Vector3(...k.center);
    if (k.id !== 'head') {
      push(k.id, k.bone, c, c.clone(), k.r * 0.3, k.r, k.r);
      continue;
    }
    // The HEAD is the sculpted head (headForms.buildHumanoidHead), which is
    // not part of the body skin, so it cannot be fitted from skin vertices.
    // It is sized from the drawn skull instead: crown 0.88 R above the skull
    // center, chin 0.59 R below, half-width 0.74 R, face about 0.8 R forward
    // (headForms / skeletonBuilder.bipedSkullRadiusM, round 7).
    const R = bipedSkullRadiusM(frame);
    const d = push('head', k.bone, c.clone().add(new Vector3(0, -0.22 * R, 0.04 * R)), c.clone().add(new Vector3(0, 0.36 * R, 0.04 * R)), 0, R, R);
    d.hx.fill(0.76 * R);
    d.hz.fill(0.82 * R);
    headDrafts.add(d);
  }
  for (const id of [...SEGMENT_IDS, ...BALL_IDS]) {
    if (!seen.has(id)) throw new Error(`bodyColliders: the rest pose has no "${id}" piece`);
  }

  // CANDIDATES. Each skin vertex may go to the colliders on its dominant bone
  // AND on that bone's parent and children. Same-bone-only was tried first
  // and failed by measurement: the shoulder-top flesh skins to the clavicle,
  // and the neck and thigh roots bloated the same way. A neighbor bone moves
  // almost exactly with the vertex, so the cover holds under animation too.
  // Vertices with no collider on their bone or a neighbor — fingers, thumbs —
  // are cloth-free and skipped.
  const pos = skin.getAttribute('position');
  const si = skin.getAttribute('skinIndex');
  const sw = skin.getAttribute('skinWeight');
  if (!pos || !si || !sw) throw new Error('bodyColliders: skin geometry needs position, skinIndex and skinWeight');
  const nameOf = new Map<number, BipedBoneName>([...boneIndex].map(([n, i]) => [i, n]));
  const onBone = new Map<number, Draft[]>();
  for (const d of drafts) {
    if (headDrafts.has(d)) continue; // sized from the skull, never from skin
    const list = onBone.get(d.boneIndex) ?? [];
    list.push(d);
    onBone.set(d.boneIndex, list);
  }
  const byBone = new Map<number, Draft[]>();
  for (const [i, name] of nameOf) {
    const own = onBone.get(i);
    if (!own) continue; // a bone with no collider of its own takes none
    const near = new Set<Draft>(own);
    const parent = BIPED_BONE_PARENT[name];
    if (parent) for (const d of onBone.get(indexOf(parent)) ?? []) near.add(d);
    for (const [child, p] of Object.entries(BIPED_BONE_PARENT) as [BipedBoneName, BipedBoneName | null][]) {
      if (p === name) for (const d of onBone.get(indexOf(child)) ?? []) near.add(d);
    }
    byBone.set(i, [...near]);
  }
  // The neck is two links from the clavicles in the tree, but it touches the
  // shoulder-top flesh, so the clavicles may hand vertices to it.
  for (const name of ['clavicleL', 'clavicleR'] as const) {
    const i = indexOf(name);
    const near = new Set<Draft>(byBone.get(i) ?? []);
    for (const d of onBone.get(indexOf('neck')) ?? []) near.add(d);
    byBone.set(i, [...near]);
  }

  // ASSIGNMENT, by how far a vertex stands outside a piece's REST surface
  // (axis distance minus rest radius), which does not depend on the fit. Two
  // rules failed by measurement first: the growing section norm (the small
  // seeds sent the upper-arm flesh to the deltoid ball and the thigh roots to
  // the pelvis, which grew to 23 cm and 31 cm half-widths), and axis distance
  // OVER rest radius (it favors big pieces, so the chest took the shoulder
  // flesh and grew to a 31 cm half-width).
  const owned = new Map<Draft, number[]>();
  for (let v = 0; v < pos.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
    const cands = byBone.get(si.getComponent(v, best));
    if (!cands) continue;
    let pick = cands[0];
    if (cands.length > 1) {
      let bestN = Infinity;
      for (const c of cands) {
        const l = local(c, pos.getX(v), pos.getY(v), pos.getZ(v));
        const rr = c.rr0 + (c.rr1 - c.rr0) * l.u;
        const n = Math.sqrt(l.ox * l.ox + l.oz * l.oz + l.along * l.along) - rr;
        if (n < bestN) { bestN = n; pick = c; }
      }
    }
    const list = owned.get(pick) ?? [];
    list.push(v);
    owned.set(pick, list);
  }

  // STRETCH each piece's ends to span the vertices it owns. A vertex past an
  // end cap otherwise widened the whole section through the corner pass:
  // measured 2026-11-04, the crotch flesh below the pelvis segment pushed the
  // pelvis depth to 38 cm. Stretched, every owned vertex sits beside the
  // axis, and the sections grow only from real width and depth. A BALL
  // (deltoid) stretches the same way along its upright axis: its vertical
  // offsets were otherwise never fitted, and left skin 2-5 mm outside.
  for (const d of drafts) {
    if (headDrafts.has(d)) continue;
    let lo = 0, hi = d.len;
    for (const v of owned.get(d) ?? []) {
      const sv = local(d, pos.getX(v), pos.getY(v), pos.getZ(v)).s;
      if (sv < lo) lo = sv;
      if (sv > hi) hi = sv;
    }
    if (lo < 0 || hi > d.len) {
      const a0 = d.a.clone();
      d.a.copy(a0).addScaledVector(d.y, lo);
      d.b.copy(a0).addScaledVector(d.y, hi);
      d.len = hi - lo;
    }
  }

  // FIT. Each knot takes the largest need among the owned vertices within
  // one knot spacing of it. A vertex then lies between two knots that both
  // hold it, so the piecewise-linear profile covers it, with no overshoot.
  // (A raise-only least-change step was tried first and failed by
  // measurement: constraints on both sides of a knot pushed it up and nothing
  // lowered it, so the chest profile reached 0.33 m over skin that stands at
  // most 0.21 m off the axis.) The first pass fits each axis alone (the box
  // faces); the second raises the SHORT axis for vertices near a section
  // corner, where the fourth-power norm bulges in less than the box.
  const span = 1 / (PROFILE_KNOTS - 1);
  const envelope = (p: Profile, us: number[], needs: number[]): void => {
    for (let k = 0; k < PROFILE_KNOTS; k++) {
      const uk = k * span;
      for (let i = 0; i < us.length; i++) {
        if (Math.abs(us[i] - uk) < span + 1e-9 && needs[i] > p[k]) p[k] = needs[i];
      }
    }
  };
  for (const d of drafts) {
    const verts = owned.get(d) ?? [];
    if (verts.length === 0) continue;
    const ls = verts.map((v) => local(d, pos.getX(v), pos.getY(v), pos.getZ(v)));
    const us = ls.map((l) => l.u);
    envelope(d.hx, us, ls.map((l) => Math.abs(l.ox)));
    envelope(d.hz, us, ls.map((l) => Math.abs(l.oz)));
    for (let pass = 0; pass < 3; pass++) {
      const needX: number[] = [];
      const needZ: number[] = [];
      for (const l of ls) {
        const qx = Math.abs(l.ox) / profileAt(d.hx, l.u);
        const qz = Math.abs(l.oz) / profileAt(d.hz, l.u);
        if (qx ** 4 + qz ** 4 <= 1) { needX.push(0); needZ.push(0); continue; }
        if (qx >= qz) { needX.push((Math.abs(l.ox) / Math.pow(1 - Math.min(0.9, qz ** 4), 0.25)) * 1.001); needZ.push(0); }
        else { needZ.push((Math.abs(l.oz) / Math.pow(1 - Math.min(0.9, qx ** 4), 0.25)) * 1.001); needX.push(0); }
      }
      envelope(d.hx, us, needX);
      envelope(d.hz, us, needZ);
    }
  }

  return drafts.map((d) => {
    const m = TORSO_IDS.has(d.id) ? margins.torso : margins.limb;
    return {
      id: d.id,
      bone: d.bone,
      boneIndex: d.boneIndex,
      a: [d.a.x, d.a.y, d.a.z],
      b: [d.b.x, d.b.y, d.b.z],
      x: [d.x.x, d.x.y, d.x.z],
      z: [d.z.x, d.z.y, d.z.z],
      hx: d.hx.map((h) => h + m),
      hz: d.hz.map((h) => h + m),
    };
  });
}

function writePacked(out: Float32Array, o: number, c: ClothCollider, a: V3, b: V3, x: V3, z: V3): void {
  out[o] = a[0]; out[o + 1] = a[1]; out[o + 2] = a[2]; out[o + 3] = 0;
  out[o + 4] = b[0]; out[o + 5] = b[1]; out[o + 6] = b[2]; out[o + 7] = 0;
  out[o + 8] = x[0]; out[o + 9] = x[1]; out[o + 10] = x[2]; out[o + 11] = 0;
  out[o + 12] = z[0]; out[o + 13] = z[1]; out[o + 14] = z[2]; out[o + 15] = 0;
  for (let k = 0; k < PROFILE_KNOTS; k++) {
    out[o + 16 + k] = c.hx[k];
    out[o + 16 + PROFILE_KNOTS + k] = c.hz[k];
  }
}

/** Pack colliders at their REST placement (bind pose), for tests and for a
 * solver's first frame. */
export function packRestColliders(colliders: readonly ClothCollider[], out: Float32Array): void {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    writePacked(out, i * CLOTH_COLLIDER_STRIDE, c, c.a, c.b, c.x, c.z);
  }
}

const skinMat = new Matrix4();
const ta = new Vector3();
const tb = new Vector3();
const tx = new Vector3();
const tz = new Vector3();

/**
 * Write every collider's live placement into `out` (CLOTH_COLLIDER_STRIDE
 * floats each), in the space of the bones' matrixWorld — world space when the
 * entity sits in a scene. Call after the skeleton is posed and its world
 * matrices are current (the same moment skinning reads them).
 */
export function poseClothColliders(
  colliders: readonly ClothCollider[],
  bones: readonly Bone[],
  boneInverses: readonly Matrix4[],
  out: Float32Array,
): void {
  if (out.length < colliders.length * CLOTH_COLLIDER_STRIDE) {
    throw new Error('bodyColliders: output buffer too small');
  }
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    skinMat.multiplyMatrices(bones[c.boneIndex].matrixWorld, boneInverses[c.boneIndex]);
    ta.set(c.a[0], c.a[1], c.a[2]).applyMatrix4(skinMat);
    tb.set(c.b[0], c.b[1], c.b[2]).applyMatrix4(skinMat);
    tx.set(c.x[0], c.x[1], c.x[2]).transformDirection(skinMat);
    tz.set(c.z[0], c.z[1], c.z[2]).transformDirection(skinMat);
    writePacked(out, i * CLOTH_COLLIDER_STRIDE, c, [ta.x, ta.y, ta.z], [tb.x, tb.y, tb.z], [tx.x, tx.y, tx.z], [tz.x, tz.y, tz.z]);
  }
}

/**
 * The contact rule, on packed colliders: how far (meters, approximately)
 * a point sits OUTSIDE the nearest collider surface. Negative = inside.
 * This is the rule a solver applies; tests use it to prove coverage.
 */
export function colliderClearance(caps: Float32Array, count: number, px: number, py: number, pz: number): number {
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const d = colliderClearanceOf(caps, i, px, py, pz);
    if (d < best) best = d;
  }
  return best;
}

/** The same contact rule against ONE packed collider (index `i`). */
export function colliderClearanceOf(caps: Float32Array, i: number, px: number, py: number, pz: number): number {
  const o = i * CLOTH_COLLIDER_STRIDE;
  const ax = caps[o], ay = caps[o + 1], az = caps[o + 2];
  const abx = caps[o + 4] - ax, aby = caps[o + 5] - ay, abz = caps[o + 6] - az;
  const len = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const rx = px - ax, ry = py - ay, rz = pz - az;
  let s = 0;
  if (len > 1e-9) {
    s = (rx * abx + ry * aby + rz * abz) / len;
  } else {
    // a ball: its axial direction is Z × X (the frame is right-handed with
    // Z = X × axis), so it turns with the bone like the section axes do
    const X0 = caps[o + 8], X1 = caps[o + 9], X2 = caps[o + 10];
    const Z0 = caps[o + 12], Z1 = caps[o + 13], Z2 = caps[o + 14];
    s = rx * (Z1 * X2 - Z2 * X1) + ry * (Z2 * X0 - Z0 * X2) + rz * (Z0 * X1 - Z1 * X0);
  }
  const sc = s < 0 ? 0 : s > len ? len : s;
  const u = len > 1e-9 ? sc / len : 0;
  const ox = rx * caps[o + 8] + ry * caps[o + 9] + rz * caps[o + 10];
  const oz = rx * caps[o + 12] + ry * caps[o + 13] + rz * caps[o + 14];
  const along = s - sc;
  const hx = packedProfileAt(caps, o + 16, u);
  const hz = packedProfileAt(caps, o + 16 + PROFILE_KNOTS, u);
  const hy = Math.min(hx, hz);
  const qx = ox / hx, qz = oz / hz, qy = along / hy;
  const n = Math.pow(qx * qx * qx * qx + qz * qz * qz * qz + qy * qy * qy * qy, 0.25);
  // radial distance in meters ≈ (n − 1) × the section size along that ray
  const ray = Math.sqrt(ox * ox + oz * oz + along * along);
  return n > 1e-9 ? (ray / n) * (n - 1) : -Math.min(hx, hz);
}
