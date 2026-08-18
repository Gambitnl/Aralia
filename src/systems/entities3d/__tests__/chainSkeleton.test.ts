/**
 * @file chainSkeleton.test.ts — skeleton pivot slice 6: real bone chains for
 * the animated chain parts (tails, tentacles, antennae, fin ridges).
 *
 * Parity strategy (mirrors speciesSkeleton.test.ts): the bind pose is DEFINED
 * as each chain part's own build() output at the rest phase, so every
 * assertion compares against the chain build itself — never copied-out
 * numbers. Tolerance is 1e-9 m: pure rigid double-precision transforms.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Quaternion, Vector3, type Object3D, type SkinnedMesh } from 'three';
import type { Frame, PartAnchors, PartPhase } from '../types';
import { ANCHORS, deriveFrame } from '../types';
import { createGaitDriver } from '../three/gaits';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';
import {
  buildChainSkeleton,
  chainRestPose,
  createChainPoseSink,
  type ChainPartInput,
} from '../three/chainSkeleton';
import { buildChainBindGeometry, createSkinnedChains } from '../three/skinnedBody';
import { assembleEntity } from '../three/assembleEntity';

beforeAll(() => {
  registerAllParts();
});

/** 1e-9 m — parity, not "close enough". */
const EPS = 1e-9;
const UP = new Vector3(0, 1, 0);
const FRAME: Frame = deriveFrame('quad', 6.5, 1.15, 1);

/** Rest anchors from a real quad driver stepped to its own rest. */
function restAnchors(frame: Frame): PartAnchors {
  const driver = createGaitDriver('quad', frame);
  driver.update(0, 0, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });
  return Object.fromEntries(ANCHORS.map((a) => [a, driver.pose.anchors[a].pos])) as PartAnchors;
}

/** The chain parts under test: a real tail, tentacles, and antennae. */
function chainInputs(): ChainPartInput[] {
  return (['tailThick', 'tentacles', 'antennae'] as const).map((partId) => ({
    partId,
    build: getPart(partId).buildChain!,
    params: {},
  }));
}

describe('chainSkeleton — bind pose parity', () => {
  it('every rest link owns a bone at its A joint with +Y along the segment', () => {
    const anchors = restAnchors(FRAME);
    const rest = chainRestPose(chainInputs(), FRAME, anchors);
    expect(rest.segs.length).toBeGreaterThan(0);
    const built = buildChainSkeleton(rest);
    built.root.updateMatrixWorld(true);

    const pos = new Vector3();
    const quat = new Quaternion();
    const dir = new Vector3();
    const rotated = new Vector3();
    for (const seg of rest.segs) {
      const i = built.index.get(seg.id);
      expect(i, `bone for ${seg.id}`).toBeDefined();
      const bone = built.bones[i!];
      pos.setFromMatrixPosition(bone.matrixWorld);
      expect(pos.distanceTo(new Vector3(...seg.a)), `${seg.id} bind position`).toBeLessThan(EPS);
      dir.set(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]).normalize();
      bone.matrixWorld.decompose(new Vector3(), quat, new Vector3());
      rotated.copy(UP).applyQuaternion(quat);
      expect(rotated.distanceTo(dir), `${seg.id} bind orientation`).toBeLessThan(1e-6);
    }
  });

  it('ids are the runtime partId:segId form and links chain to their predecessor', () => {
    const rest = chainRestPose(chainInputs(), FRAME, restAnchors(FRAME));
    const built = buildChainSkeleton(rest);
    expect(built.index.has('tailThick:tailThick.0')).toBe(true);
    expect(built.index.has('tailThick:tailThick.2')).toBe(true);
    expect(built.parentId.get('tailThick:tailThick.1')).toBe('tailThick:tailThick.0');
    expect(built.parentId.get('tailThick:tailThick.0')).toBe('root');
    expect(built.parentId.get('antennae:antennaR.1')).toBe('antennae:antennaR.0');
  });
});

describe('chainSkeleton — pose adapter', () => {
  it('reproduces a live later-phase build exactly (world position + orientation)', () => {
    const anchors = restAnchors(FRAME);
    const inputs = chainInputs();
    const rest = chainRestPose(inputs, FRAME, anchors);
    const built = buildChainSkeleton(rest);
    const pose = createChainPoseSink(built);

    // a phase well away from rest: every wag/wave/twitch term is non-zero
    const phase: PartPhase = { t: 1.37, gaitPhase: 0.42, flap: 0.6 };
    const expected = new Map<string, { a: Vector3; dir: Vector3 }>();
    for (const chain of inputs) {
      for (const s of chain.build(FRAME, chain.params, phase, anchors)) {
        const id = `${chain.partId}:${s.id}`;
        pose.sink.seg(id, s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.r0, s.r1);
        expected.set(id, {
          a: new Vector3(s.ax, s.ay, s.az),
          dir: new Vector3(s.bx - s.ax, s.by - s.ay, s.bz - s.az).normalize(),
        });
      }
    }
    pose.finishFrame();
    built.root.updateMatrixWorld(true);

    const pos = new Vector3();
    const quat = new Quaternion();
    const rotated = new Vector3();
    for (const [id, want] of expected) {
      const bone = built.bones[built.index.get(id)!];
      pos.setFromMatrixPosition(bone.matrixWorld);
      expect(pos.distanceTo(want.a), `${id} posed position`).toBeLessThan(EPS);
      bone.matrixWorld.decompose(new Vector3(), quat, new Vector3());
      rotated.copy(UP).applyQuaternion(quat);
      expect(rotated.distanceTo(want.dir), `${id} posed orientation`).toBeLessThan(1e-6);
    }
  });

  it('throws on an unknown id and on any ball emission', () => {
    const rest = chainRestPose(chainInputs(), FRAME, restAnchors(FRAME));
    const pose = createChainPoseSink(buildChainSkeleton(rest));
    expect(() => pose.sink.seg('nope.0', 0, 0, 0, 0, 1, 0, 0.1, 0.1)).toThrow(/no bone mapped/);
    expect(() => pose.sink.ball('tailThick:tailThick.0', 0, 0, 0, 0.1)).toThrow(/segments only/);
  });
});

