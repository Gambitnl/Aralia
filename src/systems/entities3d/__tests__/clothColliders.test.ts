/**
 * Cloth collision shapes (character cloth+armor slice 1a, 2026-11-04).
 *
 * The property that matters: a cloth point pushed to a collider surface must
 * sit OUTSIDE the drawn skin. So every skin vertex must lie inside some
 * collider, and no collider may stand far off the skin (or the cloth floats).
 * The test measures both on the smooth biped bind geometry — the body every
 * game surface draws — for tall, bulky and short frames, then poses the
 * skeleton and checks the colliders follow the bones as skinning does.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { buildBipedSkeleton, type BipedBoneName } from '../three/skeletonBuilder';
import { buildSmoothBipedGeometry } from '../three/smoothBipedGeometry';
import { heightM } from '../types';
import {
  CLOTH_COLLIDER_STRIDE,
  bipedClothColliders,
  colliderClearance,
  colliderClearanceOf,
  defaultClothMargins,
  packRestColliders,
  poseClothColliders,
} from '../three/cloth/bodyColliders';

/** Bones cloth never touches: the digits carry no collider. */
const UNCOVERED = /^(thumb|finger|root)/;

function build(raceId: string) {
  const frame = generateEntityBlueprint({ kind: 'humanoid', raceId, classId: 'fighter', seed: 'cloth-colliders' }).frame;
  const skel = buildBipedSkeleton(frame);
  const skin = buildSmoothBipedGeometry(skel.restPose, skel.index, frame);
  const margins = defaultClothMargins(heightM(frame));
  const colliders = bipedClothColliders(frame, skel.restPose, skel.index, skin, margins);
  return { frame, skel, skin, margins, colliders };
}

function coverage(raceId: string) {
  const { frame, skel, skin, margins, colliders } = build(raceId);
  const caps = new Float32Array(colliders.length * CLOTH_COLLIDER_STRIDE);
  packRestColliders(colliders, caps);
  const pos = skin.getAttribute('position');
  const si = skin.getAttribute('skinIndex');
  const sw = skin.getAttribute('skinWeight');
  const names = [...skel.index.keys()] as BipedBoneName[];
  let worstOut = -Infinity;
  let counted = 0;
  const floats: number[] = [];
  if (!skin.getAttribute('normal')) skin.computeVertexNormals();
  const nrm = skin.getAttribute('normal');
  for (let v = 0; v < pos.count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
    if (UNCOVERED.test(names[si.getComponent(v, best)])) continue;
    counted++;
    const d = colliderClearance(caps, colliders.length, pos.getX(v), pos.getY(v), pos.getZ(v));
    if (d > worstOut) worstOut = d;
    // FLOAT: for each collider that holds this vertex, walk out along the
    // skin normal until the point leaves THAT collider; keep the shortest
    // walk. That is how tightly the closest wrapper hugs this patch of skin.
    // (A walk out of the whole union was tried first and is wrong: about a
    // fifth of the skin faces another body part — inner arms, inner thighs —
    // so the ray runs into the next limb, where cloth never rests anyway.)
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    let tight = Infinity;
    for (let i = 0; i < colliders.length; i++) {
      if (colliderClearanceOf(caps, i, x, y, z) >= 0) continue;
      let t = 0;
      while (t < 0.3 && colliderClearanceOf(caps, i, x + nrm.getX(v) * t, y + nrm.getY(v) * t, z + nrm.getZ(v) * t) < 0) t += 0.001;
      if (t < tight) tight = t;
    }
    floats.push(tight);
  }
  floats.sort((a, b) => a - b);
  const meanFloat = floats.reduce((a, b) => a + b, 0) / floats.length;
  const p95Float = floats[Math.floor(floats.length * 0.95)];
  return { h: heightM(frame), counted, worstOut, meanFloat, p95Float, margins, n: colliders.length };
}

