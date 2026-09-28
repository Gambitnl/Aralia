/**
 * @file gaits/hopperDriver.ts — HopperDriver: the squash/stretch hop cycle
 * with airtime lift and an idle breathing squish.
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
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SegmentSink } from '../../types';
import { smooth } from '../ik';
import { BaseDriver } from './baseDriver';

/* ----------------------------------------------------------------- hopper */

export class HopperDriver extends BaseDriver {
  private hopT = 0;
  private squash = 0;

  protected advance(_t: number, dt: number): void {
    const period = 1.15;
    if (this.speed > 0.01) {
      this.hopT = (this.hopT + dt / period) % 1;
    } else {
      this.hopT = 0;
    }
    const u = this.hopT;
    const AIR0 = 0.38;
    const AIR1 = 0.82;
    let s = 0;
    let air = 0;
    if (this.speed > 0.01) {
      if (u < 0.26) s = smooth(u / 0.26) * 0.38;
      else if (u < AIR0) s = 0.38 - smooth((u - 0.26) / (AIR0 - 0.26)) * 0.75;
      else if (u < AIR1) {
        const v = (u - AIR0) / (AIR1 - AIR0);
        air = Math.sin(Math.PI * v);
        s = -0.32 * (1 - v * 0.6);
      } else {
        const v = (u - AIR1) / (1 - AIR1);
        s = 0.45 * Math.exp(-4 * v) * Math.cos(v * 9);
      }
    } else {
      s = Math.sin(this.t * 2.2) * 0.05; // idle breathing squish
    }
    this.squash = s;
    this.verticalOffsetM = air * this.hM * (0.35 + 0.35 * this.speedFactor);
    const ky = 1 - s * 0.55;
    const headY = this.hM * 0.82 * ky;
    this.setHeadAnchors(0, headY, this.hr * 0.15);
    this.setAnchor('hips', 0, this.hM * 0.3 * ky, 0);
    this.setAnchor('chest', 0, this.hM * 0.55 * ky, this.hM * 0.05);
    this.setAnchor('back', 0, this.hM * 0.6 * ky, -this.hM * 0.12);
    this.setAnchor('tailRoot', 0, this.hM * 0.28 * ky, -this.hM * 0.14);
    for (const sgn of [-1, 1] as const) {
      const lag = Math.sin(this.t * 6 - 1.2) * 0.04 - s * 0.08;
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.28, this.hM * (0.42 + lag) * ky, this.hM * 0.1);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.2, this.hM * 0.18 * ky, 0);
    }
  }

  buildBody(sink: SegmentSink): void {
    const sq = this.squash;
    const ky = 1 - sq * 0.55;
    const kxz = 1 + sq * 0.45;
    const r = this.baseR * 1.25;
    const y = (v: number) => 0.02 + (v - 0.02) * ky;
    // squat torso column: base -> mid -> top (squash via endpoint motion)
    sink.seg('torso.lower', 0, y(this.hM * 0.12), 0, 0, y(this.hM * 0.42), this.hM * 0.01 * kxz, r * 1.05, r * 0.95);
    sink.seg('torso.upper', 0, y(this.hM * 0.42), this.hM * 0.01 * kxz, 0, y(this.hM * 0.66), this.hM * 0.02 * kxz, r * 0.95, r * 0.8);
    sink.ball('head', 0, y(this.hM * 0.82), this.hM * 0.03, this.hr);
    for (const sgn of [-1, 1] as const) {
      const side = sgn < 0 ? 'L' : 'R';
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos;
      sink.seg('arm' + side, sgn * this.hM * 0.2, y(this.hM * 0.5), this.hM * 0.05, hand.x, hand.y, hand.z, r * 0.26, r * 0.2);
      sink.ball('hand' + side, hand.x, hand.y, hand.z, r * 0.28);
    }
  }
}

