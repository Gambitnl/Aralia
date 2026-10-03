/**
 * @file speciesSkeleton.test.ts — skeleton pivot slice 5: the SPECIES gait bone
 * hierarchies (quad, hexapod, hopper, flyer, float) and their pose adapter must
 * reproduce their own driver's joints, exactly.
 *
 * Parity strategy (mirrors skeletonBuilder.test.ts and planSkeleton.test.ts):
 * the bind pose is DEFINED as the driver's rest state (t 0, dt 0, speed 0),
 * which a real driver reproduces exactly when stepped that way — so every
 * assertion compares against a live driver, never against copied-out expected
 * numbers. Tolerance is 1e-9 m: the bind build and the pose resolve are pure
 * rigid double-precision transforms, so anything looser would hide a real
 * divergence.
 */
import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3, SkinnedMesh } from 'three';
import type { Frame, SegmentSink } from '../types';
import { deriveFrame } from '../types';
import { assembleEntity } from '../three/assembleEntity';
import { registerAllParts } from '../parts';
import { PLAN_TRIANGLE_BUDGET } from '../textPlan/budgets';
import { createGaitDriver } from '../three/gaits';
import {
  SPECIES_GAITS,
  buildSpeciesSkeleton,
  createSpeciesPoseSink,
  isSpeciesGait,
  speciesRestPose,
  type BuiltSpeciesSkeleton,
  type SpeciesGait,
} from '../three/speciesSkeleton';

registerAllParts();

/** 1e-9 m — parity, not "close enough". */
const EPS = 1e-9;

interface Emitted {
  segs: Map<string, { ax: number; ay: number; az: number; bx: number; by: number; bz: number; r0: number; r1: number }>;
  balls: Map<string, { x: number; y: number; z: number; r: number }>;
  order: string[];
}

function collector(): { sink: SegmentSink; out: Emitted } {
  const out: Emitted = { segs: new Map(), balls: new Map(), order: [] };
  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => {
      out.segs.set(id, { ax, ay, az, bx, by, bz, r0, r1 });
      out.order.push(id);
    },
    ball: (id, x, y, z, r) => {
      out.balls.set(id, { x, y, z, r });
      out.order.push(id);
    },
  };
  return { sink, out };
}

/** A frame per gait, sized the way the creature profiles size these bodies. */
function frameFor(gait: SpeciesGait): Frame {
  const heightFt = gait === 'quad' ? 6.5 : gait === 'hexapod' ? 4 : gait === 'flyer' ? 3 : 5;
  return deriveFrame(gait, heightFt, 1.15, 1);
}

function cases(): Array<[SpeciesGait, Frame]> {
  return SPECIES_GAITS.map((g) => [g, frameFor(g)]);
}

function boneWorld(built: BuiltSpeciesSkeleton, id: string): Vector3 {
  return new Vector3().setFromMatrixPosition(built.bones[built.index.get(id)!].matrixWorld);
}

/** The authoritative joint for a bone id, whichever emission owns it. */
function jointOf(out: Emitted, id: string): Vector3 | null {
  const seg = out.segs.get(id);
  if (seg) return new Vector3(seg.ax, seg.ay, seg.az);
  const ball = out.balls.get(id);
  if (ball) return new Vector3(ball.x, ball.y, ball.z);
  return null;
}

