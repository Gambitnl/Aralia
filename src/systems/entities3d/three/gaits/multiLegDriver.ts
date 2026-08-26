/**
 * @file gaits/multiLegDriver.ts — MultiLegDriver, the quadruped and hexapod
 * walker (one class, `isHexa` selects the leg layout and tripod gait).
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09), verbatim.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Frame, SegmentSink } from '../../types';
import { FT_TO_M } from '../../types';
import { solveKnee } from '../ik';
import { TreadmillLeg } from '../legs';
import { BaseDriver } from './baseDriver';
import { V_BEND, V_HAND, V_HIP, V_KNEE } from './poseUtils';

/* ------------------------------------------------------- quad + hexapod */

export class MultiLegDriver extends BaseDriver {
  private readonly legs: TreadmillLeg[] = [];
  private readonly legAnchorsX: number[] = [];
  private readonly legAnchorsZ: number[] = [];
  private bodyY = 0;
  private bob = 0;
  private readonly bodyLen: number;
  private readonly isHexa: boolean;

  constructor(frame: Frame, isHexa: boolean) {
    super(frame);
    this.isHexa = isHexa;
    this.bodyLen = this.hM * 1.5;
    const stance = (frame.stanceWidthFt * FT_TO_M) / 2;
    if (isHexa) {
      const zs = [this.bodyLen * 0.32, 0, -this.bodyLen * 0.32];
      for (let i = 0; i < 3; i++) {
        for (const sgn of [-1, 1] as const) {
          const phase = ((i + (sgn > 0 ? 1 : 0)) % 2) * 0.5; // tripod gait
          this.legs.push(new TreadmillLeg(sgn * stance, zs[i], phase, { duty: 0.55, liftH: this.hM * 0.07 }));
          this.legAnchorsX.push(sgn * stance * 0.4);
          this.legAnchorsZ.push(zs[i]);
        }
      }
    } else {
      const zf = this.bodyLen * 0.36;
      const zb = -this.bodyLen * 0.36;
      const defs: Array<[number, number, number]> = [
        [-stance, zf, 0],
        [stance, zb, 0],
        [stance, zf, 0.5],
        [-stance, zb, 0.5],
      ];
      for (const [x, z, phase] of defs) {
        this.legs.push(new TreadmillLeg(x, z, phase, { liftH: this.hM * 0.08 }));
        this.legAnchorsX.push(x * 0.75);
        this.legAnchorsZ.push(z * 0.95);
      }
    }
  }

  protected advance(): void {
    const stride = this.strideHalf();
    for (const leg of this.legs) leg.update(this.gaitPhase, stride);
    // grounded wing beat (the quad dragon carries membrane wing parts)
    this.flap = this.groundedWingBeat();
    this.wingFold = this.groundedWingFold();
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.02;
    this.bodyY = this.hM * (this.isHexa ? 0.55 : 0.8) + this.bob;
    const headZ = this.bodyLen * 0.55;
    const headY = this.bodyY + this.hM * (this.isHexa ? 0.15 : 0.35);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.bodyY + this.baseR * 0.4, this.bodyLen * 0.3);
    this.setAnchor('back', 0, this.bodyY + this.baseR * 0.75, 0);
    this.setAnchor('hips', 0, this.bodyY, -this.bodyLen * 0.3);
    this.setAnchor('tailRoot', 0, this.bodyY + this.baseR * 0.2, -this.bodyLen * 0.48);
    this.setAnchor('handL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('handR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('hipL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
    this.setAnchor('hipR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR * (this.isHexa ? 0.85 : 1);
    // spine: rear -> mid -> front (horizontal body)
    sink.seg('spine.rear', 0, this.bodyY, -this.bodyLen * 0.33, 0, this.bodyY + this.hM * 0.02, 0, r * 0.95, r);
    sink.seg('spine.front', 0, this.bodyY + this.hM * 0.02, 0, 0, this.bodyY + this.hM * 0.04, this.bodyLen * 0.33, r, r * 0.85);
    const head = this.pose.anchors.head.pos;
    sink.seg('neck', 0, this.bodyY + this.hM * 0.05, this.bodyLen * 0.32, head.x, head.y - this.hr * 0.4, head.z - this.hr * 0.3, r * 0.5, r * 0.38);
    sink.ball('head', head.x, head.y, head.z, this.hr);
    const legR = Math.max(r * (this.isHexa ? 0.24 : 0.3), this.legLenM * (this.isHexa ? 0.06 : 0.09));
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      V_HIP.set(this.legAnchorsX[i], this.bodyY - r * 0.1, this.legAnchorsZ[i]);
      V_BEND.set(this.isHexa ? Math.sign(this.legAnchorsX[i]) : 0, this.isHexa ? 0.9 : 0, this.legAnchorsZ[i] >= 0 ? 1 : -1).normalize();
      const l = this.legLenM * 0.55;
      solveKnee(V_HIP, V_HAND.copy(leg.pos), l, l, V_BEND, V_KNEE);
      sink.seg('leg' + i + '.upper', V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, legR, legR * 0.85);
      sink.seg('leg' + i + '.lower', V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, legR * 0.85, legR * 0.6);
      sink.ball('foot' + i, leg.pos.x, leg.pos.y + legR * 0.3, leg.pos.z + legR * 0.3, legR * 0.8);
    }
  }
}

