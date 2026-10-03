/**
 * @file fabrik.test.ts — proofs for the salvaged chain solver and joint limits.
 *
 * These two modules came out of the retired Creature Lab prototype. The tests
 * here check them against the live rig convention (+Y along the bone), not
 * against the prototype's dead genome types.
 */

import { describe, it, expect } from 'vitest';
import { Bone, Vector3, Quaternion, MathUtils } from 'three';
import { solveFabrik, fabrikChainFromIndices } from '../three/fabrik';
import {
  HingeConstraint,
  BallSocketConstraint,
  PivotConstraint,
  FixedConstraint,
  createJointConstraint,
  enforceAllConstraints,
} from '../three/jointConstraints';

/**
 * Build a straight chain along +Y, each bone `segLen` above its parent, with
 * the root at the origin. This is the same layout `skeletonBuilder` produces.
 */
function makeChain(count: number, segLen: number): Bone[] {
  const bones: Bone[] = [];
  for (let i = 0; i < count; i++) {
    const bone = new Bone();
    bone.name = `bone_${i}`;
    if (i === 0) bone.position.set(0, 0, 0);
    else {
      bone.position.set(0, segLen, 0);
      bones[i - 1].add(bone);
    }
    bones.push(bone);
  }
  bones[0].updateMatrixWorld(true);
  return bones;
}

function tipWorldPos(bones: Bone[]): Vector3 {
  bones[0].updateMatrixWorld(true);
  return bones[bones.length - 1].getWorldPosition(new Vector3());
}

describe('solveFabrik', () => {
  it('reaches a target inside the chain length', () => {
    const bones = makeChain(5, 0.4); // 4 segments, 1.6 m of reach
    const target = new Vector3(0.7, 0.9, 0.3);

    const error = solveFabrik({ bones }, target);

    expect(error).toBeLessThan(0.001);
    expect(tipWorldPos(bones).distanceTo(target)).toBeLessThan(0.01);
  });

  it('reaches a target that requires bending backwards', () => {
    const bones = makeChain(6, 0.3);
    const target = new Vector3(0, -0.6, 0.4);

    const error = solveFabrik({ bones }, target);

    expect(error).toBeLessThan(0.001);
    expect(tipWorldPos(bones).distanceTo(target)).toBeLessThan(0.01);
  });

  it('keeps every segment at its original length', () => {
    const bones = makeChain(5, 0.4);
    solveFabrik({ bones }, new Vector3(1.0, 0.5, -0.4));
    bones[0].updateMatrixWorld(true);

    for (let i = 0; i < bones.length - 1; i++) {
      const a = bones[i].getWorldPosition(new Vector3());
      const b = bones[i + 1].getWorldPosition(new Vector3());
      expect(a.distanceTo(b)).toBeCloseTo(0.4, 5);
    }
  });

  it('does not move the chain root', () => {
    const bones = makeChain(4, 0.5);
    bones[0].position.set(0.2, 1.1, -0.3);
    bones[0].updateMatrixWorld(true);
    const rootBefore = bones[0].getWorldPosition(new Vector3());

    solveFabrik({ bones }, new Vector3(2.0, 0.0, 0.0));

    expect(bones[0].getWorldPosition(new Vector3()).distanceTo(rootBefore)).toBeLessThan(1e-6);
  });

  it('extends toward an out-of-reach target instead of failing', () => {
    const bones = makeChain(4, 0.5); // 1.5 m of reach
    const target = new Vector3(0, 6, 0);

    const error = solveFabrik({ bones }, target);

    // Cannot reach, so the error is the shortfall, and the chain points at it.
    expect(error).toBeGreaterThan(4);
    const tip = tipWorldPos(bones);
    expect(tip.length()).toBeCloseTo(1.5, 2);
    expect(tip.clone().normalize().dot(new Vector3(0, 1, 0))).toBeCloseTo(1, 3);
  });

  it('produces no NaN when the target sits on the root', () => {
    const bones = makeChain(4, 0.5);
    solveFabrik({ bones }, new Vector3(0, 0, 0));
    const tip = tipWorldPos(bones);
    expect(Number.isFinite(tip.x) && Number.isFinite(tip.y) && Number.isFinite(tip.z)).toBe(true);
  });

  it('refuses a chain shorter than two bones', () => {
    expect(solveFabrik({ bones: makeChain(1, 0.4) }, new Vector3(1, 0, 0))).toBe(Infinity);
  });

  it('applies per-bone constraints while solving', () => {
    const bones = makeChain(4, 0.5);
    const restQuats = bones.map((b) => b.quaternion.clone());
    const constraints = [new FixedConstraint(), null, null, null];

    solveFabrik({ bones, constraints, restQuats }, new Vector3(1.2, 0.3, 0));

    // The welded root bone must still sit at its rest rotation.
    expect(bones[0].quaternion.angleTo(restQuats[0])).toBeLessThan(1e-6);
  });

  it('builds a chain from rig bone indices', () => {
    const bones = makeChain(5, 0.4);
    const chain = fabrikChainFromIndices(bones, [1, 2, 3, 4]);
    expect(chain.bones).toHaveLength(4);
    expect(chain.bones[0].name).toBe('bone_1');
    expect(chain.constraints).toBeUndefined();
  });
});

