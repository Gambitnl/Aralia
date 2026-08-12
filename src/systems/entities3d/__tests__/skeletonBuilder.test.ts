/**
 * @file skeletonBuilder.test.ts — skeleton pivot slice 1: the biped bone
 * hierarchy and its pose adapter must reproduce the segment driver's joints.
 *
 * Parity strategy: the bind pose is defined as the driver's rest state
 * (gaitPhase 0, speed 0), which a real BipedDriver reproduces exactly when
 * stepped with dt = 0 — so every assertion here compares against the live
 * driver, never against copied-out expected numbers.
 */
import { describe, it, expect } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Frame, SegmentSink } from '../types';
import { FT_TO_M, deriveFrame } from '../types';
import { createGaitDriver } from '../three/gaits';
import {
  ARM_LINK_K,
  BIPED_BONE_NAMES,
  BIPED_BONE_PARENT,
  bipedRestPose,
  bipedSkullRadiusM,
  buildBipedSkeleton,
  createBipedPoseSink,
  type BipedBoneName,
} from '../three/skeletonBuilder';

/** 20 deterministic frames spanning gaunt halfling to massive ogre-shaped. */
function frameTable(): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < 18; i++) {
    const heightFt = 2 + ((i * 0.37) % 6);
    const bulk = 0.6 + ((i * 7) % 11) / 10;
    const headScale = 0.8 + ((i * 3) % 7) / 10;
    frames.push(deriveFrame('biped', heightFt, bulk, headScale));
  }
  frames.push(deriveFrame('biped', 2.2, 1.6, 1.5)); // squat big-headed extreme
  frames.push(deriveFrame('biped', 9.5, 0.6, 0.7)); // towering gaunt extreme
  // round 18 (humanoid-anatomy): hunched orc posture — parity must hold with
  // the forward-hunch terms active
  frames.push({ ...deriveFrame('biped', 6.4, 1.375, 1.24), hunch: 0.6 });
  return frames;
}

interface Emitted {
  segs: Array<{ id: string; a: Vector3; b: Vector3; r0: number; r1: number }>;
  balls: Array<{ id: string; center: Vector3; r: number }>;
}

/** Record exactly what the driver emits in one buildBody pass. */
function captureEmissions(frame: Frame, t: number, dt: number, speed: number, steps = 1): Emitted {
  const driver = createGaitDriver('biped', frame);
  const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed };
  for (let k = 0; k < steps; k++) driver.update(t + k * dt, dt, loco);
  const out: Emitted = { segs: [], balls: [] };
  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) =>
      out.segs.push({ id, a: new Vector3(ax, ay, az), b: new Vector3(bx, by, bz), r0, r1 }),
    ball: (id, x, y, z, r) => out.balls.push({ id, center: new Vector3(x, y, z), r }),
  };
  driver.buildBody(sink);
  return out;
}

describe('bipedRestPose — bind pose parity with the live driver at rest', () => {
  it('matches the driver rest emissions (ids, order, endpoints, radii) on all 20 frames', () => {
    for (const frame of frameTable()) {
      const rest = bipedRestPose(frame);
      const live = captureEmissions(frame, 0, 0, 0); // dt 0 → phase 0, bob/sway 0
      expect(rest.segments.map((s) => s.id)).toEqual(live.segs.map((s) => s.id));
      expect(rest.balls.map((b) => b.id)).toEqual(live.balls.map((b) => b.id));
      for (const [i, seg] of rest.segments.entries()) {
        const l = live.segs[i];
        for (const [axis, k] of [
          ['x', 0],
          ['y', 1],
          ['z', 2],
        ] as const) {
          expect(seg.a[k], `${seg.id}.a.${axis}`).toBeCloseTo(l.a[axis], 9);
          expect(seg.b[k], `${seg.id}.b.${axis}`).toBeCloseTo(l.b[axis], 9);
        }
        expect(seg.r0, `${seg.id}.r0`).toBeCloseTo(l.r0, 9);
        expect(seg.r1, `${seg.id}.r1`).toBeCloseTo(l.r1, 9);
      }
      for (const [i, ball] of rest.balls.entries()) {
        const l = live.balls[i];
        expect(ball.center[0], `${ball.id}.x`).toBeCloseTo(l.center.x, 9);
        expect(ball.center[1], `${ball.id}.y`).toBeCloseTo(l.center.y, 9);
        expect(ball.center[2], `${ball.id}.z`).toBeCloseTo(l.center.z, 9);
        expect(ball.r, `${ball.id}.r`).toBeCloseTo(l.r, 9);
      }
    }
  });
});

