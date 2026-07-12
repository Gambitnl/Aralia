/**
 * @file gaits.test.ts — IK correctness and gait driver behavior (pure math,
 * no renderer).
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { solveKnee } from '../three/ik';
import { createGaitDriver } from '../three/gaits';
import type { LocomotionState } from '../three/gaits';
import type { BallSink, Frame, Gait } from '../types';
import { ANCHORS, deriveFrame } from '../types';

const FRAME: Frame = deriveFrame('biped', 5.5, 1, 1);

function loco(speed: number): LocomotionState {
  return { position: new Vector3(), heading: new Vector3(0, 0, 1), speed };
}

class RecordingSink implements BallSink {
  balls: Array<{ x: number; y: number; z: number; r: number }> = [];
  ball(x: number, y: number, z: number, r: number): void {
    this.balls.push({ x, y, z, r });
  }
}

describe('solveKnee (two-bone IK)', () => {
  it('places the knee at l1 from the hip and l2 from the foot for reachable targets', () => {
    const hip = new Vector3(0, 1, 0);
    const foot = new Vector3(0.1, 0.2, 0.15);
    const out = new Vector3();
    solveKnee(hip, foot, 0.45, 0.45, new Vector3(0, 0, 1), out);
    expect(Math.abs(out.distanceTo(hip) - 0.45)).toBeLessThan(1e-4);
    expect(Math.abs(out.distanceTo(foot) - 0.45)).toBeLessThan(1e-4);
  });

  it('clamps at full extension instead of producing NaN', () => {
    const hip = new Vector3(0, 1, 0);
    const foot = new Vector3(0, -2, 0); // unreachable
    const out = new Vector3();
    solveKnee(hip, foot, 0.4, 0.4, new Vector3(0, 0, 1), out);
    expect(Number.isFinite(out.x + out.y + out.z)).toBe(true);
    expect(out.distanceTo(hip)).toBeLessThanOrEqual(0.4 + 1e-3);
  });
});

describe('gait drivers', () => {
  const GAITS: Gait[] = ['biped', 'quad', 'hexapod', 'hopper', 'flyer', 'float'];

  it('every gait exposes every anchor with finite positions', () => {
    for (const gait of GAITS) {
      const frame = deriveFrame(gait, 5.5, 1, 1);
      const driver = createGaitDriver(gait, frame);
      driver.update(0.5, 1 / 60, loco(1));
      for (const anchor of ANCHORS) {
        const p = driver.pose.anchors[anchor].pos;
        expect(
          Number.isFinite(p.x + p.y + p.z),
          `${gait} anchor "${anchor}" is not finite`,
        ).toBe(true);
      }
    }
  });

  it('every gait builds a body of at least 5 finite balls', () => {
    for (const gait of GAITS) {
      const frame = deriveFrame(gait, 5.5, 1, 1);
      const driver = createGaitDriver(gait, frame);
      driver.update(0.3, 1 / 60, loco(1));
      const sink = new RecordingSink();
      driver.buildBody(sink);
      expect(sink.balls.length, `${gait} body too sparse`).toBeGreaterThan(4);
      for (const b of sink.balls) {
        expect(Number.isFinite(b.x + b.y + b.z + b.r), `${gait} emitted NaN ball`).toBe(true);
        expect(b.r).toBeGreaterThan(0);
      }
    }
  });

  it('biped: head sits above the hips', () => {
    const driver = createGaitDriver('biped', FRAME);
    driver.update(0, 1 / 60, loco(0));
    expect(driver.pose.anchors.head.pos.y).toBeGreaterThan(driver.pose.anchors.hips.pos.y);
  });

  it('biped: arms swing while walking', () => {
    const driver = createGaitDriver('biped', FRAME);
    driver.update(0, 1 / 60, loco(1.2));
    const early = driver.pose.anchors.handR.pos.z;
    for (let t = 1 / 60; t < 0.42; t += 1 / 60) {
      driver.update(t, 1 / 60, loco(1.2));
    }
    const later = driver.pose.anchors.handR.pos.z;
    expect(Math.abs(later - early)).toBeGreaterThan(0.02);
  });

  it('biped: standing still keeps hands near the sides (no phantom stride)', () => {
    const driver = createGaitDriver('biped', FRAME);
    let maxSwing = 0;
    for (let t = 0; t < 2; t += 1 / 30) {
      driver.update(t, 1 / 30, loco(0));
      maxSwing = Math.max(maxSwing, Math.abs(driver.pose.anchors.handR.pos.z));
    }
    expect(maxSwing).toBeLessThan(0.12);
  });

  it('hopper: leaves the ground during the airborne window', () => {
    const driver = createGaitDriver('hopper', deriveFrame('hopper', 5.5, 1.3, 0.9));
    let maxAir = 0;
    let minAir = Infinity;
    for (let t = 0; t < 3; t += 1 / 60) {
      driver.update(t, 1 / 60, loco(0.8));
      maxAir = Math.max(maxAir, driver.verticalOffsetM);
      minAir = Math.min(minAir, driver.verticalOffsetM);
    }
    expect(maxAir).toBeGreaterThan(0.15);
    expect(minAir).toBeGreaterThanOrEqual(0);
  });

  it('flyer: hovers above the ground and flaps; float: hovers without flapping', () => {
    const flyer = createGaitDriver('flyer', deriveFrame('flyer', 4, 1, 1));
    flyer.update(0.4, 1 / 60, loco(1));
    expect(flyer.verticalOffsetM).toBeGreaterThan(0.3);
    expect(Math.abs(flyer.flap)).toBeGreaterThan(0);
    const floater = createGaitDriver('float', deriveFrame('float', 4, 1.2, 1.4));
    floater.update(0.4, 1 / 60, loco(0.5));
    expect(floater.verticalOffsetM).toBeGreaterThan(0.2);
    expect(floater.flap).toBe(0);
  });

  it('gait phase advances with time while moving', () => {
    const driver = createGaitDriver('quad', deriveFrame('quad', 3.3, 1, 1));
    driver.update(0.1, 1 / 60, loco(1));
    const p1 = driver.gaitPhase;
    driver.update(0.4, 1 / 60, loco(1));
    expect(driver.gaitPhase).toBeGreaterThan(p1);
  });
});