describe('joint constraints', () => {
  const REST = new Quaternion();

  it('clamps a hinge past its maximum', () => {
    const hinge = new HingeConstraint(new Vector3(1, 0, 0), 0, 90);
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(150));

    hinge.enforce(q, REST);

    const angle = 2 * Math.acos(MathUtils.clamp(q.w, -1, 1));
    expect(MathUtils.radToDeg(angle)).toBeCloseTo(90, 1);
  });

  it('stops a hinge bending the wrong way', () => {
    const hinge = new HingeConstraint(new Vector3(1, 0, 0), 0, 130);
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(-60));

    hinge.enforce(q, REST);

    // A knee cannot go negative — it must snap back to straight.
    expect(q.angleTo(REST)).toBeLessThan(1e-6);
  });

  it('leaves a hinge inside its range alone', () => {
    const hinge = new HingeConstraint(new Vector3(1, 0, 0), 0, 130);
    const wanted = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(45));
    const q = wanted.clone();

    hinge.enforce(q, REST);

    expect(q.angleTo(wanted)).toBeLessThan(1e-5);
  });

  it('clamps a ball-and-socket swing to its cone', () => {
    const ball = new BallSocketConstraint(45, -30, 30);
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(120));

    ball.enforce(q, REST);

    const swung = new Vector3(0, 1, 0).applyQuaternion(q);
    const swingDeg = MathUtils.radToDeg(swung.angleTo(new Vector3(0, 1, 0)));
    expect(swingDeg).toBeLessThanOrEqual(45.5);
  });

  it('clamps a pivot twist about the bone axis', () => {
    const pivot = new PivotConstraint(-40, 40);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(90));

    pivot.enforce(q, REST);

    const angle = MathUtils.radToDeg(2 * Math.acos(MathUtils.clamp(q.w, -1, 1)));
    expect(angle).toBeCloseTo(40, 1);
  });

  it('welds a fixed joint back to rest', () => {
    const rest = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.3);
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2);

    new FixedConstraint().enforce(q, rest);

    expect(q.angleTo(rest)).toBeLessThan(1e-6);
  });

  it('leaves a joint free when stiffness is not set', () => {
    // The prototype defaulted stiffness to 0.5, which silently halved every
    // solver result. The default is now 0.
    const hinge = createJointConstraint({ type: 'hinge', minDeg: 0, maxDeg: 130 });
    const wanted = new Quaternion().setFromAxisAngle(new Vector3(-1, 0, 0), MathUtils.degToRad(60));
    const q = wanted.clone();

    hinge.enforce(q, REST);

    expect(q.angleTo(wanted)).toBeLessThan(1e-5);
  });

  it('pulls toward mid-range when stiffness is set', () => {
    const hinge = new HingeConstraint(new Vector3(1, 0, 0), 0, 90, 1);
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(80));

    hinge.enforce(q, REST);

    const angle = MathUtils.radToDeg(2 * Math.acos(MathUtils.clamp(q.w, -1, 1)));
    expect(angle).toBeCloseTo(45, 1);
  });

  it('builds every joint type from a spec', () => {
    expect(createJointConstraint({ type: 'hinge' }).type).toBe('hinge');
    expect(createJointConstraint({ type: 'ball_and_socket' }).type).toBe('ball_and_socket');
    expect(createJointConstraint({ type: 'saddle' }).type).toBe('saddle');
    expect(createJointConstraint({ type: 'pivot' }).type).toBe('pivot');
    expect(createJointConstraint({ type: 'fixed' }).type).toBe('fixed');
  });

  it('enforces a whole rig in one pass and skips free bones', () => {
    const bones = makeChain(3, 0.4);
    const restQuats = bones.map((b) => b.quaternion.clone());
    const moved = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.0);
    bones.forEach((b) => b.quaternion.copy(moved));

    enforceAllConstraints(bones, new Map([[1, new FixedConstraint()]]), restQuats);

    expect(bones[1].quaternion.angleTo(restQuats[1])).toBeLessThan(1e-6);
    expect(bones[0].quaternion.angleTo(moved)).toBeLessThan(1e-6);
    expect(bones[2].quaternion.angleTo(moved)).toBeLessThan(1e-6);
  });
});