describe('cloth body colliders', () => {
  it.each(['human', 'hill_dwarf', 'half_orc', 'lightfoot_halfling'])('cover the drawn %s body', (raceId) => {
    const r = coverage(raceId);
    // eslint-disable-next-line no-console
    console.log(`[cloth colliders] ${raceId}: h ${r.h.toFixed(2)} m, ${r.n} colliders, ${r.counted} skin verts, worst outside ${(r.worstOut * 1000).toFixed(1)} mm, float mean ${(r.meanFloat * 1000).toFixed(1)} p95 ${(r.p95Float * 1000).toFixed(1)} mm (margins ${(r.margins.torso * 1000).toFixed(0)}/${(r.margins.limb * 1000).toFixed(0)} mm)`);
    expect(r.n).toBe(20);
    expect(r.counted).toBeGreaterThan(500);
    // Every counted skin vertex lies inside a collider (a cloth point on the
    // surface is then outside the skin).
    expect(r.worstOut).toBeLessThanOrEqual(0);
    // ...and the colliders hug the skin, so resting cloth does not float.
    expect(r.meanFloat).toBeLessThan(r.margins.torso * 2.5);
  });

  it('poses with the skinning matrix', () => {
    const { skel, colliders } = build('human');
    skel.root.updateMatrixWorld(true);
    const inverses = skel.bones.map((b) => b.matrixWorld.clone().invert());
    // bend the left knee 60 degrees and move the whole figure
    const shin = skel.bones[skel.index.get('shinL')!];
    shin.rotateX(Math.PI / 3);
    skel.root.position.set(3, 0, -2);
    skel.root.updateMatrixWorld(true);
    const out = new Float32Array(colliders.length * CLOTH_COLLIDER_STRIDE);
    poseClothColliders(colliders, skel.bones, inverses, out);
    const k = colliders.findIndex((c) => c.id === 'legL.shin');
    const o = k * CLOTH_COLLIDER_STRIDE;
    // the shin's A end rides the shin bone exactly as skinning moves a vertex
    // at that rest point (the fit may stretch A off the knee, so the check
    // goes through the skin matrix, not the bone origin)
    const c = colliders[k];
    const si = skel.index.get('shinL')!;
    const expectA = new Vector3(...c.a).applyMatrix4(shin.matrixWorld.clone().multiply(inverses[si]));
    expect(Math.hypot(out[o] - expectA.x, out[o + 1] - expectA.y, out[o + 2] - expectA.z)).toBeLessThan(1e-5);
    // the end moved: a 60-degree knee bend is not the rest pose
    expect(Math.hypot(out[o + 4] - c.b[0], out[o + 5] - c.b[1], out[o + 6] - c.b[2])).toBeGreaterThan(0.05);
    // length kept, and the section axes stay unit and perpendicular to it
    const len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]);
    const ab = new Vector3(out[o + 4] - out[o], out[o + 5] - out[o + 1], out[o + 6] - out[o + 2]);
    expect(ab.length()).toBeCloseTo(len, 5);
    const X = new Vector3(out[o + 8], out[o + 9], out[o + 10]);
    const Z = new Vector3(out[o + 12], out[o + 13], out[o + 14]);
    expect(X.length()).toBeCloseTo(1, 5);
    expect(Math.abs(X.dot(ab.normalize()))).toBeLessThan(1e-5);
    expect(Math.abs(Z.dot(X))).toBeLessThan(1e-5);
    // an untouched collider (the right shin) only translated
    const kr = colliders.findIndex((cc) => cc.id === 'legR.shin');
    expect(out[kr * CLOTH_COLLIDER_STRIDE] - colliders[kr].a[0]).toBeCloseTo(3, 5);
  });

  it('throws when the rest pose loses an expected piece', () => {
    const { frame, skel, skin } = build('human');
    const pose = { ...skel.restPose, segments: skel.restPose.segments.filter((s) => s.id !== 'legL.shin') };
    expect(() => bipedClothColliders(frame, pose, skel.index, skin, { torso: 0, limb: 0 })).toThrow(/legL\.shin/);
  });
});
