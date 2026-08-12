/**
 * @file smoothBiped.test.ts — slice 3 of the skeleton pivot: one-piece chain
 * tubes with joint-blended skin weights (≤2 influences, smoothstep zones).
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-23-skeleton-smooth-bodies.md
 */
import { describe, it, expect } from 'vitest';
import { Box3, BufferGeometry, Quaternion, Vector3 } from 'three';
import { deriveFrame } from '../types';
import { buildBipedSkeleton } from '../three/skeletonBuilder';
import { buildBipedBindGeometry } from '../three/skinnedBody';
import { buildSmoothBipedGeometry, SMOOTH_CHAINS } from '../three/smoothBipedGeometry';

const frame = deriveFrame('biped', 6, 1, 1);

function build(): { geometry: BufferGeometry; skeleton: ReturnType<typeof buildBipedSkeleton> } {
  const skeleton = buildBipedSkeleton(frame);
  const geometry = buildSmoothBipedGeometry(skeleton.restPose, skeleton.index);
  return { geometry, skeleton };
}

describe('smooth biped weights', () => {
  it('every vertex sums to 1 with at most 2 influences', () => {
    const { geometry } = build();
    const w = geometry.getAttribute('skinWeight');
    const idx = geometry.getAttribute('skinIndex');
    expect(w.count).toBeGreaterThan(0);
    for (let v = 0; v < w.count; v++) {
      const sum = w.getX(v) + w.getY(v) + w.getZ(v) + w.getW(v);
      expect(sum).toBeCloseTo(1, 5);
      expect(w.getZ(v)).toBe(0);
      expect(w.getW(v)).toBe(0);
      expect(idx.getX(v)).toBeGreaterThanOrEqual(0);
      expect(idx.getX(v)).toBeLessThan(17);
    }
  });

  it('elbow-zone rings blend upperArm and foreArm; mid-bone rings stay rigid', () => {
    const { geometry, skeleton } = build();
    const upper = skeleton.index.get('upperArmL')!;
    const fore = skeleton.index.get('foreArmL')!;
    const w = geometry.getAttribute('skinWeight');
    const idx = geometry.getAttribute('skinIndex');
    let blended = 0;
    let rigidUpper = 0;
    for (let v = 0; v < w.count; v++) {
      const pair = new Set([idx.getX(v), idx.getY(v)]);
      if (pair.has(upper) && pair.has(fore) && w.getX(v) > 0.05 && w.getY(v) > 0.05) blended++;
      if (idx.getX(v) === upper && w.getX(v) === 1) rigidUpper++;
    }
    expect(blended).toBeGreaterThan(10);   // rings across the elbow zone
    expect(rigidUpper).toBeGreaterThan(5); // mid-bone stays owned by one bone
  });

  it('stays within 6% of the rigid geometry bounds per axis (z allows the torso depth ellipse)', () => {
    const { geometry, skeleton } = build();
    const rigid = buildBipedBindGeometry(frame, skeleton);
    const smoothBox = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
    const rigidBox = new Box3().setFromBufferAttribute(rigid.getAttribute('position') as never);
    const smoothSize = smoothBox.getSize(new Vector3());
    const rigidSize = rigidBox.getSize(new Vector3());
    for (const axis of ['x', 'y', 'z'] as const) {
      // round 13 (humanoid-anatomy): the smooth torso is deliberately
      // ELLIPTICAL (chest 1.18 / hips 1.12 deep — flatOf) to fix the
      // paper-thin side view; the rigid comparison body is round by
      // construction, so the z axis carries that intended extra depth.
      const tolerance = axis === 'z' ? rigidSize.z * 0.14 + 0.02 : rigidSize[axis] * 0.06 + 0.02;
      expect(Math.abs(smoothSize[axis] - rigidSize[axis])).toBeLessThan(tolerance);
    }
  });

  it('is deterministic', () => {
    const a = build().geometry.getAttribute('position');
    const b = build().geometry.getAttribute('position');
    expect(Array.from(a.array as Float32Array)).toEqual(Array.from(b.array as Float32Array));
  });

  it('a 90-degree elbow bend neither tears nor collapses the skin', () => {
    const { geometry, skeleton } = build();
    skeleton.root.updateMatrixWorld(true);
    const upper = skeleton.index.get('upperArmL')!;
    const fore = skeleton.index.get('foreArmL')!;
    const bones = skeleton.bones;
    const invBind = bones.map((b) => b.matrixWorld.clone().invert());

    // fold the forearm 90 degrees about its local X
    bones[fore].quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
    skeleton.root.updateMatrixWorld(true);
    const boneMats = bones.map((b, i) => b.matrixWorld.clone().multiply(invBind[i]));

    const pos = geometry.getAttribute('position');
    const w = geometry.getAttribute('skinWeight');
    const idx = geometry.getAttribute('skinIndex');
    const v0 = new Vector3();
    const t0 = new Vector3();
    const t1 = new Vector3();
    const skinned: Vector3[] = [];
    const involved: boolean[] = [];
    for (let v = 0; v < pos.count; v++) {
      v0.set(pos.getX(v), pos.getY(v), pos.getZ(v));
      const i0 = idx.getX(v);
      const i1 = idx.getY(v);
      const w0 = w.getX(v);
      const w1 = w.getY(v);
      t0.copy(v0).applyMatrix4(boneMats[i0]).multiplyScalar(w0);
      t1.copy(v0).applyMatrix4(boneMats[i1]).multiplyScalar(w1);
      skinned.push(t0.clone().add(t1));
      involved.push((i0 === upper || i0 === fore || i1 === fore) && (w0 > 0 || w1 > 0));
    }

    // continuity: the elbow seam's longitudinal edges stretch < 2.5x rest
    const index = geometry.getIndex()!;
    let maxStretch = 0;
    for (let e = 0; e < index.count; e += 3) {
      for (const [a, b] of [
        [index.getX(e), index.getX(e + 1)],
        [index.getX(e + 1), index.getX(e + 2)],
        [index.getX(e + 2), index.getX(e)],
      ] as const) {
        if (!involved[a] || !involved[b]) continue;
        const rest = Math.hypot(pos.getX(a) - pos.getX(b), pos.getY(a) - pos.getY(b), pos.getZ(a) - pos.getZ(b));
        if (rest < 1e-6) continue;
        const bent = skinned[a].distanceTo(skinned[b]);
        maxStretch = Math.max(maxStretch, bent / rest);
      }
    }
    expect(maxStretch).toBeLessThan(2.5);

    // no collapse: blended vertices keep at least 20% of their rest distance
    // from the elbow joint
    const joint = new Vector3().setFromMatrixPosition(bones[fore].matrixWorld);
    for (let v = 0; v < pos.count; v++) {
      const i0 = idx.getX(v);
      const i1 = idx.getY(v);
      const isBlend = new Set([i0, i1]).has(upper) && new Set([i0, i1]).has(fore) && w.getY(v) > 0.05;
      if (!isBlend) continue;
      v0.set(pos.getX(v), pos.getY(v), pos.getZ(v));
      const restDist = v0.distanceTo(new Vector3().setFromMatrixPosition(bones[fore].matrixWorld));
      expect(skinned[v].distanceTo(joint)).toBeGreaterThan(Math.min(restDist, 0.02) * 0.2);
    }
  });

  it('chain table covers torso, both arms (through the palms), thumbs, both legs, both feet', () => {
    // round 2 (humanoid-anatomy): arm chains loft through the wrist into the
    // palm; thumbs are their own short capped tubes
    // round 5 (humanoid-anatomy): heel-to-toe wedge feet are their own capped
    // tubes (the terminal foot spheres are gone)
    // round 15 (humanoid-anatomy): arm chains loft through the palm into the
    // curled finger mass (the knuckle plane break)
    expect(SMOOTH_CHAINS.map((c) => c.segIds.join('>'))).toEqual([
      'torso.pelvis>torso.chest>neck',
      'armL.upper>armL.fore>handL.palm>handL.fingers',
      'handL.thumb',
      'armR.upper>armR.fore>handR.palm>handR.fingers',
      'handR.thumb',
      'legL.thigh>legL.shin',
      'legR.thigh>legR.shin',
      'footL',
      'footR',
    ]);
  });
});

