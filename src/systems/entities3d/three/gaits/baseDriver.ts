/**
 * @file gaits/baseDriver.ts — BaseDriver, the contract every gait driver
 * extends: cadence/stride math, the update -> advance hand-off, the shared
 * wing-beat helpers and the head-anchor cluster.
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09), verbatim. Kept whole: the
 * subclasses read its protected state (t, speed, speedFactor, hM, hr, baseR,
 * legLenM, frame) across the file boundary, which TypeScript's protected
 * modifier already allows.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits/airborneDriver.ts, systems/entities3d/three/gaits/bipedDriver.ts, systems/entities3d/three/gaits/hopperDriver.ts, systems/entities3d/three/gaits/multiLegDriver.ts, systems/entities3d/three/gaits/planDriver.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Anchor, Frame, SegmentSink } from '../../types';
import { FT_TO_M, headRadiusM, heightM } from '../../types';
import type { GaitDriver, LocomotionState } from './poseUtils';
import { makePose } from './poseUtils';

export abstract class BaseDriver implements GaitDriver {
  readonly pose = makePose();
  gaitPhase = 0;
  flap = 0;
  wingFold = 0;
  verticalOffsetM = 0;
  protected t = 0;
  protected speed = 0;
  protected speedFactor = 0;
  protected gesture: LocomotionState['gesture'];
  protected readonly hM: number;
  protected readonly hr: number;
  protected readonly baseR: number;
  protected readonly legLenM: number;

  constructor(protected readonly frame: Frame) {
    this.hM = heightM(frame);
    this.hr = headRadiusM(frame);
    this.baseR = this.hM * 0.105 * frame.bulk;
    this.legLenM = frame.limbLengthFt * FT_TO_M;
  }

  protected cadence(): number {
    if (this.speed < 0.01) return 1.2;
    return Math.min(1.5 + this.speed / Math.max(this.legLenM, 0.2) / 2.4, 3.0);
  }

  protected strideHalf(): number {
    if (this.speed < 0.01) return 0;
    return Math.min(this.speed / (2 * this.cadence()), this.legLenM * 0.42);
  }

  update(t: number, dt: number, loco: LocomotionState): void {
    this.t = t;
    this.speed = Math.max(0, loco.speed);
    this.speedFactor = Math.min(this.speed / 1.2, 1);
    this.gesture = loco.gesture;
    this.gaitPhase += this.cadence() * Math.max(dt, 0);
    this.advance(t, dt);
  }

  setPhase(phase: number): void {
    this.gaitPhase = ((phase % 1) + 1) % 1;
  }

  /** Per-gait skeleton update; must refresh every pose anchor. */
  protected abstract advance(t: number, dt: number): void;
  abstract buildBody(sink: SegmentSink): void;

  protected setAnchor(a: Anchor, x: number, y: number, z: number): void {
    this.pose.anchors[a].pos.set(x, y, z);
  }

  /** Grounded wing beat: a slow sway at idle that deepens with speed. The
   * flyer's 9 rad/s power stroke stays airborne-only; this is the "alive on
   * the ground" beat for winged walkers (dragon, celestial, fiend, fairy,
   * aarakocra). Drivers without winged profiles leave flap at 0. The formula
   * matches the plan driver's wing beat so both dragon paths move alike. */
  protected groundedWingBeat(): number {
    return Math.sin(this.t * 6) * (0.25 + 0.45 * this.speedFactor);
  }

  /** Rest fold for grounded winged walkers: folded at idle, fully open by
   * ~30% speed. Harmless on wingless bodies (assembler no-ops without
   * wingL/wingR groups). */
  protected groundedWingFold(): number {
    return Math.min(1, Math.max(0, 1 - this.speedFactor * 3.5));
  }

  /** Standard head-cluster anchors around a head center. `r` defaults to the
   * frame head radius; drivers that draw a rescaled skull (BipedDriver round 6)
   * pass their drawn radius so head gear stays glued to the ball. */
  protected setHeadAnchors(hx: number, hy: number, hz: number, r: number = this.hr): void {
    this.setAnchor('head', hx, hy, hz);
    this.setAnchor('crown', hx, hy + r * 0.95, hz - r * 0.1);
    this.setAnchor('jaw', hx, hy - r * 0.55, hz + r * 0.45);
    this.setAnchor('browL', hx - r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('browR', hx + r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('earL', hx - r * 0.95, hy + r * 0.15, hz - r * 0.05);
    this.setAnchor('earR', hx + r * 0.95, hy + r * 0.15, hz - r * 0.05);
  }
}