describe('buildBipedSkeleton — hierarchy and proportions', () => {
  it('builds 17 named bones with the declared parents on all 20 frames', () => {
    for (const frame of frameTable()) {
      const built = buildBipedSkeleton(frame);
      expect(built.bones).toHaveLength(BIPED_BONE_NAMES.length);
      for (const [i, name] of BIPED_BONE_NAMES.entries()) {
        expect(built.bones[i].name).toBe(name);
        const parentName = BIPED_BONE_PARENT[name];
        if (parentName === null) {
          expect(built.bones[i].parent).toBeNull();
        } else {
          expect(built.bones[i].parent?.name).toBe(parentName);
        }
      }
    }
  });

  // round 17 (humanoid-anatomy): arm links are 0.4 armLen (ARM_LINK_K — the
  // hanging-arm fix); legs keep the 0.52 links.
  it('limb bone-to-bone distances equal the driver link lengths (arms 0.4, legs 0.52)', () => {
    for (const frame of frameTable()) {
      const built = buildBipedSkeleton(frame);
      const at = (name: string) => built.bindWorldPos[built.index.get(name as BipedBoneName)!];
      const armLink = frame.armLengthFt * FT_TO_M * ARM_LINK_K;
      const legLink = frame.limbLengthFt * FT_TO_M * 0.52;
      for (const side of ['L', 'R'] as const) {
        expect(at(`upperArm${side}`).distanceTo(at(`foreArm${side}`)), `upper arm ${side}`).toBeCloseTo(armLink, 6);
        expect(at(`foreArm${side}`).distanceTo(at(`hand${side}`)), `forearm ${side}`).toBeCloseTo(armLink, 6);
        expect(at(`thigh${side}`).distanceTo(at(`shin${side}`)), `thigh ${side}`).toBeCloseTo(legLink, 6);
      }
      // pelvis/chest/neck/head follow the driver height ladder
      const legLen = frame.limbLengthFt * FT_TO_M;
      const r = frame.heightFt * FT_TO_M * 0.105 * frame.bulk;
      // round 5 (humanoid-anatomy): upright idle — the pelvis rides at 0.96 of
      // full leg reach (1.04 legLen) plus the hip-socket drop (mirror of
      // bipedRestPose pelvisY)
      const pelvisY = legLen * 1.04 * 0.96 + r * 0.3;
      // round 13 (humanoid-anatomy): pelvis root rises to −0.2 r (the smooth
      // loft rounds a glute tuck below it — the hem-disc is gone)
      expect(at('pelvis').y).toBeCloseTo(pelvisY - r * 0.2, 6);
      // round 3 (humanoid-anatomy): the head rises when the frame leaves no
      // daylight for a neck — min visible neck height hM * 0.04 + skullR * 0.25
      // between the chest top and the skull base (mirror of bipedRestPose)
      // round 6 (humanoid-anatomy): the head ladder runs on the DRAWN skull
      // radius (bipedSkullRadiusM ≤ headRadiusM — slim frames carry a smaller
      // skull), mirroring bipedRestPose headY
      // round 10 (humanoid-anatomy): SEATED head — collar-driven mount. The
      // loft chin (headY − 0.59 skullR) rides a bulk-shrinking neckLift above
      // the chest top (human ≈ 0.46 skullR, orc/dwarf ≈ 0.2); the old hM
      // floor and skull-stack minimum are gone. Mirrors driver + restPose.
      const hM = frame.heightFt * FT_TO_M;
      const skullR = bipedSkullRadiusM(frame);
      const chestTopY = pelvisY + (hM - legLen) * 0.45 + r * 0.35;
      // round 14 (humanoid-anatomy): lift floor 0.26, slope 0.38 — mirror
      const neckLift = Math.min(0.55, Math.max(0.26, 0.46 - 0.38 * Math.max(0, frame.bulk - 1)));
      // round 18 (humanoid-anatomy): the forward hunch settles the head down
      // into the traps (mirror of bipedRestPose headY)
      expect(at('head').y).toBeCloseTo(chestTopY + skullR * (0.59 + neckLift) - skullR * 0.35 * (frame.hunch ?? 0), 6);
      expect(at('chest').y).toBeGreaterThan(at('pelvis').y);
      expect(at('neck').y).toBeGreaterThan(at('chest').y);
      expect(at('head').y).toBeGreaterThan(at('neck').y);
      // stance width carries into the thigh roots
      // round 1 (humanoid-anatomy): stance widened 1.12x, hip roots at 0.85
      // round 2 (humanoid-anatomy): bulk-independent stance floor (hM * 0.089)
      // round 4 (humanoid-anatomy): shoulder-derived stance floor — feet at
      // 68% of the visual shoulder span (deltoid outer edge), planting the
      // legs under the hips instead of under the spine
      // round 20 (humanoid-anatomy): the shoulder-derived floor TIGHTENS with
      // bulk — the round-19 dwarf "bows outward in a straddle so wide he reads
      // as riding an invisible barrel". Mirror: bipedRestPose stanceFloorK.
      const armR = Math.max(r * 0.3, frame.armLengthFt * FT_TO_M * 0.085);
      const stanceFloorK = 0.68 - 0.34 * Math.min(0.5, Math.max(0, frame.bulk - 1));
      const stanceHalf = Math.max(
        ((frame.stanceWidthFt * FT_TO_M) / 2) * 1.12,
        ((frame.shoulderWidthFt * FT_TO_M) / 2 + armR * 1.6) * stanceFloorK,
      );
      expect(at('thighL').x).toBeCloseTo(-stanceHalf * 0.85, 6);
      expect(at('thighR').x).toBeCloseTo(stanceHalf * 0.85, 6);
    }
  });

  it('local transforms recompose into the bind world transforms', () => {
    const frame = deriveFrame('biped', 6, 1, 1);
    const built = buildBipedSkeleton(frame);
    built.root.updateMatrixWorld(true);
    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    for (const [i, bone] of built.bones.entries()) {
      bone.matrixWorld.decompose(pos, quat, scale);
      expect(pos.distanceTo(built.bindWorldPos[i]), `${bone.name} position`).toBeLessThan(1e-9);
      expect(Math.abs(quat.dot(built.bindWorldQuat[i])), `${bone.name} rotation`).toBeCloseTo(1, 9);
      expect(scale.distanceTo(new Vector3(1, 1, 1)), `${bone.name} scale`).toBeLessThan(1e-9);
    }
  });
});