describe('speciesSkeleton — coverage of the five species gaits', () => {
  it('claims exactly quad, hexapod, hopper, flyer and float', () => {
    expect([...SPECIES_GAITS]).toEqual(['quad', 'hexapod', 'hopper', 'flyer', 'float']);
    expect(isSpeciesGait('biped')).toBe(false);
    expect(isSpeciesGait('plan')).toBe(false);
    for (const g of SPECIES_GAITS) expect(isSpeciesGait(g)).toBe(true);
  });

  it('gives EVERY driver emission a bone — nothing is silently dropped', () => {
    for (const [gait, frame] of cases()) {
      const built = buildSpeciesSkeleton(gait, frame);
      // Walking, not resting: a moving driver emits the same id set, and this
      // proves the coverage claim under the pose the game actually renders.
      const driver = createGaitDriver(gait, frame);
      const { sink, out } = collector();
      for (let k = 0; k < 90; k++) {
        driver.update(k / 60, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 });
      }
      driver.buildBody(sink);
      for (const id of out.order) {
        expect(built.index.has(id), `${gait}: emission "${id}" has no bone`).toBe(true);
      }
      // and no bone exists that the driver never writes (root excepted)
      for (const bone of built.bones) {
        if (bone.name === 'root') continue;
        expect(out.segs.has(bone.name) || out.balls.has(bone.name), `${gait}: bone "${bone.name}" is never emitted`).toBe(true);
      }
    }
  });

  it('leg rows hang off the spine bone on their own side of the body', () => {
    for (const gait of ['quad', 'hexapod'] as const) {
      const built = buildSpeciesSkeleton(gait, frameFor(gait));
      const rest = speciesRestPose(gait, frameFor(gait));
      const legs = rest.segs.filter((s) => /^leg\d+\.upper$/.test(s.id));
      expect(legs.length, `${gait} leg count`).toBe(gait === 'quad' ? 4 : 6);
      for (const leg of legs) {
        const want = leg.a[2] >= 0 ? 'spine.front' : 'spine.rear';
        expect(built.parentId.get(leg.id), `${gait} ${leg.id} parent`).toBe(want);
        const i = Number(/^leg(\d+)\./.exec(leg.id)![1]);
        expect(built.parentId.get(`leg${i}.lower`)).toBe(`leg${i}.upper`);
        expect(built.parentId.get(`foot${i}`)).toBe(`leg${i}.lower`);
      }
    }
  });
});

describe('buildSpeciesSkeleton — bind pose parity with the live driver at rest', () => {
  it('bone world positions at rest equal the driver rest emissions (1e-9)', () => {
    for (const [gait, frame] of cases()) {
      const built = buildSpeciesSkeleton(gait, frame);
      built.root.updateMatrixWorld(true);
      // A FRESH driver, stepped the same way the bind capture steps one.
      const driver = createGaitDriver(gait, frame);
      driver.update(0, 0, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });
      const { sink, out } = collector();
      driver.buildBody(sink);
      let checked = 0;
      for (const bone of built.bones) {
        if (bone.name === 'root') continue;
        const want = jointOf(out, bone.name);
        expect(want, `${gait}: no rest emission for bone "${bone.name}"`).not.toBeNull();
        expect(boneWorld(built, bone.name).distanceTo(want!), `${gait} ${bone.name}`).toBeLessThan(EPS);
        checked += 1;
      }
      expect(checked, `${gait} had no bones to check`).toBeGreaterThan(3);
    }
  });

  it('bind orientation is +Y along each rest segment (1e-9)', () => {
    for (const [gait, frame] of cases()) {
      const built = buildSpeciesSkeleton(gait, frame);
      built.root.updateMatrixWorld(true);
      for (const seg of built.restPose.segs) {
        const bone = built.bones[built.index.get(seg.id)!];
        const axis = new Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(new Quaternion()));
        const want = new Vector3(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]).normalize();
        expect(axis.distanceTo(want), `${gait} ${seg.id} bind axis`).toBeLessThan(EPS);
      }
    }
  });

  it('is structurally deterministic — two builds produce identical bone ids and parents', () => {
    for (const [gait, frame] of cases()) {
      const a = buildSpeciesSkeleton(gait, frame);
      const b = buildSpeciesSkeleton(gait, frame);
      expect(a.bones.map((x) => x.name)).toEqual(b.bones.map((x) => x.name));
      expect([...a.parentId.entries()]).toEqual([...b.parentId.entries()]);
    }
  });
});

