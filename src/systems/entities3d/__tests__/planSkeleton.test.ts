/**
 * @file planSkeleton.test.ts — skeleton pivot slice 4, task 1: the plan bone
 * hierarchy and its pose adapter must reproduce the PlanDriver's joints.
 *
 * Parity strategy (mirrors skeletonBuilder.test.ts): the bind pose is defined
 * as the driver's rest state (gaitPhase 0, speed 0), which a real PlanDriver
 * reproduces exactly when stepped with dt = 0 — so every assertion compares
 * against the live driver, never against copied-out expected numbers.
 *
 * Fixtures are the plan's six stress creatures (textPlan/fixtures.ts):
 * Gladefoot Centaur (tauric parentId chains), Gelatinous Cube (box spine),
 * Tyrant Orb (floating crown necks), Barrow Wisp (legless upright), plus
 * Emberwing Dragon (wings) and Threefold Fen Serpent (serpentine).
 */
import { describe, it, expect } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import type { Frame, PlanSpec, SegmentSink } from '../types';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { registerAllParts } from '../parts';
import { buildPlanSkeleton, createPlanPoseSink, type BuiltPlanSkeleton } from '../three/planSkeleton';
import { createGaitDriver } from '../three/gaits';

registerAllParts();

interface Emitted {
  segs: Array<{ id: string; ax: number; ay: number; az: number; bx: number; by: number; bz: number; r0: number; r1: number }>;
  balls: Array<{ id: string; x: number; y: number; z: number; r: number }>;
}

/** Collect a driver buildBody pass as rigid segs + balls (sinks without tube). */
function captureSegEmissions(frame: Frame, spec: PlanSpec, steps: number, speed: number, dt = 1 / 60): Emitted {
  const driver = createGaitDriver('plan', frame, spec);
  const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed };
  for (let k = 0; k < steps; k++) driver.update(k / 60, dt, loco);
  const out: Emitted = { segs: [], balls: [] };
  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => out.segs.push({ id, ax, ay, az, bx, by, bz, r0, r1 }),
    ball: (id, x, y, z, r) => out.balls.push({ id, x, y, z, r }),
    box: (id, ax, ay, az, bx, by, bz) => out.segs.push({ id, ax, ay, az, bx, by, bz, r0: 1, r1: 1 }),
  };
  driver.buildBody(sink);
  return out;
}

/** Collect a driver buildBody pass honouring tube() (smooth spine/chains). */
function captureTubeEmissions(frame: Frame, spec: PlanSpec, steps: number, speed: number): Emitted {
  const driver = createGaitDriver('plan', frame, spec);
  const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed };
  for (let k = 0; k < steps; k++) driver.update(k / 60, 1 / 60, loco);
  const out: Emitted = { segs: [], balls: [] };
  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => out.segs.push({ id, ax, ay, az, bx, by, bz, r0, r1 }),
    ball: (id, x, y, z, r) => out.balls.push({ id, x, y, z, r }),
    box: (id, ax, ay, az, bx, by, bz) => out.segs.push({ id, ax, ay, az, bx, by, bz, r0: 1, r1: 1 }),
    tube: (id, flat, radii) => {
      for (let i = 0; i < radii.length - 1; i++) {
        out.segs.push({
          id: `${id}.${i}`,
          ax: flat[i * 3], ay: flat[i * 3 + 1], az: flat[i * 3 + 2],
          bx: flat[(i + 1) * 3], by: flat[(i + 1) * 3 + 1], bz: flat[(i + 1) * 3 + 2],
          r0: radii[i], r1: radii[i + 1],
        });
      }
    },
  };
  driver.buildBody(sink);
  return out;
}

/** The plan fixtures under test, keyed for readable failure messages. */
function fixtureCases(): Array<[string, ReturnType<typeof compilePlan>]> {
  const keys = ['centaur', 'gelatinousCube', 'beholder', 'ghost', 'dragon', 'threeHeadedSerpent'] as const;
  return keys.map((k) => [k, compilePlan(PLAN_FIXTURES[k])]);
}

function boneWorld(built: BuiltPlanSkeleton, id: string): Vector3 {
  return new Vector3().setFromMatrixPosition(built.bones[built.index.get(id)!].matrixWorld);
}

describe('buildPlanSkeleton — bind pose parity with the live driver at rest', () => {
  it('bone world positions at rest equal the driver rest emissions (1e-6) on all six fixtures', () => {
    for (const [name, { frame, planSpec }] of fixtureCases()) {
      const spec = planSpec!;
      const built = buildPlanSkeleton(frame, spec);
      built.root.updateMatrixWorld(true);
      const rest = captureSegEmissions(frame, spec, 1, 0, 0); // dt 0 → phase stays 0, like the bind capture
      const segBy = new Map(rest.segs.map((s) => [s.id, s]));
      const ballBy = new Map(rest.balls.map((b) => [b.id, b]));
      for (const bone of built.bones) {
        const p = boneWorld(built, bone.name);
        const seg = segBy.get(bone.name);
        if (seg) {
          expect(p.x, `${name} ${bone.name}.x`).toBeCloseTo(seg.ax, 7);
          expect(p.y, `${name} ${bone.name}.y`).toBeCloseTo(seg.ay, 7);
          expect(p.z, `${name} ${bone.name}.z`).toBeCloseTo(seg.az, 7);
        } else {
          const ball = ballBy.get(bone.name);
          if (ball) {
            expect(p.x, `${name} ${bone.name}.x`).toBeCloseTo(ball.x, 7);
            expect(p.y, `${name} ${bone.name}.y`).toBeCloseTo(ball.y, 7);
            expect(p.z, `${name} ${bone.name}.z`).toBeCloseTo(ball.z, 7);
          }
          // Formed heads emit no ball (the assembler owns their sculpted mesh);
          // their head bone borrows the live socket for the bind pose, so it has
          // no rigid emission to compare against — skip rather than fail.
        }
      }
    }
  });

  it('is structurally deterministic — two builds produce identical bone ids', () => {
    for (const [, { frame, planSpec }] of fixtureCases()) {
      const a = buildPlanSkeleton(frame, planSpec!);
      const b = buildPlanSkeleton(frame, planSpec!);
      expect(a.bones.map((x) => x.name)).toEqual(b.bones.map((x) => x.name));
      expect([...a.parentId.entries()]).toEqual([...b.parentId.entries()]);
    }
  });
});