describe('createBipedPoseSink — driver emissions drive the bones', () => {
  /** Where a segment's bind endpoint lands under the current bone transform. */
  function boneMapped(built: ReturnType<typeof buildBipedSkeleton>, boneName: string, bindPoint: Vector3): Vector3 {
    const i = built.index.get(boneName as BipedBoneName)!;
    const bindInverse = new Matrix4()
      .compose(built.bindWorldPos[i], built.bindWorldQuat[i], new Vector3(1, 1, 1))
      .invert();
    return bindPoint.clone().applyMatrix4(bindInverse).applyMatrix4(built.bones[i].matrixWorld);
  }

  it('bind endpoints track the emitted joints within 1e-3 across walk phases', () => {
    for (const frame of [deriveFrame('biped', 6, 1, 1), deriveFrame('biped', 3.1, 1.4, 1.2)]) {
      const built = buildBipedSkeleton(frame);
      const pose = createBipedPoseSink(built);
      const boneOf = Object.fromEntries(
        [...built.restPose.segments.map((s) => [s.id, s.bone]), ...built.restPose.balls.map((b) => [b.id, b.bone])],
      ) as Record<string, string>;
      const bindOf = new Map(built.restPose.segments.map((s) => [s.id, s]));

      // sample 8 phases of a walking cycle, including the driver's first frame
      for (let step = 0; step < 8; step++) {
        const live = captureEmissions(frame, 0, 1 / 30, 1.2, step + 1);
        for (const seg of live.segs) {
          pose.sink.seg(seg.id, seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z, seg.r0, seg.r1);
        }
        for (const ball of live.balls) {
          pose.sink.ball(ball.id, ball.center.x, ball.center.y, ball.center.z, ball.r);
        }
        pose.finishFrame();
        built.root.updateMatrixWorld(true);

        for (const seg of live.segs) {
          const bind = bindOf.get(seg.id)!;
          const a = boneMapped(built, boneOf[seg.id], new Vector3(...bind.a));
          const b = boneMapped(built, boneOf[seg.id], new Vector3(...bind.b));
          expect(a.distanceTo(seg.a), `step ${step} ${seg.id} A`).toBeLessThan(1e-3);
          // Rigid bones keep the BIND length. When IK overstretches a link
          // past it (deep stride pushes a foot slightly out of reach), the
          // cylinder's far end lags by exactly that length difference — and
          // the hand/foot BALL bones still land exactly, hiding the seam.
          // Assert the drift is fully explained by length: position and
          // orientation must contribute nothing.
          const bindLen = new Vector3(...bind.a).distanceTo(new Vector3(...bind.b));
          const liveLen = seg.a.distanceTo(seg.b);
          expect(b.distanceTo(seg.b), `step ${step} ${seg.id} B`).toBeLessThan(Math.abs(liveLen - bindLen) + 1e-3);
        }
        for (const ball of live.balls) {
          const i = built.index.get(boneOf[ball.id] as BipedBoneName)!;
          const p = new Vector3().setFromMatrixPosition(built.bones[i].matrixWorld);
          expect(p.distanceTo(ball.center), `step ${step} ${ball.id}`).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('throws loudly on an emission id with no bone mapping', () => {
    const built = buildBipedSkeleton(deriveFrame('biped', 6, 1, 1));
    const pose = createBipedPoseSink(built);
    expect(() => pose.sink.seg('tailThin:tailThin.0', 0, 0, 0, 0, 1, 0, 0.1, 0.1)).toThrow(/no bone mapped/);
    expect(() => pose.sink.ball('extraEye', 0, 0, 0, 0.1)).toThrow(/no bone mapped/);
  });
});
