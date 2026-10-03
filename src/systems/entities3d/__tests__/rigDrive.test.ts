/**
 * @file rigDrive.test.ts — a foreign rig as the biped body (Part Lab base
 * meshes, 2026-08-21). A synthetic rig built from our own skeleton at unit
 * height stands in for a Blender export: same bone names, T-pose-style bind.
 * The seam must scale it to meters, bind it, and let the driver pose it.
 */
import { describe, it, expect } from 'vitest';
import { Skeleton, SkinnedMesh, Vector3 } from 'three';
import { deriveFrame, heightM } from '../types';
import { buildBipedSkeleton } from '../three/skeletonBuilder';
import { buildBipedBindGeometry, createSkinnedFromRig, frameFromRig } from '../three/skinnedBody';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

const frame = deriveFrame('biped', 6, 1, 1);

/** A unit-height rig: our skeleton + bind geometry, shrunk to height 1. The
 * skin's joint order is REVERSED from our name order, as a Blender export's
 * would differ — the seam must keep the skin's order for skinIndex. */
function syntheticRig(): SkinnedMesh {
  const built = buildBipedSkeleton(frame);
  const geometry = buildBipedBindGeometry(frame, built);
  const inv = 1 / heightM(frame);
  geometry.scale(inv, inv, inv);
  for (const b of built.bones) b.position.multiplyScalar(inv);
  const n = built.bones.length;
  const sIdx = geometry.getAttribute('skinIndex');
  for (let v = 0; v < sIdx.count; v++) sIdx.setXYZW(v, n - 1 - sIdx.getX(v), n - 1 - sIdx.getY(v), n - 1 - sIdx.getZ(v), n - 1 - sIdx.getW(v));
  const mesh = new SkinnedMesh(geometry);
  mesh.add(built.root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton([...built.bones].reverse()));
  return mesh;
}

/** Skinned bounding-box height in meters (applies the current pose). */
function posedHeight(mesh: SkinnedMesh): number {
  mesh.updateMatrixWorld(true);
  mesh.computeBoundingBox();
  const size = mesh.boundingBox!.getSize(new Vector3());
  return size.y;
}

describe('createSkinnedFromRig', () => {
  it('scales a unit rig to the frame height and binds every bone by name', () => {
    const body = createSkinnedFromRig(frame, syntheticRig(), { colorHex: '#c8a07a', outlineThickness: 0.01 });
    const bones = body.skinnedMesh.skeleton.bones;
    expect(bones).toHaveLength(39);
    // the skin keeps ITS joint order (reversed here); lookups go by name
    expect(bones[0].name).toBe('fingerR3b');
    expect(body.boneNamed('root')?.name).toBe('root');
    expect(body.boneNamed('handL')).toBeDefined();
    body.skinnedMesh.geometry.computeBoundingBox();
    const size = body.skinnedMesh.geometry.boundingBox!.getSize(new Vector3());
    expect(size.y).toBeGreaterThan(heightM(frame) * 0.8);
    expect(size.y).toBeLessThan(heightM(frame) * 1.2);
    body.dispose();
  });
  it('throws on a rig that lacks one of our bones', () => {
    const rig = syntheticRig();
    rig.skeleton.bones.find((b) => b.name === 'fingerR3b')!.name = 'pinky';
    expect(() => createSkinnedFromRig(frame, rig, { colorHex: '#fff', outlineThickness: 0.01 })).toThrow(/no bone "fingerR3b"/);
  });
});