describe('createPlanPoseSink — driver emissions drive the bones', () => {
  it('bone world transforms track a fresh collecting-sink capture over 120 walk steps (1e-6)', () => {
    for (const [name, { frame, planSpec }] of fixtureCases()) {
      const spec = planSpec!;
      const built = buildPlanSkeleton(frame, spec);
      const pose = createPlanPoseSink(built);
      const driver = createGaitDriver('plan', frame, spec);
      const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 };
      for (let k = 0; k < 120; k++) {
        driver.update(k / 60, 1 / 60, loco);
        driver.buildBody(pose.sink);
        pose.finishFrame();
      }
      // Authoritative positions at the same driver state.
      const rec: Emitted = { segs: [], balls: [] };
      const r: SegmentSink = {
        seg: (id, ax, ay, az, bx, by, bz, r0, r1) => rec.segs.push({ id, ax, ay, az, bx, by, bz, r0, r1 }),
        ball: (id, x, y, z, r) => rec.balls.push({ id, x, y, z, r }),
        box: (id, ax, ay, az, bx, by, bz) => rec.segs.push({ id, ax, ay, az, bx, by, bz, r0: 1, r1: 1 }),
        tube: (id, flat, radii) => {
          for (let i = 0; i < radii.length - 1; i++) {
            rec.segs.push({
              id: `${id}.${i}`,
              ax: flat[i * 3], ay: flat[i * 3 + 1], az: flat[i * 3 + 2],
              bx: flat[(i + 1) * 3], by: flat[(i + 1) * 3 + 1], bz: flat[(i + 1) * 3 + 2],
              r0: radii[i], r1: radii[i + 1],
            });
          }
        },
      };
      driver.buildBody(r);
      built.root.updateMatrixWorld(true);
      const segBy = new Map(rec.segs.map((s) => [s.id, s]));
      const ballBy = new Map(rec.balls.map((b) => [b.id, b]));
      // Collect the skeleton's bone world positions (not re-derived) per id.
      const worldById = new Map(built.bones.map((b) => [b.name, boneWorld(built, b.name)]));
      for (const bone of built.bones) {
        const p = worldById.get(bone.name)!;
        const seg = segBy.get(bone.name);
        if (seg) {
          expect(p.x, `${name} ${bone.name}.x`).toBeCloseTo(seg.ax, 6);
          expect(p.y, `${name} ${bone.name}.y`).toBeCloseTo(seg.ay, 6);
          expect(p.z, `${name} ${bone.name}.z`).toBeCloseTo(seg.az, 6);
        } else {
          const ball = ballBy.get(bone.name);
          if (ball) {
            expect(p.distanceTo(new Vector3(ball.x, ball.y, ball.z)), `${name} ${bone.name}`).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('tube and seg emission paths produce identical bone transforms for the same pose', () => {
    for (const [name, { frame, planSpec }] of fixtureCases()) {
      const spec = planSpec!;
      const built = buildPlanSkeleton(frame, spec);
      const pose = createPlanPoseSink(built);
      const seg = captureSegEmissions(frame, spec, 1, 1.2);
      for (const s of seg.segs) pose.sink.seg(s.id, s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.r0, s.r1);
      for (const b of seg.balls) pose.sink.ball(b.id, b.x, b.y, b.z, b.r);
      pose.finishFrame();
      const segPose = built.bones.map((b) => new Matrix4().copy(b.matrixWorld));

      const built2 = buildPlanSkeleton(frame, spec);
      const pose2 = createPlanPoseSink(built2);
      const tube = captureTubeEmissions(frame, spec, 1, 1.2);
      for (const s of tube.segs) pose2.sink.seg(s.id, s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.r0, s.r1);
      for (const b of tube.balls) pose2.sink.ball(b.id, b.x, b.y, b.z, b.r);
      pose2.finishFrame();

      for (let i = 0; i < built2.bones.length; i++) {
        const a = new Vector3().setFromMatrixPosition(segPose[i]);
        const b = new Vector3().setFromMatrixPosition(built2.bones[i].matrixWorld);
        expect(a.distanceTo(b), `${name} ${built2.bones[i].name}`).toBeLessThan(1e-6);
      }
    }
  });

  it('throws loudly on an emission id with no bone mapping', () => {
    const { frame, planSpec } = compilePlan(PLAN_FIXTURES.centaur);
    const built = buildPlanSkeleton(frame, planSpec!);
    const pose = createPlanPoseSink(built);
    expect(() => pose.sink.seg('mysteryPart.0', 0, 0, 0, 0, 1, 0, 0.1, 0.1)).toThrow(/no bone mapped/);
    expect(() => pose.sink.ball('extraEye', 0, 0, 0, 0.1)).toThrow(/no bone mapped/);
  });
});


