/**
 * @file legs.ts — treadmill leg for externally driven locomotion.
 *
 * The blobfolk prototype pinned feet in WORLD space along its own fixed
 * path. Game entities are moved by outside systems, so legs here run in
 * LOCAL space instead: while a foot is in stance it slides backward at
 * ground speed (which reads as world-pinned once the body moves forward),
 * and in swing it arcs to the next plant. Standing still, stride collapses
 * to zero and feet rest under the hips.
 */
import { Vector3 } from 'three';
import { smooth } from './ik';

export interface LegOptions {
  /** Fraction of the cycle spent planted. */
  duty?: number;
  /** Peak swing lift in meters. */
  liftH?: number;
}

export class TreadmillLeg {
  readonly pos = new Vector3();
  private readonly duty: number;
  private readonly liftH: number;

  constructor(
    private readonly restX: number,
    private readonly restZ: number,
    private readonly phaseOffset: number,
    opts: LegOptions = {},
  ) {
    this.duty = opts.duty ?? 0.62;
    this.liftH = opts.liftH ?? 0.08;
    this.pos.set(restX, 0, restZ);
  }

  /** Advance to the given gait phase. `strideHalfM` = half stride length. */
  update(gaitPhase: number, strideHalfM: number): void {
    const ph = (((gaitPhase + this.phaseOffset) % 1) + 1) % 1;
    if (ph < this.duty) {
      // stance: slide backward under the body at ground speed
      const u = ph / this.duty;
      this.pos.set(this.restX, 0, this.restZ + strideHalfM * (1 - 2 * u));
    } else {
      // swing: arc forward to the next plant
      const u = (ph - this.duty) / (1 - this.duty);
      const s = smooth(u);
      this.pos.set(
        this.restX,
        Math.sin(Math.PI * Math.min(u, 1)) * this.liftH * (strideHalfM > 1e-4 ? 1 : 0),
        this.restZ + strideHalfM * (2 * s - 1),
      );
    }
  }
}
