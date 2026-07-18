/**
 * @file skinnedBody.test.ts — skeleton pivot slice 1: rigid-weight skinned
 * biped body + the assembleEntity bodyTech switch.
 *
 * Covers: rigid weights (each vertex 100% one bone), bind-pose identity
 * (geometry authored exactly where the bones expect it), first-frame joint
 * parity against the segment body, deterministic geometry, and — most
 * important — that the DEFAULT path is byte-stable: omitting bodyTech
 * produces the identical segment body as before this slice.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Matrix4, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { deriveFrame } from '../types';
import { assembleEntity } from '../three/assembleEntity';
import { createSkinnedBiped } from '../three/skinnedBody';
import { buildBipedSkeleton, BIPED_BONE_NAMES } from '../three/skeletonBuilder';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

const WALK = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 };
const FRAME = deriveFrame('biped', 6, 1, 1);
const BODY_OPTS = { colorHex: '#8a6f5a', outlineThickness: 0.015 };

function fillMeshOf(root: Object3D): SkinnedMesh {
  const fill = root.getObjectByName('skinnedFill') as SkinnedMesh | undefined;
  expect(fill?.isSkinnedMesh, 'skinnedFill mesh missing').toBe(true);
  return fill!;
}

describe('createSkinnedBiped — geometry and weights', () => {
  it('every vertex is rigidly owned: weights sum to 1 with a single bone', () => {
    const body = createSkinnedBiped(FRAME, BODY_OPTS);
    const geometry = fillMeshOf(body.root).geometry;
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    expect(skinIndex.count).toBe(geometry.getAttribute('position').count);
    for (let v = 0; v < skinWeight.count; v++) {
      const sum = skinWeight.getX(v) + skinWeight.getY(v) + skinWeight.getZ(v) + skinWeight.getW(v);
      expect(sum, `vertex ${v} weight sum`).toBeCloseTo(1, 9);
      expect(skinWeight.getX(v), `vertex ${v} sole owner`).toBe(1);
      expect(skinIndex.getX(v), `vertex ${v} bone range`).toBeLessThan(BIPED_BONE_NAMES.length);
    }
    body.dispose();
  });

  it('bind pose is the identity: bone.matrixWorld × boneInverse ≈ I before any pose', () => {
    const body = createSkinnedBiped(FRAME, BODY_OPTS);
    const fill = fillMeshOf(body.root);
    body.root.updateMatrixWorld(true);
    const offset = new Matrix4();
    const identity = new Matrix4();
    fill.skeleton.bones.forEach((bone, i) => {
      offset.multiplyMatrices(bone.matrixWorld, fill.skeleton.boneInverses[i]);
      for (let k = 0; k < 16; k++) {
        expect(Math.abs(offset.elements[k] - identity.elements[k]), `bone ${bone.name} element ${k}`).toBeLessThan(1e-6);
      }
    });
    body.dispose();
  });

  it('outline shell is a second SkinnedMesh sharing the skeleton and geometry', () => {
    const body = createSkinnedBiped(FRAME, BODY_OPTS);
    const fill = fillMeshOf(body.root);
    const shell = body.root.getObjectByName('skinnedOutline') as SkinnedMesh;
    expect(shell?.isSkinnedMesh, 'outline must skin — a plain mesh freezes in bind pose').toBe(true);
    expect(shell.skeleton).toBe(fill.skeleton);
    expect(shell.geometry).toBe(fill.geometry);
    // the shell's ShaderMaterial must carry the skinning chunks or it will
    // compile without bone support and freeze
    const shader = (shell.material as { vertexShader?: string }).vertexShader ?? '';
    expect(shader).toContain('skinning_pars_vertex');
    expect(shader).toContain('skinbase_vertex');
    expect(shader).toContain('skinning_vertex');
    body.dispose();
  });

  it('geometry is deterministic across rebuilds', () => {
    const a = createSkinnedBiped(FRAME, BODY_OPTS);
    const b = createSkinnedBiped(FRAME, BODY_OPTS);
    const pa = fillMeshOf(a.root).geometry.getAttribute('position').array as Float32Array;
    const pb = fillMeshOf(b.root).geometry.getAttribute('position').array as Float32Array;
    expect(pa.length).toBe(pb.length);
    let mismatches = 0;
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) mismatches++;
    expect(mismatches).toBe(0);
    a.dispose();
    b.dispose();
  });
});

describe('assembleEntity bodyTech switch', () => {
  beforeAll(() => {
    registerAllParts();
  });
  const bp = () => generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'skel-1' });

  /** Full transform snapshot of every named node — the byte-stability probe. */
  function snapshot(root: Object3D): Array<[string, number[]]> {
    const rows: Array<[string, number[]]> = [];
    root.traverse((o) => {
      rows.push([o.name, [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]]);
    });
    return rows;
  }

  it('default output is byte-stable: omitting bodyTech === explicit segments, no skinning', () => {
    const plain = assembleEntity(bp(), { renderMode: 'solid' });
    const explicit = assembleEntity(bp(), { renderMode: 'solid', bodyTech: 'segments' });
    let skinnedNodes = 0;
    plain.group.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) skinnedNodes++;
    });
    expect(skinnedNodes, 'default must contain no SkinnedMesh').toBe(0);
    expect(snapshot(plain.group)).toEqual(snapshot(explicit.group));
    // stays identical while animating
    for (let t = 1 / 60; t < 0.3; t += 1 / 60) {
      plain.update(t, 1 / 60, WALK);
      explicit.update(t, 1 / 60, WALK);
    }
    expect(snapshot(plain.group)).toEqual(snapshot(explicit.group));
    plain.dispose();
    explicit.dispose();
  });

  it('skinned mode: 2-draw-call body, no driver segment nodes, eyes/shadow/parts intact', () => {
    const blueprint = bp();
    const handle = assembleEntity(blueprint, { renderMode: 'solid', bodyTech: 'skinned' });
    expect(handle.group.getObjectByName('skinnedBody'), 'skinned body group missing').toBeTruthy();
    expect(handle.group.getObjectByName('skinnedFill'), 'fill mesh missing').toBeTruthy();
    expect(handle.group.getObjectByName('skinnedOutline'), 'ink shell missing').toBeTruthy();
    expect(handle.group.getObjectByName('seg:torso.chest'), 'driver segments must not render').toBeFalsy();
    expect(handle.group.getObjectByName('seg:head'), 'driver balls must not render').toBeFalsy();
    // the untouched anchor pathway: eyes, shadow, and gear parts still mount
    expect(handle.group.getObjectByName('eyeL')).toBeTruthy();
    expect(handle.group.getObjectByName('blobShadow')).toBeTruthy();
    const parts = handle.group.getObjectByName('parts')!;
    expect(parts.children.length).toBeGreaterThan(0);
    const stats = handle.stats();
    expect(stats.triangles).toBeGreaterThan(100);
    handle.update(0.2, 1 / 60, WALK); // must not throw while walking
    handle.dispose();
    expect(handle.group.children.length).toBe(0);
  });

  it('skinned first-frame joints match the segment body within 1e-3', () => {
    const blueprint = bp();
    const seg = assembleEntity(blueprint, { renderMode: 'solid', bodyTech: 'segments' });
    const skin = assembleEntity(blueprint, { renderMode: 'solid', bodyTech: 'skinned' });
    // both handles settled into the same first frame (t 0, dt 1/60) at build
    seg.group.updateMatrixWorld(true);
    skin.group.updateMatrixWorld(true);
    const bind = buildBipedSkeleton(blueprint.frame);
    const bindInverse = new Matrix4();
    const one = new Vector3(1, 1, 1);
    const mapped = new Vector3();

    // ball pieces: the segment node's position IS the joint (head, hands, feet)
    for (const ball of bind.restPose.balls) {
      const segNode = seg.group.getObjectByName(`seg:${ball.id}`)!;
      const bone = skin.group.getObjectByName(ball.bone)!;
      const a = new Vector3().setFromMatrixPosition(segNode.matrixWorld);
      const b = new Vector3().setFromMatrixPosition(bone.matrixWorld);
      expect(a.distanceTo(b), `${ball.id} joint drift`).toBeLessThan(1e-3);
    }
    // segment pieces: the node sits at the segment midpoint — map the bind
    // midpoint through the live bone and compare
    for (const piece of bind.restPose.segments) {
      const segNode = seg.group.getObjectByName(`seg:${piece.id}`)!;
      const bone = skin.group.getObjectByName(piece.bone)!;
      const i = bind.index.get(piece.bone)!;
      bindInverse.compose(bind.bindWorldPos[i], bind.bindWorldQuat[i], one).invert();
      mapped
        .set((piece.a[0] + piece.b[0]) / 2, (piece.a[1] + piece.b[1]) / 2, (piece.a[2] + piece.b[2]) / 2)
        .applyMatrix4(bindInverse)
        .applyMatrix4(bone.matrixWorld);
      const nodePos = new Vector3().setFromMatrixPosition(segNode.matrixWorld);
      expect(mapped.distanceTo(nodePos), `${piece.id} midpoint drift`).toBeLessThan(1e-3);
    }
    seg.dispose();
    skin.dispose();
  });

  it('fails honestly outside slice-1 scope: wireframe and non-biped gaits', () => {
    expect(() => assembleEntity(bp(), { renderMode: 'wireframe', bodyTech: 'skinned' })).toThrow(/no wireframe path/);
    const wolf = generateEntityBlueprint({
      kind: 'creature',
      creatureType: 'Beast',
      size: 'Medium',
      seed: 'skel-2',
      cues: ['wolf'],
    });
    expect(wolf.gait).not.toBe('biped');
    expect(() => assembleEntity(wolf, { renderMode: 'solid', bodyTech: 'skinned' })).toThrow(/biped/);
  });
});