describe('createSpeciesPoseSink — the driver drives the bones', () => {
  it('bone world transforms track the live driver over 180 walk steps (1e-9)', () => {
    for (const [gait, frame] of cases()) {
      const built = buildSpeciesSkeleton(gait, frame);
      const pose = createSpeciesPoseSink(built);
      const driver = createGaitDriver(gait, frame);
      const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 };
      for (let k = 0; k < 180; k++) {
        driver.update(k / 60, 1 / 60, loco);
        driver.buildBody(pose.sink);
        pose.finishFrame();
      }
      // Authoritative joints at exactly this driver state.
      const { sink, out } = collector();
      driver.buildBody(sink);
      built.root.updateMatrixWorld(true);
      for (const bone of built.bones) {
        if (bone.name === 'root') continue;
        const want = jointOf(out, bone.name)!;
        expect(boneWorld(built, bone.name).distanceTo(want), `${gait} ${bone.name} @walk`).toBeLessThan(EPS);
      }
    }
  });

  it('bones actually MOVE off the bind pose while walking (no bind-pose freeze)', () => {
    for (const [gait, frame] of cases()) {
      const built = buildSpeciesSkeleton(gait, frame);
      const bind = new Map(built.bones.map((b) => [b.name, boneWorld(built, b.name).clone()]));
      const pose = createSpeciesPoseSink(built);
      const driver = createGaitDriver(gait, frame);
      const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.6 };
      let maxMove = 0;
      for (let k = 0; k < 120; k++) {
        driver.update(k / 60, 1 / 60, loco);
        driver.buildBody(pose.sink);
        pose.finishFrame();
        built.root.updateMatrixWorld(true);
        for (const b of built.bones) {
          maxMove = Math.max(maxMove, boneWorld(built, b.name).distanceTo(bind.get(b.name)!));
        }
      }
      // A centimeter is a floor, not a target: every one of these gaits swings
      // limbs or squashes a torso by far more than that at 1.6 m/s.
      expect(maxMove, `${gait} never left the bind pose`).toBeGreaterThan(0.01);
    }
  });

  it('throws loudly on an emission id with no bone mapping', () => {
    const built = buildSpeciesSkeleton('quad', frameFor('quad'));
    const pose = createSpeciesPoseSink(built);
    expect(() => pose.sink.seg('mysteryPart.0', 0, 0, 0, 0, 1, 0, 0.1, 0.1)).toThrow(/no bone mapped/);
    expect(() => pose.sink.ball('extraEye', 0, 0, 0, 0.1)).toThrow(/no bone mapped/);
  });
});

describe('assembleEntity — species gaits render skinned', () => {
  function blueprint(gait: SpeciesGait) {
    return {
      gait,
      frame: frameFor(gait),
      palette: { skinHex: '#6f8f5a', accentHex: '#c8a35a', eyeHex: '#e0b830', secondaryHex: '#3f4a33' },
      parts: [],
      label: `test ${gait}`,
    };
  }

  it('builds a 2-draw-call skinned body (fill + ink shell) for every species gait', () => {
    for (const gait of SPECIES_GAITS) {
      const handle = assembleEntity(blueprint(gait), { bodyTech: 'skinned' });
      handle.update(0.5, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 });
      const body = handle.group.getObjectByName('skinnedBody');
      expect(body, `${gait}: no skinned body`).toBeTruthy();
      const skinned: SkinnedMesh[] = [];
      body!.traverse((o) => {
        if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
      });
      expect(skinned.map((m) => m.name).sort(), `${gait} draw calls`).toEqual(['skinnedFill', 'skinnedOutline']);
      // ONE geometry and ONE skeleton shared by both — the shell deforms with
      // the fill instead of freezing in bind pose.
      expect(skinned[0].geometry).toBe(skinned[1].geometry);
      expect(skinned[0].skeleton).toBe(skinned[1].skeleton);
      handle.dispose();
    }
  });

  it('keeps the wireframe guard: a skinned body is solid shaded, period', () => {
    for (const gait of SPECIES_GAITS) {
      expect(() => assembleEntity(blueprint(gait), { bodyTech: 'skinned', renderMode: 'wireframe' })).toThrow(
        /solid shaded only/,
      );
    }
  });

  it('stays inside the 30k plan triangle budget on every species gait', () => {
    for (const gait of SPECIES_GAITS) {
      const handle = assembleEntity(blueprint(gait), { bodyTech: 'skinned' });
      handle.update(0.5, 1 / 60);
      expect(handle.stats().triangles, `${gait} budget`).toBeLessThan(PLAN_TRIANGLE_BUDGET);
      handle.dispose();
    }
  }, 30000);
});