describe('assembleEntity smooth-weights pass-through', () => {
  it('builds a 2-mesh smooth-weighted body under the humanoid budget', async () => {
    const { assembleEntity } = await import('../three/assembleEntity');
    const { generateEntityBlueprint } = await import('../generateEntityBlueprint');
    const { registerAllParts } = await import('../parts');
    const { HUMANOID_TRIANGLE_BUDGET } = await import('../textPlan/budgets');
    registerAllParts();
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'smooth-1' });
    const handle = assembleEntity(bp, { renderMode: 'solid', bodyTech: 'skinned', skinnedWeights: 'smooth' });
    handle.update(0.5, 1 / 60);

    const skinnedMeshes: { geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number } } }[] = [];
    handle.group.traverse((o) => {
      if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinnedMeshes.push(o as never);
    });
    expect(skinnedMeshes.length).toBe(2); // fill + ink shell

    const w = skinnedMeshes[0].geometry.getAttribute('skinWeight');
    let blended = 0;
    for (let v = 0; v < w.count; v++) {
      if (w.getX(v) > 0.05 && w.getY(v) > 0.05) blended++;
    }
    expect(blended).toBeGreaterThan(50);
    expect(handle.stats().triangles).toBeLessThan(HUMANOID_TRIANGLE_BUDGET);
    handle.dispose();
  });
});
