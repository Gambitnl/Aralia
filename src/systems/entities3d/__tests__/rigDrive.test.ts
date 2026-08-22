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
import { buildBipedBindGeometry, createSkinnedFromRig } from '../three/skinnedBody';
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
  it('rejects a rig on a segment body or with parts', () => {
    expect(() => assembleEntity(blueprint, { renderMode: 'solid', rig: syntheticRig() })).toThrow(/options.rig/);
  });
});