describe('createSkinnedChains — geometry and weights', () => {
  it('every vertex is rigidly owned by a real chain bone', () => {
    const rest = chainRestPose(chainInputs(), FRAME, restAnchors(FRAME));
    const built = buildChainSkeleton(rest);
    const geometry = buildChainBindGeometry(rest, built.index);
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    expect(skinIndex.count).toBe(geometry.getAttribute('position').count);
    for (let v = 0; v < skinWeight.count; v++) {
      const sum = skinWeight.getX(v) + skinWeight.getY(v) + skinWeight.getZ(v) + skinWeight.getW(v);
      expect(sum, `vertex ${v} weight sum`).toBeCloseTo(1, 9);
      expect(skinWeight.getX(v), `vertex ${v} sole owner`).toBe(1);
      expect(skinIndex.getX(v), `vertex ${v} bone range`).toBeLessThan(built.bones.length);
      expect(skinIndex.getX(v), `vertex ${v} never the root`).toBeGreaterThan(0);
    }
    geometry.dispose();
  });

  it('builds a fill + ink SkinnedMesh pair with skinning-capable shell shader', () => {
    const chains = createSkinnedChains(chainInputs(), FRAME, restAnchors(FRAME), {
      colorHex: '#8a6f5a',
      outlineThickness: 0.015,
    })!;
    expect(chains).toBeTruthy();
    const fill = chains.root.getObjectByName('skinnedChainFill') as SkinnedMesh;
    const shell = chains.root.getObjectByName('skinnedChainOutline') as SkinnedMesh;
    expect(fill?.isSkinnedMesh).toBe(true);
    expect(shell?.isSkinnedMesh).toBe(true);
    expect(shell.skeleton).toBe(fill.skeleton);
    const shader = (shell.material as { vertexShader?: string }).vertexShader ?? '';
    expect(shader).toContain('skinning_vertex');
    expect(chains.triangles()).toBeGreaterThan(0);
    expect(chains.boneCount()).toBe(buildChainSkeleton(chainRestPose(chainInputs(), FRAME, restAnchors(FRAME))).bones.length);
    chains.dispose();
  });

  it('returns null when there is nothing to skin', () => {
    expect(createSkinnedChains([], FRAME, restAnchors(FRAME), { colorHex: '#fff', outlineThickness: 0.01 })).toBeNull();
  });
});

describe('assembleEntity — slice 6 integration', () => {
  // Plan-template creatures replace their chain tails with plan chains, so a
  // GENERATED fixture is fragile. A hand-rolled quad blueprint pins the parts.
  const blueprint = (): import('../types').EntityBlueprint => ({
    gait: 'quad',
    frame: FRAME,
    palette: { skinHex: '#8a6f5a', accentHex: '#c9a227', secondaryHex: '#6b4f3f', eyeHex: '#e0b830' },
    parts: [
      { partId: 'tailThick', anchor: 'tailRoot' },
      { partId: 'antennae', anchor: 'crown' },
    ],
    label: 'chain fixture quad',
  });

  it('a skinned creature with chain parts carries skinnedChains and no chain segment nodes', () => {
    const handle = assembleEntity(blueprint(), { renderMode: 'solid', bodyTech: 'skinned' });
    expect(handle.group.getObjectByName('skinnedChains'), 'skinned chains group missing').toBeTruthy();
    expect(handle.group.getObjectByName('skinnedChainFill')).toBeTruthy();
    expect(handle.group.getObjectByName('skinnedChainOutline')).toBeTruthy();
    // the segment renderer must not draw the chain links in skinned mode
    let chainSegNodes = 0;
    handle.group.traverse((o: Object3D) => {
      if (/^seg:(tailThick|tailThin|tentacle|antenna)/.test(o.name)) chainSegNodes++;
    });
    expect(chainSegNodes, 'chain links leaked to the segment renderer').toBe(0);
    handle.update(0.2, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 });
    handle.dispose();
  });

  it('segments mode is untouched: chains still render as segment nodes, no skinned pair', () => {
    const handle = assembleEntity(blueprint(), { renderMode: 'solid', bodyTech: 'segments' });
    expect(handle.group.getObjectByName('skinnedChains')).toBeFalsy();
    let chainSegNodes = 0;
    handle.group.traverse((o: Object3D) => {
      if (/^seg:(tailThick|tailThin|tentacle|antenna)/.test(o.name)) chainSegNodes++;
    });
    expect(chainSegNodes, 'segments mode must keep drawing chains').toBeGreaterThan(0);
    handle.dispose();
  });
});