describe('applyWorldPose (a mocap clip on a foreign rig)', () => {
  it('leaves the rig at its bind when the reference biped stands at ITS bind', () => {
    // The clip plays on the reference biped, whose bind frames use the
    // bindWorld convention; the sink's rest uses the canonical limb frames.
    // A delta taken against the wrong rest carries the roll difference and
    // swings FK children around the bone axis (the clip pretzel,
    // 2026-08-23). At the reference's bind the pose delta must be identity:
    // every rig joint stays at its own bind position.
    const body = createSkinnedFromRig(frame, syntheticRig(), { colorHex: '#c8a07a', outlineThickness: 0.01 });
    const bones = body.skinnedMesh.skeleton.bones;
    body.skinnedMesh.updateMatrixWorld(true);
    const bind = bones.map((b) => b.getWorldPosition(new Vector3()));
    const reference = buildBipedSkeleton(frame);
    const pelvis = reference.index.get('pelvis')!;
    body.applyWorldPose!(reference.bindWorldQuat, reference.bindWorldPos[pelvis]);
    body.skinnedMesh.updateMatrixWorld(true);
    for (const [i, b] of bones.entries()) {
      expect(b.getWorldPosition(new Vector3()).distanceTo(bind[i]), b.name).toBeLessThan(1e-4);
    }
    body.dispose();
  });
});

describe('assembleEntity with options.rig', () => {
  registerAllParts();
  const blueprint = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'rig-test' });
  it('drives the rig: the hand bone moves between an idle frame and a walk frame, no humanoid head is mounted', () => {
    const handle = assembleEntity(blueprint, { renderMode: 'solid', bodyTech: 'skinned', rig: syntheticRig() });
    const names: string[] = [];
    handle.group.traverse((o) => {
      if (o.name) names.push(o.name);
    });
    expect(names).not.toContain('mouthLine');
    expect(names).toContain('skinnedFill');
    handle.update(0, 0);
    // the posed skin stays body-sized: a joint-order mismatch shreds it
    const fill = handle.group.getObjectByName('skinnedFill') as SkinnedMesh;
    const h = posedHeight(fill);
    expect(h).toBeGreaterThan(heightM(frame) * 0.7);
    expect(h).toBeLessThan(heightM(frame) * 1.3);
    const hand = handle.group.getObjectByName('handL')!;
    const idle = hand.getWorldPosition(new Vector3());
    handle.update(0.6, 0.6, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 });
    const walking = hand.getWorldPosition(new Vector3());
    expect(idle.distanceTo(walking)).toBeGreaterThan(0.01);
    expect(Number.isFinite(walking.x + walking.y + walking.z)).toBe(true);
    handle.dispose();
  });
  it('keeps the rig\'s limb lengths under a walk frame (rotations only)', () => {
    const handle = assembleEntity(blueprint, { renderMode: 'solid', bodyTech: 'skinned', rig: syntheticRig() });
    const len = (a: string, b: string) => handle.group.getObjectByName(a)!.getWorldPosition(new Vector3()).distanceTo(handle.group.getObjectByName(b)!.getWorldPosition(new Vector3()));
    handle.update(0, 0);
    handle.group.updateMatrixWorld(true);
    const fore0 = len('foreArmL', 'handL');
    const shin0 = len('shinR', 'footR');
    handle.update(0.7, 0.7, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 });
    handle.group.updateMatrixWorld(true);
    expect(Math.abs(len('foreArmL', 'handL') - fore0)).toBeLessThan(1e-6);
    expect(Math.abs(len('shinR', 'footR') - shin0)).toBeLessThan(1e-6);
    handle.dispose();
  });
  it('measures a frame from the rig that matches the synthetic body', () => {
    const f = frameFromRig(syntheticRig(), frame);
    expect(f.heightFt).toBe(frame.heightFt);
    expect(Math.abs(f.armLengthFt / frame.armLengthFt - 1)).toBeLessThan(0.25);
    expect(Math.abs(f.limbLengthFt / frame.limbLengthFt - 1)).toBeLessThan(0.25);
    expect(Math.abs(f.shoulderWidthFt / frame.shoulderWidthFt - 1)).toBeLessThan(0.35);
  });
  it('rejects a rig on a segment body or with parts', () => {
    expect(() => assembleEntity(blueprint, { renderMode: 'solid', rig: syntheticRig() })).toThrow(/options.rig/);
  });
});
